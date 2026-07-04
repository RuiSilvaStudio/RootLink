from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin

# Roles/permissions redesign — Phase 2, per Phase 0 decision (e)
# (docs/roles-permissions/phase0-decisions.md). An allowlist table
# checked in `get_current_user`/`get_optional_user` alongside today's
# existing banned/suspended check — lets a promotion, demotion, ban,
# suspension, or password reset take effect immediately instead of waiting
# for the JWT to naturally expire (docs/roles-permissions/assessment.md §4.2's "no token
# revocation mechanism at all" gap).


class Session(TimestampMixin, Base):
    __tablename__ = "sessions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    # The JWT's `jti` claim — a random identifier embedded in the token at
    # issuance (see app/api/auth.py's register/login), not a secret itself
    # (the token's signature already protects the payload).
    token_jti: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    issued_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_reason: Mapped[str | None] = mapped_column(String(255), nullable=True)
