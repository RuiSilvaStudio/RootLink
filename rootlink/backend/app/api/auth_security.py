"""Phase 2 baseline auth endpoints (docs/roles-permissions/ROLES_PERMISSIONS.md §1 / docs/roles-permissions/assessment.md §4.2),
confirmed entirely absent from the live system before this change: email
verification, self-service password reset, and force-logout/session
revocation. All additive — nothing here touches `/api/auth/register`,
`/api/auth/login`, or any existing endpoint's authorization logic.

Uses the plain `role`-based `require_role` dependency already established in
`app/api/admin.py` for the staff-only "revoke someone else's sessions"
endpoint — **not** the new `app.core.permissions.can()` helper. That helper
is proven by its own dedicated test suite this same session, but is
deliberately not yet wired into any real request-handling code path
(Phase 3 scope); staying consistent with the codebase's current, existing
authorization pattern here avoids a one-off, inconsistent early adoption.
"""

import hashlib
import secrets
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.admin import require_role
from app.core.database import get_db
from app.core.security import get_current_user, hash_password
from app.models.auth_tokens import EmailVerificationToken, PasswordResetToken
from app.models.moderation import ModerationAction
from app.models.user import User, UserRole
from app.schemas.auth import (
    EmailVerificationConfirmRequest,
    EmailVerificationRequestResponse,
    PasswordResetConfirmRequest,
    PasswordResetRequest,
    PasswordResetRequestResponse,
    SessionsRevokedResponse,
)
from app.services.audit import log_moderation
from app.services.sessions import revoke_all_user_sessions

router = APIRouter(prefix="/api/auth", tags=["auth-security"])

EMAIL_VERIFICATION_TTL = timedelta(hours=24)
PASSWORD_RESET_TTL = timedelta(hours=1)

require_admin_or_above = Depends(require_role([UserRole.admin]))


def _new_token() -> tuple[str, str]:
    """Returns (raw_token, sha256_hash). Only the hash is ever stored."""
    raw = secrets.token_urlsafe(32)
    digest = hashlib.sha256(raw.encode()).hexdigest()
    return raw, digest


# ---------------------------------------------------------------------------
# Email verification (docs/roles-permissions/ROLES_PERMISSIONS.md §2's "Verified user" — email path)
# ---------------------------------------------------------------------------

@router.post("/email/verify/request", response_model=EmailVerificationRequestResponse)
async def request_email_verification(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if current_user.email_verified:
        raise HTTPException(status_code=400, detail="Email already verified")
    raw, digest = _new_token()
    expires_at = datetime.now(UTC) + EMAIL_VERIFICATION_TTL
    db.add(EmailVerificationToken(user_id=current_user.id, token_hash=digest, expires_at=expires_at))
    await db.commit()
    return EmailVerificationRequestResponse(token=raw, expires_at=expires_at)


@router.post("/email/verify/confirm")
async def confirm_email_verification(
    body: EmailVerificationConfirmRequest,
    db: AsyncSession = Depends(get_db),
):
    digest = hashlib.sha256(body.token.encode()).hexdigest()
    result = await db.execute(
        select(EmailVerificationToken).where(EmailVerificationToken.token_hash == digest)
    )
    token_row = result.scalar_one_or_none()
    now = datetime.now(UTC)
    if token_row is None or token_row.used_at is not None:
        raise HTTPException(status_code=400, detail="Invalid or already-used token")
    expires_at = token_row.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)
    if expires_at < now:
        raise HTTPException(status_code=400, detail="Token expired")

    user_result = await db.execute(select(User).where(User.id == token_row.user_id))
    user = user_result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=400, detail="Invalid token")

    user.email_verified = True
    user.email_verified_at = now
    token_row.used_at = now
    await db.commit()
    return {"email_verified": True}


# ---------------------------------------------------------------------------
# Self-service password reset (docs/roles-permissions/ROLES_PERMISSIONS.md §1 baseline rule)
# ---------------------------------------------------------------------------

@router.post("/password/reset/request", response_model=PasswordResetRequestResponse)
async def request_password_reset(body: PasswordResetRequest, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == body.email))
    user = result.scalar_one_or_none()
    # Same response shape whether or not the email exists, to avoid leaking
    # which addresses are registered — only actually create a token if the
    # account exists.
    if user is None:
        return PasswordResetRequestResponse(message="If that email exists, a reset token has been created.")

    raw, digest = _new_token()
    expires_at = datetime.now(UTC) + PASSWORD_RESET_TTL
    db.add(PasswordResetToken(user_id=user.id, token_hash=digest, expires_at=expires_at))
    await db.commit()
    return PasswordResetRequestResponse(
        message="If that email exists, a reset token has been created.",
        token=raw,
        expires_at=expires_at,
    )


@router.post("/password/reset/confirm")
async def confirm_password_reset(body: PasswordResetConfirmRequest, db: AsyncSession = Depends(get_db)):
    digest = hashlib.sha256(body.token.encode()).hexdigest()
    result = await db.execute(select(PasswordResetToken).where(PasswordResetToken.token_hash == digest))
    token_row = result.scalar_one_or_none()
    now = datetime.now(UTC)
    if token_row is None or token_row.used_at is not None:
        raise HTTPException(status_code=400, detail="Invalid or already-used token")
    expires_at = token_row.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)
    if expires_at < now:
        raise HTTPException(status_code=400, detail="Token expired")

    user_result = await db.execute(select(User).where(User.id == token_row.user_id))
    user = user_result.scalar_one_or_none()
    if user is None:
        raise HTTPException(status_code=400, detail="Invalid token")

    user.password_hash = hash_password(body.new_password)
    token_row.used_at = now
    await db.commit()

    # docs/roles-permissions/ROLES_PERMISSIONS.md §1: "a compromised or removed account's login can be
    # force-expired (e.g. after a password reset or a ban)" — old sessions
    # must not survive a password reset.
    await revoke_all_user_sessions(db, user.id, reason="password reset")
    return {"password_reset": True}


# ---------------------------------------------------------------------------
# Force-logout / revoke sessions (docs/roles-permissions/ROLES_PERMISSIONS.md §7's two distinct rows:
# "Force-logout/revoke own sessions" (persona+) vs. "...someone else's"
# (admin+/entity super admin))
# ---------------------------------------------------------------------------

@router.post("/sessions/revoke-mine", response_model=SessionsRevokedResponse)
async def revoke_my_sessions(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    count = await revoke_all_user_sessions(db, current_user.id, reason="self-service force-logout")
    await log_moderation(
        db, action=ModerationAction.revoke_own_sessions, target_type="user", target_id=current_user.id,
        actor_id=current_user.id, reason="self-service force-logout",
    )
    await db.commit()
    return SessionsRevokedResponse(revoked_count=count)


@router.post("/sessions/{user_id}/revoke", response_model=SessionsRevokedResponse)
async def revoke_user_sessions_endpoint(
    user_id: int,
    current_user: User = require_admin_or_above,
    db: AsyncSession = Depends(get_db),
):
    """Staff-only: force-logout a specific user (docs/roles-permissions/ROLES_PERMISSIONS.md §7's admin+/🔑
    "revoke someone else's sessions" row). Reuses the existing `require_role`
    admin-gate pattern (super_admin already satisfies it, per that
    dependency's own super_admin-superset handling).
    """
    result = await db.execute(select(User).where(User.id == user_id))
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="User not found")
    count = await revoke_all_user_sessions(db, user_id, reason=f"revoked by staff user {current_user.id}")
    await log_moderation(
        db, action=ModerationAction.revoke_user_sessions, target_type="user", target_id=user_id,
        actor_id=current_user.id, reason="staff-initiated force-logout",
    )
    await db.commit()
    return SessionsRevokedResponse(revoked_count=count)
