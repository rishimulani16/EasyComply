"""
routers/compliance.py
Compliance document upload + OCR verification route — placeholder structure.
Full OCR logic (Tesseract) implemented in the compliance build step.
"""

from fastapi import APIRouter

router = APIRouter(prefix="/compliance", tags=["Compliance"])


@router.post("/upload")
async def upload_document():
    """
    POST /compliance/upload
    Accepts a PDF or image file for a specific calendar entry.
    Runs Tesseract OCR, checks for required keywords,
    extracts renewal/validity date, and updates compliance_calendar status.
    — Implementation coming in compliance build step —
    """
    return {"message": "Document upload + OCR — not yet implemented"}
