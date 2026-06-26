from sqlalchemy import JSON, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class ContentRating(TimestampMixin, Base):
    __tablename__ = "content_ratings"
    __table_args__ = (
        UniqueConstraint("content_id", "user_id", name="uq_rating_user_content"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    content_id: Mapped[int] = mapped_column(ForeignKey("content.id"), index=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    reaction: Mapped[str] = mapped_column(String(10))
    tags: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
