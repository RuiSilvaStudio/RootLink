from datetime import datetime

from pydantic import BaseModel


class FeedSourceCreate(BaseModel):
    feed_url: str
    site_url: str | None = None
    auto_sync: bool = False


class FeedSourceResponse(BaseModel):
    id: int
    user_id: int
    feed_url: str
    site_url: str | None = None
    title: str | None = None
    verified: bool = False
    verification_token: str | None = None
    is_active: bool = True
    priority: int = 2
    auto_sync: bool = False
    last_crawled_at: datetime | None = None
    last_error: str | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class FeedSourceStatusResponse(BaseModel):
    id: int
    feed_url: str
    verified: bool
    is_active: bool
    priority: int
    last_crawled_at: datetime | None = None
    last_error: str | None = None
    total_items: int
    ingested_items: int
    pending_review: int


class FeedItemResponse(BaseModel):
    id: int
    feed_source_id: int
    guid: str
    url: str
    title: str
    content_id: int | None = None
    ingested: bool = False
    skipped_reason: str | None = None

    model_config = {"from_attributes": True}
