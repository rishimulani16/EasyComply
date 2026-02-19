"""
routers/developer.py
Developer/Owner panel routes — placeholder structure.
Covers: list companies, CRUD on compliance rules.
Full logic implemented in the developer build step.
"""

from fastapi import APIRouter

router = APIRouter(prefix="/developer", tags=["Developer"])


@router.get("/companies")
async def list_companies():
    """
    GET /developer/companies
    Returns all subscribed companies.
    — Implementation coming in developer build step —
    """
    return {"message": "List companies — not yet implemented"}


@router.post("/rules")
async def add_rule():
    """
    POST /developer/rules
    Adds a new compliance rule to the DB and writes to audit_log.
    — Implementation coming in developer build step —
    """
    return {"message": "Add rule — not yet implemented"}


@router.put("/rules/{rule_id}")
async def update_rule(rule_id: int):
    """
    PUT /developer/rules/{rule_id}
    Updates an existing compliance rule and writes to audit_log.
    — Implementation coming in developer build step —
    """
    return {"message": f"Update rule {rule_id} — not yet implemented"}


@router.delete("/rules/{rule_id}")
async def delete_rule(rule_id: int):
    """
    DELETE /developer/rules/{rule_id}
    Soft-deletes a rule (sets is_active = FALSE) and writes to audit_log.
    — Implementation coming in developer build step —
    """
    return {"message": f"Delete rule {rule_id} — not yet implemented"}
