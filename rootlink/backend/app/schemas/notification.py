from datetime import datetime

from pydantic import BaseModel

from app.models.notification import NotificationType


class NotificationResponse(BaseModel):
    id: int
    user_id: int
    actor_id: int
    type: NotificationType
    message: str
    link: str | None = None
    read: bool
    created_at: datetime | None = None

    model_config = {"from_attributes": True}
