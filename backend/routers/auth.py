"""
routers/auth.py
Authentication router.

Endpoints:
    POST /auth/login  — verify credentials, return JWT with role payload
"""

import os
from datetime import datetime, timedelta, timezone

from dotenv import load_dotenv
from fastapi import APIRouter, Depends, HTTPException, status
from jose import jwt
from passlib.context import CryptContext
from sqlalchemy.orm import Session

from db.database import get_db
from models.models import User
from models.schemas import LoginRequest, TokenResponse

load_dotenv()

SECRET_KEY: str = os.getenv("SECRET_KEY", "change-me")
ALGORITHM: str = os.getenv("ALGORITHM", "HS256")
ACCESS_TOKEN_EXPIRE_MINUTES: int = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", "1440"))

# ---------------------------------------------------------------------------
# Password hashing context (bcrypt)
# ---------------------------------------------------------------------------
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

router = APIRouter(prefix="/auth", tags=["Auth"])


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """Compare a plain-text password with its bcrypt hash."""
    return pwd_context.verify(plain_password, hashed_password)


def hash_password(plain_password: str) -> str:
    """Hash a plain-text password with bcrypt. Used during user creation."""
    return pwd_context.hash(plain_password)


def create_access_token(payload: dict) -> str:
    """
    Build a JWT with an expiry of ACCESS_TOKEN_EXPIRE_MINUTES.
    The caller passes the custom claims; this function appends 'exp'.
    """
    to_encode = payload.copy()
    expire = datetime.now(timezone.utc) + timedelta(minutes=ACCESS_TOKEN_EXPIRE_MINUTES)
    to_encode["exp"] = expire
    return jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)


# ---------------------------------------------------------------------------
# POST /auth/login
# ---------------------------------------------------------------------------

@router.post("/login", response_model=TokenResponse, summary="Login and get JWT token")
def login(body: LoginRequest, db: Session = Depends(get_db)):
    """
    Authenticate a user by email + password.

    **Flow:**
    1. Look up the user by email in the `users` table.
    2. Verify the submitted password against the stored bcrypt hash.
    3. Build a JWT containing `user_id`, `email`, `role`, `company_id`.
    4. Return the token (24-hour expiry by default).

    **Roles:**
    - `developer` — platform owner, no company_id
    - `company` — company admin, company_id present in token
    """
    # 1. Fetch user by email
    user: User | None = db.query(User).filter(User.email == body.email).first()

    if not user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    # 2. Verify password
    if not verify_password(body.password, user.password_hash):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid email or password.",
        )

    # 3. Build JWT payload
    token_payload = {
        "user_id":    user.user_id,
        "email":      user.email,
        "role":       user.role,
        "company_id": user.company_id,   # None for developer role
    }
    access_token = create_access_token(token_payload)

    # 4. Return token response
    return TokenResponse(
        access_token=access_token,
        token_type="bearer",
        role=user.role,
        user_id=user.user_id,
        company_id=user.company_id,
    )
