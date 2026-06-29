import enum
from datetime import UTC, datetime

from sqlalchemy import JSON, Boolean, DateTime, Float, Integer, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class UserRole(enum.StrEnum):
    super_admin = "super_admin"
    admin = "admin"
    moderator = "moderator"
    contributor = "contributor"
    user = "user"


class AccountStatus(enum.StrEnum):
    active = "active"
    suspended = "suspended"
    banned = "banned"


class AccountType(enum.StrEnum):
    individual = "individual"
    organization = "organization"
    practitioner = "practitioner"


class EntityType(enum.StrEnum):
    ipss = "ipss"
    cooperative = "cooperative"
    association = "association"
    cer = "cer"
    ministry = "ministry"
    regulatory = "regulatory"
    adr = "adr"
    municipality = "municipality"
    company = "company"
    other = "other"


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    password_hash: Mapped[str] = mapped_column(String(255))
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    skills: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    interests: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    role: Mapped[UserRole] = mapped_column(SAEnum(UserRole), default=UserRole.user)
    visible_in_network: Mapped[bool] = mapped_column(Boolean, default=True)
    locale: Mapped[str | None] = mapped_column(String(10), nullable=True, default=None)

    # Account type & entity fields
    account_type: Mapped[str] = mapped_column(String(20), default="individual")
    entity_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    registration_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    services: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    service_area: Mapped[str | None] = mapped_column(String(255), nullable=True)
    certifications: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    modality: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    verified_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)

    website_url: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    feed_url: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    feed_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    feed_verification_token: Mapped[str | None] = mapped_column(String(255), nullable=True)
    feed_last_crawled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    feed_priority: Mapped[int] = mapped_column(Integer, default=3)

    boost_active: Mapped[bool] = mapped_column(Boolean, default=False)
    boost_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Content platform: trusted-author self-publish (see docs/content-platform/CONTENT_PLATFORM.md §3)
    can_self_publish: Mapped[bool] = mapped_column(Boolean, default=False)
    self_publish_agreed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Content platform: editable site copy permission (§12)
    can_edit_copy: Mapped[bool] = mapped_column(Boolean, default=False)

    # Content platform: account enforcement ladder (§4.4)
    account_status: Mapped[str] = mapped_column(String(20), default=AccountStatus.active)
    suspended_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    banned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ban_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    banned_by: Mapped[int | None] = mapped_column(Integer, nullable=True)

    @property
    def is_banned(self) -> bool:
        return self.account_status == AccountStatus.banned

    @property
    def is_suspended(self) -> bool:
        """True only while a suspension is active (auto-expires at suspended_until)."""
        if self.account_status != AccountStatus.suspended:
            return False
        if self.suspended_until is None:
            return True
        until = self.suspended_until
        if until.tzinfo is None:
            until = until.replace(tzinfo=UTC)
        return until > datetime.now(UTC)

    @property
    def can_author(self) -> bool:
        """Whether the user may currently create/edit content or comment."""
        return not self.is_banned and not self.is_suspended
