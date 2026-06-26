from datetime import datetime

from pydantic import BaseModel


class RatingCreate(BaseModel):
    reaction: str
    tags: list[str] | None = None


class RatingResponse(BaseModel):
    id: int
    content_id: int
    user_id: int
    reaction: str
    tags: list[str] | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class RatingAggregate(BaseModel):
    content_id: int
    up_count: int
    down_count: int
    top_tags: list[dict]
    user_reaction: str | None = None
