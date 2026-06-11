from datetime import datetime

from pydantic import BaseModel


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


class RSVPResponse(BaseModel):
    id: int
    event_id: int
    user_id: int
    created_at: datetime | None = None

    model_config = {"from_attributes": True}
