"""
models/models.py
SQLAlchemy ORM models for all 5 EZ Compliance Tracker tables.
Matches the PostgreSQL schema defined in PRD Section 7 exactly.
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
    document_required = Column(Boolean, default=False)
    penalty_amount    = Column(String(255), nullable=True)
    penalty_impact    = Column(
        String(20),
        nullable=True,
        # CHECK enforced in DB; noted here for documentation
    )
    scope             = Column(String(20), nullable=True)   # 'Company' | 'Branch'
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
    role          = Column(String(20), nullable=True)       # 'developer' | 'company'
    company_id    = Column(Integer, nullable=True)          # FK handled at DB level
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
    status        = Column(String(20), default="PENDING")   # PENDING | COMPLETED | OVERDUE | OVERDUE-PASS | FAILED
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
