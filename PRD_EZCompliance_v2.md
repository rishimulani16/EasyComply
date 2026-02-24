# 📋 PRODUCT REQUIREMENTS DOCUMENT (PRD)
## EZ Compliance Tracker — MVP v2.0
**Version:** 2.0 | **Date:** Feb 2026 | **Author:** Founder | **Status:** MVP Build

---

## 1. PRODUCT OVERVIEW

**Product Name:** EZ Compliance Tracker
**One-Line Pitch:** A SaaS compliance management platform that automatically identifies, tracks, and verifies all legal compliance requirements for Indian companies — based on their industry, state, employee count, and company type.

**Problem Statement:** Indian startups (especially AI/Tech/Transport) miss compliance deadlines due to scattered information, expensive legal retainers, and no centralized tracking system. Missed deadlines lead to fines up to ₹250 Crore (DPDP Act).

**Solution:** A role-based dashboard (Developer + Company Admin + Auditor) that auto-maps applicable compliance rules from a predefined PostgreSQL database, tracks deadlines, stores versioned documents on AWS S3, uses OCR to verify uploaded documents, and provides auditors a read-only view with flagging capability.

---

## 2. TARGET USERS (MVP SCOPE)

| User | Description |
|:---|:---|
| **Developer/Owner** | Platform owner — manages rules, views all subscribed companies, emergency delete |
| **Company Admin** | Client company's compliance officer — uploads docs, manages dashboard |
| **Auditor** | External CA/auditor — read-only view of company's compliance + flag suspicious docs |

---

## 3. MVP SCOPE

**In Scope:**
- 2 Industries: AI/IT + Transport
- 4 States: Gujarat, Maharashtra, Rajasthan, Goa
- 2 Company Types: Pvt Ltd + Public Ltd
- ~45 pre-loaded compliance rules
- 2 Subscription Plans: Basic + Enterprise
- Document Upload with OCR keyword verification (Tesseract OCR)
- AWS S3 for versioned document storage (private bucket + presigned URLs)
- Document version history for full audit trail
- 3 Role-based panels: Developer + Company Admin + Auditor (JWT Auth via Supabase)
- Compliance Score + Risk Score (weighted by penalty impact)
- Auditor invite system (Company Admin invites auditor by email)
- Auditor document flagging (Flag suspicious docs without deleting)

**Out of Scope (Post-MVP / Future):**
- Mobile app
- Government portal integration
- Auto-filing of returns
- Payment gateway (manual invoicing for MVP)
- Email Alerts: SendGrid or SMTP
- RAG Chatbot (pgvector + LangChain)
- Hosting: Railway.app or Render.com

---

## 4. TECH STACK

| Layer | Technology |
|:---|:---|
| **Frontend** | React.js (Vite) |
| **Backend** | Python — FastAPI |
| **Database** | PostgreSQL |
| **Authentication** | JWT Tokens + Supabase Auth |
| **OCR** | Tesseract OCR (free, open source) |
| **File Storage** | AWS S3 (private bucket, Mumbai region ap-south-1) |
| **S3 SDK** | boto3 (Python) |
| **Email Alerts** | Not in MVP (SendGrid/SMTP in future) |
| **Hosting** | Local/localhost for MVP (Railway.app or Render.com in future) |

---

## 5. USER ROLES & PERMISSIONS

| Feature | Developer | Company Admin | Auditor |
|:---|:---|:---|:---|
| Add / Edit / Delete Rules in DB | ✅ | ❌ | ❌ |
| View all subscribed companies | ✅ | ❌ | ❌ |
| View own company dashboard | ❌ | ✅ | ✅ (read-only) |
| Upload compliance documents | ❌ | ✅ | ❌ |
| View OCR verification result | ❌ | ✅ | ✅ |
| View document version history | ❌ | ✅ | ✅ |
| Download any doc version from S3 | ❌ | ✅ | ✅ |
| Flag a document as suspicious | ❌ | ❌ | ✅ |
| Resolve a flag | ❌ | ✅ | ❌ |
| Invite auditor | ❌ | ✅ | ❌ |
| Delete document from S3 (emergency) | ✅ | ❌ | ❌ |
| View compliance score + risk score | ❌ | ✅ | ✅ |
| Edit company profile | ❌ | ✅ | ❌ |

---

## 6. AUTHENTICATION FLOW

```
[Login Page]
  ↓ Enter Email + Password
  ↓ Supabase Auth validates credentials
  ↓ Backend checks: users table → role column
  ↓ JWT Token issued with role + company_id embedded
  ↓
  IF role = 'developer'  → Developer Panel
  IF role = 'company'    → Company Admin Panel
  IF role = 'auditor'    → Auditor Panel
```

**Users Table (PostgreSQL):**
```sql
CREATE TABLE users (
    user_id       SERIAL PRIMARY KEY,
    email         VARCHAR(255) UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role         VARCHAR(20) CHECK (role IN ('developer', 'company', 'auditor')),
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
    fixed_due_day     INT,
    fixed_due_month   INT,
    document_required BOOLEAN DEFAULT FALSE,
    doc_scope         VARCHAR(20) DEFAULT 'Company'
                      CHECK (doc_scope IN ('Company', 'Branch')),
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
    role          VARCHAR(20) CHECK (role IN ('developer', 'company', 'auditor')),
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
    ocr_verified    BOOLEAN DEFAULT FALSE,
    ocr_result      TEXT,
    verified_at     TIMESTAMP,
    next_due_date   DATE
);
```

### Table 5: compliance_documents (NEW — Versioned Document Storage)
```sql
CREATE TABLE compliance_documents (
    doc_id          SERIAL PRIMARY KEY,
    company_id      INT REFERENCES companies(company_id),
    rule_id         INT REFERENCES compliance_rules(rule_id),
    calendar_id     INT REFERENCES compliance_calendar(calendar_id),
    version_number  INT NOT NULL,
    is_current      BOOLEAN DEFAULT TRUE,
    file_name       VARCHAR(500),
    s3_key          VARCHAR(1000),
    file_type       VARCHAR(20),
    file_size_kb    INT,
    ocr_status      VARCHAR(20),
    ocr_result      TEXT,
    ocr_verified    BOOLEAN DEFAULT FALSE,
    renewal_date    DATE,
    next_due_date   DATE,
    is_deleted      BOOLEAN DEFAULT FALSE,
    deleted_reason  TEXT,
    uploaded_by     VARCHAR(255),
    uploaded_at     TIMESTAMP DEFAULT NOW()
);
```

### Table 6: audit_flags (NEW — Auditor Flagging System)
```sql
CREATE TABLE audit_flags (
    flag_id      SERIAL PRIMARY KEY,
    company_id   INT REFERENCES companies(company_id),
    doc_id       INT REFERENCES compliance_documents(doc_id),
    flagged_by   VARCHAR(255),
    reason       TEXT,
    flagged_at   TIMESTAMP DEFAULT NOW(),
    resolved     BOOLEAN DEFAULT FALSE,
    resolved_by  VARCHAR(255),
    resolved_at  TIMESTAMP
);
```

### Table 7: audit_log
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

## 8. AWS S3 STORAGE DESIGN

### Bucket Setup
```
Bucket Name : ez-compliance-docs
Region      : ap-south-1 (Mumbai)
Access      : Private (Block all public access = ON)
```

### Folder Structure in S3
```
ez-compliance-docs/
├── company_42/
│   ├── rule_7_DPDP/
│   │   ├── v1_2025-01-01.pdf    ← Archived
│   │   ├── v2_2026-01-15.pdf    ← Archived
│   │   └── v3_2026-02-23.pdf    ← Current ✅
│   ├── rule_1_GST/
│   │   └── v1_2026-02-20.pdf    ← Current ✅
└── company_85/
    └── rule_4_VehiclePermit/
        └── v1_2026-01-10.pdf    ← Current ✅
```

### S3 Key Naming Convention
```
company_{company_id}/rule_{rule_id}_{rule_slug}/v{version}_{YYYY-MM-DD}.{ext}

Example:
company_42/rule_7_DPDP/v3_2026-02-23.pdf
```

### S3 Flow: Upload
```
Company Admin uploads PDF
         ↓
FastAPI receives file (held in RAM, NOT saved locally)
         ↓
Calculate version: last_version + 1
         ↓
boto3 streams file directly to S3
s3_key = company_42/rule_7_DPDP/v3_2026-02-23.pdf
         ↓
S3 confirms upload
         ↓
Mark old docs: is_current = FALSE
         ↓
Insert new row in compliance_documents (s3_key stored, NOT full URL)
         ↓
Download file from S3 to /tmp/ for OCR
Run Tesseract OCR → get text
Delete /tmp/ file immediately
         ↓
Save OCR result, renewal_date, next_due_date in compliance_documents
Update compliance_calendar status
         ↓
Return result to frontend
```

### S3 Flow: Download / View (Presigned URL)
```
User clicks "Download" or "View"
         ↓
Frontend: GET /compliance/document/{doc_id}/download
         ↓
Backend fetches s3_key from compliance_documents table
         ↓
boto3.generate_presigned_url(s3_key, ExpiresIn=3600)
         ↓
Returns temporary URL (valid 1 hour only)
         ↓
Frontend opens URL in new tab → PDF loads from S3
URL auto-expires — cannot be shared permanently
```

### .env Variables for S3
```
AWS_ACCESS_KEY_ID=your_access_key
AWS_SECRET_ACCESS_KEY=your_secret_key
AWS_BUCKET_NAME=EasyComply
AWS_REGION=ap-south-1
```

---

## 9. COMPLIANCE SCORE SYSTEM (NEW)

### Weight Map
```
Imprisonment  → 40 points
High          → 30 points
Medium        → 20 points
Low           → 10 points
```

### Status Multipliers
```
COMPLETED     → 1.0  (full credit)
OVERDUE-PASS  → 0.5  (valid doc but uploaded late)
PENDING       → 0.0
FAILED        → 0.0
OVERDUE       → 0.0
```

### Formulas

**Compliance Score:**
Score = (Sum of weight × multiplier for all rules) / (Sum of all weights) × 100

**Risk Score:**
Risk = (Sum of weights of OVERDUE rules only) / (Sum of all weights) × 100

### Grade Table
| Score | Grade |
|:---|:---|
| 90–100% | A — Excellent |
| 75–89% | B — Good |
| 50–74% | C — Needs Attention |
| 25–49% | D — Critical |
| 0–24% | F — Danger Zone |

---

## 10. DUE DATE CALCULATION LOGIC

Priority order for setting next_due_date:

```python
# Priority 1: Rule has fixed government deadline
if rule.fixed_due_day and rule.fixed_due_month:
    next_due = date(current_year, rule.fixed_due_month, rule.fixed_due_day)

# Priority 2: OCR extracted renewal date from uploaded document
elif ocr_extracted_date:
    next_due = ocr_extracted_date + relativedelta(months=rule.frequency_months)

# Priority 3: Fallback — company signup date + frequency
else:
    next_due = company.created_at + relativedelta(months=rule.frequency_months)
```

---

## 11. AUTO-MATCHING QUERY

Runs at company signup. Extracts all applicable rules based on company profile:

```sql
SELECT rule_id, rule_name, frequency_months, document_required,
       fixed_due_day, fixed_due_month, doc_scope, penalty_impact
FROM compliance_rules
WHERE
    (industry_type && CAST(:industries AS TEXT[]) OR industry_type = ARRAY['ALL'])
    AND
    (applicable_states && CAST(:states AS TEXT[]) OR applicable_states = ARRAY['ALL'])
    AND
    (company_type && CAST(:comp_types AS TEXT[]) OR company_type = ARRAY['ALL'])
    AND
    (min_employees <= :emp_count AND max_employees >= :emp_count)
    AND
    is_active = TRUE;
```

Subscription gating:
- Basic: states = [hq_state only]
- Enterprise: states = [hq_state + all branch_states]

---

## 12. BACKEND API ENDPOINTS (FastAPI)

### Auth
| Method | Endpoint | Role | Description |
|:---|:---|:---|:---|
| POST | `/auth/login` | All | Login, returns JWT with role |

### Company Admin
| Method | Endpoint | Role | Description |
|:---|:---|:---|:---|
| POST | `/company/signup` | Public | Register company, triggers auto-match |
| GET | `/company/dashboard` | Company | Returns all matched rules with status + scores |
| POST | `/company/invite-auditor` | Company | Create auditor user linked to same company |
| PATCH | `/company/flag/{flag_id}/resolve` | Company | Mark auditor flag as resolved |

### Compliance & Documents
| Method | Endpoint | Role | Description |
|:---|:---|:---|:---|
| POST | `/compliance/upload/{calendar_id}` | Company | Upload doc → S3 → OCR → update status |
| GET | `/compliance/document/{doc_id}/download` | Company+Auditor | Generate S3 presigned URL |
| GET | `/compliance/document/history/{rule_id}` | Company+Auditor | Get all versions for a rule |
| PATCH | `/compliance/markdone/{calendar_id}` | Company | Mark non-doc rule as done |

### Auditor
| Method | Endpoint | Role | Description |
|:---|:---|:---|:---|
| GET | `/audit/dashboard` | Auditor | Read-only compliance dashboard |
| POST | `/audit/flag/{doc_id}` | Auditor | Flag a document as suspicious |
| GET | `/audit/flags` | Company+Auditor | View all flags for the company |

### Developer
| Method | Endpoint | Role | Description |
|:---|:---|:---|:---|
| GET | `/developer/companies` | Developer | All subscribed companies |
| GET | `/developer/rules` | Developer | All compliance rules |
| POST | `/developer/rules` | Developer | Add new rule |
| PUT | `/developer/rules/{id}` | Developer | Update rule |
| DELETE | `/developer/rules/{id}` | Developer | Soft-delete rule |
| DELETE | `/developer/document/{doc_id}` | Developer | Emergency hard-delete from S3 |

---

## 13. DEVELOPER PANEL — UI SCREENS

### Screen D1: Company Subscription Dashboard
| Column | Detail |
|:---|:---|
| Company Name | Clickable |
| Industry | AI / IT / Transport |
| State(s) | Gujarat, Maharashtra... |
| Employees | Number |
| Plan | 🟢 Basic / 🟡 Enterprise |
| Compliance Score | e.g. 72% |
| Status | Active / Expired |
| Joined Date | Timestamp |

### Screen D2: Compliance Rule Manager (CRUD Form)
```
rule_name         → Text Input
description       → Text Area
industry_type     → Multi-Select [AI / IT / Transport / ALL]
applicable_states → Multi-Select [Gujarat / Maharashtra / Rajasthan / Goa / ALL]
company_type      → Multi-Select [Pvt Ltd / Public Ltd / ALL]
min_employees     → Number Input [default: 0]
max_employees     → Number Input [default: 999999]
frequency_months  → Number Input [1 / 3 / 6 / 12]
fixed_due_day     → Number Input [optional, e.g. 20 for GST]
fixed_due_month   → Number Input [optional, e.g. 10 for October]
document_required → Toggle [Yes / No]
doc_scope         → Radio [Company / Branch]
penalty_amount    → Text Input
penalty_impact    → Dropdown [Imprisonment / High / Medium / Low]
is_active         → Toggle [Yes / No]
```

---

## 14. COMPANY ADMIN PANEL — UI SCREENS

### Screen C1: Onboarding / Signup (Multi-Step)
```
Step 1: Company Name, Admin Email, Password
Step 2: Industry (multi-select), Company Type (radio),
        Employees (number), HQ State (dropdown), Plan (radio)
Step 3 (Enterprise only): Add branch locations
Step 4: Submit → auto-match runs → redirect to dashboard
        Show: "X compliance rules loaded for your company!"
```

### Screen C2: Compliance Dashboard
**Top Bar:**
```
🟢 Compliance Score: 72%  |  🔴 Risk Exposure: 28%  |  Grade: B — Good
Total: 45 | ✅ Completed: 12 | ⏳ Pending: 25 | ❌ Overdue: 8
```

**Compliance Table:**
| Rule Name | Frequency | Due Date | Scope | Status | Action |
|:---|:---|:---|:---|:---|:---|
| GST Return | Monthly | 20 Feb 2026 | Company | ⏳ PENDING | [Upload] |
| PF Return | Monthly | 15 Feb 2026 | Company | ❌ OVERDUE | [Upload] |
| Gujarat Shop Act | Annual | 31 Mar 2026 | Branch 1 | ✅ DONE | [View Docs] |
| DPDP Annual Audit | Annual | 31 Mar 2026 | Company | ⏳ PENDING | [Upload] |

**Status Colors:**
```
✅ GREEN      → COMPLETED
⏳ YELLOW     → PENDING (due within 30 days)
❌ RED        → OVERDUE
🟡 AMBER      → OVERDUE-PASS (valid but late upload)
🔴 DARK RED   → FAILED (OCR failed, re-upload needed)
```

### Screen C3: Document Upload + OCR Verification
```
Click "Upload" on any rule row
         ↓
Modal opens: Rule name shown at top
File input (PDF / JPG / PNG only, max 5MB)
"Upload & Verify" button
         ↓
On submit:
  Show spinner: "Running OCR..."
  POST /compliance/upload/{calendar_id}
         ↓
Show result in modal:
  ✅ COMPLETED: "Verified! Next due: {date}"
  🟡 OVERDUE-PASS: "Valid but uploaded late. Next due: {date}"
  ❌ FAILED: "Missing keywords: [list]. Please fix and re-upload."
         ↓
On close: refresh dashboard table
```

### Screen C4: Document Version History
```
Click "View Docs" on any completed rule
         ↓
Side panel opens showing all versions:

Ver | Uploaded On    | Uploaded By | OCR Status   | Action
v3  | 23 Feb 2026 ✅ | admin@co    | ✅ COMPLETED  | [Download]  ← CURRENT
v2  | 15 Jan 2026    | admin@co    | ❌ FAILED     | [Download]  ← Archived
v1  | 01 Jan 2025    | admin@co    | ✅ COMPLETED  | [Download]  ← Archived

Click Download → generates S3 presigned URL → PDF opens in new tab
```

### Screen C5: Auditor Management
```
Settings → "Invite Auditor"
  → Enter auditor email
  → POST /company/invite-auditor
  → Auditor gets login credentials
  → Auditor is now linked to this company only

View active auditors list
Remove auditor access button
```

---

## 15. AUDITOR PANEL — UI SCREENS

### Screen A1: Read-Only Compliance Dashboard
```
Same layout as Company Admin dashboard BUT:
- No Upload buttons
- No Edit buttons
- Shows "🚩 Flag" button on each document version
- Shows compliance score + risk score
- Shows all audit flags raised (with resolved/unresolved status)
```

### Screen A2: Flag a Document
```
Click "🚩 Flag" on any document version
         ↓
Modal opens:
  - Shows: Document name, version, uploaded date
  - Text area: "Reason for flagging"
  - Submit button
         ↓
POST /audit/flag/{doc_id}
audit_flags table updated
Company Admin notified (future: email alert)
         ↓
Flag appears on both Admin and Auditor dashboards
Admin can click "Resolve" to mark it as resolved
```

---

## 16. SUBSCRIPTION PLANS

| Feature | Basic | Enterprise |
|:---|:---|:---|
| Industries | 1 | Multiple |
| Locations | 1 (HQ only) | Multiple branches |
| Rules Tracked | ~30 | ~100+ |
| Branch-Level Documents | ❌ | ✅ |
| Auditor Invites | 1 | Unlimited |
| Document Versioning | ✅ | ✅ |
| Compliance Score | ✅ | ✅ |
| Suggested MVP Price | ₹2,999/month | ₹9,999/month |

---

## 17. MVP BUILD ORDER (Step-by-Step)

### Week 1: Database + S3 Setup
- [ ] Create PostgreSQL DB
- [ ] Create all 7 tables
- [ ] Insert ~45 compliance rules via SQL
- [ ] Create AWS S3 bucket (ez-compliance-docs, ap-south-1, private)
- [ ] Create IAM user with S3FullAccess, copy keys to .env
- [ ] Install boto3, test upload/download/presigned URL manually
- [ ] Verify auto-matching query works

### Week 2: Backend (FastAPI)
- [ ] Setup FastAPI project with SQLAlchemy
- [ ] Build `/auth/login` with JWT (role: developer/company/auditor)
- [ ] Build `/company/signup` with auto-matching + calendar creation
- [ ] Build `/compliance/upload` (S3 upload + OCR + versioning logic)
- [ ] Build `/compliance/document/{id}/download` (presigned URL)
- [ ] Build `/compliance/document/history/{rule_id}` (version list)
- [ ] Build all developer CRUD endpoints
- [ ] Build `/company/invite-auditor`
- [ ] Build `/audit/flag` and `/audit/flags` endpoints
- [ ] Implement compliance score + risk score calculation
- [ ] Add audit_log writes on all rule CRUD

### Week 3: Frontend (React.js)
- [ ] Login Page (role-based redirect to 3 panels)
- [ ] Developer Panel (company list + rule CRUD form)
- [ ] Company Signup (multi-step form)
- [ ] Company Dashboard (score bar + compliance table)
- [ ] Document Upload Modal (OCR result display)
- [ ] Document Version History side panel
- [ ] Auditor Management screen (invite + list)
- [ ] Auditor Panel (read-only dashboard + flag modal)

### Week 4: Integration + Demo Polish
- [ ] Connect all frontend to FastAPI
- [ ] Test full upload → S3 → OCR → version history flow
- [ ] Test auditor flag → admin resolve flow
- [ ] Test compliance score calculation end-to-end
- [ ] Fix CORS, JWT, S3 permission bugs
- [ ] Run demo seed script (2 companies, realistic data)
- [ ] Prepare 5-minute demo walkthrough

---

## 18. DEMO SUCCESS CHECKLIST

- [ ] Developer logs in → sees all companies + compliance scores
- [ ] Developer adds a new rule in under 2 minutes
- [ ] AI company in Gujarat signs up → sees ~45 applicable rules
- [ ] Transport company in Maharashtra sees different rules
- [ ] Company uploads PDF → S3 stores it → OCR runs → status updates
- [ ] Old document versions visible in history panel
- [ ] Auditor logs in → sees read-only dashboard → flags a document
- [ ] Admin sees the flag → resolves it
- [ ] Compliance score and risk score display correctly
- [ ] Presigned URL download works for both admin and auditor

---

## 19. FUTURE FEATURES (Post-MVP)

| Feature | Technology |
|:---|:---|
| Email Alerts (due date reminders) | SendGrid or SMTP |
| RAG Chatbot ("Ask your compliance docs") | LangChain + pgvector + OpenAI |
| Hosting | Railway.app or Render.com |
| Mobile App | React Native |
| Government API verification | MCA / GST Portal APIs |
| Auto-archive old docs | S3 Lifecycle → Glacier |

---

*EZ Compliance Tracker — PRD v2.0 | Updated with S3 Storage + Auditor Panel + Compliance Score*
