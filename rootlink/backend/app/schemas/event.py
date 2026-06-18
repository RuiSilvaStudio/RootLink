from datetime import datetime

from pydantic import BaseModel

# ── Event ──────────────────────────────────────────────────────────────

class EventResponse(BaseModel):
    id: int
    title: str
    description: str | None = None
    date: datetime
    end_date: datetime | None = None
    location: str | None = None
    url: str | None = None
    image_url: str | None = None
    is_online: bool = False
    category: str | None = None
    max_attendees: int | None = None
    attendee_count: int = 0
    group_id: int | None = None
    created_by: int
    created_at: datetime | None = None
    updated_at: datetime | None = None

    # Visibility & access
    visibility: str = "all"
    visibility_roles: list[str] | None = None
    status: str = "published"

    # Pricing
    ticket_type: str = "free"
    ticket_price: int | None = None
    ticket_tiers: list[dict] | None = None
    currency: str = "EUR"
    donation_goal: int | None = None

    # Extended info
    description_long: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None
    requirements: str | None = None
    tags: list[str] | None = None
    image_gallery: list[str] | None = None

    # Recurrence
    recurrence_type: str = "none"
    recurrence_config: dict | None = None

    model_config = {"from_attributes": True}


class EventCreate(BaseModel):
    title: str
    description: str | None = None
    date: datetime
    end_date: datetime | None = None
    location: str | None = None
    url: str | None = None
    image_url: str | None = None
    is_online: bool = False
    category: str | None = None
    max_attendees: int | None = None
    group_id: int | None = None

    visibility: str = "all"
    visibility_roles: list[str] | None = None
    status: str = "published"

    ticket_type: str = "free"
    ticket_price: int | None = None
    ticket_tiers: list[dict] | None = None
    currency: str = "EUR"
    donation_goal: int | None = None

    description_long: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None
    requirements: str | None = None
    tags: list[str] | None = None
    image_gallery: list[str] | None = None

    recurrence_type: str = "none"
    recurrence_config: dict | None = None


class EventUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    date: datetime | None = None
    end_date: datetime | None = None
    location: str | None = None
    url: str | None = None
    image_url: str | None = None
    is_online: bool | None = None
    category: str | None = None
    max_attendees: int | None = None
    group_id: int | None = None

    visibility: str | None = None
    visibility_roles: list[str] | None = None
    status: str | None = None

    ticket_type: str | None = None
    ticket_price: int | None = None
    ticket_tiers: list[dict] | None = None
    currency: str | None = None
    donation_goal: int | None = None

    description_long: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None
    requirements: str | None = None
    tags: list[str] | None = None
    image_gallery: list[str] | None = None

    recurrence_type: str | None = None
    recurrence_config: dict | None = None


# ── RSVP ───────────────────────────────────────────────────────────────

class RSVPResponse(BaseModel):
    id: int
    event_id: int
    user_id: int
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


# ── Venue ──────────────────────────────────────────────────────────────

class VenueResponse(BaseModel):
    id: int
    event_id: int
    venue_name: str | None = None
    address: str | None = None
    city: str | None = None
    postal_code: str | None = None
    country: str | None = None
    lat: float | None = None
    lng: float | None = None
    capacity: int | None = None
    indoor_outdoor: str | None = None
    parking: bool = False
    wheelchair_accessible: bool = False
    public_transport: str | None = None
    map_embed_url: str | None = None
    notes: str | None = None

    model_config = {"from_attributes": True}


class VenueCreate(BaseModel):
    venue_name: str | None = None
    address: str | None = None
    city: str | None = None
    postal_code: str | None = None
    country: str | None = None
    lat: float | None = None
    lng: float | None = None
    capacity: int | None = None
    indoor_outdoor: str | None = None
    parking: bool = False
    wheelchair_accessible: bool = False
    public_transport: str | None = None
    map_embed_url: str | None = None
    notes: str | None = None


class VenueUpdate(BaseModel):
    venue_name: str | None = None
    address: str | None = None
    city: str | None = None
    postal_code: str | None = None
    country: str | None = None
    lat: float | None = None
    lng: float | None = None
    capacity: int | None = None
    indoor_outdoor: str | None = None
    parking: bool | None = None
    wheelchair_accessible: bool | None = None
    public_transport: str | None = None
    map_embed_url: str | None = None
    notes: str | None = None


# ── Amenity ────────────────────────────────────────────────────────────

class AmenityResponse(BaseModel):
    id: int
    event_id: int
    name: str
    icon: str | None = None
    description: str | None = None
    included: bool = True
    extra_cost: int | None = None
    time_start: str | None = None
    time_end: str | None = None

    model_config = {"from_attributes": True}


class AmenityCreate(BaseModel):
    name: str
    icon: str | None = None
    description: str | None = None
    included: bool = True
    extra_cost: int | None = None
    time_start: str | None = None
    time_end: str | None = None


class AmenityUpdate(BaseModel):
    name: str | None = None
    icon: str | None = None
    description: str | None = None
    included: bool | None = None
    extra_cost: int | None = None
    time_start: str | None = None
    time_end: str | None = None


# ── Schedule ───────────────────────────────────────────────────────────

class ScheduleResponse(BaseModel):
    id: int
    event_id: int
    title: str
    description: str | None = None
    speaker_name: str | None = None
    speaker_bio: str | None = None
    speaker_avatar: str | None = None
    start_time: datetime
    end_time: datetime | None = None
    location: str | None = None
    type: str = "talk"
    max_participants: int | None = None
    requires_rsvp: bool = False
    sort_order: int = 0
    day_of_week: int | None = None

    model_config = {"from_attributes": True}


class ScheduleCreate(BaseModel):
    title: str
    description: str | None = None
    speaker_name: str | None = None
    speaker_bio: str | None = None
    speaker_avatar: str | None = None
    start_time: datetime
    end_time: datetime | None = None
    location: str | None = None
    type: str = "talk"
    max_participants: int | None = None
    requires_rsvp: bool = False
    sort_order: int = 0
    day_of_week: int | None = None


class ScheduleUpdate(BaseModel):
    title: str | None = None
    description: str | None = None
    speaker_name: str | None = None
    speaker_bio: str | None = None
    speaker_avatar: str | None = None
    start_time: datetime | None = None
    end_time: datetime | None = None
    location: str | None = None
    type: str | None = None
    max_participants: int | None = None
    requires_rsvp: bool | None = None
    sort_order: int | None = None
    day_of_week: int | None = None


# ── Sponsor ────────────────────────────────────────────────────────────

class SponsorResponse(BaseModel):
    id: int
    event_id: int
    name: str
    logo_url: str | None = None
    website_url: str | None = None
    tier: str = "community"
    description: str | None = None
    sort_order: int = 0
    contact_name: str | None = None
    contact_email: str | None = None
    contribution: int | None = None
    agreement_url: str | None = None
    agreement_status: str = "none"
    is_active: bool = True
    visible_to_attendees: bool = True

    model_config = {"from_attributes": True}


class SponsorCreate(BaseModel):
    name: str
    logo_url: str | None = None
    website_url: str | None = None
    tier: str = "community"
    description: str | None = None
    sort_order: int = 0
    contact_name: str | None = None
    contact_email: str | None = None
    contribution: int | None = None
    agreement_url: str | None = None
    agreement_status: str = "none"
    is_active: bool = True
    visible_to_attendees: bool = True


class SponsorUpdate(BaseModel):
    name: str | None = None
    logo_url: str | None = None
    website_url: str | None = None
    tier: str | None = None
    description: str | None = None
    sort_order: int | None = None
    contact_name: str | None = None
    contact_email: str | None = None
    contribution: int | None = None
    agreement_url: str | None = None
    agreement_status: str | None = None
    is_active: bool | None = None
    visible_to_attendees: bool | None = None


# ── Vendor ─────────────────────────────────────────────────────────────

class VendorResponse(BaseModel):
    id: int
    event_id: int
    name: str
    service_type: str | None = None
    contact_name: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None
    website_url: str | None = None
    cost: int | None = None
    status: str = "pending"
    notes: str | None = None
    contract_url: str | None = None
    agreement_status: str = "none"
    visible_to_attendees: bool = False

    model_config = {"from_attributes": True}


class VendorCreate(BaseModel):
    name: str
    service_type: str | None = None
    contact_name: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None
    website_url: str | None = None
    cost: int | None = None
    status: str = "pending"
    notes: str | None = None
    contract_url: str | None = None
    agreement_status: str = "none"
    visible_to_attendees: bool = False


class VendorUpdate(BaseModel):
    name: str | None = None
    service_type: str | None = None
    contact_name: str | None = None
    contact_email: str | None = None
    contact_phone: str | None = None
    website_url: str | None = None
    cost: int | None = None
    status: str | None = None
    notes: str | None = None
    contract_url: str | None = None
    agreement_status: str | None = None
    visible_to_attendees: bool | None = None


# ── Donation ───────────────────────────────────────────────────────────

class DonationResponse(BaseModel):
    id: int
    event_id: int
    user_id: int | None = None
    amount: int
    currency: str = "EUR"
    donor_name: str | None = None
    donor_email: str | None = None
    message: str | None = None
    is_anonymous: bool = False
    payment_method: str | None = None
    payment_status: str = "completed"
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class DonationCreate(BaseModel):
    amount: int
    currency: str = "EUR"
    donor_name: str | None = None
    donor_email: str | None = None
    message: str | None = None
    is_anonymous: bool = False
    payment_method: str | None = None


class DonationStats(BaseModel):
    total_raised: int
    donation_count: int
    goal: int | None = None
    progress_pct: float = 0.0


# ── Ticket ─────────────────────────────────────────────────────────────

class TicketResponse(BaseModel):
    id: int
    event_id: int
    user_id: int
    ticket_type: str = "regular"
    price: int = 0
    quantity: int = 1
    total_paid: int = 0
    payment_status: str = "completed"
    qr_code: str | None = None
    checked_in: bool = False
    checked_in_at: datetime | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class TicketPurchase(BaseModel):
    ticket_type: str = "regular"
    quantity: int = 1
    payment_method: str | None = None


# ── Check-in ───────────────────────────────────────────────────────────

class CheckInResponse(BaseModel):
    ticket_id: int
    attendee_name: str
    ticket_type: str
    checked_in_at: datetime
