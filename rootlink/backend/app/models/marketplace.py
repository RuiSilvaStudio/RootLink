
from sqlalchemy import String, Text, Integer, Float, ForeignKey, Boolean
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class Listing(TimestampMixin, Base):
    __tablename__ = "listings"

    id: Mapped[int] = mapped_column(primary_key=True)
    seller_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    listing_type: Mapped[str] = mapped_column(String(20), default="sell")  # sell, offer, want, swap, free
    title: Mapped[str] = mapped_column(String(500))
    description: Mapped[str | None] = mapped_column(Text, nullable=True)
    family: Mapped[str | None] = mapped_column(String(50), nullable=True, index=True)
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    condition: Mapped[str | None] = mapped_column(String(50), nullable=True)  # new, like_new, good, fair, poor, n/a
    price_cents: Mapped[int] = mapped_column(Integer, default=0)
    currency: Mapped[str] = mapped_column(String(3), default="EUR")
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    status: Mapped[str] = mapped_column(String(20), default="active", index=True)  # active, sold, expired, removed
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    images: Mapped[list[str] | None] = mapped_column(String(2000), nullable=True)  # JSON array of image URLs
    estimated_waste_diverted_kg: Mapped[float | None] = mapped_column(Float, nullable=True)
    swap_preferences: Mapped[str | None] = mapped_column(Text, nullable=True)
    view_count: Mapped[int] = mapped_column(Integer, default=0)


class ListingOrder(TimestampMixin, Base):
    __tablename__ = "listing_orders"

    id: Mapped[int] = mapped_column(primary_key=True)
    listing_id: Mapped[int] = mapped_column(ForeignKey("listings.id"), index=True)
    buyer_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    seller_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    quantity: Mapped[int] = mapped_column(Integer, default=1)
    amount_cents: Mapped[int] = mapped_column(Integer, default=0)
    currency: Mapped[str] = mapped_column(String(3), default="EUR")
    payment_status: Mapped[str] = mapped_column(String(20), default="pending")  # pending, paid, failed, refunded
    payment_method: Mapped[str] = mapped_column(String(50), default="stripe")  # stripe, cash, swap, free
    stripe_payment_intent_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    stripe_checkout_session_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    fulfillment_type: Mapped[str] = mapped_column(String(20), default="pickup")  # pickup, shipping, digital, swap
    fulfillment_status: Mapped[str] = mapped_column(String(20), default="pending")  # pending, completed, cancelled
    swap_listing_id: Mapped[int | None] = mapped_column(ForeignKey("listings.id"), nullable=True)


class SellerStripeAccount(TimestampMixin, Base):
    __tablename__ = "seller_stripe_accounts"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), unique=True, index=True)
    stripe_account_id: Mapped[str] = mapped_column(String(255), unique=True)
    status: Mapped[str] = mapped_column(String(20), default="pending")  # pending, active, restricted
    details_submitted: Mapped[bool] = mapped_column(Boolean, default=False)
