from datetime import datetime

from sqlalchemy import String, Text, DateTime, ForeignKey, Enum as SAEnum, JSON
from sqlalchemy.orm import Mapped, mapped_column
import enum

from app.models.base import Base, TimestampMixin


class ContentType(str, enum.Enum):
    article = "article"
    event = "event"
    course = "course"
    forum = "forum"
    video = "video"


class ContentSource(str, enum.Enum):
    crawled = "crawled"
    user = "user"
    curated = "curated"


class Category(str, enum.Enum):
    gardening = "gardening"
    woodworking = "woodworking"
    craft_trades = "craft_trades"
    homesteading = "homesteading"


class VerificationStatus(str, enum.Enum):
    unreviewed = "unreviewed"
    cross_referenced = "cross_referenced"
    community_reviewed = "community_reviewed"


class Content(TimestampMixin, Base):
    __tablename__ = "content"

    id: Mapped[int] = mapped_column(primary_key=True)
    title: Mapped[str] = mapped_column(String(500))
    url: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    content_type: Mapped[ContentType] = mapped_column(SAEnum(ContentType))
    category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    family: Mapped[str | None] = mapped_column(String(50), nullable=True)
    full_text: Mapped[str | None] = mapped_column(Text, nullable=True)
    summary: Mapped[str | None] = mapped_column(Text, nullable=True)
    embedding: Mapped[list[float] | None] = mapped_column(JSON, nullable=True)
    image_url: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    source: Mapped[ContentSource] = mapped_column(SAEnum(ContentSource))
    source_url: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    published_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    crawled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    verification_status: Mapped[str] = mapped_column(String(50), default="unreviewed")
    validated_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    cross_referenced_sources: Mapped[list[int] | None] = mapped_column(JSON, nullable=True)


class Bookmark(TimestampMixin, Base):
    __tablename__ = "bookmarks"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    content_id: Mapped[int] = mapped_column(ForeignKey("content.id"))
    tags: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)


class SearchQueryLog(TimestampMixin, Base):
    __tablename__ = "search_query_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    query: Mapped[str] = mapped_column(String(500))
    result_count: Mapped[int] = mapped_column(default=0)
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
