"""
models/models.py
SQLAlchemy ORM models for all 7 EZ Compliance Tracker tables.
Matches the PostgreSQL schema defined in PRD v2.0 Section 7 exactly.
"""

from sqlalchemy import (
    Boolean, Column, Date, Integer, String, Text, TIMESTAMP, func
)
from sqlalchemy.dialects.postgresql import ARRAY, JSONB
from db.database import Base


# ---------------------------------------------------------------------------
# 1. ComplianceRule
#    Rule library managed by the Developer/Owner role.
# ---------------------------------------------------------------------------
class ComplianceRule(Base):
    __tablename__ = "compliance_rules"

    rule_id           = Column(Integer, primary_key=True, index=True, autoincrement=True)
    rule_name         = Column(String(255), nullable=False)
    description       = Column(Text, nullable=True)
    industry_type     = Column(ARRAY(String), server_default="{ALL}")
    applicable_states = Column(ARRAY(String), server_default="{ALL}")
    company_type      = Column(ARRAY(String), server_default="{ALL}")
    min_employees     = Column(Integer, default=0)
    max_employees     = Column(Integer, default=999999)
    frequency_months  = Column(Integer, nullable=False)
    # Fixed government deadline (e.g. GST → day=20, month=None means every month)
    fixed_due_day     = Column(Integer, nullable=True)
    fixed_due_month   = Column(Integer, nullable=True)
    document_required = Column(Boolean, default=False)
    # doc_scope replaces / extends the old 'scope' column
    doc_scope         = Column(String(20), nullable=True, default="Company")  # 'Company' | 'Branch'
    scope             = Column(String(20), nullable=True)   # legacy — kept for backward compat
    penalty_amount    = Column(String(255), nullable=True)
    penalty_impact    = Column(
        String(20),
        nullable=True,
        # CHECK enforced in DB: Imprisonment | High | Medium | Low
    )
    is_active         = Column(Boolean, default=True)


# ---------------------------------------------------------------------------
# 2. Company
#    Client companies that subscribe to the platform.
# ---------------------------------------------------------------------------
class Company(Base):
    __tablename__ = "companies"

    company_id     = Column(Integer, primary_key=True, index=True, autoincrement=True)
    company_name   = Column(String(255), nullable=False)
    industry_type  = Column(ARRAY(String), nullable=True)
    company_type   = Column(ARRAY(String), nullable=True)
    hq_state       = Column(String(50), nullable=True)
    branch_states  = Column(ARRAY(String), nullable=True)
    employee_count = Column(Integer, nullable=True)
    subscription   = Column(String(20), nullable=True)      # 'Basic' | 'Enterprise'
    created_at     = Column(TIMESTAMP, server_default=func.now())


# ---------------------------------------------------------------------------
# 3. User
#    Platform users — Developer/Owner or Company Admin.
#    company_id FK → companies.company_id (NULL for Developer role)
# ---------------------------------------------------------------------------
class User(Base):
    __tablename__ = "users"

    user_id       = Column(Integer, primary_key=True, index=True, autoincrement=True)
    email         = Column(String(255), unique=True, nullable=False, index=True)
    password_hash = Column(Text, nullable=False)
    role          = Column(String(20), nullable=True)       # 'developer' | 'company' | 'auditor'
    company_id    = Column(Integer, nullable=True)          # FK → companies (NULL for developer)
    created_at    = Column(TIMESTAMP, server_default=func.now())


# ---------------------------------------------------------------------------
# 4. ComplianceCalendar
#    One row per (company × rule × branch_state) combination.
#    Populated automatically when a company signs up (auto-matching query).
# ---------------------------------------------------------------------------
class ComplianceCalendar(Base):
    __tablename__ = "compliance_calendar"

    calendar_id   = Column(Integer, primary_key=True, index=True, autoincrement=True)
    company_id    = Column(Integer, nullable=True)          # FK → companies
    rule_id       = Column(Integer, nullable=True)          # FK → compliance_rules
    branch_state  = Column(String(50), nullable=True)
    due_date      = Column(Date, nullable=True)
    status        = Column(String(20), default="PENDING")   # PENDING | COMPLETED | OVERDUE-PASS | FAILED
    document_url  = Column(String(500), nullable=True)
    ocr_verified  = Column(Boolean, default=False)
    ocr_result    = Column(Text, nullable=True)
    verified_at   = Column(TIMESTAMP, nullable=True)
    next_due_date = Column(Date, nullable=True)


# ---------------------------------------------------------------------------
# 5. AuditLog
#    Immutable record of every ADD / UPDATE / DELETE on compliance_rules.
#    rule_id is a plain INT (no FK) so historical entries survive rule deletion.
# ---------------------------------------------------------------------------
class AuditLog(Base):
    __tablename__ = "audit_log"

    log_id     = Column(Integer, primary_key=True, index=True, autoincrement=True)
    action     = Column(String(20), nullable=True)          # 'ADD' | 'UPDATE' | 'DELETE'
    table_name = Column(String(50), nullable=True)
    rule_id    = Column(Integer, nullable=True)             # intentionally no FK
    changed_by = Column(String(100), nullable=True)
    changed_at = Column(TIMESTAMP, server_default=func.now())
    old_value  = Column(JSONB, nullable=True)
    new_value  = Column(JSONB, nullable=True)


# ---------------------------------------------------------------------------
# 6. ComplianceDocument  (NEW — PRD v2)
#    Every version of every document uploaded by a company.
#    Replaces the old document_url column in compliance_calendar.
#    s3_key format: company_{id}/rule_{id}_{slug}/v{n}_{YYYY-MM-DD}.{ext}
# ---------------------------------------------------------------------------
class ComplianceDocument(Base):
    __tablename__ = "compliance_documents"

    doc_id         = Column(Integer, primary_key=True, index=True, autoincrement=True)
    company_id     = Column(Integer, nullable=True)          # FK → companies
    rule_id        = Column(Integer, nullable=True)          # FK → compliance_rules
    calendar_id    = Column(Integer, nullable=True)          # FK → compliance_calendar
    version_number = Column(Integer, nullable=False)         # monotonically increasing per company+rule
    is_current     = Column(Boolean, default=True)           # only one row per calendar_id is TRUE
    file_name      = Column(String(500), nullable=True)      # original uploaded filename
    s3_key         = Column(String(1000), nullable=True)     # S3 object key (NOT a full URL)
    file_type      = Column(String(20), nullable=True)       # e.g. 'pdf' | 'png' | 'jpeg'
    file_size_kb   = Column(Integer, nullable=True)
    ocr_status     = Column(String(20), nullable=True)       # 'COMPLETED' | 'OVERDUE-PASS' | 'FAILED'
    ocr_result     = Column(Text, nullable=True)             # full OCR verification message
    ocr_verified   = Column(Boolean, default=False)
    renewal_date   = Column(Date, nullable=True)             # issue/renewal date extracted from doc
    next_due_date  = Column(Date, nullable=True)             # renewal_date + frequency_months
    is_deleted     = Column(Boolean, default=False)          # soft-delete by Developer (emergency)
    deleted_reason = Column(Text, nullable=True)
    uploaded_by    = Column(String(255), nullable=True)      # uploader email
    uploaded_at    = Column(TIMESTAMP, server_default=func.now())


# ---------------------------------------------------------------------------
# 7. AuditFlag  (NEW — PRD v2)
#    Raised by an Auditor on a specific document version.
#    Resolved by the Company Admin.
# ---------------------------------------------------------------------------
class AuditFlag(Base):
    __tablename__ = "audit_flags"

    flag_id     = Column(Integer, primary_key=True, index=True, autoincrement=True)
    company_id  = Column(Integer, nullable=True)             # FK → companies
    doc_id      = Column(Integer, nullable=True)             # FK → compliance_documents
    flagged_by  = Column(String(255), nullable=True)         # auditor email
    reason      = Column(Text, nullable=True)
    flagged_at  = Column(TIMESTAMP, server_default=func.now())
    resolved    = Column(Boolean, default=False)
    resolved_by = Column(String(255), nullable=True)         # company admin email
    resolved_at = Column(TIMESTAMP, nullable=True)
