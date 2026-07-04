"""Session allowlist helpers (Phase 0 decision (e),
docs/roles-permissions/phase0-decisions.md).

`get_current_user`/`get_optional_user` (app/core/security.py) call
`is_session_valid` for any token that carries a `jti` claim, in addition to
the existing banned/suspended check. Tokens without a `jti` (e.g. some
existing test fixtures that call `create_access_token({"sub": ...})`
directly, without going through the real `/api/auth/login`/`register`
endpoints) skip this check entirely — additive, not a breaking change for
anything that predates this table.
"""

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.session import Session


async def create_session(
    db: AsyncSession, *, user_id: int, jti: str, issued_at: datetime, expires_at: datetime
) -> Session:
    session_row = Session(
        user_id=user_id, token_jti=jti, issued_at=issued_at, expires_at=expires_at
    )
    db.add(session_row)
    await db.commit()
    return session_row


async def is_session_valid(db: AsyncSession, jti: str) -> bool:
    result = await db.execute(select(Session).where(Session.token_jti == jti))
    session_row = result.scalar_one_or_none()
    if session_row is None:
        # No allowlist row for a jti-bearing token: treat as invalid rather
        # than fail-open — every token issued by the real login/register
        # endpoints going forward always gets a row.
        return False
    if session_row.revoked_at is not None:
        return False
    expires_at = session_row.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=UTC)
    return expires_at > datetime.now(UTC)


async def revoke_all_user_sessions(db: AsyncSession, user_id: int, reason: str) -> int:
    """Force-logout: revoke every active session for `user_id`. Returns the
    number of sessions revoked. Idempotent — already-revoked rows are
    excluded from the count and left untouched.
    """
    now = datetime.now(UTC)
    result = await db.execute(
        select(Session).where(Session.user_id == user_id, Session.revoked_at.is_(None))
    )
    rows = list(result.scalars().all())
    for row in rows:
        row.revoked_at = now
        row.revoked_reason = reason
    await db.commit()
    return len(rows)
