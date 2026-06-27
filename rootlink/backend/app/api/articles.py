import re
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user, get_optional_user
from app.models.content import Content, ContentStatus, ContentSource, ContentType
from app.models.points import PointBalance
from app.models.user import User
from app.schemas.article import ArticleCreate, ArticleListResponse, ArticleResponse, ArticleUpdate
from app.services.cross_reference import auto_cross_reference
from app.services.embeddings import embed_text
from app.services.ranking import compute_rank

router = APIRouter(prefix="/api/articles", tags=["articles"])

BOOST_SLOTS_PER_PAGE = 2


def _slugify(title: str) -> str:
    slug = title.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    slug = re.sub(r"-+", "-", slug)
    return slug[:480]


async def _unique_slug(db: AsyncSession, title: str) -> str:
    base = _slugify(title)
    slug = base
    n = 2
    while True:
        existing = await db.scalar(select(Content.id).where(Content.slug == slug))
        if not existing:
            return slug
        slug = f"{base}-{n}"
        n += 1


async def _to_response(article: Content, db: AsyncSession, current_user: User | None = None) -> ArticleResponse:
    author_name = None
    author_avatar = None
    if article.created_by:
        author = await db.get(User, article.created_by)
        if author:
            author_name = author.name
            author_avatar = author.avatar_url

    is_boosted = False
    if article.created_by:
        bal = await db.scalar(select(PointBalance).where(PointBalance.user_id == article.created_by))
        if bal and bal.balance > 0:
            user = await db.get(User, article.created_by)
            if user and user.boost_active:
                is_boosted = True

    return ArticleResponse(
        id=article.id,
        title=article.title,
        slug=article.slug,
        summary=article.summary,
        body=article.body,
        category=article.category,
        family=article.family,
        image_url=article.image_url,
        status=article.status,
        source=article.source.value if hasattr(article.source, "value") else str(article.source),
        source_url=article.source_url,
        canonical_url=article.canonical_url,
        created_by=article.created_by,
        author_name=author_name,
        author_avatar=author_avatar,
        published_at=article.published_at,
        edited_at=article.edited_at,
        created_at=article.created_at,
        updated_at=article.updated_at,
        verification_status=article.verification_status,
        rating_up=article.rating_up or 0,
        rating_down=article.rating_down or 0,
        view_count=article.view_count or 0,
        comment_count=article.comment_count or 0,
        bookmark_count=article.bookmark_count or 0,
        is_boosted=is_boosted,
    )


@router.post("/", response_model=ArticleResponse, status_code=201)
async def create_article(
    body: ArticleCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    article = Content(
        title=body.title,
        summary=body.summary,
        body=body.body,
        category=body.category,
        family=body.family,
        image_url=body.image_url,
        content_type=ContentType.article,
        source=ContentSource.user,
        created_by=current_user.id,
        status=ContentStatus.draft,
    )
    db.add(article)
    await db.commit()
    await db.refresh(article)
    return await _to_response(article, db, current_user)


@router.get("/my", response_model=list[ArticleResponse])
async def my_articles(
    status: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Content).where(
        Content.created_by == current_user.id,
        Content.content_type == ContentType.article,
    )
    if status:
        stmt = stmt.where(Content.status == status)
    stmt = stmt.order_by(Content.updated_at.desc()).offset(offset).limit(limit)
    result = await db.execute(stmt)
    articles = result.scalars().all()
    return [await _to_response(a, db, current_user) for a in articles]


@router.get("/feed", response_model=ArticleListResponse)
async def article_feed(
    category: str | None = Query(None),
    family: str | None = Query(None),
    limit: int = Query(20, ge=1, le=100),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    stmt = select(Content).where(
        Content.content_type == ContentType.article,
        Content.status == ContentStatus.published,
        Content.verification_status.in_(["community_reviewed", "cross_referenced"]),
    )
    if category:
        stmt = stmt.where(Content.category == category)
    if family:
        stmt = stmt.where(Content.family == family)

    result = await db.execute(stmt)
    all_articles = result.scalars().all()

    boosted_user_ids = set()
    if all_articles:
        creator_ids = {a.created_by for a in all_articles if a.created_by}
        if creator_ids:
            bal_result = await db.execute(
                select(PointBalance.user_id).where(
                    PointBalance.user_id.in_(creator_ids),
                    PointBalance.balance > 0,
                )
            )
            boosted_user_ids = {r[0] for r in bal_result.all()}

    scored = []
    for a in all_articles:
        is_boosted = a.created_by in boosted_user_ids
        rank = compute_rank(
            relevance=1.0,
            rating_up=a.rating_up or 0,
            rating_down=a.rating_down or 0,
            published_at=a.published_at,
            comments=a.comment_count or 0,
            bookmarks=a.bookmark_count or 0,
            views=a.view_count or 0,
            is_boosted=is_boosted,
        )
        scored.append((rank, a, is_boosted))

    scored.sort(key=lambda x: x[0], reverse=True)

    boosted = [(r, a, b) for r, a, b in scored if b]
    organic = [(r, a, b) for r, a, b in scored if not b]

    page_boosted = boosted[:BOOST_SLOTS_PER_PAGE]
    remaining = limit - len(page_boosted)
    page_organic = organic[offset:offset + remaining]

    final = page_boosted + page_organic
    final.sort(key=lambda x: x[0], reverse=True)

    articles = [await _to_response(a, db, current_user) for _, a, _ in final]
    return ArticleListResponse(
        articles=articles,
        total=len(scored),
        boosted_count=len(page_boosted),
    )


@router.get("/{slug}", response_model=ArticleResponse)
async def get_article(
    slug: str,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    result = await db.execute(select(Content).where(Content.slug == slug))
    article = result.scalar_one_or_none()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    if article.status == ContentStatus.draft:
        if not current_user or (article.created_by != current_user.id and current_user.role not in ("admin", "moderator")):
            raise HTTPException(status_code=404, detail="Article not found")

    article.view_count = (article.view_count or 0) + 1
    await db.commit()
    await db.refresh(article)

    return await _to_response(article, db, current_user)


@router.patch("/{article_id}", response_model=ArticleResponse)
async def update_article(
    article_id: int,
    body: ArticleUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    article = await db.get(Content, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    if article.created_by != current_user.id and current_user.role not in ("admin", "moderator"):
        raise HTTPException(status_code=403, detail="Not authorized")

    for key, val in body.model_dump(exclude_unset=True).items():
        setattr(article, key, val)

    article.edited_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(article)
    return await _to_response(article, db, current_user)


@router.post("/{article_id}/publish", response_model=ArticleResponse)
async def publish_article(
    article_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    article = await db.get(Content, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    if article.created_by != current_user.id and current_user.role not in ("admin", "moderator"):
        raise HTTPException(status_code=403, detail="Not authorized")
    if article.status == ContentStatus.published:
        raise HTTPException(status_code=400, detail="Article is already published")

    if not article.slug:
        article.slug = await _unique_slug(db, article.title)

    article.status = ContentStatus.published
    article.published_at = datetime.now(UTC)

    text_for_embedding = article.full_text or article.summary or article.title
    try:
        article.embedding = await embed_text(text_for_embedding)
    except Exception:
        article.embedding = None
    try:
        await auto_cross_reference(db, article)
    except Exception:
        pass

    await db.commit()
    await db.refresh(article)
    return await _to_response(article, db, current_user)


@router.delete("/{article_id}", status_code=204)
async def delete_article(
    article_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    article = await db.get(Content, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    if article.created_by != current_user.id and current_user.role not in ("admin", "moderator"):
        raise HTTPException(status_code=403, detail="Not authorized")
    await db.delete(article)
    await db.commit()


@router.get("/ranking/transparency")
async def ranking_transparency():
    from app.services.ranking import RANKING_DESCRIPTION, RANKING_WEIGHTS
    return {
        "formula": "score = relevance(0.40) + rating(0.25) + freshness(0.15) + engagement(0.10) + boost(0.10)",
        "weights": RANKING_WEIGHTS,
        "descriptions": RANKING_DESCRIPTION,
        "boost_slots_per_page": BOOST_SLOTS_PER_PAGE,
        "boost_label": "Community Supported",
        "freshness_half_life": "7 days",
        "rating_method": "Wilson score lower bound (thumbs up/down)",
        "engagement_signals": "comments (3x), bookmarks (2x), views (0.1x) — log-scaled",
    }
