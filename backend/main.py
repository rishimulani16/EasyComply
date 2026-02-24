"""
main.py — EZ Compliance Tracker API entry point
Registers all routers and configures the FastAPI application.
"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routers import auth, developer, company, compliance, auditor

# ---------------------------------------------------------------------------
# App instance
# ---------------------------------------------------------------------------
app = FastAPI(
    title="EZ Compliance Tracker API",
    description=(
        "Role-based compliance management platform for Indian companies. "
        "Tracks GST, PF, ESI and industry-specific deadlines with OCR document verification."
    ),
    version="1.0.0",
)

# ---------------------------------------------------------------------------
# CORS — allow React dev server during local development
# (tighten origins before production deployment)
# ---------------------------------------------------------------------------
app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000", "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ---------------------------------------------------------------------------
# Routers
# ---------------------------------------------------------------------------
app.include_router(auth.router)
app.include_router(developer.router)
app.include_router(company.router)
app.include_router(compliance.router)
app.include_router(auditor.router)


# ---------------------------------------------------------------------------
# Health-check endpoint
# ---------------------------------------------------------------------------
@app.get("/", tags=["Health"])
async def root():
    return {"status": "ok", "service": "EZ Compliance Tracker API v1.0"}


# ---------------------------------------------------------------------------
# Dev server entry point
# Run with:  uvicorn main:app --reload
# ---------------------------------------------------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
