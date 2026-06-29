import re
from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query, Request
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user, get_optional_user, get_writable_user
from app.models.content import Content, ContentSource, ContentStatus, ContentType, VerificationStatus
from app.models.moderation import ModerationAction
from app.models.points import PointBalance
from app.models.user import User
from app.schemas.article import ArticleCreate, ArticleListResponse, ArticleResponse, ArticleUpdate
from app.services.audit import log_moderation
from app.services.content_visibility import is_publicly_visible
from app.services.default_cover import default_cover_for
from app.services.embeddings import embed_text
from app.services.ranking import compute_rank
from app.services.view_tracking import should_count_view, viewer_key

router = APIRouter(prefix="/api/articles", tags=["articles"])

BOOST_SLOTS_PER_PAGE = 2


def _extract_first_image_from_body(body: dict | str | None) -> str | None:
    if not body:
        return None
    if isinstance(body, str):
        try:
            import json
            body = json.loads(body)
        except (json.JSONDecodeError, TypeError):
            return None
    blocks = body.get("blocks", [])
    for block in blocks:
        t = block.get("type", "")
        data = block.get("data", {})
        if t in ("image", "simpleImage", "attaches"):
            file_data = data.get("file")
            if isinstance(file_data, dict):
                url = file_data.get("url")
                if url:
                    return url
            if isinstance(file_data, str):
                return file_data
            url = data.get("url")
            if url:
                return url
    return None


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
        review_note=article.review_note,
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
    current_user: User = Depends(get_writable_user),
    db: AsyncSession = Depends(get_db),
):
    image_url = body.image_url
    if not image_url:
        image_url = _extract_first_image_from_body(body.body)

    article = Content(
        title=body.title,
        summary=body.summary,
        body=body.body,
        category=body.category,
        family=body.family,
        image_url=image_url,
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
    request: Request,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    result = await db.execute(select(Content).where(Content.slug == slug))
    article = result.scalar_one_or_none()
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")

    # Not-yet-live articles (drafts and published-but-awaiting-review) are only
    # viewable by their author and moderators. Everyone else gets a 404 until a
    # reviewer approves the article.
    live = is_publicly_visible(article)
    if not live:
        is_owner = current_user and article.created_by == current_user.id
        is_staff = current_user and current_user.role in ("admin", "moderator")
        if not (is_owner or is_staff):
            raise HTTPException(status_code=404, detail="Article not found")

    # Only count public views (author/mod previews don't inflate it), and only
    # one per viewer per window so refreshes/bots can't inflate it (§9.6).
    if live:
        vkey = viewer_key(current_user.id if current_user else None, request.client.host if request.client else None)
        if await should_count_view(vkey, article.id):
            article.view_count = (article.view_count or 0) + 1
            await db.commit()
            await db.refresh(article)

    return await _to_response(article, db, current_user)


@router.patch("/{article_id}", response_model=ArticleResponse)
async def update_article(
    article_id: int,
    body: ArticleUpdate,
    current_user: User = Depends(get_writable_user),
    db: AsyncSession = Depends(get_db),
):
    article = await db.get(Content, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    if article.created_by != current_user.id and current_user.role not in ("super_admin", "admin", "moderator"):
        raise HTTPException(status_code=403, detail="Not authorized")

    was_published = article.status == ContentStatus.published

    for key, val in body.model_dump(exclude_unset=True).items():
        setattr(article, key, val)

    if not article.image_url:
        first_img = _extract_first_image_from_body(article.body)
        if first_img:
            article.image_url = first_img

    # Editing published content (CONTENT_PLATFORM.md §2.4): trusted authors/staff
    # keep it live; everyone else's edits return it to review until re-approved.
    if was_published:
        trusted = (
            current_user.role in ("super_admin", "admin", "moderator")
            or current_user.can_self_publish
        )
        if not trusted:
            article.status = ContentStatus.in_review
            await log_moderation(
                db, action=ModerationAction.submit, target_type="content",
                target_id=article.id, actor_id=current_user.id,
                meta={"reason": "edit_of_published"},
            )

    article.edited_at = datetime.now(UTC)
    await db.commit()
    await db.refresh(article)
    return await _to_response(article, db, current_user)


@router.post("/{article_id}/publish", response_model=ArticleResponse)
async def publish_article(
    article_id: int,
    current_user: User = Depends(get_writable_user),
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

    # Cover required at publish (CONTENT_PLATFORM.md §6.4): satisfy via the
    # 4-source fallback chain so a published article is never blank —
    # explicit image_url -> first body image -> category default cover.
    if not article.image_url:
        first_img = _extract_first_image_from_body(article.body)
        if first_img:
            article.image_url = first_img
    if not article.image_url:
        article.image_url = default_cover_for(article.family, article.category)

    # Trust-based publishing (CONTENT_PLATFORM.md §3): staff and trusted authors
    # publish instantly; everyone else is pre-moderated into in_review. status is
    # the single visibility gate, so in_review stays hidden until a moderator
    # approves. We deliberately do NOT auto-cross-reference user articles — that
    # is the auto-verification path for crawled multi-source content.
    can_publish_live = (
        current_user.role in ("super_admin", "admin", "moderator")
        or current_user.can_self_publish
    )
    if can_publish_live:
        article.status = ContentStatus.published
        article.published_at = datetime.now(UTC)
        audit_action = ModerationAction.approve  # self-published by a trusted author
    else:
        article.status = ContentStatus.in_review
        audit_action = ModerationAction.submit
    article.verification_status = VerificationStatus.unreviewed

    # Generate the embedding now so the article is instantly searchable the
    # moment it is live (search still hides it until status=published).
    text_for_embedding = article.full_text or article.summary or article.title
    try:
        article.embedding = await embed_text(text_for_embedding)
    except Exception:
        article.embedding = None

    await log_moderation(
        db,
        action=audit_action,
        target_type="content",
        target_id=article.id,
        actor_id=current_user.id,
        meta={"status": str(article.status), "self_published": can_publish_live},
    )
    await db.commit()
    await db.refresh(article)
    return await _to_response(article, db, current_user)


@router.post("/{article_id}/appeal", response_model=ArticleResponse)
async def appeal_article(
    article_id: int,
    current_user: User = Depends(get_writable_user),
    db: AsyncSession = Depends(get_db),
):
    """Author appeals a rejected article → back to in_review (§2.5)."""
    article = await db.get(Content, article_id)
    if not article:
        raise HTTPException(status_code=404, detail="Article not found")
    if article.created_by != current_user.id:
        raise HTTPException(status_code=403, detail="Not authorized")
    if article.status != ContentStatus.rejected:
        raise HTTPException(status_code=400, detail="Only rejected content can be appealed")
    article.status = ContentStatus.in_review
    await log_moderation(
        db,
        action=ModerationAction.appeal,
        target_type="content",
        target_id=article.id,
        actor_id=current_user.id,
    )
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
