import secrets

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.permissions import rank_at_least
from app.core.permissions_registry import Rank
from app.core.security import get_current_user
from app.models.feed import FeedItem, FeedSource
from app.models.points import PointBalance
from app.models.user import User
from app.schemas.feed import FeedSourceCreate, FeedSourceResponse, FeedSourceStatusResponse
from app.services.feed_parser import fetch_and_parse, verify_feed_ownership

router = APIRouter(prefix="/api/feeds", tags=["feeds"])


async def _compute_priority(db: AsyncSession, user_id: int) -> int:
    bal = await db.scalar(select(PointBalance).where(PointBalance.user_id == user_id))
    if bal and bal.balance > 0:
        return 1
    return 2


@router.post("/connect", response_model=FeedSourceResponse, status_code=201)
async def connect_feed(
    body: FeedSourceCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.scalar(
        select(FeedSource).where(
            FeedSource.user_id == current_user.id,
            FeedSource.feed_url == body.feed_url,
        )
    )
    if existing:
        raise HTTPException(status_code=400, detail="Feed already connected")

    parsed = await fetch_and_parse(body.feed_url)
    if not parsed:
        raise HTTPException(status_code=400, detail="Could not parse feed URL. Ensure it is a valid RSS/Atom feed.")

    token = secrets.token_hex(16)
    priority = await _compute_priority(db, current_user.id)

    feed = FeedSource(
        user_id=current_user.id,
        feed_url=body.feed_url,
        site_url=body.site_url or parsed.site_url,
        title=parsed.title,
        verified=False,
        verification_token=token,
        is_active=True,
        priority=priority,
        auto_sync=body.auto_sync,
    )
    db.add(feed)

    current_user.feed_url = body.feed_url
    current_user.feed_verification_token = token
    current_user.feed_priority = priority

    await db.commit()
    await db.refresh(feed)
    return feed


@router.post("/{feed_id}/verify", response_model=FeedSourceResponse)
async def verify_feed(
    feed_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    feed = await db.get(FeedSource, feed_id)
    if not feed:
        raise HTTPException(status_code=404, detail="Feed not found")
    if feed.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")

    if feed.verified:
        return feed

    site_url = feed.site_url
    if not site_url:
        raise HTTPException(status_code=400, detail="No site URL to verify against. Set site_url first.")

    verified = await verify_feed_ownership(feed.feed_url, site_url, feed.verification_token)
    if not verified:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Verification failed. Add this meta tag to your site's <head>: "
                f'<meta name="rootlink-verify" content="{feed.verification_token}">'
            ),
        )

    feed.verified = True
    feed.verification_method = "meta_tag"
    current_user.feed_verified = True

    await db.commit()
    await db.refresh(feed)
    return feed


@router.get("/", response_model=list[FeedSourceResponse])
async def list_feeds(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(FeedSource).where(FeedSource.user_id == current_user.id)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/{feed_id}/status", response_model=FeedSourceStatusResponse)
async def feed_status(
    feed_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    feed = await db.get(FeedSource, feed_id)
    if not feed:
        raise HTTPException(status_code=404, detail="Feed not found")
    # TECH_DEBT.md §0 (was missing super_admin) — Phase 3 cutover.
    if feed.user_id != current_user.id and not rank_at_least(current_user, Rank.moderator):
        raise HTTPException(status_code=403, detail="Not authorized")

    total = await db.scalar(select(func.count(FeedItem.id)).where(FeedItem.feed_source_id == feed_id)) or 0
    ingested = await db.scalar(
        select(func.count(FeedItem.id)).where(FeedItem.feed_source_id == feed_id, FeedItem.ingested.is_(True))
    ) or 0
    pending = await db.scalar(
        select(func.count(FeedItem.id)).where(FeedItem.feed_source_id == feed_id, FeedItem.ingested.is_(False))
    ) or 0

    return FeedSourceStatusResponse(
        id=feed.id,
        feed_url=feed.feed_url,
        verified=feed.verified,
        is_active=feed.is_active,
        priority=feed.priority,
        last_crawled_at=feed.last_crawled_at,
        last_error=feed.last_error,
        total_items=total,
        ingested_items=ingested,
        pending_review=pending,
    )


@router.post("/{feed_id}/refresh", response_model=dict)
async def refresh_feed(
    feed_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    feed = await db.get(FeedSource, feed_id)
    if not feed:
        raise HTTPException(status_code=404, detail="Feed not found")
    # TECH_DEBT.md §0 (was missing super_admin) — Phase 3 cutover.
    if feed.user_id != current_user.id and not rank_at_least(current_user, Rank.moderator):
        raise HTTPException(status_code=403, detail="Not authorized")

    parsed = await fetch_and_parse(feed.feed_url)
    if not parsed:
        feed.last_error = "Failed to fetch feed"
        await db.commit()
        raise HTTPException(status_code=500, detail="Failed to fetch feed")

    new_items = 0
    for item in parsed.items:
        existing = await db.scalar(
            select(FeedItem.id).where(
                FeedItem.feed_source_id == feed.id,
                FeedItem.guid == item.guid,
            )
        )
        if not existing:
            db.add(FeedItem(
                feed_source_id=feed.id,
                guid=item.guid,
                url=item.url,
                title=item.title,
            ))
            new_items += 1

    from datetime import UTC, datetime
    feed.last_crawled_at = datetime.now(UTC)
    feed.last_error = None
    await db.commit()

    return {"new_items": new_items, "total_parsed": len(parsed.items)}


@router.delete("/{feed_id}", status_code=204)
async def disconnect_feed(
    feed_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    feed = await db.get(FeedSource, feed_id)
    if not feed:
        raise HTTPException(status_code=404, detail="Feed not found")
    # TECH_DEBT.md §0 (was missing super_admin) — Phase 3 cutover.
    if feed.user_id != current_user.id and not rank_at_least(current_user, Rank.moderator):
        raise HTTPException(status_code=403, detail="Not authorized")

    await db.execute(delete(FeedItem).where(FeedItem.feed_source_id == feed_id))
    await db.delete(feed)

    if current_user.feed_url == feed.feed_url:
        current_user.feed_url = None
        current_user.feed_verified = False
        current_user.feed_verification_token = None

    await db.commit()
