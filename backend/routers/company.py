"""
routers/company.py
Company Admin panel routes — placeholder structure.
Covers: signup/onboarding, compliance dashboard.
Full logic implemented in the company build step.
"""

from fastapi import APIRouter

router = APIRouter(prefix="/company", tags=["Company"])


@router.post("/signup")
async def company_signup():
    """
    POST /company/signup
    Registers a new company, triggers the auto-matching query,
    populates compliance_calendar with PENDING entries.
    — Implementation coming in company build step —
    """
    return {"message": "Company signup — not yet implemented"}


@router.get("/dashboard")
async def company_dashboard():
    """
    GET /company/dashboard
    Returns all matched compliance rules for the authenticated company,
    sorted by nearest due date, with current status.
    — Implementation coming in company build step —
    """
    return {"message": "Company dashboard — not yet implemented"}
