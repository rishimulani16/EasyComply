# 📋 PRODUCT REQUIREMENTS DOCUMENT (PRD)
## EZ Compliance Tracker — MVP v1.0
**Version:** 1.0 | **Date:** Feb 2026 | **Author:** Founder | **Status:** MVP Build

---

## 1. PRODUCT OVERVIEW

**Product Name:** EZ Compliance Tracker  
**One-Line Pitch:** A SaaS compliance management platform that automatically identifies, tracks, and verifies all legal compliance requirements for Indian companies — based on their industry, state, employee count, and company type.

**Problem Statement:** Indian startups (especially AI/Tech/Transport) miss compliance deadlines due to scattered information, expensive legal retainers, and no centralized tracking system. Missed deadlines lead to fines up to ₹250 Crore (DPDP Act).

**Solution:** A role-based dashboard that auto-maps applicable compliance rules from a predefined PostgreSQL database, tracks deadlines, and uses OCR to verify uploaded documents.

---

## 2. TARGET USERS (MVP SCOPE)

| User | Description |
|:---|:---|
| **Developer/Owner** | Platform owner — manages rules, views all subscribed companies |
| **Company Admin** | Client company's compliance officer — manages their company's rules and uploads |

---

## 3. MVP SCOPE

**In Scope:**
- 2 Industries: AI/IT + Transport
- 4 States: Gujarat, Maharashtra, Rajasthan, Goa
- 2 Company Types: Pvt Ltd + Public Ltd
- ~45 pre-loaded compliance rules
- 2 Subscription Plans: Basic + Enterprise
- Document Upload with OCR keyword verification (Tesseract OCR)
- Role-based login: Developer + Company Admin (JWT Auth via Supabase)

**Out of Scope (Post-MVP / Future):**
- Auditor panel
- Mobile app
- Government portal integration
- Auto-filing of returns
- Payment gateway (manual invoicing for MVP)
- File Storage: AWS S3 or Cloudinary
- Email Alerts: SendGrid or SMTP
- Hosting: Railway.app or Render.com

---

## 4. TECH STACK

| Layer | Technology |
|:---|:---|
| **Frontend** | React.js |
| **Backend** | Python — FastAPI |
| **Database** | PostgreSQL |
| **Authentication** | JWT Tokens + Supabase Auth |
| **OCR** | Tesseract OCR (free, open source) |
| **File Storage** | Local storage for MVP (S3/Cloudinary in future) |
| **Email Alerts** | Not in MVP (SendGrid/SMTP in future) |
| **Hosting** | Local/localhost for MVP (Railway.app or Render.com in future) |

---

## 5. USER ROLES & PERMISSIONS

| Feature | Developer/Owner | Company Admin |
|:---|:---|:---|
| Add / Edit / Delete Rules in DB | ✅ | ❌ |
| View all subscribed companies | ✅ | ❌ |
| View own company dashboard | ❌ | ✅ |
| Upload compliance documents | ❌ | ✅ |
| View OCR verification result | ❌ | ✅ |
| Edit company profile | ❌ | ✅ |

---

## 6. AUTHENTICATION FLOW

```
[Login Page]
  ↓ Enter Email + Password
  ↓ Supabase Auth validates credentials
  ↓ Backend checks: users table → role column
  ↓ JWT Token issued with role embedded
  ↓
  IF role = 'developer'  → Developer Panel
  IF role = 'company'    → Company Admin Panel
```

**Users Table (PostgreSQL):**
```sql
CREATE TABLE users (
    user_id       SERIAL PRIMARY KEY,
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role          VARCHAR(20) CHECK (role IN ('developer', 'company')),
    company_id    INT REFERENCES companies(company_id),
    created_at    TIMESTAMP DEFAULT NOW()
);
```

---

## 7. DATABASE SCHEMA (PostgreSQL)

### Table 1: compliance_rules
```sql
CREATE TABLE compliance_rules (
    rule_id           SERIAL PRIMARY KEY,
    rule_name         VARCHAR(255) NOT NULL,
    description       TEXT,
    industry_type     TEXT[]  DEFAULT ARRAY['ALL'],
    applicable_states TEXT[]  DEFAULT ARRAY['ALL'],
    company_type      TEXT[]  DEFAULT ARRAY['ALL'],
    min_employees     INT     DEFAULT 0,
    max_employees     INT     DEFAULT 999999,
    frequency_months  INT     NOT NULL,
    document_required BOOLEAN DEFAULT FALSE,
    penalty_amount    VARCHAR(255),
    penalty_impact    VARCHAR(20) CHECK (penalty_impact IN ('Imprisonment', 'High', 'Medium', 'Low')),
    is_active         BOOLEAN DEFAULT TRUE
);
```

### Table 2: companies
```sql
CREATE TABLE companies (
    company_id      SERIAL PRIMARY KEY,
    company_name    VARCHAR(255) NOT NULL,
    industry_type   TEXT[],
    company_type    TEXT[],
    hq_state        VARCHAR(50),
    branch_states   TEXT[],
    employee_count  INT,
    subscription    VARCHAR(20) CHECK (subscription IN ('Basic', 'Enterprise')),
    created_at      TIMESTAMP DEFAULT NOW()
);
```

### Table 3: users
```sql
CREATE TABLE users (
    user_id       SERIAL PRIMARY KEY,
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role          VARCHAR(20) CHECK (role IN ('developer', 'company')),
    company_id    INT REFERENCES companies(company_id),
    created_at    TIMESTAMP DEFAULT NOW()
);
```

### Table 4: compliance_calendar
```sql
CREATE TABLE compliance_calendar (
    calendar_id     SERIAL PRIMARY KEY,
    company_id      INT REFERENCES companies(company_id),
    rule_id         INT REFERENCES compliance_rules(rule_id),
    branch_state    VARCHAR(50),
    due_date        DATE,
    status          VARCHAR(20) DEFAULT 'PENDING'
                    CHECK (status IN ('PENDING', 'COMPLETED', 'OVERDUE', 'OVERDUE-PASS', 'FAILED')),
    document_url    VARCHAR(500),
    ocr_verified    BOOLEAN DEFAULT FALSE,
    ocr_result      TEXT,
    verified_at     TIMESTAMP,
    next_due_date   DATE
);
```

### Table 5: audit_log
```sql
CREATE TABLE audit_log (
    log_id      SERIAL PRIMARY KEY,
    action      VARCHAR(20) CHECK (action IN ('ADD', 'UPDATE', 'DELETE')),
    table_name  VARCHAR(50),
    rule_id     INT,
    changed_by  VARCHAR(100),
    changed_at  TIMESTAMP DEFAULT NOW(),
    old_value   JSONB,
    new_value   JSONB
);
```

---

## 8. AUTO-MATCHING QUERY

Runs at company signup. Extracts all applicable rules based on company profile:

```sql
SELECT rule_id, rule_name, frequency_months, document_required
FROM compliance_rules
WHERE
    (industry_type && ARRAY['AI','IT'] OR industry_type = ARRAY['ALL'])
    AND
    (applicable_states && ARRAY['Gujarat','Maharashtra'] OR applicable_states = ARRAY['ALL'])
    AND
    (company_type && ARRAY['Pvt Ltd'] OR company_type = ARRAY['ALL'])
    AND
    (min_employees <= 50 AND max_employees >= 50)
    AND
    is_active = TRUE;
```

> Replace array values with actual company inputs at runtime.

---

## 9. BACKEND API ENDPOINTS (FastAPI)

| Method | Endpoint | Role | Description |
|:---|:---|:---|:---|
| POST | `/auth/login` | All | Login, returns JWT with role |
| POST | `/company/signup` | Company | Register company, triggers auto-match |
| GET | `/company/dashboard` | Company | Returns all matched rules with status |
| POST | `/compliance/upload` | Company | Upload document, runs OCR, updates status |
| GET | `/developer/companies` | Developer | Returns all subscribed companies |
| POST | `/developer/rules` | Developer | Add new rule to DB |
| PUT | `/developer/rules/{id}` | Developer | Update existing rule |
| DELETE | `/developer/rules/{id}` | Developer | Soft-delete rule (is_active = FALSE) |

---

## 10. DEVELOPER PANEL — UI SCREENS

### Screen D1: Company Subscription Dashboard
Displays all onboarded companies:

| Column | Detail |
|:---|:---|
| Company Name | Clickable to view details |
| Industry | AI / IT / Transport |
| State(s) | Gujarat, Maharashtra... |
| Employees | Number |
| Plan | 🟢 Basic / 🟡 Enterprise |
| Status | Active / Expired |
| Joined Date | Timestamp |

### Screen D2: Compliance Rule Manager (CRUD Form)

```
rule_name         → Text Input             [required]
description       → Text Area              [required]
industry_type     → Multi-Select Checkbox  [AI / IT / Transport / ALL]
applicable_states → Multi-Select Checkbox  [Gujarat / Maharashtra / Rajasthan / Goa / ALL]
company_type      → Multi-Select Checkbox  [Pvt Ltd / Public Ltd / ALL]
min_employees     → Number Input           [default: 0]
max_employees     → Number Input           [default: 999999]
frequency_months  → Number Input           [1=Monthly, 3=Quarterly, 6=Half-Yearly, 12=Annual]
document_required → Toggle                 [Yes / No]
penalty_amount    → Text Input             [e.g., "Up to ₹250 Crore"]
penalty_impact    → Dropdown               [Imprisonment / High / Medium / Low]
is_active         → Toggle                 [Yes / No — soft delete]
```

---

## 11. COMPANY ADMIN PANEL — UI SCREENS

### Screen C1: Onboarding / Signup (Multi-Step, First Time Only)

```
Step 1: Account Setup
  → Company Name, Admin Email, Password

Step 2: Company Profile
  → Industry Type      [Multi-Select: AI / IT / Transport]
  → Company Type       [Pvt Ltd / Public Ltd]
  → No. of Employees   [Number Input]
  → HQ State           [Dropdown: Gujarat / Maharashtra / Rajasthan / Goa]
  → Subscription Plan  [Basic / Enterprise]

Step 3 (Enterprise Only): Branch Locations
  → Branch 1: State + City
  → Branch 2: State + City
  → [ + Add More ]

Step 4: Auto-Matching fires in backend
  → PostgreSQL query runs
  → Matching rules extracted
  → compliance_calendar populated
  → Default status = PENDING for all rules

Step 5: Redirect to Company Dashboard
```

### Screen C2: Compliance Dashboard (Main Screen)

**Top Summary Bar:**
```
Total Rules: 45 | ✅ Completed: 12 | ⏳ Pending: 25 | ❌ Overdue: 8
```

**Compliance Table (Sorted: Nearest Due Date First):**

| Rule Name | Frequency | Due Date | Scope | Status | Action |
|:---|:---|:---|:---|:---|:---|
| GST Return | Monthly | 20 Feb 2026 | Company | ⏳ PENDING | [Upload] |
| PF Return | Monthly | 15 Feb 2026 | Company | ❌ OVERDUE | [Upload] |
| Gujarat Shop Act | Annual | 31 Mar 2026 | Branch 1 | ✅ DONE | [View] |
| DPDP Annual Audit | Annual | 31 Mar 2026 | Company | ⏳ PENDING | [Upload] |

**Status Color Logic:**
```
✅ GREEN  → Uploaded + OCR verified + Due date not passed
⏳ YELLOW → Due within 30 days, not yet uploaded
❌ RED    → Due date passed, no verified document
🟡 AMBER  → Late upload but content is valid (OVERDUE-PASS)
```

### Screen C3: Document Upload + OCR Verification

```
[Click Upload Button on any rule]
  ↓
Upload PDF / Image
  ↓
Backend: Tesseract OCR extracts text from document
  ↓
System checks for required keywords in extracted text
  ↓
System extracts renewal/valid date from document
  ↓
  IF keywords found + date valid:
    → status = COMPLETED
    → next_due = renewal_date + frequency_months
    → Dashboard shows ✅ GREEN

  IF keywords missing:
    → status = FAILED
    → Shows violations: "Missing: consent clause"
    → Dashboard shows ❌ RED — Re-upload required

  IF valid content but uploaded after renewal date:
    → status = OVERDUE-PASS
    → Dashboard shows 🟡 AMBER — Late upload note
```

---

## 12. SUBSCRIPTION PLANS

| Feature | Basic | Enterprise |
|:---|:---|:---|
| Industries | 1 | Multiple |
| Locations | 1 (HQ only) | Multiple branches |
| Rules Tracked | ~30 | ~100+ |
| Branch-Level Documents | ❌ | ✅ |
| Suggested MVP Price | ₹2,999/month | ₹9,999/month |

---

## 13. DOCUMENT SCOPE LOGIC

| Rule Type | Scope | Upload Requirement |
|:---|:---|:---|
| DPDP Policy, Privacy Policy | Company-Level | Upload ONCE for all branches |
| Gujarat Shop Act License | Branch-Level | Upload SEPARATELY per branch |
| GST Return | Company-Level | Upload ONCE |
| Vehicle Permit | Branch-Level | Upload per vehicle/branch |

> Rule in `compliance_rules` table has a `scope` field:  
> `Company` = 1 upload for all | `Branch` = 1 upload per branch location

---

## 14. MVP BUILD ORDER (Step-by-Step)

### Week 1: Database Setup
- [ ] Install PostgreSQL locally
- [ ] Create all 5 tables (compliance_rules, companies, users, compliance_calendar, audit_log)
- [ ] Insert ~45 compliance rules manually via SQL INSERT statements
- [ ] Verify auto-matching query works with test inputs

### Week 2: Backend (FastAPI)
- [ ] Setup FastAPI project with folder structure
- [ ] Connect FastAPI to PostgreSQL (asyncpg or psycopg2)
- [ ] Integrate Supabase Auth for JWT token generation
- [ ] Build all 8 API endpoints listed in Section 9
- [ ] Implement auto-matching logic on `/company/signup`
- [ ] Implement Tesseract OCR on `/compliance/upload`
- [ ] Add audit log writes on every rule CRUD operation

### Week 3: Frontend (React.js)
- [ ] Setup React project (Vite or CRA)
- [ ] Login Page with role-based redirect
- [ ] Developer Panel: Company list table (Screen D1)
- [ ] Developer Panel: Rule CRUD form (Screen D2)
- [ ] Company Onboarding: Multi-step signup form (Screen C1)
- [ ] Company Dashboard: Compliance table with status colors (Screen C2)
- [ ] Document Upload Modal + OCR result display (Screen C3)

### Week 4: Integration + Demo Polish
- [ ] Connect all frontend screens to FastAPI endpoints
- [ ] Test auto-matching for 2 demo companies
  - Demo 1: AI company, Gujarat, Pvt Ltd, 50 employees (Basic)
  - Demo 2: Transport company, Maharashtra + Goa, Pvt Ltd, 120 employees (Enterprise)
- [ ] Verify OCR pass/fail/overdue-pass flows work end-to-end
- [ ] Fix all bugs from integration testing
- [ ] Prepare 5-minute demo walkthrough script

---

## 15. DEMO SUCCESS CHECKLIST

- [ ] Developer logs in → sees subscribed companies list
- [ ] Developer adds a new rule via UI form in under 2 minutes
- [ ] AI company in Gujarat signs up → sees exactly their applicable rules
- [ ] Transport company in Maharashtra sees different rules from AI company
- [ ] Company uploads a PDF → OCR runs → shows PASS or FAIL within 10 seconds
- [ ] Overdue rules show RED status on dashboard
- [ ] Basic plan company cannot see multi-branch features

---

*EZ Compliance Tracker — PRD v1.0 | Ready for MVP Build*
