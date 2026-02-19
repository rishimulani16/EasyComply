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
from models.models import ComplianceCalendar, ComplianceRule
from routers.deps import require_company

router = APIRouter(tags=["Compliance"])

# Folder where uploaded documents are stored locally
UPLOAD_DIR = Path(__file__).resolve().parent.parent / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

# Keywords the OCR result is checked against (all lowercase for comparison)
OCR_KEYWORDS = [
    "user consent",
    "data protection",
    "grievance officer",
    "privacy policy",
    "valid until",
    "effective date",
]

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

@router.post(
    "/compliance/upload/{calendar_id}",
    summary="Upload a compliance document and run Tesseract OCR verification",
)
def upload_document(
    calendar_id: int,
    file: UploadFile = File(...),
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_company),
):
    """
    Accepts a PDF or image, runs Tesseract OCR, checks for required keywords,
    extracts a renewal date, and updates the compliance_calendar row.

    **OCR pass condition**: ≥ 3 of 6 keywords found in the extracted text.

    **Status outcomes:**
    - `COMPLETED`   — keywords found + uploaded before due_date
    - `OVERDUE-PASS`— keywords found + uploaded after due_date
    - `FAILED`      — fewer than 3 keywords found (re-upload required)
    """
    # ------------------------------------------------------------------
    # Step 5 — Fetch calendar row and validate ownership
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

    # ------------------------------------------------------------------
    # Step 3 — Keyword check
    # ------------------------------------------------------------------
    lower_text = extracted_text.lower()
    found   = [k for k in OCR_KEYWORDS if k in lower_text]
    missing = [k for k in OCR_KEYWORDS if k not in lower_text]

    # ------------------------------------------------------------------
    # Step 4 — Extract renewal date from OCR text
    # ------------------------------------------------------------------
    renewal_date = _extract_date_from_text(extracted_text)
    today = date.today()

    # ------------------------------------------------------------------
    # Step 6 — Determine status, compute next_due, and persist
    # ------------------------------------------------------------------
    if len(found) >= 3:
        # Look up frequency from the linked rule
        rule = db.query(ComplianceRule).filter(
            ComplianceRule.rule_id == calendar.rule_id
        ).first()
        freq_months = rule.frequency_months if rule else 12
        next_due = renewal_date + relativedelta(months=freq_months)

        if calendar.due_date and calendar.due_date < today:
            final_status = "OVERDUE-PASS"
        else:
            final_status = "COMPLETED"

        ocr_verified = True
        ocr_result = f"Verified. Found keywords: {found}"
    else:
        final_status = "FAILED"
        ocr_verified = False
        ocr_result = f"Missing keywords: {missing}"
        next_due = None

    # Update calendar row
    calendar.status       = final_status
    calendar.document_url = document_url
    calendar.ocr_verified = ocr_verified
    calendar.ocr_result   = ocr_result
    calendar.verified_at  = datetime.now(timezone.utc)
    calendar.next_due_date = next_due

    db.commit()

    return {
        "status":        final_status,
        "ocr_result":    ocr_result,
        "next_due_date": next_due,
        "keywords_found":   found,
        "keywords_missing": missing,
    }


# ---------------------------------------------------------------------------
# PATCH /compliance/markdone/{calendar_id}
# For rules where document_required = FALSE — no OCR needed.
# ---------------------------------------------------------------------------

@router.patch(
    "/compliance/markdone/{calendar_id}",
    summary="Mark a non-document rule as COMPLETED",
)
def mark_done(
    calendar_id: int,
    db: Session = Depends(get_db),
    current_user: dict = Depends(require_company),
):
    """
    Marks a compliance calendar entry as COMPLETED without requiring a document upload.
    Only valid for rules where document_required = FALSE.
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

    calendar.status        = "COMPLETED"
    calendar.ocr_verified  = False
    calendar.verified_at   = datetime.now(timezone.utc)
    calendar.next_due_date = today + relativedelta(months=freq_months)

    db.commit()

    return {
        "status":        "COMPLETED",
        "calendar_id":   calendar_id,
        "next_due_date": calendar.next_due_date.isoformat() if calendar.next_due_date else None,
    }

