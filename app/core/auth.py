"""
Authentication & Authorization
- JWT for frontend (login/register → token → middleware)
- API Key for external API calls
"""
import uuid
import jwt
from datetime import datetime, timedelta
from typing import Optional
from passlib.hash import pbkdf2_sha256
from fastapi import Request, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from sqlalchemy import text

from .config import settings
from .database import get_db_session


# ═══════════════════════════════════════════
# PASSWORD HASHING
# ═══════════════════════════════════════════

def hash_password(password: str) -> str:
    return pbkdf2_sha256.hash(password)

def verify_password(password: str, hashed: str) -> bool:
    return pbkdf2_sha256.verify(password, hashed)


# ═══════════════════════════════════════════
# JWT TOKEN
# ═══════════════════════════════════════════

def create_access_token(user_id: str, username: str) -> str:
    payload = {
        "sub": user_id,
        "username": username,
        "exp": datetime.utcnow() + timedelta(minutes=settings.JWT_EXPIRE_MINUTES),
        "iat": datetime.utcnow(),
    }
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)


def decode_access_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except jwt.ExpiredSignatureError:
        return None
    except jwt.InvalidTokenError:
        return None


# ═══════════════════════════════════════════
# USER CRUD
# ═══════════════════════════════════════════

def create_users_table():
    """Ensure users table exists."""
    try:
        with get_db_session() as db:
            db.execute(text("""
                CREATE TABLE IF NOT EXISTS users (
                    id VARCHAR(36) PRIMARY KEY,
                    username VARCHAR(100) NOT NULL UNIQUE,
                    email VARCHAR(255) DEFAULT NULL,
                    password_hash VARCHAR(255) NOT NULL,
                    is_active TINYINT(1) DEFAULT 1,
                    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
                    INDEX idx_username (username)
                ) ENGINE=InnoDB
            """))
    except Exception:
        pass  # Table may already exist


def register_user(username: str, password: str, email: str = None) -> dict:
    user_id = str(uuid.uuid4())
    password_hash = hash_password(password)

    with get_db_session() as db:
        # Check if user exists
        existing = db.execute(
            text("SELECT id FROM users WHERE username = :u"), {"u": username}
        ).fetchone()
        if existing:
            raise ValueError("Username already exists")

        db.execute(text("""
            INSERT INTO users (id, username, email, password_hash)
            VALUES (:id, :username, :email, :password_hash)
        """), {
            "id": user_id, "username": username,
            "email": email, "password_hash": password_hash,
        })

    return {"id": user_id, "username": username, "email": email}


def authenticate_user(username: str, password: str) -> Optional[dict]:
    with get_db_session() as db:
        row = db.execute(
            text("SELECT id, username, email, password_hash, is_active FROM users WHERE username = :u"),
            {"u": username}
        ).mappings().first()

    if not row:
        return None
    if not row["is_active"]:
        return None
    if not verify_password(password, row["password_hash"]):
        return None

    return {"id": row["id"], "username": row["username"], "email": row["email"]}


# ═══════════════════════════════════════════
# FASTAPI DEPENDENCIES
# ═══════════════════════════════════════════

security = HTTPBearer(auto_error=False)


async def get_current_user(request: Request, credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Dual auth: JWT token (from frontend login) OR API Key (header X-API-Key).
    Public routes (health, login, register, static) skip auth.
    """
    # Check API Key first (for external API calls)
    api_key = request.headers.get("X-API-Key")
    if api_key:
        if api_key == settings.API_KEY:
            return {"id": "api_key_user", "username": "api_client", "auth_method": "api_key"}
        raise HTTPException(status_code=401, detail="Invalid API Key")

    # Check JWT token (from frontend)
    if credentials:
        payload = decode_access_token(credentials.credentials)
        if payload:
            return {"id": payload["sub"], "username": payload["username"], "auth_method": "jwt"}
        raise HTTPException(status_code=401, detail="Token expired or invalid")

    # Check cookie token (fallback for browser)
    token = request.cookies.get("access_token")
    if token:
        payload = decode_access_token(token)
        if payload:
            return {"id": payload["sub"], "username": payload["username"], "auth_method": "jwt_cookie"}
        raise HTTPException(status_code=401, detail="Token expired or invalid")

    raise HTTPException(status_code=401, detail="Authentication required")
