import ipaddress
import socket
from urllib.parse import urlparse

import anyio
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user, get_optional_user
from app.models.content import Bookmark, Content, SearchQueryLog
from app.models.event import Event
from app.models.group import Group
from app.models.learning import Course
from app.models.points import PointBalance
from app.models.user import User
from app.schemas.content import (
    BookmarkCreate,
    BookmarkResponse,
    ContentResponse,
    IndexRequest,
    SearchResponse,
)
from app.services.content_visibility import is_publicly_visible, public_content_clause
from app.services.crawler import crawl_url
from app.services.cross_reference import auto_cross_reference
from app.services.embeddings import embed_text
from app.services.ranking import compute_rank
from app.services.search import hybrid_search

router = APIRouter(prefix="/api/content", tags=["content"])


def _is_safe_public_url(url: str) -> bool:
    """Reject non-http(s) and URLs resolving to private/loopback addresses (SSRF guard)."""
    try:
        p = urlparse(url)
    except Exception:
        return False
    if p.scheme not in ("http", "https") or not p.hostname:
        return False
    host = p.hostname.lower()
    if host == "localhost" or host.endswith(".local"):
        return False
    try:
        infos = socket.getaddrinfo(host, None)
    except Exception:
        return False
    for info in infos:
        try:
            ip = ipaddress.ip_address(info[4][0])
        except ValueError:
            return False
        if ip.is_private or ip.is_loopback or ip.is_link_local or ip.is_reserved or ip.is_multicast:
            return False
    return True


@router.get("/link-preview")
async def link_preview(url: str = Query(..., min_length=4, max_length=2000)):
    """Fetch OpenGraph/title/description/image for a URL (Editor.js LinkTool endpoint)."""
    safe = await anyio.to_thread.run_sync(_is_safe_public_url, url)
    if not safe:
        return {"success": 0}
    try:
        data = await crawl_url(url)
    except Exception:
        return {"success": 0}
    return {
        "success": 1,
        "meta": {
            "title": (data.get("title") or url)[:300],
            "description": (data.get("description") or "")[:500],
            "image": {"url": data.get("image_url") or ""},
        },
    }


@router.get("/search", response_model=SearchResponse)
async def search(
    q: str = Query(..., min_length=1),
    category: str | None = Query(None),
    family: str | None = Query(None),
    content_type: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    result = await hybrid_search(db, q, category, content_type, family, limit, offset)
    db.add(SearchQueryLog(query=q, result_count=result.total, user_id=current_user.id if current_user else None))
    await db.commit()
    return result


async def _get_boosted_user_ids(db: AsyncSession, user_ids: set[int]) -> set[int]:
    if not user_ids:
        return set()
    result = await db.execute(
        select(PointBalance.user_id).where(
            PointBalance.user_id.in_(user_ids),
            PointBalance.balance > 0,
        )
    )
    return {r[0] for r in result.all()}


@router.get("/recent", response_model=list[ContentResponse])
async def recent(
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(select(Content).where(public_content_clause()))
    items = result.scalars().all()

    creator_ids = {c.created_by for c in items if c.created_by}
    boosted_ids = await _get_boosted_user_ids(db, creator_ids)

    scored = []
    for c in items:
        is_boosted = c.created_by in boosted_ids
        rank = compute_rank(
            relevance=1.0,
            rating_up=c.rating_up or 0,
            rating_down=c.rating_down or 0,
            published_at=c.published_at or c.crawled_at,
            comments=c.comment_count or 0,
            bookmarks=c.bookmark_count or 0,
            views=c.view_count or 0,
            is_boosted=is_boosted,
        )
        scored.append((rank, c))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [c for _, c in scored[:limit]]


@router.get("/popular", response_model=list[ContentResponse])
async def popular(
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Content).where(
            Content.verification_status.in_(["community_reviewed", "cross_referenced"])
        )
    )
    items = result.scalars().all()

    creator_ids = {c.created_by for c in items if c.created_by}
    boosted_ids = await _get_boosted_user_ids(db, creator_ids)

    scored = []
    for c in items:
        is_boosted = c.created_by in boosted_ids
        rank = compute_rank(
            relevance=1.0,
            rating_up=c.rating_up or 0,
            rating_down=c.rating_down or 0,
            published_at=c.published_at or c.crawled_at,
            comments=c.comment_count or 0,
            bookmarks=c.bookmark_count or 0,
            views=c.view_count or 0,
            is_boosted=is_boosted,
        )
        scored.append((rank, c))

    scored.sort(key=lambda x: x[0], reverse=True)
    return [c for _, c in scored[:limit]]


@router.get("/by-category/{category}", response_model=list[ContentResponse])
async def by_category(
    category: str,
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Content)
        .where(Content.category == category, public_content_clause())
        .order_by(Content.crawled_at.desc())
        .limit(limit)
    )
    return result.scalars().all()


@router.get("/{content_id}", response_model=ContentResponse)
async def get_content(
    content_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    result = await db.execute(select(Content).where(Content.id == content_id))
    content = result.scalar_one_or_none()
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")
    # Hide not-yet-live content from the public; author/mods may still preview it.
    if not is_publicly_visible(content):
        is_owner = current_user and content.created_by == current_user.id
        is_staff = current_user and current_user.role in ("admin", "moderator")
        if not (is_owner or is_staff):
            raise HTTPException(status_code=404, detail="Content not found")
    return content


@router.post("/bookmarks", response_model=BookmarkResponse, status_code=201)
async def create_bookmark(
    body: BookmarkCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    bookmark = Bookmark(user_id=current_user.id, content_id=body.content_id, tags=body.tags)
    db.add(bookmark)
    await db.commit()
    await db.refresh(bookmark)
    return bookmark


@router.get("/bookmarks", response_model=list[BookmarkResponse])
async def list_bookmarks(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Bookmark).where(Bookmark.user_id == current_user.id)
    )
    return result.scalars().all()


@router.delete("/bookmarks/{bookmark_id}", status_code=204)
async def delete_bookmark(
    bookmark_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        delete(Bookmark).where(Bookmark.id == bookmark_id, Bookmark.user_id == current_user.id)
    )
    await db.commit()


@router.post("/submit", response_model=ContentResponse, status_code=201)
async def submit_content(
    body: IndexRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    embedding = await embed_text(body.full_text or body.title)
    content = Content(
        title=body.title,
        url=body.url,
        content_type=body.content_type,
        category=body.category,
        full_text=body.full_text,
        summary=body.summary,
        embedding=embedding,
        image_url=body.image_url,
        source="user",
        source_url=body.source_url,
        created_by=current_user.id,
    )
    db.add(content)
    await db.commit()
    await db.refresh(content)
    await auto_cross_reference(db, content)
    return content


@router.post("/index", response_model=ContentResponse, status_code=201)
async def index_content(
    body: IndexRequest,
    db: AsyncSession = Depends(get_db),
):
    embedding = await embed_text(body.full_text or body.title)
    content = Content(
        title=body.title,
        url=body.url,
        content_type=body.content_type,
        category=body.category,
        full_text=body.full_text,
        summary=body.summary,
        embedding=embedding,
        image_url=body.image_url,
        source=body.source,
        source_url=body.source_url,
        created_by=body.created_by,
    )
    db.add(content)
    await db.commit()
    await db.refresh(content)
    await auto_cross_reference(db, content)
    return content


@router.get("/stats/public")
async def public_stats(db: AsyncSession = Depends(get_db)):
    users_count = await db.scalar(select(func.count(User.id)))
    content_count = await db.scalar(select(func.count(Content.id)))
    groups_count = await db.scalar(select(func.count(Group.id)))
    events_count = await db.scalar(select(func.count(Event.id)))
    courses_count = await db.scalar(select(func.count(Course.id)))
    return {
        "users": users_count or 0,
        "content": content_count or 0,
        "groups": groups_count or 0,
        "events": events_count or 0,
        "courses": courses_count or 0,
    }


@router.get("/trending-searches")
async def trending_searches(
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(SearchQueryLog.query, func.count(SearchQueryLog.id).label("count"))
        .group_by(SearchQueryLog.query)
        .order_by(func.count(SearchQueryLog.id).desc())
        .limit(limit)
    )
    return [{"query": row[0], "count": row[1]} for row in result.all()]
