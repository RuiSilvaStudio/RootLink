"""Phase 5c default covers + Phase 6 GDPR export/erasure (§6.4, §8)."""


from app.models.comment import Comment
from app.models.content import Content, ContentSource, ContentStatus, ContentType
from app.models.user import User

# ── Default covers on events/groups (§6.4) ──

async def test_group_gets_default_cover(client, make_user):
    _, headers = await make_user(email="g1@example.com")
    r = await client.post("/api/groups/", headers=headers, json={
        "name": "Tomato Growers", "slug": "tomato-growers", "description": "x", "family": "gardening",
    })
    assert r.status_code in (200, 201)
    assert r.json()["image_url"].endswith("/gardening.svg")


async def test_event_gets_default_cover(client, make_user):
    _, headers = await make_user(email="e1@example.com")
    r = await client.post("/api/events/", headers=headers, json={
        "title": "Pruning workshop", "description": "x",
        "date": "2027-01-01T10:00:00Z", "family": "woodworking",
    })
    assert r.status_code in (200, 201)
    assert r.json()["image_url"].endswith("/woodworking.svg")


# ── GDPR export ──

async def test_export_returns_user_data(client, make_user, session_factory):
    user, headers = await make_user(email="export@example.com")
    async with session_factory() as s:
        s.add(Content(title="Mine", content_type=ContentType.article, source=ContentSource.user,
                      status=ContentStatus.published, created_by=user.id))
        await s.commit()
    r = await client.get("/api/me/export", headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert body["profile"]["email"] == "export@example.com"
    assert any(c["title"] == "Mine" for c in body["content"])


# ── GDPR erasure ──

async def test_erasure_anonymizes_and_deletes(client, make_user, session_factory):
    user, headers = await make_user(email="erase@example.com")
    async with session_factory() as s:
        c = Content(title="Kept", content_type=ContentType.article, source=ContentSource.user,
                    status=ContentStatus.published, created_by=user.id)
        s.add(c)
        s.add(Comment(body="hi", entity_type="content", entity_id=1, user_id=user.id))
        await s.commit()
        cid = c.id

    r = await client.delete("/api/me", headers=headers)
    assert r.status_code == 204

    async with session_factory() as s:
        # user gone
        assert await s.get(User, user.id) is None
        # content kept but de-authored
        kept = await s.get(Content, cid)
        assert kept is not None
        assert kept.created_by is None
        # personal rows removed
        from sqlalchemy import select
        comments = (await s.execute(select(Comment).where(Comment.user_id == user.id))).scalars().all()
        assert comments == []

    # token no longer valid
    assert (await client.get("/api/auth/me", headers=headers)).status_code == 401
