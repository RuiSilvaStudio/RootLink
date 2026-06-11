from datetime import datetime

from pydantic import BaseModel


class CommentResponse(BaseModel):
    id: int
    content_id: int
    user_id: int
    parent_id: int | None = None
    body: str
    created_at: datetime | None = None
    replies: list["CommentResponse"] = []

    model_config = {"from_attributes": True}


class CommentCreate(BaseModel):
    content_id: int
    parent_id: int | None = None
    body: str
