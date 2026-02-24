"""
routers/deps.py
Shared FastAPI dependencies.

get_current_user() — decodes the Bearer JWT and returns the token payload.
                     Raise 401 for any invalid / expired token.
"""

import os
from typing import Optional

from dotenv import load_dotenv
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import ExpiredSignatureError, JWTError, jwt

load_dotenv()

SECRET_KEY: str = os.getenv("SECRET_KEY", "change-me")
ALGORITHM: str = os.getenv("ALGORITHM", "HS256")

# HTTPBearer extracts the token from "Authorization: Bearer <token>"
bearer_scheme = HTTPBearer()


def get_current_user(
    credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme),
) -> dict:
    """
    FastAPI dependency — validates the JWT and returns its payload.

    Returns:
        {
            "user_id":    int,
            "email":      str,
            "role":       str,   # 'developer' | 'company'
            "company_id": int | None
        }

    Raises:
        HTTPException 401 — token missing, expired, or invalid.
    """
    token = credentials.credentials

    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials. Please log in again.",
        headers={"WWW-Authenticate": "Bearer"},
    )

    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
    except ExpiredSignatureError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Token has expired. Please log in again.",
            headers={"WWW-Authenticate": "Bearer"},
        )
    except JWTError:
        raise credentials_exception

    user_id: Optional[int] = payload.get("user_id")
    email: Optional[str] = payload.get("email")
    role: Optional[str] = payload.get("role")

    if user_id is None or email is None or role is None:
        raise credentials_exception

    return {
        "user_id":    user_id,
        "email":      email,
        "role":       role,
        "company_id": payload.get("company_id"),   # None for developer role
    }


def require_developer(current_user: dict = Depends(get_current_user)) -> dict:
    """
    Guard dependency — only allows users with role='developer'.
    Drop-in replacement for get_current_user on Developer-only routes.
    """
    if current_user["role"] != "developer":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to Developer/Owner accounts.",
        )
    return current_user


def require_company(current_user: dict = Depends(get_current_user)) -> dict:
    """
    Guard dependency — only allows users with role='company'.
    Drop-in replacement for get_current_user on Company Admin-only routes.
    """
    if current_user["role"] != "company":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to Company Admin accounts.",
        )
    return current_user


def require_auditor(current_user: dict = Depends(get_current_user)) -> dict:
    """
    Guard dependency — only allows users with role='auditor'.
    """
    if current_user["role"] != "auditor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to Auditor accounts.",
        )
    return current_user


def require_company_or_auditor(current_user: dict = Depends(get_current_user)) -> dict:
    """
    Guard dependency — allows both Company Admin and Auditor roles.
    Used for shared read endpoints (flags list, document download, etc.).
    """
    if current_user["role"] not in ("company", "auditor"):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access restricted to Company Admin or Auditor accounts.",
        )
    return current_user
