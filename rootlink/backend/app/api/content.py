from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user, get_optional_user
from app.models.user import User
from app.models.content import Content, Bookmark, SearchQueryLog
from app.schemas.content import ContentResponse, SearchResponse, BookmarkResponse, BookmarkCreate, IndexRequest
from app.services.search import hybrid_search
from app.services.embeddings import embed_text
from app.services.cross_reference import auto_cross_reference

router = APIRouter(prefix="/api/content", tags=["content"])


@router.get("/search", response_model=SearchResponse)
async def search(
    q: str = Query(..., min_length=1),
    category: str | None = Query(None),
    content_type: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    result = await hybrid_search(db, q, category, content_type, limit, offset)
    db.add(SearchQueryLog(query=q, result_count=result.total, user_id=current_user.id if current_user else None))
    await db.commit()
    return result


@router.get("/recent", response_model=list[ContentResponse])
async def recent(
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Content).order_by(Content.crawled_at.desc()).limit(limit)
    )
    return result.scalars().all()


@router.get("/by-category/{category}", response_model=list[ContentResponse])
async def by_category(
    category: str,
    limit: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Content)
        .where(Content.category == category)
        .order_by(Content.crawled_at.desc())
        .limit(limit)
    )
    return result.scalars().all()


@router.get("/{content_id}", response_model=ContentResponse)
async def get_content(content_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Content).where(Content.id == content_id))
    content = result.scalar_one_or_none()
    if not content:
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
