"""
models/schemas.py
Pydantic v2 request / response schemas for all 5 ORM models.
Used for request validation and serialised API responses.
"""

from __future__ import annotations

from datetime import date, datetime
from typing import List, Optional

from pydantic import BaseModel, EmailStr, Field


# ===========================================================================
# ComplianceRule schemas
# ===========================================================================

class ComplianceRuleBase(BaseModel):
    rule_name: str
    description: Optional[str] = None
    industry_type: List[str] = ["ALL"]
    applicable_states: List[str] = ["ALL"]
    company_type: List[str] = ["ALL"]
    min_employees: int = 0
    max_employees: int = 999999
    frequency_months: int
    document_required: bool = False
    penalty_amount: Optional[str] = None
    penalty_impact: Optional[str] = Field(
        default=None,
        description="One of: Imprisonment | High | Medium | Low"
    )
    scope: Optional[str] = Field(
        default=None,
        description="One of: Company | Branch"
    )
    is_active: bool = True


class ComplianceRuleCreate(ComplianceRuleBase):
    """Used when the Developer adds a new rule (POST /developer/rules)."""
    pass


class ComplianceRuleUpdate(BaseModel):
    """All fields optional — Developer can patch individual fields."""
    rule_name: Optional[str] = None
    description: Optional[str] = None
    industry_type: Optional[List[str]] = None
    applicable_states: Optional[List[str]] = None
    company_type: Optional[List[str]] = None
    min_employees: Optional[int] = None
    max_employees: Optional[int] = None
    frequency_months: Optional[int] = None
    document_required: Optional[bool] = None
    penalty_amount: Optional[str] = None
    penalty_impact: Optional[str] = None
    scope: Optional[str] = None
    is_active: Optional[bool] = None


class ComplianceRuleOut(ComplianceRuleBase):
    rule_id: int

    model_config = {"from_attributes": True}


# ===========================================================================
# Company schemas
# ===========================================================================

class CompanyBase(BaseModel):
    company_name: str
    industry_type: Optional[List[str]] = None
    company_type: Optional[List[str]] = None
    hq_state: Optional[str] = None
    branch_states: Optional[List[str]] = None
    employee_count: Optional[int] = None
    subscription: Optional[str] = Field(
        default=None,
        description="One of: Basic | Enterprise"
    )


class CompanyCreate(CompanyBase):
    """Used during company signup (POST /company/signup)."""
    pass


class CompanyOut(CompanyBase):
    company_id: int
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ===========================================================================
# User schemas
# ===========================================================================

class UserBase(BaseModel):
    email: EmailStr
    role: Optional[str] = Field(
        default=None,
        description="One of: developer | company"
    )
    company_id: Optional[int] = None


class UserCreate(UserBase):
    """Received on registration. Password is plain-text; hashed before storage."""
    password: str


class UserOut(UserBase):
    user_id: int
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


# ===========================================================================
# Auth schemas
# ===========================================================================

class LoginRequest(BaseModel):
    email: EmailStr
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"
    role: str
    user_id: int
    company_id: Optional[int] = None


# ===========================================================================
# ComplianceCalendar schemas
# ===========================================================================

class ComplianceCalendarBase(BaseModel):
    company_id: Optional[int] = None
    rule_id: Optional[int] = None
    branch_state: Optional[str] = None
    due_date: Optional[date] = None
    status: str = "PENDING"
    document_url: Optional[str] = None
    ocr_verified: bool = False
    ocr_result: Optional[str] = None
    verified_at: Optional[datetime] = None
    next_due_date: Optional[date] = None


class ComplianceCalendarOut(ComplianceCalendarBase):
    calendar_id: int

    model_config = {"from_attributes": True}


class CalendarStatusUpdate(BaseModel):
    """Payload when OCR verification updates a calendar entry."""
    status: str
    document_url: Optional[str] = None
    ocr_verified: bool
    ocr_result: Optional[str] = None
    verified_at: Optional[datetime] = None
    next_due_date: Optional[date] = None


# ===========================================================================
# AuditLog schemas
# ===========================================================================

class AuditLogOut(BaseModel):
    log_id: int
    action: Optional[str] = None
    table_name: Optional[str] = None
    rule_id: Optional[int] = None
    changed_by: Optional[str] = None
    changed_at: Optional[datetime] = None
    old_value: Optional[dict] = None
    new_value: Optional[dict] = None

    model_config = {"from_attributes": True}
