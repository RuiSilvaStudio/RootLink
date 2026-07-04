import uuid
from datetime import UTC, datetime, timedelta

from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError, jwt
from passlib.context import CryptContext
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.config import settings
from app.core.database import get_db
from app.models.user import User
from app.services.sessions import create_session, is_session_valid

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


def hash_password(plain: str) -> str:
    return pwd_context.hash(plain)


def create_access_token(data: dict) -> str:
    to_encode = data.copy()
    expire = datetime.now(UTC) + timedelta(minutes=settings.access_token_expire_minutes)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


async def issue_token_for_user(db: AsyncSession, user: User) -> str:
    """Create an access token AND its corresponding `sessions` allowlist row
    (Phase 0 decision (e)) — the register/login endpoints should call this
    instead of calling `create_access_token` directly, so every real login
    is revocable (force-logout, password reset, ban, demotion) without
    waiting for the JWT to naturally expire.

    `create_access_token` itself is untouched and still usable directly
    (e.g. by existing test fixtures) for a token with no session tracking
    — `get_current_user`/`get_optional_user` only enforce the allowlist
    check for tokens that carry a `jti` claim.
    """
    jti = uuid.uuid4().hex
    issued_at = datetime.now(UTC)
    expires_at = issued_at + timedelta(minutes=settings.access_token_expire_minutes)
    token = create_access_token({"sub": str(user.id), "jti": jti})
    await create_session(db, user_id=user.id, jti=jti, issued_at=issued_at, expires_at=expires_at)
    return token


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User:
    credentials_exception = HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail="Could not validate credentials",
        headers={"WWW-Authenticate": "Bearer"},
    )
    if token is None:
        raise credentials_exception
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id: str | None = payload.get("sub")
        jti: str | None = payload.get("jti")
        if user_id is None:
            raise credentials_exception
    except JWTError:
        raise credentials_exception

    # Session allowlist check (Phase 0 decision (e),
    # docs/roles-permissions/phase0-decisions.md): only enforced for
    # tokens that carry a `jti` claim (every token issued by the real
    # register/login endpoints does; some test fixtures construct tokens
    # directly without one, and are left untouched by this additive check).
    if jti is not None and not await is_session_valid(db, jti):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Session revoked or expired",
            headers={"WWW-Authenticate": "Bearer"},
        )

    result = await db.execute(select(User).where(User.id == int(user_id)))
    user = result.scalar_one_or_none()
    if user is None:
        raise credentials_exception
    # Enforcement ladder: banned users are fully blocked (originally
    # CONTENT_PLATFORM.md §4.4; superseded by the roles/permissions
    # redesign's 4-rung ladder, docs/roles-permissions/ROLES_PERMISSIONS.md
    # §4 — same `account_status` field, this check is unchanged since ban is
    # still the top rung either way).
    # Suspended users keep read access here; authoring is gated by get_writable_user.
    if user.is_banned:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account banned",
        )
    return user


async def get_optional_user(
    token: str | None = Depends(oauth2_scheme),
    db: AsyncSession = Depends(get_db),
) -> User | None:
    if token is None:
        return None
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id: str | None = payload.get("sub")
        jti: str | None = payload.get("jti")
        if user_id is None:
            return None
    except JWTError:
        return None
    if jti is not None and not await is_session_valid(db, jti):
        return None
    result = await db.execute(select(User).where(User.id == int(user_id)))
    user = result.scalar_one_or_none()
    if user is not None and user.is_banned:
        return None
    return user


async def get_writable_user(current_user: User = Depends(get_current_user)) -> User:
    """Require an account that may currently author content (create/edit/comment/rate).

    Banned users are already rejected by get_current_user; this additionally blocks
    temporarily-suspended users (originally CONTENT_PLATFORM.md §4.4: suspension
    blocks authoring but allows read — same rule under the roles/permissions
    redesign's ladder, docs/roles-permissions/ROLES_PERMISSIONS.md §4).
    """
    if current_user.is_suspended:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account suspended — you cannot create or edit content right now",
        )
    return current_user
