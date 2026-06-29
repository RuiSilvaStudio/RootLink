"""Phase 1 — unified lifecycle: status is the single visibility gate.

Validates CONTENT_PLATFORM.md §2 (lifecycle), §2.3 (verification = badge),
§2.5 (soft reject + appeal), §3 (trust-based publish).
"""

import pytest_asyncio

from app.models.content import (
    Content,
    ContentSource,
    ContentStatus,
    ContentType,
    VerificationStatus,
)
from app.models.moderation import ModerationAuditLog
from app.services.cross_reference import auto_cross_reference


@pytest_asyncio.fixture
async def make_content(session_factory):
    async def _make(created_by=None, status=ContentStatus.draft, **extra):
        async with session_factory() as session:
            c = Content(
                title=extra.pop("title", "Test piece"),
                content_type=extra.pop("content_type", ContentType.article),
                source=extra.pop("source", ContentSource.user),
                status=status,
                created_by=created_by,
                **extra,
            )
            session.add(c)
            await session.commit()
            await session.refresh(c)
            return c

    return _make


# ── Visibility gate ──

async def test_published_visible_to_anonymous(client, make_content):
    c = await make_content(status=ContentStatus.published)
    r = await client.get(f"/api/content/{c.id}")
    assert r.status_code == 200


async def test_in_review_hidden_from_anonymous(client, make_content):
    c = await make_content(status=ContentStatus.in_review)
    r = await client.get(f"/api/content/{c.id}")
    assert r.status_code == 404


async def test_rejected_hidden_from_anonymous(client, make_content):
    c = await make_content(status=ContentStatus.rejected)
    r = await client.get(f"/api/content/{c.id}")
    assert r.status_code == 404


async def test_owner_can_preview_own_unpublished(client, make_user, make_content):
    user, headers = await make_user(email="owner@example.com")
    c = await make_content(created_by=user.id, status=ContentStatus.in_review)
    r = await client.get(f"/api/content/{c.id}", headers=headers)
    assert r.status_code == 200


async def test_verification_badge_does_not_gate(client, make_content):
    """A published item with no verification badge is still public (§2.3)."""
    c = await make_content(
        status=ContentStatus.published,
        verification_status=VerificationStatus.unreviewed,
    )
    r = await client.get(f"/api/content/{c.id}")
    assert r.status_code == 200


# ── Trust-based publish ──

async def _create_draft_article(client, headers):
    r = await client.post("/api/articles/", headers=headers, json={"title": "My guide", "body": {"blocks": []}})
    assert r.status_code == 201, r.text
    return r.json()["id"]


async def test_untrusted_publish_goes_to_review(client, make_user):
    user, headers = await make_user(email="newbie@example.com")
    aid = await _create_draft_article(client, headers)
    r = await client.post(f"/api/articles/{aid}/publish", headers=headers)
    assert r.status_code == 200
    assert r.json()["status"] == "in_review"
    # not public yet
    anon = await client.get(f"/api/content/{aid}")
    assert anon.status_code == 404


async def test_trusted_author_publishes_live(client, make_user):
    user, headers = await make_user(email="trusted@example.com", can_self_publish=True)
    aid = await _create_draft_article(client, headers)
    r = await client.post(f"/api/articles/{aid}/publish", headers=headers)
    assert r.status_code == 200
    assert r.json()["status"] == "published"
    anon = await client.get(f"/api/content/{aid}")
    assert anon.status_code == 200


async def test_admin_publishes_live(client, make_user):
    user, headers = await make_user(email="adminpub@example.com", role="admin")
    aid = await _create_draft_article(client, headers)
    r = await client.post(f"/api/articles/{aid}/publish", headers=headers)
    assert r.json()["status"] == "published"


# ── Approve / reject / appeal ──

async def test_admin_approve_publishes_and_badges(client, make_user, make_content, session_factory):
    author, _ = await make_user(email="a1@example.com")
    _, admin_headers = await make_user(email="mod1@example.com", role="admin")
    c = await make_content(created_by=author.id, status=ContentStatus.in_review)
    r = await client.patch(f"/api/admin/content/{c.id}/approve", headers=admin_headers)
    assert r.status_code == 200
    async with session_factory() as s:
        fresh = await s.get(Content, c.id)
        assert fresh.status == ContentStatus.published
        assert fresh.verification_status == VerificationStatus.community_reviewed


async def test_reject_is_soft_and_logged(client, make_user, make_content, session_factory):
    author, _ = await make_user(email="a2@example.com")
    _, admin_headers = await make_user(email="mod2@example.com", role="moderator")
    c = await make_content(created_by=author.id, status=ContentStatus.in_review)
    r = await client.patch(f"/api/admin/content/{c.id}/reject", headers=admin_headers, params={"reason": "spam"})
    assert r.status_code == 200
    async with session_factory() as s:
        fresh = await s.get(Content, c.id)
        assert fresh is not None, "reject must NOT hard-delete (§2.5)"
        assert fresh.status == ContentStatus.rejected
        assert fresh.review_note == "spam"
        logs = (await s.execute(ModerationAuditLog.__table__.select())).fetchall()
        assert any(row.action == "reject" and row.target_id == c.id for row in logs)


async def test_author_can_appeal_rejected(client, make_user, make_content):
    author, headers = await make_user(email="a3@example.com")
    c = await make_content(created_by=author.id, status=ContentStatus.rejected)
    r = await client.post(f"/api/articles/{c.id}/appeal", headers=headers)
    assert r.status_code == 200
    assert r.json()["status"] == "in_review"


async def test_cannot_appeal_non_rejected(client, make_user, make_content):
    author, headers = await make_user(email="a4@example.com")
    c = await make_content(created_by=author.id, status=ContentStatus.draft)
    r = await client.post(f"/api/articles/{c.id}/appeal", headers=headers)
    assert r.status_code == 400


# ── Cross-reference auto-publish ──

async def test_cross_reference_publishes_corroborated_content(session_factory, make_content):
    # three near-identical crawled drafts
    emb = [1.0, 0.0, 0.0]
    await make_content(status=ContentStatus.draft, embedding=emb, body=None, full_text="x")
    await make_content(status=ContentStatus.draft, embedding=emb, body=None, full_text="x")
    c3 = await make_content(status=ContentStatus.draft, embedding=emb, body=None, full_text="x")
    async with session_factory() as s:
        target = await s.get(Content, c3.id)
        await auto_cross_reference(s, target)
        refreshed = await s.get(Content, c3.id)
        assert refreshed.status == ContentStatus.published
        assert refreshed.verification_status == VerificationStatus.cross_referenced
