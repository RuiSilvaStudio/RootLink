from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class FeedSource(TimestampMixin, Base):
    __tablename__ = "feed_sources"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    feed_url: Mapped[str] = mapped_column(String(2000))
    site_url: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    title: Mapped[str | None] = mapped_column(String(500), nullable=True)
    verified: Mapped[bool] = mapped_column(Boolean, default=False)
    verification_token: Mapped[str | None] = mapped_column(String(255), nullable=True)
    verification_method: Mapped[str | None] = mapped_column(String(50), nullable=True)
    last_crawled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error: Mapped[str | None] = mapped_column(Text, nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
    priority: Mapped[int] = mapped_column(Integer, default=2)
    auto_sync: Mapped[bool] = mapped_column(Boolean, default=False)
    language: Mapped[str | None] = mapped_column(String(10), nullable=True)


class FeedItem(Base):
    __tablename__ = "feed_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    feed_source_id: Mapped[int] = mapped_column(ForeignKey("feed_sources.id"), index=True)
    guid: Mapped[str] = mapped_column(String(2000))
    url: Mapped[str] = mapped_column(String(2000))
    title: Mapped[str] = mapped_column(String(500))
    content_id: Mapped[int | None] = mapped_column(ForeignKey("content.id"), nullable=True)
    ingested: Mapped[bool] = mapped_column(Boolean, default=False)
    skipped_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)


class FeedSubscription(TimestampMixin, Base):
    __tablename__ = "feed_subscriptions"

    id: Mapped[int] = mapped_column(primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    feed_source_id: Mapped[int] = mapped_column(ForeignKey("feed_sources.id", ondelete="CASCADE"), index=True)

    __table_args__ = (
        UniqueConstraint("user_id", "feed_source_id", name="uq_feed_sub_user_source"),
    )
