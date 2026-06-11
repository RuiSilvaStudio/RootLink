import math
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.content import Content, VerificationStatus


def cosine_similarity(a: list[float], b: list[float]) -> float:
    dot = sum(x * y for x, y in zip(a, b))
    norm_a = math.sqrt(sum(x * x for x in a))
    norm_b = math.sqrt(sum(y * y for y in b))
    if norm_a == 0 or norm_b == 0:
        return 0.0
    return dot / (norm_a * norm_b)


CROSS_REF_SIMILARITY_THRESHOLD = 0.85
MIN_SOURCES_FOR_CROSS_REF = 3


async def auto_cross_reference(db: AsyncSession, content: Content) -> None:
    if not content.embedding:
        return

    result = await db.execute(
        select(Content).where(
            Content.id != content.id,
            Content.embedding.isnot(None),
        )
    )
    all_with_embeddings = result.scalars().all()

    similar_ids = []
    for other in all_with_embeddings:
        if other.embedding:
            sim = cosine_similarity(content.embedding, other.embedding)
            if sim >= CROSS_REF_SIMILARITY_THRESHOLD:
                similar_ids.append(other.id)

    if len(similar_ids) >= MIN_SOURCES_FOR_CROSS_REF - 1:
        content.verification_status = VerificationStatus.cross_referenced
        content.cross_referenced_sources = similar_ids

        for sid in similar_ids:
            sibling = await db.get(Content, sid)
            if sibling and sibling.verification_status == VerificationStatus.unreviewed:
                existing = sibling.cross_referenced_sources or []
                if content.id not in existing:
                    existing.append(content.id)
                all_ids = list(set(existing + [sid for sid in similar_ids if sid != sibling.id]))
                if content.id not in all_ids:
                    all_ids.append(content.id)
                sibling.cross_referenced_sources = all_ids
                if len(all_ids) >= MIN_SOURCES_FOR_CROSS_REF:
                    sibling.verification_status = VerificationStatus.cross_referenced

    await db.commit()
