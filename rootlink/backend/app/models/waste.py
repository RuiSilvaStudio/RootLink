from sqlalchemy import String, Text, Integer, Float, ForeignKey, Boolean, JSON
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class CompostingHub(TimestampMixin, Base):
    __tablename__ = "composting_hubs"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    manager_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    location: Mapped[str] = mapped_column(String(255))
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    capacity_kg_week: Mapped[float | None] = mapped_column(Float, nullable=True)
    accepted_materials: Mapped[list | None] = mapped_column(JSON, nullable=True)  # ["food_scraps", "yard_waste", "coffee_grounds", ...]
    operating_hours: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_public: Mapped[bool] = mapped_column(Boolean, default=True)
    status: Mapped[str] = mapped_column(String(20), default="active")  # active, full, closed
    image_url: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    current_volume_kg: Mapped[float] = mapped_column(Float, default=0.0)


class CompostingMember(TimestampMixin, Base):
    __tablename__ = "composting_members"

    id: Mapped[int] = mapped_column(primary_key=True)
    hub_id: Mapped[int] = mapped_column(ForeignKey("composting_hubs.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    role: Mapped[str] = mapped_column(String(20), default="member")  # member, manager


class CompostingDeposit(TimestampMixin, Base):
    __tablename__ = "composting_deposits"

    id: Mapped[int] = mapped_column(primary_key=True)
    hub_id: Mapped[int] = mapped_column(ForeignKey("composting_hubs.id", ondelete="CASCADE"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    weight_kg: Mapped[float] = mapped_column(Float)
    material_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class UpcyclingProject(TimestampMixin, Base):
    __tablename__ = "upcycling_projects"

    id: Mapped[int] = mapped_column(primary_key=True)
    creator_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    title: Mapped[str] = mapped_column(String(500))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    materials_used: Mapped[list | None] = mapped_column(JSON, nullable=True)  # ["pallets", "tires", "bottles", ...]
    before_images: Mapped[list | None] = mapped_column(JSON, nullable=True)
    after_images: Mapped[list | None] = mapped_column(JSON, nullable=True)
    estimated_waste_diverted_kg: Mapped[float | None] = mapped_column(Float, nullable=True)
    difficulty: Mapped[str | None] = mapped_column(String(50), nullable=True)  # easy, intermediate, advanced
    time_spent_hours: Mapped[float | None] = mapped_column(Float, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="published")  # draft, published
    family: Mapped[str | None] = mapped_column(String(50), nullable=True)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    view_count: Mapped[int] = mapped_column(Integer, default=0)


class WasteChallenge(TimestampMixin, Base):
    __tablename__ = "waste_challenges"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(255))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    target_kg: Mapped[float] = mapped_column(Float, default=1000.0)
    current_kg: Mapped[float] = mapped_column(Float, default=0.0)
    start_date: Mapped[str | None] = mapped_column(String(20), nullable=True)
    end_date: Mapped[str | None] = mapped_column(String(20), nullable=True)
    organizer_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    status: Mapped[str] = mapped_column(String(20), default="active")  # active, completed, cancelled
    image_url: Mapped[str | None] = mapped_column(String(2000), nullable=True)
