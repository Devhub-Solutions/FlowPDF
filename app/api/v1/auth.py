"""
Auth API — Login/Register endpoints
"""
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse
from pydantic import BaseModel
from typing import Optional

from ...core.auth import register_user, authenticate_user, create_access_token, create_users_table

router = APIRouter()

# Ensure users table exists on import
create_users_table()


class RegisterRequest(BaseModel):
    username: str
    password: str
    email: Optional[str] = None

class LoginRequest(BaseModel):
    username: str
    password: str


@router.post("/register")
async def register(req: RegisterRequest):
    """Register a new user."""
    if len(req.username) < 3:
        raise HTTPException(400, "Username must be at least 3 characters")
    if len(req.password) < 6:
        raise HTTPException(400, "Password must be at least 6 characters")

    try:
        user = register_user(req.username, req.password, req.email)
    except ValueError as e:
        raise HTTPException(409, str(e))

    token = create_access_token(user["id"], user["username"])
    response = JSONResponse({
        "message": "Registration successful",
        "user": {"id": user["id"], "username": user["username"]},
        "access_token": token,
        "token_type": "bearer",
    })
    response.set_cookie("access_token", token, httponly=True, max_age=28800, samesite="lax")
    return response


@router.post("/login")
async def login(req: LoginRequest):
    """Login and get JWT token."""
    user = authenticate_user(req.username, req.password)
    if not user:
        raise HTTPException(401, "Invalid username or password")

    token = create_access_token(user["id"], user["username"])
    response = JSONResponse({
        "message": "Login successful",
        "user": {"id": user["id"], "username": user["username"]},
        "access_token": token,
        "token_type": "bearer",
    })
    response.set_cookie("access_token", token, httponly=True, max_age=28800, samesite="lax")
    return response


@router.post("/logout")
async def logout():
    """Logout (clear cookie)."""
    response = JSONResponse({"message": "Logged out"})
    response.delete_cookie("access_token")
    return response
