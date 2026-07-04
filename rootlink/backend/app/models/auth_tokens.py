from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin

# Roles/permissions redesign — Phase 2. Baseline auth rules docs/roles-permissions/ROLES_PERMISSIONS.md §1
# requires and docs/roles-permissions/assessment.md §4.2 confirms are entirely absent today: email
# verification and self-service password reset. Both are short-lived,
# single-use, token-based flows; no email-sending infrastructure exists yet
# (confirmed: no SMTP/mail-provider integration anywhere in this codebase),
# so — for local dev, with no real users — the request endpoints return the
# raw token directly in the API response rather than emailing it. This is
# explicitly a dev-only stand-in, called out in each endpoint's docstring;
# wiring up real email delivery is a prerequisite before this reaches real
# users. Tokens are stored as a SHA-256 hash, not the raw value, so a DB
# read alone can't produce a usable token.


class EmailVerificationToken(TimestampMixin, Base):
    __tablename__ = "email_verification_tokens"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class PasswordResetToken(TimestampMixin, Base):
    __tablename__ = "password_reset_tokens"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    token_hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    used_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
