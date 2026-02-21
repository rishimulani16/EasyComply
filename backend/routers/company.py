"""
routers/company.py
Company Admin panel routes.

Endpoints:
    POST /company/signup    — register company, auto-match rules, populate calendar
    GET  /company/dashboard — see routers/compliance.py (enriched version with join)
"""

import os
from datetime import date, datetime, timedelta, timezone

from dateutil.relativedelta import relativedelta
from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, status
from jose import jwt
from passlib.context import CryptContext
from sqlalchemy import text
from sqlalchemy.orm import Session

from db.database import get_db
from models.models import Company, ComplianceCalendar, User
from models.schemas import (
    SignupRequest,
    SignupResponse,
)
from routers.deps import require_company

load_dotenv()

SECRET_KEY: str = os.getenv("SECRET_KEY", "change-me")
ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

router = APIRouter(prefix="/company", tags=["Company"])


# ---------------------------------------------------------------------------
# Helper — reuse auth.py token creation logic without circular import
# ---------------------------------------------------------------------------

def _create_access_token(payload: dict) -> str:
    to_encode = payload.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode["exp"] = expire
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


# ---------------------------------------------------------------------------
# Auto-matching SQL
# Uses PostgreSQL && (array overlap) operator — not natively supported by
# SQLAlchemy ORM, so executed via db.execute() with text() + bound params.
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# Auto-match via SQLAlchemy ORM (avoids psycopg2 ::TEXT[] cast conflict)
# We use Python-level overlap check via the ARRAY column's .overlap() method.
# ---------------------------------------------------------------------------

def _match_rules(db: Session, industries: list, states: list, comp_types: list, emp_count: int):
    """
    Return all active ComplianceRule rows that match the company profile.
    Uses a raw psycopg2 cursor via the SQLAlchemy engine connection pool
    so we can pass arrays as Python lists — psycopg2 adapts them natively
    to {val1,val2,...} which compares correctly against TEXT[] columns.
    """
    from models.models import ComplianceRule

    SQL = """
        SELECT rule_id FROM compliance_rules
        WHERE
            is_active = TRUE
            AND min_employees <= %(emp)s
            AND max_employees >= %(emp)s
            AND (industry_type && %(industries)s OR 'ALL' = ANY(industry_type))
            AND (applicable_states && %(states)s OR 'ALL' = ANY(applicable_states))
            AND (company_type && %(comp_types)s OR 'ALL' = ANY(company_type))
    """

    # Get a raw psycopg2 connection from the SQLAlchemy pool
    raw_conn = db.get_bind().raw_connection()
    try:
        cur = raw_conn.cursor()
        cur.execute(SQL, {
            "emp":        emp_count,
            "industries": industries,
            "states":     states,
            "comp_types": comp_types,
        })
        ids = [row[0] for row in cur.fetchall()]
        cur.close()
    finally:
        raw_conn.close()

    if not ids:
        return []
    return db.query(ComplianceRule).filter(ComplianceRule.rule_id.in_(ids)).all()







# ---------------------------------------------------------------------------
# POST /company/signup
# ---------------------------------------------------------------------------

@router.post(
    "/signup",
    response_model=SignupResponse,
    status_code=status.HTTP_201_CREATED,
    summary="Register a new company, auto-match compliance rules, and get JWT",
)
def company_signup(body: SignupRequest, db: Session = Depends(get_db)):
    """
    Full onboarding flow in a single call:

    1. Persist Company row
    2. Hash password + persist User row (role='company')
    3. Determine states to match (Basic → HQ only, Enterprise → HQ + branches)
    4. Run PostgreSQL array-overlap auto-matching query
    5. Bulk-insert ComplianceCalendar rows (one per matched rule, status=PENDING)
    6. Return JWT token + matched rule count (company is auto-logged-in)
    """

    # ------------------------------------------------------------------
    # Guard: reject duplicate email
    # ------------------------------------------------------------------
    existing_user = db.query(User).filter(User.email == body.email).first()
    if existing_user:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="An account with this email already exists.",
        )

    # ------------------------------------------------------------------
    # Step 1 — Create Company
    # ------------------------------------------------------------------
    company = Company(
        company_name=body.company_name,
        industry_type=body.industry_type,
        company_type=body.company_type,
        hq_state=body.hq_state,
        branch_states=body.branch_states if body.branch_states else [],
        employee_count=body.employee_count,
        subscription=body.subscription,
    )
    db.add(company)
    db.flush()   # ensures company.company_id is available before User FK

    # ------------------------------------------------------------------
    # Step 2 — Create User (role='company')
    # ------------------------------------------------------------------
    hashed_pw = pwd_context.hash(body.password)
    user = User(
        email=body.email,
        password_hash=hashed_pw,
        role="company",
        company_id=company.company_id,
    )
    db.add(user)
    db.flush()   # ensures user.user_id is available for JWT

    # ------------------------------------------------------------------
    # Step 3 — Build states_to_match
    # ------------------------------------------------------------------
    if body.subscription == "Basic":
        states_to_match = [body.hq_state]
    else:
        # Enterprise: HQ + all branch states (de-duplicated)
        branch = body.branch_states if body.branch_states else []
        states_to_match = list(dict.fromkeys([body.hq_state] + branch))

    # ------------------------------------------------------------------
    # Step 4 — Auto-matching via ORM (avoids psycopg2 ::TEXT[] cast bug)
    # ------------------------------------------------------------------
    emp_count = body.employee_count if body.employee_count is not None else 0

    matched_rules = _match_rules(
        db,
        industries=body.industry_type,
        states=states_to_match,
        comp_types=body.company_type,
        emp_count=emp_count,
    )

    # ------------------------------------------------------------------
    # Step 5 — Bulk-insert ComplianceCalendar rows
    # Branch-scope rules: one row per matching state (branch_state = state)
    # Company-scope rules: one row total (branch_state = None)
    # ------------------------------------------------------------------
    today = date.today()
    calendar_rows = []

    for rule in matched_rules:
        rule_states = rule.applicable_states or []
        freq = int(rule.frequency_months)
        due = today + relativedelta(months=freq)

        if rule.scope == "Branch":
            # Create one calendar entry per state the company operates in
            # that overlaps with the rule's applicable_states
            for state in states_to_match:
                if "ALL" in rule_states or state in rule_states:
                    # Avoid duplicate if already exists
                    exists = db.query(ComplianceCalendar).filter(
                        ComplianceCalendar.company_id == company.company_id,
                        ComplianceCalendar.rule_id == rule.rule_id,
                        ComplianceCalendar.branch_state == state,
                    ).first()
                    if not exists:
                        calendar_rows.append(ComplianceCalendar(
                            company_id=company.company_id,
                            rule_id=rule.rule_id,
                            branch_state=state,
                            due_date=due,
                            status="PENDING",
                            ocr_verified=False,
                        ))
        else:
            # Company-scope: one row, no branch differentiation
            exists = db.query(ComplianceCalendar).filter(
                ComplianceCalendar.company_id == company.company_id,
                ComplianceCalendar.rule_id == rule.rule_id,
            ).first()
            if not exists:
                calendar_rows.append(ComplianceCalendar(
                    company_id=company.company_id,
                    rule_id=rule.rule_id,
                    branch_state=None,
                    due_date=due,
                    status="PENDING",
                    ocr_verified=False,
                ))


    if calendar_rows:
        db.add_all(calendar_rows)

    db.commit()   # commits Company, User, and all calendar rows atomically
    db.refresh(company)
    db.refresh(user)

    # ------------------------------------------------------------------
    # Step 6 — Build and return JWT (auto-login)
    # ------------------------------------------------------------------
    token = _create_access_token({
        "user_id":    user.user_id,
        "email":      user.email,
        "role":       "company",
        "company_id": company.company_id,
    })

    return SignupResponse(
        access_token=token,
        token_type="bearer",
        role="company",
        user_id=user.user_id,
        company_id=company.company_id,
        total_rules_matched=len(matched_rules),
    )


# GET /company/dashboard is implemented in routers/compliance.py
# with full join query and summary counts.
