"""Comment editing (docs/roles-permissions/ROLES_PERMISSIONS.md §7
"add/edit/remove own comment"): the owner — and only the owner — can edit
their comment via PATCH /api/comments/{id}. No moderator-edit-others.
"""

from app.models.comment import Comment


async def _make_comment(session_factory, user_id, body="Original body"):
    async with session_factory() as session:
        comment = Comment(
            entity_type="content",
            entity_id=1,
            user_id=user_id,
            body=body,
        )
        session.add(comment)
        await session.commit()
        await session.refresh(comment)
        return comment.id


async def test_owner_can_edit_own_comment(client, make_user, session_factory):
    owner, headers = await make_user(email="owner-comment@example.com")
    comment_id = await _make_comment(session_factory, owner.id)

    resp = await client.patch(
        f"/api/comments/{comment_id}",
        headers=headers,
        json={"body": "Fixed the typo"},
    )
    assert resp.status_code == 200, resp.text
    data = resp.json()
    assert data["body"] == "Fixed the typo"
    assert data["id"] == comment_id
    assert data["user_id"] == owner.id
    assert "updated_at" in data  # frontend uses this for the "(edited)" marker


async def test_edit_persists(client, make_user, session_factory):
    owner, headers = await make_user(email="persist-comment@example.com")
    comment_id = await _make_comment(session_factory, owner.id)

    await client.patch(
        f"/api/comments/{comment_id}", headers=headers, json={"body": "New text"}
    )
    resp = await client.get(
        "/api/comments/", params={"entity_type": "content", "entity_id": 1}
    )
    assert resp.status_code == 200
    bodies = [c["body"] for c in resp.json()]
    assert "New text" in bodies
    assert "Original body" not in bodies


async def test_non_owner_cannot_edit_comment(client, make_user, session_factory):
    owner, _ = await make_user(email="owner2-comment@example.com")
    _, other_headers = await make_user(email="other-comment@example.com", role="moderator")
    comment_id = await _make_comment(session_factory, owner.id)

    resp = await client.patch(
        f"/api/comments/{comment_id}",
        headers=other_headers,
        json={"body": "Hijacked"},
    )
    assert resp.status_code == 403


async def test_unauthenticated_cannot_edit_comment(client, make_user, session_factory):
    owner, _ = await make_user(email="owner3-comment@example.com")
    comment_id = await _make_comment(session_factory, owner.id)

    resp = await client.patch(f"/api/comments/{comment_id}", json={"body": "Anon edit"})
    assert resp.status_code == 401


async def test_edit_missing_comment_returns_404(client, make_user):
    _, headers = await make_user(email="ghost-comment@example.com")

    resp = await client.patch(
        "/api/comments/99999", headers=headers, json={"body": "Nothing here"}
    )
    assert resp.status_code == 404


async def test_empty_body_rejected(client, make_user, session_factory):
    owner, headers = await make_user(email="empty-comment@example.com")
    comment_id = await _make_comment(session_factory, owner.id)

    resp = await client.patch(
        f"/api/comments/{comment_id}", headers=headers, json={"body": ""}
    )
    assert resp.status_code == 422


async def test_missing_body_rejected(client, make_user, session_factory):
    owner, headers = await make_user(email="nobody-comment@example.com")
    comment_id = await _make_comment(session_factory, owner.id)

    resp = await client.patch(f"/api/comments/{comment_id}", headers=headers, json={})
    assert resp.status_code == 422
