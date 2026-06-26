from datetime import datetime

from pydantic import BaseModel


class PointBalanceResponse(BaseModel):
    balance: float
    total_donated: float
    boost_active: bool
    boost_expires_at: datetime | None = None
    last_decay_at: datetime | None = None

    model_config = {"from_attributes": True}


class PointTransactionResponse(BaseModel):
    id: int
    amount: float
    reason: str
    reference_id: str | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class DonationInitiateRequest(BaseModel):
    amount_euros: int
    tier_name: str | None = None


class DonationInitiateResponse(BaseModel):
    checkout_url: str
    session_id: str


class LiberapayWebhookPayload(BaseModel):
    event_type: str
    participant_id: str | None = None
    amount: float | None = None


class PointLeaderboardEntry(BaseModel):
    user_id: int
    name: str
    avatar_url: str | None = None
    total_donated: float
