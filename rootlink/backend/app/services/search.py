import math

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.content import Content
from app.models.event import Event
from app.models.group import Group
from app.models.learning import Course, Lesson
from app.models.plant import Plant
from app.models.points import PointBalance
from app.schemas.content import SearchContentResponse, SearchResponse, SearchResult
from app.services.embeddings import embed_text
from app.services.ranking import compute_rank


def cosine_similarity(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b, strict=False))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def keyword_score(query: str, *fields: str | None) -> float:
    text = " ".join(f or "" for f in fields).lower()
    words = query.lower().split()
    matches = sum(1 for w in words if w in text)
    if not words:
        return 0.0
    return matches / len(words)


def _normalize_category(cat, enum_cls=None) -> str:
    if cat is None:
        return ""
    if enum_cls and hasattr(cat, 'value'):
        return cat.value
    if hasattr(cat, 'value'):
        return cat.value
    return str(cat)


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


async def hybrid_search(
    db: AsyncSession,
    query: str,
    category: str | None = None,
    content_type: str | None = None,
    family: str | None = None,
    limit: int = 20,
    offset: int = 0,
) -> SearchResponse:
    query_embedding = await embed_text(query)

    scored = []

    # --- Articles ---
    if content_type in (None, "article"):
        stmt = select(Content)
        if category:
            stmt = stmt.where(Content.category == category)
        if family:
            stmt = stmt.where(Content.family == family)
        result = await db.execute(stmt)
        articles = result.scalars().all()

        creator_ids = {c.created_by for c in articles if c.created_by}
        boosted_ids = await _get_boosted_user_ids(db, creator_ids)

        for c in articles:
            semantic_score = 0.0
            if c.embedding:
                semantic_score = cosine_similarity(query_embedding, c.embedding)
            kw = keyword_score(query, c.title, c.full_text)
            relevance = semantic_score * 0.5 + kw * 0.5

            is_boosted = c.created_by in boosted_ids
            rank = compute_rank(
                relevance=relevance,
                rating_up=c.rating_up or 0,
                rating_down=c.rating_down or 0,
                published_at=c.published_at or c.crawled_at,
                comments=c.comment_count or 0,
                bookmarks=c.bookmark_count or 0,
                views=c.view_count or 0,
                is_boosted=is_boosted,
            )

            scored.append((rank, {
                "id": c.id,
                "title": c.title,
                "url": c.url,
                "content_type": "article",
                "category": _normalize_category(c.category),
                "summary": c.summary,
                "image_url": c.image_url,
                "source": _normalize_category(c.source),
                "source_url": c.source_url,
                "created_by": c.created_by,
                "published_at": c.published_at,
                "crawled_at": c.crawled_at,
                "created_at": c.created_at,
                "verification_status": _normalize_category(c.verification_status),
                "validated_by": c.validated_by,
                "cross_referenced_sources": c.cross_referenced_sources,
            }))

    # --- Events ---
    if content_type in (None, "event"):
        stmt = select(Event)
        if category:
            stmt = stmt.where(Event.category == category)
        if family:
            stmt = stmt.where(Event.family == family)
        result = await db.execute(stmt)
        for e in result.scalars().all():
            kw = keyword_score(query, e.title, e.description, e.location)
            scored.append((kw, {
                "id": e.id,
                "title": e.title,
                "url": e.url,
                "content_type": "event",
                "category": e.category or "",
                "summary": e.description,
                "image_url": e.image_url,
                "source": "user",
                "source_url": None,
                "created_by": e.created_by,
                "published_at": e.date,
                "crawled_at": None,
                "created_at": e.created_at,
                "verification_status": "unreviewed",
                "validated_by": None,
                "cross_referenced_sources": None,
            }))

    # --- Courses ---
    if content_type in (None, "course"):
        stmt = select(Course)
        if category:
            stmt = stmt.where(Course.category == category)
        if family:
            stmt = stmt.where(Course.family == family)
        result = await db.execute(stmt)
        for co in result.scalars().all():
            kw = keyword_score(query, co.title, co.description)
            scored.append((kw, {
                "id": co.id,
                "title": co.title,
                "url": None,
                "content_type": "course",
                "category": co.category or "",
                "summary": co.description,
                "image_url": co.image_url,
                "source": "user",
                "source_url": None,
                "created_by": co.created_by,
                "published_at": None,
                "crawled_at": None,
                "created_at": co.created_at,
                "verification_status": "unreviewed",
                "validated_by": None,
                "cross_referenced_sources": None,
            }))

    # --- Videos (lessons with video_url) ---
    if content_type in (None, "video"):
        stmt = select(Lesson).where(Lesson.video_url.isnot(None))
        result = await db.execute(stmt)
        for les in result.scalars().all():
            kw = keyword_score(query, les.title, les.body)
            scored.append((kw, {
                "id": les.id,
                "title": les.title,
                "url": les.video_url,
                "content_type": "video",
                "category": "",
                "summary": les.body,
                "image_url": None,
                "source": "user",
                "source_url": None,
                "created_by": None,
                "published_at": None,
                "crawled_at": None,
                "created_at": les.created_at,
                "verification_status": "unreviewed",
                "validated_by": None,
                "cross_referenced_sources": None,
            }))

    # --- Groups ---
    if content_type in (None, "group"):
        stmt = select(Group)
        if category:
            stmt = stmt.where(Group.category == category)
        if family:
            stmt = stmt.where(Group.family == family)
        result = await db.execute(stmt)
        for g in result.scalars().all():
            kw = keyword_score(query, g.name, g.description)
            scored.append((kw, {
                "id": g.id,
                "title": g.name,
                "url": f"/groups/{g.id}",
                "content_type": "group",
                "category": _normalize_category(g.category),
                "summary": g.description,
                "image_url": g.image_url,
                "source": "user",
                "source_url": None,
                "created_by": g.created_by,
                "published_at": None,
                "crawled_at": None,
                "created_at": g.created_at,
                "verification_status": "unreviewed",
                "validated_by": None,
                "cross_referenced_sources": None,
            }))

    # --- Plants ---
    if content_type in (None, "plant"):
        stmt = select(Plant)
        result = await db.execute(stmt)
        for p in result.scalars().all():
            # Build searchable text from all name fields
            common_pt = " ".join(p.common_names_pt) if p.common_names_pt else ""
            common_en = " ".join(p.common_names_en) if p.common_names_en else ""
            kw = keyword_score(query, p.scientific_name, p.scientific_name_full, common_pt, common_en, p.genus, p.family, p.plant_type)
            # Show common names as summary
            names = []
            if p.common_names_en:
                names.extend(p.common_names_en[:3])
            if p.common_names_pt:
                names.extend(p.common_names_pt[:3])
            summary = ", ".join(names) if names else p.scientific_name

            scored.append((kw, {
                "id": p.id,
                "title": p.scientific_name,
                "url": f"/plants/{p.id}",
                "content_type": "plant",
                "category": p.plant_type or "",
                "summary": summary,
                "image_url": p.image_url,
                "source": "database",
                "source_url": p.source_url,
                "created_by": None,
                "published_at": None,
                "crawled_at": None,
                "created_at": p.created_at,
                "verification_status": "unreviewed",
                "validated_by": None,
                "cross_referenced_sources": None,
            }))

    scored.sort(key=lambda x: x[0], reverse=True)
    total = len(scored)
    page = scored[offset:offset + limit]

    results = []
    for score, content_dict in page:
        results.append(SearchResult(content=SearchContentResponse(**content_dict), score=float(score)))

    return SearchResponse(results=results, total=total, query=query)
