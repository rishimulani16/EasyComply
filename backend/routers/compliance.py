"""
routers/compliance.py
Compliance document upload + OCR verification, and the enriched dashboard.

Note: This router has NO prefix so it can serve both:
    GET  /company/dashboard              — enriched calendar view
    POST /compliance/upload/{calendar_id} — OCR document verification
"""

import os
import re
from datetime import date, datetime, timezone
from pathlib import Path

import pytesseract
from dateutil.relativedelta import relativedelta
from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from PIL import Image
from sqlalchemy.orm import Session

from db.database import get_db
from models.models import Company, ComplianceCalendar, ComplianceRule
from routers.deps import require_company

router = APIRouter(tags=["Compliance"])

# Folder where uploaded documents are stored locally
UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Regex patterns to extract dates from OCR text
DATE_PATTERNS = [
    r"\b(\d{2})/(\d{2})/(\d{4})\b",   # DD/MM/YYYY
    r"\b(\d{4})-(\d{2})-(\d{2})\b",   # YYYY-MM-DD
]


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def _extract_text_from_file(file_path: Path, content_type: str) -> str:
    """
    Run Tesseract OCR on an uploaded file.
    - PDF  → convert each page to PIL image via pdf2image, then OCR
    - Image → open directly with Pillow, then OCR
    """
    if content_type == "application/pdf" or file_path.suffix.lower() == ".pdf":
        try:
            from pdf2image import convert_from_path
            pages = convert_from_path(str(file_path))
            return "\n".join(
                pytesseract.image_to_string(page) for page in pages
            )
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"PDF processing failed: {exc}",
            )
    else:
        try:
            img = Image.open(str(file_path))
            return pytesseract.image_to_string(img)
        except Exception as exc:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"Image OCR failed: {exc}",
            )


def _extract_date_from_text(text: str) -> date:
    """
    Try to find a date in the OCR text.
    Tries DD/MM/YYYY first, then YYYY-MM-DD.
    Falls back to today if nothing is found.
    """
    # Pattern 1: DD/MM/YYYY
    m = re.search(DATE_PATTERNS[0], text)
    if m:
        try:
            return date(int(m.group(3)), int(m.group(2)), int(m.group(1)))
        except ValueError:
            pass

    # Pattern 2: YYYY-MM-DD
    m = re.search(DATE_PATTERNS[1], text)
    if m:
        try:
            return date(int(m.group(1)), int(m.group(2)), int(m.group(3)))
        except ValueError:
            pass

    return date.today()


# ---------------------------------------------------------------------------
# GET /company/dashboard
# ---------------------------------------------------------------------------

@router.get(
    "/company/dashboard",
    summary="Compliance calendar with summary counts and auto status refresh",
)
def company_dashboard(
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_company),
):
    """
    Returns the full compliance calendar for the authenticated company.

    **Auto-status update**: any PENDING entry whose due_date has already
    passed is flipped to OVERDUE before the response is built.

    Response shape:
    ```json
    {
      "summary": {"total": N, "completed": N, "pending": N, "overdue": N},
      "rules": [{ calendar fields + rule_name, frequency_months, ... }]
    }
    ```
    """
    results = (
        db.query(ComplianceCalendar, ComplianceRule)
        .join(ComplianceRule, ComplianceCalendar.rule_id == ComplianceRule.rule_id)
        .filter(ComplianceCalendar.company_id == current_user["company_id"])
        .all()
    )

    today = date.today()
    rows_to_return = []
    updated = False

    for cal, rule in results:
        # Auto-flip PENDING → OVERDUE if past due
        if cal.due_date and cal.due_date < today and cal.status == "PENDING":
            cal.status = "OVERDUE"
            updated = True

        rows_to_return.append({
            # Calendar fields
            "calendar_id":   cal.calendar_id,
            "rule_id":       cal.rule_id,
            "branch_state":  cal.branch_state,
            # Serialise dates as plain ISO strings so the frontend parses
            # them as local dates (avoids UTC-midnight off-by-one in IST)
            "due_date":      cal.due_date.isoformat() if cal.due_date else None,
            "status":        cal.status,
            "document_url":  cal.document_url,
            "ocr_verified":  cal.ocr_verified,
            "ocr_result":    cal.ocr_result,
            "verified_at":   cal.verified_at.isoformat() if cal.verified_at else None,
            "next_due_date": cal.next_due_date.isoformat() if cal.next_due_date else None,
            # Joined rule details
            "rule_name":         rule.rule_name,
            "frequency_months":  rule.frequency_months,
            "document_required": rule.document_required,
            "penalty_impact":    rule.penalty_impact,
            "scope":             rule.scope,
        })

    if updated:
        db.commit()

    # Build summary counts
    statuses = [r["status"] for r in rows_to_return]
    summary = {
        "total":     len(statuses),
        "completed": statuses.count("COMPLETED") + statuses.count("OVERDUE-PASS"),
        "pending":   statuses.count("PENDING"),
        "overdue":   statuses.count("OVERDUE") + statuses.count("FAILED"),
    }

    return {"summary": summary, "rules": rows_to_return}


# ---------------------------------------------------------------------------
# POST /compliance/upload/{calendar_id}
# ---------------------------------------------------------------------------


# ---------------------------------------------------------------------------
# POST /compliance/upload/{calendar_id}
# ---------------------------------------------------------------------------

@router.post(
    "/compliance/upload/{calendar_id}",
    summary="Upload a compliance document and run date-based OCR verification",
)
def upload_document(
    calendar_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_company),
):
    """
    Date-based Verification Logic:
    1. Extract text via Tesseract OCR.
    2. Extract **Dates** — issue dates (<= today) and expiry dates (> today).
    3. Optionally check for the **Company Name** (reported but does not affect pass/fail).

    **Pass Condition**:
    - At least one valid date found (issue date OR expiry date).

    **Status Outcomes**:
    - `COMPLETED`    : Pass condition met + uploaded before due_date.
    - `OVERDUE-PASS` : Pass condition met + uploaded after due_date.
    - `FAILED`       : No dates found in the document.
    """
    # ------------------------------------------------------------------
    # Fetch calendar and company details
    # ------------------------------------------------------------------
    calendar: ComplianceCalendar | None = (
        db.query(ComplianceCalendar)
        .filter(ComplianceCalendar.calendar_id == calendar_id)
        .first()
    )

    if not calendar:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Calendar entry {calendar_id} not found.",
        )
    if calendar.company_id != current_user["company_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to upload for this calendar entry.",
        )

    # Fetch company name (checked optionally — does not affect pass/fail)
    company = db.query(Company).filter(Company.company_id == current_user["company_id"]).first()
    company_name_clean = re.sub(r'[^a-zA-Z0-9]', '', company.company_name.lower()) if company else ""

    # Validate file type
    allowed_types = {"application/pdf", "image/png", "image/jpeg", "image/tiff", "image/bmp"}
    if file.content_type not in allowed_types:
        raise HTTPException(
            status_code=status.HTTP_415_UNSUPPORTED_MEDIA_TYPE,
            detail=f"Unsupported file type '{file.content_type}'. Upload a PDF or image.",
        )

    # ------------------------------------------------------------------
    # Step 1 — Save file to /backend/uploads/
    # ------------------------------------------------------------------
    safe_filename = f"cal_{calendar_id}_{file.filename}"
    file_path = UPLOAD_DIR / safe_filename
    with open(file_path, "wb") as f:
        f.write(file.file.read())

    document_url = str(file_path)

    # ------------------------------------------------------------------
    # Step 2 — Extract text using Tesseract OCR
    # ------------------------------------------------------------------
    extracted_text = _extract_text_from_file(file_path, file.content_type)
    lower_text = extracted_text.lower()
    clean_text = re.sub(r'[^a-zA-Z0-9]', '', lower_text)

    # ------------------------------------------------------------------
    # Step 3 — Date Extraction (primary check)
    # We look for common date formats: DD/MM/YYYY, YYYY-MM-DD, DD-MM-YYYY, DD Mon YYYY
    # ------------------------------------------------------------------
    date_patterns = [
        r"\b(\d{1,2})[-/](\d{1,2})[-/](\d{2,4})\b",           # DD/MM/YYYY or DD-MM-YYYY
        r"\b(\d{4})[-/](\d{1,2})[-/](\d{1,2})\b",             # YYYY-MM-DD
        r"\b(\d{1,2})\s+(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\s+(\d{2,4})\b", # DD Mon YYYY
    ]

    found_dates = []
    for pat in date_patterns:
        matches = re.findall(pat, extracted_text, re.IGNORECASE)
        for m in matches:
            ds = " ".join(m) if isinstance(m, tuple) else m
            try:
                from dateutil import parser
                d = parser.parse(ds, dayfirst=True).date()
                found_dates.append(d)
            except Exception:
                pass

    found_dates = sorted(list(set(found_dates)))  # Deduplicate and sort
    today = date.today()

    expiry_dates = [d for d in found_dates if d > today]   # future dates = expiry
    issue_dates  = [d for d in found_dates if d <= today]  # past/today dates = issue

    # ------------------------------------------------------------------
    # Step 4 — Company Name Check (informational only)
    # ------------------------------------------------------------------
    name_found = bool(company_name_clean and company_name_clean in clean_text)

    # ------------------------------------------------------------------
    # Step 5 — Determine verification status
    # Pass condition: at least one date (issue OR expiry) must be present.
    # Company name is reported but does NOT affect pass/fail.
    # ------------------------------------------------------------------
    if found_dates:
        # Determine COMPLETED vs OVERDUE-PASS
        if calendar.due_date and calendar.due_date < today:
            final_status = "OVERDUE-PASS"
        else:
            final_status = "COMPLETED"

        ocr_verified = True

        # Pick anchor for next_due_date:
        # Prefer furthest expiry date; fall back to latest issue date.
        rule = db.query(ComplianceRule).filter(ComplianceRule.rule_id == calendar.rule_id).first()
        freq_months = rule.frequency_months if rule else 12

        if expiry_dates:
            anchor_date = expiry_dates[-1]   # furthest future date
        else:
            anchor_date = issue_dates[-1]    # most recent issue date

        next_due = anchor_date + relativedelta(months=freq_months)

        company_note = (
            f" Company '{company.company_name}' found in document."
            if name_found
            else f" Company '{company.company_name}' not detected (not required)."
        ) if company else ""

        ocr_result = (
            f"Verified. Issue dates: {[d.isoformat() for d in issue_dates]}. "
            f"Expiry dates: {[d.isoformat() for d in expiry_dates]}.{company_note}"
        )

    else:
        final_status = "FAILED"
        ocr_verified = False
        next_due = None
        ocr_result = "Verification Failed: No valid dates (issue date or expiry date) found in the document."

    # ------------------------------------------------------------------
    # Update calendar row
    # ------------------------------------------------------------------
    calendar.status        = final_status
    calendar.document_url  = document_url
    calendar.ocr_verified  = ocr_verified
    calendar.ocr_result    = ocr_result
    calendar.verified_at   = datetime.now(timezone.utc)
    calendar.next_due_date = next_due

    db.commit()

    return {
        "status":        final_status,
        "ocr_result":    ocr_result,
        "next_due_date": next_due,
        "issue_dates":   [d.isoformat() for d in issue_dates],
        "expiry_dates":  [d.isoformat() for d in expiry_dates],
        "company_found": name_found,
    }



# ---------------------------------------------------------------------------
# PATCH /compliance/markdone/{calendar_id}
# For rules where document_required = FALSE — no OCR needed.
# ---------------------------------------------------------------------------

from typing import Optional
from pydantic import BaseModel

class MarkDoneRequest(BaseModel):
    note: Optional[str] = None              # free-text compliance note / reference
    renewal_date: Optional[date] = None     # date the certificate/compliance was renewed
    expiry_date: Optional[date] = None      # expiry date; None = permanent (no expiry)


@router.patch(
    "/compliance/markdone/{calendar_id}",
    summary="Mark a non-document rule as COMPLETED with note, renewal date, and optional expiry date",
)
def mark_done(
    calendar_id: int,
    body: MarkDoneRequest = MarkDoneRequest(),
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_company),
):
    """
    Marks a compliance calendar entry as COMPLETED without a document upload.
    Only valid for rules where document_required = FALSE.

    **Body fields:**
    - `note`         — free-text compliance note / reference number
    - `renewal_date` — date the certificate or action was renewed/completed
    - `expiry_date`  — expiry date of the compliance; omit or set null for permanent/no expiry

    **next_due_date logic:**
    - If `expiry_date` is provided → anchor = expiry_date
    - Else if `renewal_date` is provided → anchor = renewal_date
    - Else → anchor = today

    Company Admin role required.
    """
    calendar: ComplianceCalendar | None = (
        db.query(ComplianceCalendar)
        .filter(ComplianceCalendar.calendar_id == calendar_id)
        .first()
    )

    if not calendar:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Calendar entry {calendar_id} not found.",
        )
    if calendar.company_id != current_user["company_id"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Not authorised to update this entry.",
        )

    # Guard: don't allow shortcut for document-required rules
    rule = db.query(ComplianceRule).filter(
        ComplianceRule.rule_id == calendar.rule_id
    ).first()
    if rule and rule.document_required:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="This rule requires a document upload. Use /compliance/upload instead.",
        )

    today = date.today()
    freq_months = rule.frequency_months if rule else 12

    # Determine next_due_date anchor:
    #   Priority: expiry_date > renewal_date > today
    # If permanent (no expiry_date), still use renewal_date/today as anchor for next renewal reminder.
    if body.expiry_date:
        anchor = body.expiry_date
    elif body.renewal_date:
        anchor = body.renewal_date
    else:
        anchor = today

    next_due = anchor + relativedelta(months=freq_months)

    # Build ocr_result note
    note_text    = body.note.strip() if body.note else ""
    renewal_text = f" | Renewed on: {body.renewal_date.isoformat()}" if body.renewal_date else ""
    expiry_text  = f" | Expiry date: {body.expiry_date.isoformat()}" if body.expiry_date else " | Permanent (no expiry)"
    ocr_result   = f"Manually marked done.{(' Note: ' + note_text) if note_text else ''}{renewal_text}{expiry_text}"

    calendar.status        = "COMPLETED"
    calendar.ocr_verified  = False
    calendar.ocr_result    = ocr_result
    calendar.verified_at   = datetime.now(timezone.utc)
    calendar.next_due_date = next_due

    db.commit()

    return {
        "status":        "COMPLETED",
        "calendar_id":   calendar_id,
        "next_due_date": calendar.next_due_date.isoformat() if calendar.next_due_date else None,
        "renewal_date":  body.renewal_date.isoformat() if body.renewal_date else None,
        "expiry_date":   body.expiry_date.isoformat() if body.expiry_date else None,
        "permanent":     body.expiry_date is None,
        "note":          note_text or None,
    }

