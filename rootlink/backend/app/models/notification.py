import enum

from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class NotificationType(enum.StrEnum):
    follow = "follow"
    comment = "comment"
    reply = "reply"
    group_join = "group_join"
    event_rsvp = "event_rsvp"
    system = "system"
    message = "message"
    feed_digest = "feed_digest"


class Notification(TimestampMixin, Base):
    __tablename__ = "notifications"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    actor_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    type: Mapped[NotificationType] = mapped_column(SAEnum(NotificationType))
    message: Mapped[str] = mapped_column(String(500))
    link: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    read: Mapped[bool] = mapped_column(Boolean, default=False)
