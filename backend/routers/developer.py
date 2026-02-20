"""
routers/developer.py
Developer/Owner panel — all endpoints require role='developer' in JWT.

Endpoints:
    GET    /developer/companies          — list all client companies
    GET    /developer/rules              — list all active compliance rules
    POST   /developer/rules              — add new rule + audit log
    PUT    /developer/rules/{rule_id}    — update rule + audit log
    DELETE /developer/rules/{rule_id}    — soft delete rule + audit log
"""

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from db.database import get_db
from models.models import AuditLog, Company, ComplianceRule
from models.schemas import (
    CompanyOut,
    ComplianceRuleCreate,
    ComplianceRuleOut,
    ComplianceRuleUpdate,
)
from routers.deps import require_developer

router = APIRouter(prefix="/developer", tags=["Developer"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _rule_to_dict(rule: ComplianceRule) -> dict:
    """Serialise a ComplianceRule ORM object to a plain dict for JSONB audit values."""
    return {
        "rule_id":           rule.rule_id,
        "rule_name":         rule.rule_name,
        "description":       rule.description,
        "industry_type":     rule.industry_type,
        "applicable_states": rule.applicable_states,
        "company_type":      rule.company_type,
        "min_employees":     rule.min_employees,
        "max_employees":     rule.max_employees,
        "frequency_months":  rule.frequency_months,
        "document_required": rule.document_required,
        "penalty_amount":    rule.penalty_amount,
        "penalty_impact":    rule.penalty_impact,
        "scope":             rule.scope,
        "is_active":         rule.is_active,
    }


def _write_audit(
    db: Session,
    action: str,
    rule_id: int,
    changed_by: str,
    old_value: dict | None = None,
    new_value: dict | None = None,
) -> None:
    """Create and persist an AuditLog entry in the same transaction."""
    log = AuditLog(
        action=action,
        table_name="compliance_rules",
        rule_id=rule_id,
        changed_by=changed_by,
        old_value=old_value,
        new_value=new_value,
    )
    db.add(log)


def _sync_calendar_for_rule(db: Session, rule: "ComplianceRule") -> dict:
    """
    Sync compliance_calendar rows for a single rule.

    For Branch-scope rules:
      - Delete rows where branch_state is NULL (legacy) or not in rule.applicable_states
      - Create missing per-company-state rows for states that DO match
    For Company-scope rules:
      - Ensure every matching company has exactly one row (branch_state=None)
      - Remove branch-specific rows if scope changed from Branch → Company

    Returns {"deleted": N, "created": N}
    """
    from datetime import date
    from dateutil.relativedelta import relativedelta
    from models.models import Company, ComplianceCalendar

    today  = date.today()
    due    = today + relativedelta(months=int(rule.frequency_months))
    rule_states = rule.applicable_states or []
    deleted = 0
    created = 0

    companies = db.query(Company).all()

    if rule.scope == "Branch":
        # 1. Remove all invalid rows:  null branch_state OR state not covered by rule
        existing = db.query(ComplianceCalendar).filter(
            ComplianceCalendar.rule_id == rule.rule_id
        ).all()
        for row in existing:
            if row.branch_state is None:
                db.delete(row); deleted += 1
            elif "ALL" not in rule_states and row.branch_state not in rule_states:
                db.delete(row); deleted += 1
        db.flush()

        # 2. Create missing rows per (company × applicable state)
        for company in companies:
            hq     = company.hq_state or ""
            subs   = company.subscription or "Basic"
            branches = company.branch_states or []
            company_states = list(dict.fromkeys([hq] + branches)) if subs == "Enterprise" else [hq]

            for state in company_states:
                if "ALL" not in rule_states and state not in rule_states:
                    continue
                exists = db.query(ComplianceCalendar).filter(
                    ComplianceCalendar.company_id == company.company_id,
                    ComplianceCalendar.rule_id    == rule.rule_id,
                    ComplianceCalendar.branch_state == state,
                ).first()
                if not exists:
                    db.add(ComplianceCalendar(
                        company_id=company.company_id,
                        rule_id=rule.rule_id,
                        branch_state=state,
                        due_date=due,
                        status="PENDING",
                        ocr_verified=False,
                    ))
                    created += 1

    else:  # Company-scope
        # Remove any branch-state rows (if rule was changed from Branch → Company)
        branch_rows = db.query(ComplianceCalendar).filter(
            ComplianceCalendar.rule_id == rule.rule_id,
            ComplianceCalendar.branch_state != None,  # noqa: E711
        ).all()
        for row in branch_rows:
            db.delete(row); deleted += 1
        db.flush()

        # Ensure one Company-scope row per matching company
        for company in companies:
            exists = db.query(ComplianceCalendar).filter(
                ComplianceCalendar.company_id == company.company_id,
                ComplianceCalendar.rule_id    == rule.rule_id,
            ).first()
            if not exists:
                db.add(ComplianceCalendar(
                    company_id=company.company_id,
                    rule_id=rule.rule_id,
                    branch_state=None,
                    due_date=due,
                    status="PENDING",
                    ocr_verified=False,
                ))
                created += 1

    return {"deleted": deleted, "created": created}


# ---------------------------------------------------------------------------
# GET /developer/companies
# ---------------------------------------------------------------------------

@router.get(
    "/companies",
    response_model=list[CompanyOut],
    summary="List all subscribed companies",
)
def list_companies(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_developer),
):
    """
    Returns every company registered on the platform.
    Developer role required.
    """
    return db.query(Company).all()


# ---------------------------------------------------------------------------
# GET /developer/rules
# ---------------------------------------------------------------------------

@router.get(
    "/rules",
    response_model=list[ComplianceRuleOut],
    summary="List all active compliance rules",
)
def list_rules(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_developer),
):
    """
    Returns all compliance rules where is_active = TRUE.
    Developer role required.
    """
    return db.query(ComplianceRule).filter(ComplianceRule.is_active == True).all()


# ---------------------------------------------------------------------------
# POST /developer/rules
# ---------------------------------------------------------------------------

@router.post(
    "/rules",
    response_model=ComplianceRuleOut,
    status_code=status.HTTP_201_CREATED,
    summary="Add a new compliance rule",
)
def add_rule(
    body: ComplianceRuleCreate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_developer),
):
    """
    Creates a new compliance rule and writes an ADD entry to audit_log.
    Also auto-assigns the rule to all existing companies that match its criteria.
    Developer role required.
    """
    from datetime import date
    from dateutil.relativedelta import relativedelta
    from models.models import Company, ComplianceCalendar

    # 1. Create ORM object
    rule = ComplianceRule(
        rule_name=body.rule_name,
        description=body.description,
        industry_type=body.industry_type,
        applicable_states=body.applicable_states,
        company_type=body.company_type,
        min_employees=body.min_employees,
        max_employees=body.max_employees,
        frequency_months=body.frequency_months,
        document_required=body.document_required,
        penalty_amount=body.penalty_amount,
        penalty_impact=body.penalty_impact,
        scope=body.scope,
        is_active=body.is_active,
    )
    db.add(rule)
    db.flush()          # assigns rule.rule_id without committing

    # 2. Audit log (same transaction)
    _write_audit(
        db,
        action="ADD",
        rule_id=rule.rule_id,
        changed_by=current_user["email"],
        old_value=None,
        new_value=_rule_to_dict(rule),
    )

    db.commit()
    db.refresh(rule)

    # ------------------------------------------------------------------
    # 3. Auto-assign to existing companies that match this new rule
    # ------------------------------------------------------------------
    if body.is_active:
        today = date.today()
        companies = db.query(Company).all()

        calendar_rows = []
        for company in companies:
            industries   = company.industry_type  or []
            hq_state     = company.hq_state       or ""
            comp_types   = company.company_type   or []
            emp_count    = company.employee_count or 0
            subscription = company.subscription   or "Basic"

            # Build states to match
            branches = company.branch_states or []
            if subscription == "Enterprise":
                states = list(dict.fromkeys([hq_state] + branches))
            else:
                states = [hq_state]


            # Check employee range
            if not (rule.min_employees <= emp_count <= rule.max_employees):
                continue

            # Check industry match (ALL means universal)
            rule_industries = rule.industry_type or []
            if "ALL" not in rule_industries and not any(i in rule_industries for i in industries):
                continue

            # Check state match
            rule_states = rule.applicable_states or []
            if "ALL" not in rule_states and not any(s in rule_states for s in states):
                continue

            # Check company type match
            rule_types = rule.company_type or []
            if "ALL" not in rule_types and not any(t in rule_types for t in comp_types):
                continue

            # Matched — create calendar row(s)
            if rule.scope == "Branch":
                # One row per matching state for location-specific rules
                for state in states:
                    rule_states = rule.applicable_states or []
                    if "ALL" in rule_states or state in rule_states:
                        already_state = db.query(ComplianceCalendar).filter(
                            ComplianceCalendar.company_id == company.company_id,
                            ComplianceCalendar.rule_id == rule.rule_id,
                            ComplianceCalendar.branch_state == state,
                        ).first()
                        if not already_state:
                            calendar_rows.append(ComplianceCalendar(
                                company_id=company.company_id,
                                rule_id=rule.rule_id,
                                branch_state=state,
                                due_date=today + relativedelta(months=int(rule.frequency_months)),
                                status="PENDING",
                                ocr_verified=False,
                            ))
            else:
                # Company-scope: one row covers all locations
                already_company = db.query(ComplianceCalendar).filter(
                    ComplianceCalendar.company_id == company.company_id,
                    ComplianceCalendar.rule_id == rule.rule_id,
                ).first()
                if not already_company:
                    calendar_rows.append(ComplianceCalendar(
                        company_id=company.company_id,
                        rule_id=rule.rule_id,
                        branch_state=None,
                        due_date=today + relativedelta(months=int(rule.frequency_months)),
                        status="PENDING",
                        ocr_verified=False,
                    ))

        if calendar_rows:
            db.add_all(calendar_rows)
            db.commit()

    return rule


# ---------------------------------------------------------------------------
# PUT /developer/rules/{rule_id}
# ---------------------------------------------------------------------------

@router.put(
    "/rules/{rule_id}",
    response_model=ComplianceRuleOut,
    summary="Update an existing compliance rule",
)
def update_rule(
    rule_id: int,
    body: ComplianceRuleUpdate,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_developer),
):
    """
    Partially updates a compliance rule (only fields supplied in the request body).
    Captures old and new values in audit_log.
    Developer role required.
    """
    rule: ComplianceRule | None = (
        db.query(ComplianceRule)
        .filter(ComplianceRule.rule_id == rule_id)
        .first()
    )
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Compliance rule {rule_id} not found.",
        )

    # 1. Snapshot old state before mutation
    old_snapshot = _rule_to_dict(rule)

    # 2. Build the dict of fields to update (only those sent by the client).
    #    Use Core UPDATE (not ORM setattr) — SQLAlchemy plain ARRAY columns have
    #    no mutation tracking, so ORM setattr silently skips the UPDATE on repeat
    #    edits. Core UPDATE always emits SQL regardless of ORM identity-map state.
    from sqlalchemy import update as sql_update
    CLEARABLE = {"description", "penalty_amount"}
    update_data = body.model_dump(exclude_unset=True)
    values_to_set = {
        k: v for k, v in update_data.items()
        if v is not None or k in CLEARABLE
    }

    if values_to_set:
        db.execute(
            sql_update(ComplianceRule)
            .where(ComplianceRule.rule_id == rule_id)
            .values(**values_to_set)
        )

    # 3. Reload rule so audit log and calendar sync see the new values
    db.flush()
    db.refresh(rule)

    # 4. Audit log
    _write_audit(
        db,
        action="UPDATE",
        rule_id=rule.rule_id,
        changed_by=current_user["email"],
        old_value=old_snapshot,
        new_value=_rule_to_dict(rule),
    )

    db.commit()
    db.refresh(rule)

    # 4. Sync calendar rows — isolated in its own try/except so a sync
    #    failure never rolls back the already-committed rule update.
    try:
        _sync_calendar_for_rule(db, rule)
        db.commit()
    except Exception as e:
        db.rollback()
        # Calendar sync failed — rule is already updated, log and continue
        import logging
        logging.getLogger(__name__).warning(f"Calendar sync failed for rule {rule_id}: {e}")

    return rule


# ---------------------------------------------------------------------------
# DELETE /developer/rules/{rule_id}  (soft delete)
# ---------------------------------------------------------------------------

@router.delete(
    "/rules/{rule_id}",
    status_code=status.HTTP_200_OK,
    summary="Soft-delete a compliance rule (sets is_active = FALSE)",
)
def delete_rule(
    rule_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_developer),
):
    """
    Soft-deletes a rule by setting is_active = FALSE.
    The rule remains in the DB for audit / historical calendar entries.
    Creates a DELETE entry in audit_log.
    Developer role required.
    """
    rule: ComplianceRule | None = (
        db.query(ComplianceRule)
        .filter(ComplianceRule.rule_id == rule_id)
        .first()
    )
    if not rule:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Compliance rule {rule_id} not found.",
        )

    if not rule.is_active:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail=f"Compliance rule {rule_id} is already inactive.",
        )

    # 1. Snapshot before soft-delete
    old_snapshot = _rule_to_dict(rule)

    # 2. Soft delete
    rule.is_active = False
    db.flush()

    # 3. Audit log
    _write_audit(
        db,
        action="DELETE",
        rule_id=rule.rule_id,
        changed_by=current_user["email"],
        old_value=old_snapshot,
        new_value=_rule_to_dict(rule),  # shows is_active=False as confirmation
    )

    db.commit()
    return {"message": f"Rule {rule_id} has been deactivated (soft-deleted)."}


# ---------------------------------------------------------------------------
# POST /developer/rebuild-calendar
# ---------------------------------------------------------------------------

@router.post(
    "/rebuild-calendar",
    summary="Rebuild all calendar rows so each Branch-scope rule has correct per-state rows",
)
def rebuild_calendar(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_developer),
):
    """
    One-shot repair utility — runs _sync_calendar_for_rule for every active rule.
    Fixes legacy null branch_state rows and removes rows for states no longer in applicable_states.
    """
    all_rules = db.query(ComplianceRule).filter(ComplianceRule.is_active == True).all()

    total_deleted = 0
    total_created = 0
    for rule in all_rules:
        result = _sync_calendar_for_rule(db, rule)
        total_deleted += result["deleted"]
        total_created += result["created"]

    db.commit()
    return {
        "message": "Calendar rebuilt successfully.",
        "stale_rows_deleted": total_deleted,
        "new_rows_created":   total_created,
    }
