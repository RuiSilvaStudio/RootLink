import math
from sqlalchemy import select, text
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.content import Content
from app.schemas.content import ContentResponse, SearchResult, SearchResponse
from app.services.embeddings import embed_text
from app.core.config import settings


def cosine_similarity(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


def keyword_score(query: str, title: str, full_text: str | None) -> float:
    text = (title + " " + (full_text or "")).lower()
    words = query.lower().split()
    matches = sum(1 for w in words if w in text)
    if not words:
        return 0.0
    return matches / len(words)


async def hybrid_search(
    db: AsyncSession,
    query: str,
    category: str | None = None,
    content_type: str | None = None,
    limit: int = 20,
    offset: int = 0,
) -> SearchResponse:
    query_embedding = await embed_text(query)

    stmt = select(Content)
    if category:
        stmt = stmt.where(Content.category == category)
    if content_type:
        stmt = stmt.where(Content.content_type == content_type)

    result = await db.execute(stmt)
    all_content = result.scalars().all()

    scored = []
    for c in all_content:
        semantic_score = 0.0
        if c.embedding:
            semantic_score = cosine_similarity(query_embedding, c.embedding)

        kw_score = keyword_score(query, c.title, c.full_text)

        combined = semantic_score * 0.5 + kw_score * 0.5
        scored.append((combined, c))

    scored.sort(key=lambda x: x[0], reverse=True)
    total = len(scored)
    page = scored[offset:offset + limit]

    results = []
    for score, c in page:
        content_dict = {
            "id": c.id,
            "title": c.title,
            "url": c.url,
            "content_type": c.content_type.value if hasattr(c.content_type, 'value') else c.content_type,
            "category": c.category.value if hasattr(c.category, 'value') else c.category,
            "summary": c.summary,
            "image_url": c.image_url,
            "source": c.source.value if hasattr(c.source, 'value') else c.source,
            "source_url": c.source_url,
            "created_by": c.created_by,
            "published_at": c.published_at,
            "crawled_at": c.crawled_at,
            "created_at": c.created_at,
            "verification_status": c.verification_status.value if hasattr(c.verification_status, 'value') else c.verification_status,
            "validated_by": c.validated_by,
            "cross_referenced_sources": c.cross_referenced_sources,
        }
        results.append(SearchResult(content=ContentResponse(**content_dict), score=float(score)))

    return SearchResponse(results=results, total=total, query=query)
