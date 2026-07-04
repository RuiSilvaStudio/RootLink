"""Phase 4 — ban anonymization (docs/roles-permissions/ROLES_PERMISSIONS.md §4 / GDPR Art. 17).

Extends existing GDPR/erasure coverage (tests/test_phase6_account.py, the
self-service `/api/me` erasure path) rather than replacing it — that file
is untouched by this phase. This file covers the *ban-triggered*
anonymization path (`app/api/admin.py::ban_user`), which is
platform-triggered, not user-triggered, and previously only unpublished
content without anonymizing authorship.
"""

from app.models.content import Content, ContentSource, ContentStatus, ContentType


async def test_ban_anonymizes_published_content_authorship(client, make_user, session_factory):
    admin, admin_headers = await make_user(email="admin@example.com", role="admin")
    author, _ = await make_user(email="author@example.com", role="user")

    async with session_factory() as s:
        c = Content(
            title="Published piece", content_type=ContentType.article, source=ContentSource.user,
            status=ContentStatus.published, created_by=author.id,
        )
        s.add(c)
        await s.commit()
        cid = c.id

    r = await client.post(f"/api/admin/users/{author.id}/ban", headers=admin_headers, json={"reason": "spam"})
    assert r.status_code == 200
    assert r.json()["account_status"] == "banned"

    async with session_factory() as s:
        content = await s.get(Content, cid)
        assert content.status == ContentStatus.archived
        assert content.created_by is None  # tombstoned, not merely unpublished


async def test_ban_does_not_anonymize_non_published_content(client, make_user, session_factory):
    """Only published content is unpublished+anonymized per docs/roles-permissions/ROLES_PERMISSIONS.md
    §4 — a draft or in_review row is untouched by a ban (same scope the
    pre-Phase-4 unpublish-only behavior already had)."""
    admin, admin_headers = await make_user(email="admin2@example.com", role="admin")
    author, _ = await make_user(email="author2@example.com", role="user")

    async with session_factory() as s:
        draft = Content(
            title="Draft piece", content_type=ContentType.article, source=ContentSource.user,
            status=ContentStatus.draft, created_by=author.id,
        )
        s.add(draft)
        await s.commit()
        did = draft.id

    await client.post(f"/api/admin/users/{author.id}/ban", headers=admin_headers, json={"reason": "spam"})

    async with session_factory() as s:
        content = await s.get(Content, did)
        assert content.status == ContentStatus.draft
        assert content.created_by == author.id


async def test_unban_does_not_restore_anonymized_authorship(client, make_user, session_factory):
    """Anonymization is a one-way GDPR erasure action — reversing the ban
    (unban) only restores account access, never un-anonymizes content
    (docs/roles-permissions/ROLES_PERMISSIONS.md §4's "Appeal-only to reverse" is about the ban decision,
    not about restoring tombstoned authorship)."""
    admin, admin_headers = await make_user(email="admin3@example.com", role="admin")
    author, _ = await make_user(email="author3@example.com", role="user")

    async with session_factory() as s:
        c = Content(
            title="Piece", content_type=ContentType.article, source=ContentSource.user,
            status=ContentStatus.published, created_by=author.id,
        )
        s.add(c)
        await s.commit()
        cid = c.id

    await client.post(f"/api/admin/users/{author.id}/ban", headers=admin_headers, json={"reason": "spam"})
    r = await client.post(f"/api/admin/users/{author.id}/unban", headers=admin_headers)
    assert r.status_code == 200

    async with session_factory() as s:
        content = await s.get(Content, cid)
        assert content.created_by is None
