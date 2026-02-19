"""
routers/auth.py
Authentication router — placeholder structure.
Full JWT + Supabase logic will be implemented in the auth build step.
"""

from fastapi import APIRouter

router = APIRouter(prefix="/auth", tags=["Auth"])


@router.post("/login")
async def login():
    """
    POST /auth/login
    Accepts email + password, validates via Supabase Auth,
    returns a JWT with the user's role embedded.
    — Implementation coming in auth build step —
    """
    return {"message": "Login endpoint — not yet implemented"}
