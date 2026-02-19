"""
routers/company.py
Company Admin panel routes.

Endpoints:
    POST /company/signup    — register company, auto-match rules, populate calendar
    GET  /company/dashboard — see routers/compliance.py (enriched version with join + auto-OVERDUE)
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

AUTO_MATCH_SQL = text("""
    SELECT rule_id, rule_name, frequency_months, document_required
    FROM compliance_rules
    WHERE
        (industry_type && CAST(:industries AS TEXT[]) OR industry_type = ARRAY['ALL'])
        AND (applicable_states && CAST(:states AS TEXT[]) OR applicable_states = ARRAY['ALL'])
        AND (company_type && CAST(:comp_types AS TEXT[]) OR company_type = ARRAY['ALL'])
        AND (min_employees <= :emp_count AND max_employees >= :emp_count)
        AND is_active = TRUE
""")


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
    # Step 4 — Auto-matching query (raw SQL via text())
    # PostgreSQL array literals must be passed as "{val1,val2,...}" strings
    # ------------------------------------------------------------------
    emp_count = body.employee_count if body.employee_count is not None else 0

    def _pg_array(lst: list) -> str:
        """Convert a Python list to a PostgreSQL array literal string."""
        escaped = [str(v).replace('"', '') for v in lst]
        return "{" + ",".join(escaped) + "}"

    result = db.execute(
        AUTO_MATCH_SQL,
        {
            "industries":  _pg_array(body.industry_type),
            "states":      _pg_array(states_to_match),
            "comp_types":  _pg_array(body.company_type),
            "emp_count":   emp_count,
        },
    )
    matched_rules = result.mappings().all()

    # ------------------------------------------------------------------
    # Step 5 — Bulk-insert ComplianceCalendar rows
    # ------------------------------------------------------------------
    today = date.today()
    calendar_rows = [
        ComplianceCalendar(
            company_id=company.company_id,
            rule_id=rule["rule_id"],
            branch_state=None,          # populated at branch level for Enterprise in future
            due_date=today + relativedelta(months=int(rule["frequency_months"])),
            status="PENDING",
            ocr_verified=False,
        )
        for rule in matched_rules
    ]

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
# with full join query, auto-OVERDUE logic, and summary counts.
