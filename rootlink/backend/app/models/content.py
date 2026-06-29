import enum
from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class ContentType(enum.StrEnum):
    article = "article"
    event = "event"
    course = "course"
    forum = "forum"
    video = "video"


class ContentSource(enum.StrEnum):
    crawled = "crawled"
    user = "user"
    curated = "curated"


class Category(enum.StrEnum):
    gardening = "gardening"
    woodworking = "woodworking"
    craft_trades = "craft_trades"
    homesteading = "homesteading"


class VerificationStatus(enum.StrEnum):
    unreviewed = "unreviewed"
    cross_referenced = "cross_referenced"
    community_reviewed = "community_reviewed"


# Verification states that make content publicly visible (live & indexed).
# Content stays hidden from all public surfaces until it reaches one of these.
# NOTE: this is the gate for BOTH user-authored articles (which become
# community_reviewed after a human approves) and crawled content (which becomes
# cross_referenced once enough independent sources corroborate it). Crawled rows
# keep status="draft", so verification_status — not status — is the public gate.
PUBLIC_VERIFICATION_STATUSES = (
    VerificationStatus.community_reviewed,
    VerificationStatus.cross_referenced,
)


class ContentStatus(enum.StrEnum):
    draft = "draft"
    in_review = "in_review"
    published = "published"
    needs_changes = "needs_changes"
    rejected = "rejected"
    archived = "archived"


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

    slug: Mapped[str | None] = mapped_column(String(500), unique=True, nullable=True)
    body: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="draft")
    # Latest moderator note for needs_changes / rejected (surfaced to the author).
    review_note: Mapped[str | None] = mapped_column(Text, nullable=True)
    edited_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    canonical_url: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    feed_source_id: Mapped[int | None] = mapped_column(ForeignKey("feed_sources.id"), nullable=True)

    rating_up: Mapped[int] = mapped_column(Integer, default=0)
    rating_down: Mapped[int] = mapped_column(Integer, default=0)
    view_count: Mapped[int] = mapped_column(Integer, default=0)
    comment_count: Mapped[int] = mapped_column(Integer, default=0)
    bookmark_count: Mapped[int] = mapped_column(Integer, default=0)


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
