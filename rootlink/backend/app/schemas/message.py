from datetime import datetime

from pydantic import BaseModel


class ConversationResponse(BaseModel):
    id: int
    other_user: dict | None = None
    last_message: str | None = None
    last_message_at: datetime | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class MessageResponse(BaseModel):
    id: int
    conversation_id: int
    sender_id: int
    body: str
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class MessageCreate(BaseModel):
    body: str
