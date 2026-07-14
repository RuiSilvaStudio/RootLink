"""Blocked feed sources — a denylist of RSS feeds that were previously
rejected (e.g. excerpt-only feeds that provide no article body content).
Prevents the same feed from being re-added by an admin."""

from sqlalchemy import String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class BlockedFeed(TimestampMixin, Base):
    __tablename__ = "blocked_feeds"

    id: Mapped[int] = mapped_column(primary_key=True)
    feed_url: Mapped[str] = mapped_column(String(2000), unique=True, index=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    blocked_by: Mapped[int | None] = mapped_column(nullable=True)
