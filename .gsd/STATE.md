# GSD State

> Updated: 2026-02-24 | Based on PRD v2.0

## Project Status

**Phase:** v2 Planning — S3 Storage + Auditor Panel not yet built.
**What's live:** Full v1 backend (auth, company signup, compliance upload [local], dashboard, mark done, developer CRUD). Full v1 frontend (login, company dashboard with sort, developer dashboard, signup, upload modal, mark done modal).

---

## What Exists (v1 — Live)

- ✅ FastAPI backend with 4 routers: `auth`, `company`, `compliance`, `developer`
- ✅ PostgreSQL with 5 tables (rules, companies, users, compliance_calendar, audit_log)
- ✅ JWT auth (2 roles: `developer`, `company`)
- ✅ Auto-matching at company signup
- ✅ Document upload → Tesseract OCR → local disk → status update
- ✅ Compliance dashboard with score ring and sort dropdown
- ✅ Mark Done for non-document rules (renewal date, expiry date)
- ✅ React frontend with Vite + TailwindCSS

---

## What's Planned (v2 — To Build)

### Phase 1: Database Migrations
1. Add `auditor` to `users.role` CHECK constraint
2. Create `compliance_documents` table (versioned doc storage)
3. Create `audit_flags` table
4. Add `fixed_due_day`, `fixed_due_month`, `doc_scope` columns to `compliance_rules`
5. Run migration on existing DB

### Phase 2: S3 Setup
1. Create AWS S3 bucket (`EasyComply`, `ap-south-1`, private, block all public access)
2. Create IAM user with S3 permissions, copy keys to `backend/.env`
3. Add `boto3` to `requirements.txt`
4. Create `backend/services/s3_service.py`:
   - `upload_to_s3(file_bytes, s3_key)` → boto3 put_object
   - `generate_presigned_url(s3_key, expires=3600)` → temp URL
   - `delete_from_s3(s3_key)` → hard delete (developer only)
   - `get_next_version(company_id, rule_id)` → query compliance_documents for max version + 1

### Phase 3: Backend — S3 Migration + New Endpoints
1. **Migrate `/compliance/upload/{calendar_id}`** (compliance.py):
   - Remove local disk save
   - Stream file to S3 via s3_service
   - Mark old docs `is_current = FALSE` in compliance_documents
   - Download from S3 to `/tmp/` for OCR → delete after
   - Insert new row in `compliance_documents`
   - Update `compliance_calendar` status as before
2. **Add `GET /compliance/document/{doc_id}/download`**:
   - Look up `s3_key` from `compliance_documents`
   - Return presigned URL (valid 1hr)
3. **Add `GET /compliance/document/history/{rule_id}`**:
   - Return all versions for a rule+company (ordered by version_number DESC)
4. **Add `POST /company/invite-auditor`**:
   - Create user with role=`auditor` linked to same company_id
   - Hash password, store in `users` table
5. **Add `PATCH /company/flag/{flag_id}/resolve`**:
   - Set `audit_flags.resolved = TRUE`, `resolved_by`, `resolved_at`
6. **Create `routers/auditor.py`**:
   - `GET /audit/dashboard` → same as company dashboard but read-only payload
   - `POST /audit/flag/{doc_id}` → insert audit_flags row
   - `GET /audit/flags` → list all flags for company (filtered by company_id from JWT)
7. **Update `routers/deps.py`**:
   - Add `require_auditor` → check role == 'auditor'
   - Also add `require_company_or_auditor` for shared endpoints
8. **Update `routers/developer.py`**:
   - Add `DELETE /developer/document/{doc_id}` → s3_service.delete_from_s3 + set is_deleted = TRUE

### Phase 4: Frontend — New Screens
1. **Update `LoginPage.jsx`**:
   - Add 3rd redirect branch: `role === 'auditor'` → `/auditor`
2. **Create `AuditorDashboard.jsx`**:
   - Read-only compliance table (same data as CompanyDashboard)
   - No Upload, no Mark Done buttons
   - Add **🚩 Flag** button on each document version row in DocHistoryPanel
   - Show compliance score + risk score
   - Show all audit flags (resolved/unresolved) at bottom
3. **Create `FlagModal.jsx`**:
   - Shows: doc name, version, uploaded date
   - Text area for reason
   - Submits `POST /audit/flag/{doc_id}`
4. **Create `DocHistoryPanel.jsx`**:
   - Triggered by "View Docs" button on completed rules
   - Lists all versions: version number, uploaded date, uploaded by, OCR status
   - **Download** button per version → calls `GET /compliance/document/{doc_id}/download` → opens presigned URL in new tab
   - **🚩 Flag** button per version (auditor only — hide for company admin)
5. **Update `CompanyDashboard.jsx`**:
   - "View Docs" button on completed rules → opens DocHistoryPanel
   - Show Risk Score in summary bar alongside Compliance Score
   - Show unresolved audit flags banner if any
   - **Resolve** button on each flag row
6. **Create `AuditorManagementScreen.jsx`** (settings section in CompanyDashboard):
   - List of linked auditors
   - **Invite Auditor** button → input email → `POST /company/invite-auditor`
   - Remove auditor button

### Phase 5: App Router Update
- Add protected route `/auditor` → `AuditorDashboard.jsx` (role=auditor guard)
- Ensure existing `/company` and `/developer` routes remain unchanged

---

## Key Design Decisions

| Decision | Choice | Reason |
|----------|--------|--------|
| S3 key format | `company_{id}/rule_{id}_{slug}/v{n}_{YYYY-MM-DD}.{ext}` | Human-readable, easy to audit |
| S3 URL strategy | Presigned URLs (1hr TTL) | Files are private; no permanent public URLs |
| OCR with S3 | Download to /tmp/, OCR, delete | No persistent local storage needed |
| Document URL in calendar | Deprecated — use compliance_documents.s3_key | Single source of truth for all versions |
| Auditor link | `users.company_id` = linked company | Simple; auditor sees only their assigned company |
| Auditor invite | Company Admin creates user directly (no email for MVP) | Email alerts are post-MVP |
| Risk score | Exposed only to Company Admin + Auditor | Developer does not need per-company health |

---

## Files to Create / Modify

### New Files
- `backend/services/s3_service.py`
- `backend/routers/auditor.py`
- `frontend/src/pages/AuditorDashboard.jsx`
- `frontend/src/components/FlagModal.jsx`
- `frontend/src/components/DocHistoryPanel.jsx`
- `frontend/src/pages/AuditorManagementScreen.jsx` (or as section inside CompanyDashboard)

### Files to Modify
- `backend/models/models.py` — add ComplianceDocument, AuditFlag ORM models
- `backend/models/schemas.py` — add corresponding Pydantic schemas
- `backend/routers/compliance.py` — S3 migration + new download/history endpoints
- `backend/routers/company.py` — invite-auditor, resolve-flag
- `backend/routers/developer.py` — emergency doc delete
- `backend/routers/deps.py` — require_auditor, require_company_or_auditor
- `backend/main.py` — register auditor router
- `backend/requirements.txt` — add boto3
- `backend/.env.template` — add AWS_ variables
- `frontend/src/App.jsx` — add /auditor route
- `frontend/src/pages/LoginPage.jsx` — 3rd role redirect
- `frontend/src/pages/CompanyDashboard.jsx` — View Docs, Risk Score, flag banner/resolve

### Database Migrations (SQL)
```sql
-- 1. Add auditor role
ALTER TABLE users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE users ADD CONSTRAINT users_role_check
    CHECK (role IN ('developer', 'company', 'auditor'));

-- 2. Add compliance_rules new columns
ALTER TABLE compliance_rules ADD COLUMN IF NOT EXISTS fixed_due_day INT;
ALTER TABLE compliance_rules ADD COLUMN IF NOT EXISTS fixed_due_month INT;
ALTER TABLE compliance_rules ADD COLUMN IF NOT EXISTS doc_scope VARCHAR(20)
    DEFAULT 'Company' CHECK (doc_scope IN ('Company', 'Branch'));

-- 3. Create compliance_documents
CREATE TABLE IF NOT EXISTS compliance_documents (
    doc_id SERIAL PRIMARY KEY,
    company_id INT REFERENCES companies(company_id),
    rule_id INT REFERENCES compliance_rules(rule_id),
    calendar_id INT REFERENCES compliance_calendar(calendar_id),
    version_number INT NOT NULL,
    is_current BOOLEAN DEFAULT TRUE,
    file_name VARCHAR(500), s3_key VARCHAR(1000),
    file_type VARCHAR(20), file_size_kb INT,
    ocr_status VARCHAR(20), ocr_result TEXT,
    ocr_verified BOOLEAN DEFAULT FALSE,
    renewal_date DATE, next_due_date DATE,
    is_deleted BOOLEAN DEFAULT FALSE, deleted_reason TEXT,
    uploaded_by VARCHAR(255), uploaded_at TIMESTAMP DEFAULT NOW()
);

-- 4. Create audit_flags
CREATE TABLE IF NOT EXISTS audit_flags (
    flag_id SERIAL PRIMARY KEY,
    company_id INT REFERENCES companies(company_id),
    doc_id INT REFERENCES compliance_documents(doc_id),
    flagged_by VARCHAR(255), reason TEXT,
    flagged_at TIMESTAMP DEFAULT NOW(),
    resolved BOOLEAN DEFAULT FALSE,
    resolved_by VARCHAR(255), resolved_at TIMESTAMP
);
```
