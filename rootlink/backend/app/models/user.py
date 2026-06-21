import enum

from sqlalchemy import JSON, Boolean, DateTime, Float, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class UserRole(enum.StrEnum):
    admin = "admin"
    moderator = "moderator"
    contributor = "contributor"
    user = "user"


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
