from datetime import datetime

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class Event(TimestampMixin, Base):
    __tablename__ = "events"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(500))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    date: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    end_date: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    location: Mapped[str | None] = mapped_column(String(500), nullable=True)
    url: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    is_online: Mapped[bool] = mapped_column(Boolean, default=False)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    max_attendees: Mapped[int | None] = mapped_column(nullable=True)
    group_id: Mapped[int | None] = mapped_column(ForeignKey("groups.id"), nullable=True)
    created_by: Mapped[int] = mapped_column(ForeignKey("users.id"))

    # Visibility & access control
    visibility: Mapped[str] = mapped_column(String(50), default="all")
    visibility_roles: Mapped[list | None] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="published")

    # Pricing
    ticket_type: Mapped[str] = mapped_column(String(50), default="free")
    ticket_price: Mapped[int | None] = mapped_column(Integer, nullable=True)
    ticket_tiers: Mapped[list | None] = mapped_column(JSON, nullable=True)
    currency: Mapped[str] = mapped_column(String(3), default="EUR")
    donation_goal: Mapped[int | None] = mapped_column(Integer, nullable=True)

    # Extended info
    description_long: Mapped[str | None] = mapped_column(Text, nullable=True)
    contact_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    contact_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    requirements: Mapped[str | None] = mapped_column(Text, nullable=True)
    tags: Mapped[list | None] = mapped_column(JSON, nullable=True)
    image_gallery: Mapped[list | None] = mapped_column(JSON, nullable=True)

    # Recurrence
    recurrence_type: Mapped[str] = mapped_column(String(50), default="none")
    recurrence_config: Mapped[list | None] = mapped_column(JSON, nullable=True)


class EventRSVP(TimestampMixin, Base):
    __tablename__ = "event_rsvps"

    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))


class EventVenue(TimestampMixin, Base):
    __tablename__ = "event_venues"

    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id"), unique=True)
    venue_name: Mapped[str | None] = mapped_column(String(500), nullable=True)
    address: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    city: Mapped[str | None] = mapped_column(String(255), nullable=True)
    postal_code: Mapped[str | None] = mapped_column(String(20), nullable=True)
    country: Mapped[str | None] = mapped_column(String(100), nullable=True)
    lat: Mapped[float | None] = mapped_column(nullable=True)
    lng: Mapped[float | None] = mapped_column(nullable=True)
    capacity: Mapped[int | None] = mapped_column(Integer, nullable=True)
    indoor_outdoor: Mapped[str | None] = mapped_column(String(50), nullable=True)
    parking: Mapped[bool] = mapped_column(Boolean, default=False)
    wheelchair_accessible: Mapped[bool] = mapped_column(Boolean, default=False)
    public_transport: Mapped[str | None] = mapped_column(String(500), nullable=True)
    map_embed_url: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)


class EventAmenity(TimestampMixin, Base):
    __tablename__ = "event_amenities"

    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id"))
    name: Mapped[str] = mapped_column(String(255))
    icon: Mapped[str | None] = mapped_column(String(100), nullable=True)
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    included: Mapped[bool] = mapped_column(Boolean, default=True)
    extra_cost: Mapped[int | None] = mapped_column(Integer, nullable=True)
    time_start: Mapped[str | None] = mapped_column(String(10), nullable=True)
    time_end: Mapped[str | None] = mapped_column(String(10), nullable=True)


class EventSchedule(TimestampMixin, Base):
    __tablename__ = "event_schedule"

    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id"))
    title: Mapped[str] = mapped_column(String(500))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    speaker_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    speaker_bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    speaker_avatar: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    start_time: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    end_time: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    type: Mapped[str] = mapped_column(String(50), default="talk")
    max_participants: Mapped[int | None] = mapped_column(Integer, nullable=True)
    requires_rsvp: Mapped[bool] = mapped_column(Boolean, default=False)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    day_of_week: Mapped[int | None] = mapped_column(Integer, nullable=True)


class EventSponsor(TimestampMixin, Base):
    __tablename__ = "event_sponsors"

    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id"))
    name: Mapped[str] = mapped_column(String(255))
    logo_url: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    website_url: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    tier: Mapped[str] = mapped_column(String(50), default="community")
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    contact_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    contact_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    contribution: Mapped[int | None] = mapped_column(Integer, nullable=True)
    agreement_url: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    agreement_status: Mapped[str] = mapped_column(String(50), default="none")
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    visible_to_attendees: Mapped[bool] = mapped_column(Boolean, default=True)


class EventVendor(TimestampMixin, Base):
    __tablename__ = "event_vendors"

    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id"))
    name: Mapped[str] = mapped_column(String(255))
    service_type: Mapped[str | None] = mapped_column(String(100), nullable=True)
    contact_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    contact_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    contact_phone: Mapped[str | None] = mapped_column(String(50), nullable=True)
    website_url: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    cost: Mapped[int | None] = mapped_column(Integer, nullable=True)
    status: Mapped[str] = mapped_column(String(50), default="pending")
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    contract_url: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    agreement_status: Mapped[str] = mapped_column(String(50), default="none")
    visible_to_attendees: Mapped[bool] = mapped_column(Boolean, default=False)


class EventDonation(TimestampMixin, Base):
    __tablename__ = "event_donations"

    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id"))
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    amount: Mapped[int] = mapped_column(Integer)
    currency: Mapped[str] = mapped_column(String(3), default="EUR")
    donor_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    donor_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    message: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_anonymous: Mapped[bool] = mapped_column(Boolean, default=False)
    payment_method: Mapped[str | None] = mapped_column(String(50), nullable=True)
    payment_status: Mapped[str] = mapped_column(String(50), default="completed")
    transaction_id: Mapped[str | None] = mapped_column(String(255), nullable=True)


class EventTicket(TimestampMixin, Base):
    __tablename__ = "event_tickets"

    id: Mapped[int] = mapped_column(primary_key=True)
    event_id: Mapped[int] = mapped_column(ForeignKey("events.id"))
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    ticket_type: Mapped[str] = mapped_column(String(100), default="regular")
    price: Mapped[int] = mapped_column(Integer, default=0)
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    total_paid: Mapped[int] = mapped_column(Integer, default=0)
    payment_status: Mapped[str] = mapped_column(String(50), default="completed")
    transaction_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    qr_code: Mapped[str | None] = mapped_column(String(255), nullable=True)
    checked_in: Mapped[bool] = mapped_column(Boolean, default=False)
    checked_in_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
