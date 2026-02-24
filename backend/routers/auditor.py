"""
routers/auditor.py
Auditor panel — read-only compliance view + document flagging system.

Endpoints:
    GET  /audit/dashboard        — read-only compliance calendar (same data as company dashboard)
    POST /audit/flag/{doc_id}    — flag a document as suspicious
    GET  /audit/flags            — list all flags for the auditor's linked company
"""

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.orm import Session
from typing import Optional

from db.database import get_db
from models.models import (
    AuditFlag,
    ComplianceCalendar,
    ComplianceDocument,
    ComplianceRule,
)
from routers.deps import require_auditor, require_company_or_auditor

router = APIRouter(prefix="/audit", tags=["Auditor"])


# ---------------------------------------------------------------------------
# Pydantic schemas (inline — no need to add to schemas.py for now)
# ---------------------------------------------------------------------------

class FlagRequest(BaseModel):
    reason: str


# ---------------------------------------------------------------------------
# GET /audit/dashboard
# Read-only compliance calendar — same payload as /company/dashboard.
# The auditor is linked to a company via users.company_id.
# ---------------------------------------------------------------------------

@router.get(
    "/dashboard",
    summary="Auditor read-only compliance dashboard (same data as company dashboard)",
)
def auditor_dashboard(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_auditor),
):
    """
    Returns the full compliance calendar for the company this auditor is linked to.
    Identical payload shape to GET /company/dashboard so the frontend can reuse
    the same rendering logic with upload/action buttons hidden.
    """
    company_id = current_user.get("company_id")
    if not company_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Auditor account is not linked to any company.",
        )

    results = (
        db.query(ComplianceCalendar, ComplianceRule)
        .join(ComplianceRule, ComplianceCalendar.rule_id == ComplianceRule.rule_id)
        .filter(ComplianceCalendar.company_id == company_id)
        .all()
    )

    rows_to_return = []
    for cal, rule in results:
        rows_to_return.append({
            "calendar_id":       cal.calendar_id,
            "rule_id":           cal.rule_id,
            "branch_state":      cal.branch_state,
            "due_date":          cal.due_date.isoformat() if cal.due_date else None,
            "status":            cal.status,
            "document_url":      cal.document_url,
            "ocr_verified":      cal.ocr_verified,
            "ocr_result":        cal.ocr_result,
            "verified_at":       cal.verified_at.isoformat() if cal.verified_at else None,
            "next_due_date":     cal.next_due_date.isoformat() if cal.next_due_date else None,
            "rule_name":         rule.rule_name,
            "frequency_months":  rule.frequency_months,
            "document_required": rule.document_required,
            "penalty_impact":    rule.penalty_impact,
            "scope":             rule.scope,
            "applicable_states": rule.applicable_states or [],
        })

    # Compliance score (same weighted formula as company dashboard)
    IMPACT_WEIGHTS = {"Imprisonment": 40, "High": 30, "Medium": 20, "Low": 10}
    total_weight = sum(IMPACT_WEIGHTS.get(r["penalty_impact"], 10) for r in rows_to_return)
    completed_weight = sum(
        IMPACT_WEIGHTS.get(r["penalty_impact"], 10)
        for r in rows_to_return
        if r["status"] in ("COMPLETED", "OVERDUE-PASS")
    )
    compliance_score = (
        round((completed_weight / total_weight) * 100, 1) if total_weight > 0 else 0
    )

    statuses = [r["status"] for r in rows_to_return]
    summary = {
        "total":            len(statuses),
        "completed":        statuses.count("COMPLETED") + statuses.count("OVERDUE-PASS"),
        "pending":          statuses.count("PENDING"),
        "failed":           statuses.count("FAILED"),
        "compliance_score": compliance_score,
    }

    return {"summary": summary, "rules": rows_to_return}


# ---------------------------------------------------------------------------
# POST /audit/flag/{doc_id}
# Auditor flags a document version as suspicious.
# ---------------------------------------------------------------------------

@router.post(
    "/flag/{doc_id}",
    status_code=status.HTTP_201_CREATED,
    summary="Flag a document as suspicious (Auditor only)",
)
def flag_document(
    doc_id: int,
    body: FlagRequest,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_auditor),
):
    """
    Creates an audit_flags record for a specific compliance_documents row.
    Only auditors may raise flags. Company Admins resolve them.
    """
    company_id = current_user.get("company_id")

    # Verify the document exists and belongs to the auditor's company
    doc = db.query(ComplianceDocument).filter(
        ComplianceDocument.doc_id == doc_id
    ).first()

    if not doc:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Document {doc_id} not found.",
        )
    if doc.company_id != company_id:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You can only flag documents belonging to your linked company.",
        )

    flag = AuditFlag(
        company_id=company_id,
        doc_id=doc_id,
        flagged_by=current_user["email"],
        reason=body.reason.strip(),
        flagged_at=datetime.now(timezone.utc),
        resolved=False,
    )
    db.add(flag)
    db.commit()
    db.refresh(flag)

    return {
        "flag_id":    flag.flag_id,
        "doc_id":     doc_id,
        "flagged_by": flag.flagged_by,
        "reason":     flag.reason,
        "flagged_at": flag.flagged_at.isoformat(),
        "resolved":   False,
    }


# ---------------------------------------------------------------------------
# GET /audit/flags
# List all flags for the company — visible to both Auditor and Company Admin.
# ---------------------------------------------------------------------------

@router.get(
    "/flags",
    summary="List all audit flags for this company (Auditor + Company Admin)",
)
def list_flags(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_company_or_auditor),
):
    """
    Returns all audit flags raised on this company's documents,
    ordered newest-first. Resolved status included.
    """
    company_id = current_user.get("company_id")
    if not company_id:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Account is not linked to any company.",
        )

    flags = (
        db.query(AuditFlag)
        .filter(AuditFlag.company_id == company_id)
        .order_by(AuditFlag.flagged_at.desc())
        .all()
    )

    return [
        {
            "flag_id":     f.flag_id,
            "doc_id":      f.doc_id,
            "flagged_by":  f.flagged_by,
            "reason":      f.reason,
            "flagged_at":  f.flagged_at.isoformat() if f.flagged_at else None,
            "resolved":    f.resolved,
            "resolved_by": f.resolved_by,
            "resolved_at": f.resolved_at.isoformat() if f.resolved_at else None,
        }
        for f in flags
    ]
