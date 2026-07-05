from datetime import datetime

from pydantic import BaseModel, Field


class CommentResponse(BaseModel):
    id: int
    entity_type: str = "content"
    entity_id: int
    user_id: int
    user_name: str | None = None
    parent_id: int | None = None
    body: str
    created_at: datetime | None = None
    updated_at: datetime | None = None
    replies: list["CommentResponse"] = []

    model_config = {"from_attributes": True}


class CommentCreate(BaseModel):
    entity_type: str = "content"
    entity_id: int
    parent_id: int | None = None
    body: str


class CommentUpdate(BaseModel):
    body: str = Field(min_length=1)
