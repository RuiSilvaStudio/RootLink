from datetime import datetime

from pydantic import BaseModel


class ListingCreate(BaseModel):
    listing_type: str = "sell"  # sell, offer, want, swap, free
    title: str
    description: str | None = None
    family: str | None = None
    category: str | None = None
    condition: str | None = None
    price_cents: int = 0
    currency: str = "EUR"
    quantity: int = 1
    location: str | None = None
    lat: float | None = None
    lng: float | None = None
    images: list[str] | None = None
    estimated_waste_diverted_kg: float | None = None
    swap_preferences: str | None = None


class ListingUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    family: str | None = None
    category: str | None = None
    condition: str | None = None
    price_cents: int | None = None
    quantity: int | None = None
    location: str | None = None
    images: list[str] | None = None
    swap_preferences: str | None = None
    status: str | None = None


class ListingResponse(BaseModel):
    id: int
    seller_id: int
    seller_name: str | None = None
    seller_verified: bool = False
    listing_type: str
    title: str
    description: str | None = None
    family: str | None = None
    category: str | None = None
    condition: str | None = None
    price_cents: int
    currency: str = "EUR"
    quantity: int = 1
    status: str = "active"
    location: str | None = None
    lat: float | None = None
    lng: float | None = None
    images: list[str] = []
    estimated_waste_diverted_kg: float | None = None
    swap_preferences: str | None = None
    view_count: int = 0
    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class OrderResponse(BaseModel):
    id: int
    listing_id: int
    listing_title: str | None = None
    buyer_id: int
    seller_id: int
    quantity: int = 1
    amount_cents: int
    currency: str = "EUR"
    payment_status: str = "pending"
    payment_method: str = "stripe"
    fulfillment_type: str = "pickup"
    fulfillment_status: str = "pending"
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class SellerStatusResponse(BaseModel):
    has_account: bool
    status: str = "none"
    details_submitted: bool = False
    stripe_account_id: str | None = None
