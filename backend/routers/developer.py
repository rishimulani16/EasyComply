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
    Developer role required.
    """
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

    # 2. Apply only the fields that were explicitly supplied in the request
    update_data = body.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(rule, field, value)

    db.flush()  # apply changes so _rule_to_dict reflects new state

    # 3. Audit log
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
