"""Real two-step article review/approve (docs/roles-permissions/ROLES_PERMISSIONS.md §7):
contributor+ "review" is an optional first pass, moderator+ "approve" goes
live from either `in_review` or `reviewed`. Also covers the split of
`revert_approval` (published -> in_review) away from `reject`
(in_review/reviewed -> rejected), and the self-approval guard (§6).
"""

from sqlalchemy import select

from app.models.content import Content, ContentStatus, ContentType, ContentSource


async def _make_content(session_factory, created_by=None, status=ContentStatus.in_review):
    async with session_factory() as session:
        content = Content(
            title="Test Article",
            content_type=ContentType.article,
            source=ContentSource.user,
            created_by=created_by,
            status=status,
        )
        session.add(content)
        await session.commit()
        await session.refresh(content)
        return content.id


async def _get_status(session_factory, content_id):
    async with session_factory() as session:
        result = await session.execute(select(Content).where(Content.id == content_id))
        return result.scalar_one()


async def test_contributor_can_mark_reviewed(client, make_user, session_factory):
    _, headers = await make_user(email="author@example.com", role="user")
    contributor, contrib_headers = await make_user(email="rev@example.com", role="contributor")
    content_id = await _make_content(session_factory)

    resp = await client.patch(
        f"/api/admin/content/{content_id}/review?comment=looks+good",
        headers=contrib_headers,
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "reviewed"

    content = await _get_status(session_factory, content_id)
    assert content.status == ContentStatus.reviewed
    assert content.review_comment == "looks good"


async def test_review_requires_contributor_rank(client, make_user, session_factory):
    _, plain_headers = await make_user(email="plain@example.com", role="user")
    content_id = await _make_content(session_factory)

    resp = await client.patch(f"/api/admin/content/{content_id}/review", headers=plain_headers)
    assert resp.status_code == 403


async def test_review_only_from_in_review_status(client, make_user, session_factory):
    _, contrib_headers = await make_user(email="rev2@example.com", role="contributor")
    content_id = await _make_content(session_factory, status=ContentStatus.draft)

    resp = await client.patch(f"/api/admin/content/{content_id}/review", headers=contrib_headers)
    assert resp.status_code == 400


async def test_approve_requires_moderator_not_just_contributor(client, make_user, session_factory):
    """Fixes the documented enforcement mismatch (ACTION_UI_MAP.md) — approve
    used to be reachable at contributor+; now genuinely needs moderator+."""
    author, _ = await make_user(email="author2@example.com", role="user")
    _, contrib_headers = await make_user(email="contrib2@example.com", role="contributor")
    content_id = await _make_content(session_factory, created_by=author.id)

    resp = await client.patch(f"/api/admin/content/{content_id}/approve", headers=contrib_headers)
    assert resp.status_code == 403


async def test_moderator_can_approve_directly_from_in_review_no_strict_ordering(client, make_user, session_factory):
    author, _ = await make_user(email="author3@example.com", role="user")
    _, mod_headers = await make_user(email="mod3@example.com", role="moderator")
    content_id = await _make_content(session_factory, created_by=author.id, status=ContentStatus.in_review)

    resp = await client.patch(f"/api/admin/content/{content_id}/approve", headers=mod_headers)
    assert resp.status_code == 200, resp.text
    content = await _get_status(session_factory, content_id)
    assert content.status == ContentStatus.published
    assert content.verification_status == "community_reviewed"


async def test_moderator_can_approve_from_reviewed_state(client, make_user, session_factory):
    author, _ = await make_user(email="author4@example.com", role="user")
    _, mod_headers = await make_user(email="mod4@example.com", role="moderator")
    content_id = await _make_content(session_factory, created_by=author.id, status=ContentStatus.reviewed)

    resp = await client.patch(f"/api/admin/content/{content_id}/approve", headers=mod_headers)
    assert resp.status_code == 200, resp.text


async def test_cannot_approve_own_submission(client, make_user, session_factory):
    """docs/roles-permissions/ROLES_PERMISSIONS.md §6 separation of duties —
    not even the author's own high rank lets them approve their own work."""
    mod, mod_headers = await make_user(email="selfmod@example.com", role="moderator")
    content_id = await _make_content(session_factory, created_by=mod.id, status=ContentStatus.in_review)

    resp = await client.patch(f"/api/admin/content/{content_id}/approve", headers=mod_headers)
    assert resp.status_code == 403
    content = await _get_status(session_factory, content_id)
    assert content.status == ContentStatus.in_review


async def test_reject_sets_rejected_not_in_review(client, make_user, session_factory):
    author, _ = await make_user(email="author5@example.com", role="user")
    _, mod_headers = await make_user(email="mod5@example.com", role="moderator")
    content_id = await _make_content(session_factory, created_by=author.id, status=ContentStatus.in_review)

    resp = await client.patch(f"/api/admin/content/{content_id}/reject?reason=not+ready", headers=mod_headers)
    assert resp.status_code == 200, resp.text
    content = await _get_status(session_factory, content_id)
    assert content.status == ContentStatus.rejected
    assert content.review_note == "not ready"


async def test_revert_approval_goes_back_to_in_review_not_rejected(client, make_user, session_factory):
    author, _ = await make_user(email="author6@example.com", role="user")
    _, mod_headers = await make_user(email="mod6@example.com", role="moderator")
    content_id = await _make_content(session_factory, created_by=author.id, status=ContentStatus.published)

    resp = await client.patch(f"/api/admin/content/{content_id}/revert-approval?reason=mistake", headers=mod_headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "in_review"
    content = await _get_status(session_factory, content_id)
    assert content.status == ContentStatus.in_review
    assert content.verification_status == "unreviewed"


async def test_revert_approval_requires_moderator(client, make_user, session_factory):
    author, _ = await make_user(email="author7@example.com", role="user")
    _, contrib_headers = await make_user(email="contrib7@example.com", role="contributor")
    content_id = await _make_content(session_factory, created_by=author.id, status=ContentStatus.published)

    resp = await client.patch(f"/api/admin/content/{content_id}/revert-approval", headers=contrib_headers)
    assert resp.status_code == 403


async def test_revert_approval_only_from_published(client, make_user, session_factory):
    _, mod_headers = await make_user(email="mod8@example.com", role="moderator")
    content_id = await _make_content(session_factory, status=ContentStatus.in_review)

    resp = await client.patch(f"/api/admin/content/{content_id}/revert-approval", headers=mod_headers)
    assert resp.status_code == 400


async def test_review_queue_includes_both_in_review_and_reviewed(client, make_user, session_factory):
    _, contrib_headers = await make_user(email="contrib9@example.com", role="contributor")
    id1 = await _make_content(session_factory, status=ContentStatus.in_review)
    id2 = await _make_content(session_factory, status=ContentStatus.reviewed)
    await _make_content(session_factory, status=ContentStatus.published)

    resp = await client.get("/api/admin/review-queue", headers=contrib_headers)
    assert resp.status_code == 200
    ids = {c["id"] for c in resp.json()}
    assert id1 in ids
    assert id2 in ids
