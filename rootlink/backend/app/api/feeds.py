"""RSS feed management.

RSS feeds are platform-managed: admins add trusted sources via
``POST /api/admin/feeds`` (auto-verified, no meta-tag dance). Users can
subscribe to feeds they're interested in. Subscribed articles flow into
the user's activity feed (interleaved with social content).
"""

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.feed import FeedItem, FeedSource, FeedSubscription
from app.models.user import User
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


@router.post("/{feed_id}/subscribe")
async def subscribe_to_feed(
    feed_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Subscribe to an RSS feed source. Creates a FeedSubscription row.
    Idempotent — subscribing to an already-subscribed feed is a no-op."""
    feed = await db.get(FeedSource, feed_id)
    if not feed:
        raise HTTPException(status_code=404, detail="Feed source not found")

    existing = await db.scalar(
        select(FeedSubscription).where(
            FeedSubscription.user_id == current_user.id,
            FeedSubscription.feed_source_id == feed_id,
        )
    )
    if not existing:
        db.add(FeedSubscription(
            user_id=current_user.id,
            feed_source_id=feed_id,
        ))
        await db.commit()

    return {"ok": True, "feed_id": feed_id, "title": feed.title}


@router.delete("/{feed_id}/subscribe", status_code=204)
async def unsubscribe_from_feed(
    feed_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    """Unsubscribe from an RSS feed source. Removes the FeedSubscription row.
    Idempotent — unsubscribing from a non-subscribed feed is a no-op."""
    from sqlalchemy import delete
    await db.execute(
        delete(FeedSubscription).where(
            FeedSubscription.user_id == current_user.id,
            FeedSubscription.feed_source_id == feed_id,
        )
    )
    await db.commit()
