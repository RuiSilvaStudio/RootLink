"""RSS feed management.

RSS feeds are platform-managed: admins add trusted sources via
``POST /api/admin/feeds`` (auto-verified, no meta-tag dance). Users can
browse the feed library and subscribe (Phase 2). The old user-facing
connect/verify/refresh/disconnect flow has been removed.
"""
from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.feed import FeedItem, FeedSource
from app.schemas.feed import FeedSourceResponse

router = APIRouter(prefix="/api/feeds", tags=["feeds"])


@router.get("/", response_model=list[FeedSourceResponse])
async def list_platform_feeds(
    db: AsyncSession = Depends(get_db),
    _=Depends(get_current_user),
):
    """List all platform-managed RSS feed sources (any logged-in user).
    Used by the frontend to render the feed library and to look up which
    feed an article came from."""
    stmt = (
        select(
            FeedSource,
            func.count(FeedItem.id).label("item_count"),
        )
        .outerjoin(FeedItem, FeedItem.feed_source_id == FeedSource.id)
        .group_by(FeedSource.id)
        .order_by(FeedSource.title.asc())
    )
    rows = await db.execute(stmt)
    feeds = []
    for feed, _item_count in rows.fetchall():
        feeds.append(feed)
    return feeds
