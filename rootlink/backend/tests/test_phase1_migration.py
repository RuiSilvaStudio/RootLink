"""Verify the Phase 1 data migration preserves visibility exactly.

Mirrors the three UPDATE statements in app/main.py lifespan(). If you change them
there, change them here too.
"""

from sqlalchemy import text

from app.models.content import (
    Content,
    ContentSource,
    ContentStatus,
    ContentType,
    VerificationStatus,
)

# The exact statements from main.py (§2 migration). Authored vs crawled is keyed
# on `url` (NULL for editor articles) — NOT `body`, because a JSON column stores
# Python None as JSON 'null', so `body IS NULL` never matches.
MIGRATION_SQL = [
    "UPDATE content SET status='in_review' "
    "WHERE status='published' AND verification_status='unreviewed' AND url IS NULL",
    "UPDATE content SET status='draft' "
    "WHERE status='published' AND verification_status='unreviewed' AND url IS NOT NULL",
    "UPDATE content SET status='published' "
    "WHERE verification_status IN ('community_reviewed','cross_referenced')",
]


async def _seed(session_factory):
    async with session_factory() as s:
        rows = {
            # authored article awaiting review (no url, was hidden) -> in_review
            "authored_unreviewed": Content(
                title="a", content_type=ContentType.article, source=ContentSource.user,
                status="published", verification_status=VerificationStatus.unreviewed, body={"blocks": []},
            ),
            # crawled published-unreviewed (has url, was hidden) -> draft
            "crawled_unreviewed": Content(
                title="b", url="http://example.com/b", content_type=ContentType.article,
                source=ContentSource.crawled,
                status="published", verification_status=VerificationStatus.unreviewed, body=None,
            ),
            # crawled corroborated, kept status=draft historically (was visible) -> published
            "crawled_crossref": Content(
                title="c", url="http://example.com/c", content_type=ContentType.article,
                source=ContentSource.crawled,
                status="draft", verification_status=VerificationStatus.cross_referenced, body=None,
            ),
            # human-approved article (was visible) -> stays published
            "approved": Content(
                title="d", content_type=ContentType.article, source=ContentSource.user,
                status="published", verification_status=VerificationStatus.community_reviewed, body={"blocks": []},
            ),
            # plain draft (was hidden) -> stays draft
            "plain_draft": Content(
                title="e", content_type=ContentType.article, source=ContentSource.user,
                status="draft", verification_status=VerificationStatus.unreviewed, body={"blocks": []},
            ),
        }
        for c in rows.values():
            s.add(c)
        await s.commit()
        return {k: v.id for k, v in rows.items()}


async def test_migration_preserves_visibility(engine, session_factory):
    ids = await _seed(session_factory)
    async with engine.begin() as conn:
        for stmt in MIGRATION_SQL:
            await conn.execute(text(stmt))

    async with session_factory() as s:
        got = {k: (await s.get(Content, cid)).status for k, cid in ids.items()}

    assert got["authored_unreviewed"] == ContentStatus.in_review  # hidden -> hidden
    assert got["crawled_unreviewed"] == ContentStatus.draft       # hidden -> hidden
    assert got["crawled_crossref"] == ContentStatus.published      # visible -> visible
    assert got["approved"] == ContentStatus.published              # visible -> visible
    assert got["plain_draft"] == ContentStatus.draft               # hidden -> hidden
