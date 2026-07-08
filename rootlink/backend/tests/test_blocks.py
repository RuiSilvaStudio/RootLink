"""Content Studio — Block model: composed pages + sections, public reads, super_admin writes."""


from sqlalchemy import select

from app.models.moderation import ModerationAuditLog


async def _make_published_page(client, make_user, *, slug="landing", label="Landing"):
    su, headers = await make_user(email=f"su-{slug}@example.com", role="super_admin")
    r = await client.post("/api/blocks/pages", headers=headers, json={"slug": slug, "label": label})
    assert r.status_code == 200, r.text
    page_id = r.json()["id"]
    pub = await client.put(f"/api/blocks/pages/{page_id}", headers=headers, json={"is_published": True})
    assert pub.status_code == 200, pub.text
    return su, headers, page_id


async def test_public_pages_empty_by_default(client):
    r = await client.get("/api/blocks/pages")
    assert r.status_code == 200
    assert r.json() == []


async def test_public_pages_lists_only_published(client, make_user):
    _, headers, _ = await _make_published_page(client, make_user, slug="about", label="About")
    # An unpublished page stays hidden from the public listing.
    await client.post("/api/blocks/pages", headers=headers, json={"slug": "secret", "label": "Secret"})
    r = await client.get("/api/blocks/pages")
    assert r.status_code == 200
    slugs = [p["slug"] for p in r.json()]
    assert "about" in slugs
    assert "secret" not in slugs


async def test_public_page_returns_ordered_sections(client, make_user):
    _, headers, page_id = await _make_published_page(client, make_user, slug="home", label="Home")
    for bt, props, order in [
        ("hero", {"title": "Hi"}, 20),
        ("text-block", {"body": "middle"}, 5),
        ("card-grid", {"count": 3}, 10),
    ]:
        s = await client.post(
            f"/api/blocks/pages/{page_id}/sections", headers=headers,
            json={"block_type": bt, "props": props, "order": order},
        )
        assert s.status_code == 200, s.text
    r = await client.get("/api/blocks/pages/home")
    assert r.status_code == 200
    body = r.json()
    assert body["slug"] == "home"
    assert body["label"] == "Home"
    orders = [sec["order"] for sec in body["sections"]]
    assert orders == [5, 10, 20]
    assert [sec["block_type"] for sec in body["sections"]] == ["text-block", "card-grid", "hero"]


async def test_public_page_404_for_unknown_slug(client):
    r = await client.get("/api/blocks/pages/does-not-exist")
    assert r.status_code == 404


async def test_create_page_requires_super_admin(client, make_user):
    _, plain = await make_user(email="plain-create@example.com", role="user")
    r = await client.post("/api/blocks/pages", headers=plain, json={"slug": "x", "label": "X"})
    assert r.status_code == 403
    _, su = await make_user(email="su-create@example.com", role="super_admin")
    r = await client.post("/api/blocks/pages", headers=su, json={"slug": "x", "label": "X"})
    assert r.status_code == 200
    assert r.json()["is_published"] is False


async def test_create_section_requires_super_admin(client, make_user):
    _, headers, page_id = await _make_published_page(client, make_user, slug="sec-page", label="Sec")
    _, plain = await make_user(email="plain-sec@example.com", role="user")
    r = await client.post(
        f"/api/blocks/pages/{page_id}/sections", headers=plain,
        json={"block_type": "hero", "props": {}, "order": 0},
    )
    assert r.status_code == 403
    r = await client.post(
        f"/api/blocks/pages/{page_id}/sections", headers=headers,
        json={"block_type": "hero", "props": {"title": "T"}, "order": 0},
    )
    assert r.status_code == 200
    assert r.json()["props"] == {"title": "T"}


async def test_update_section_requires_super_admin_and_updates_props(client, make_user):
    _, headers, page_id = await _make_published_page(client, make_user, slug="upd-page", label="Upd")
    s = await client.post(
        f"/api/blocks/pages/{page_id}/sections", headers=headers,
        json={"block_type": "hero", "props": {"title": "old"}, "order": 1},
    )
    sid = s.json()["id"]
    _, plain = await make_user(email="plain-upd@example.com", role="user")
    r = await client.put(
        f"/api/blocks/sections/{sid}", headers=plain,
        json={"props": {"title": "new"}},
    )
    assert r.status_code == 403
    r = await client.put(
        f"/api/blocks/sections/{sid}", headers=headers,
        json={"props": {"title": "new"}, "order": 9},
    )
    assert r.status_code == 200
    assert r.json()["props"] == {"title": "new"}
    assert r.json()["order"] == 9


async def test_delete_section_requires_super_admin(client, make_user):
    _, headers, page_id = await _make_published_page(client, make_user, slug="del-page", label="Del")
    s = await client.post(
        f"/api/blocks/pages/{page_id}/sections", headers=headers,
        json={"block_type": "hero", "props": {}, "order": 0},
    )
    sid = s.json()["id"]
    _, plain = await make_user(email="plain-del@example.com", role="user")
    r = await client.delete(f"/api/blocks/sections/{sid}", headers=plain)
    assert r.status_code == 403
    r = await client.delete(f"/api/blocks/sections/{sid}", headers=headers)
    assert r.status_code == 200
    # Section is gone from the page.
    body = (await client.get("/api/blocks/pages/del-page")).json()
    assert body["sections"] == []


async def test_admin_pages_requires_super_admin_and_shows_unpublished(client, make_user):
    _, plain = await make_user(email="plain-admin@example.com", role="user")
    r = await client.get("/api/blocks/admin/pages", headers=plain)
    assert r.status_code == 403
    _, su = await make_user(email="su-admin@example.com", role="super_admin")
    # One published, one unpublished.
    _, _, _ = await _make_published_page(client, make_user, slug="pub", label="Pub")
    await client.post("/api/blocks/pages", headers=su, json={"slug": "draft", "label": "Draft"})
    r = await client.get("/api/blocks/admin/pages", headers=su)
    assert r.status_code == 200
    by_slug = {p["slug"]: p for p in r.json()}
    assert "pub" in by_slug and by_slug["pub"]["is_published"] is True
    assert "draft" in by_slug and by_slug["draft"]["is_published"] is False


async def test_update_page_metadata(client, make_user):
    _, headers, page_id = await _make_published_page(client, make_user, slug="meta1", label="Meta1")
    r = await client.put(
        f"/api/blocks/pages/{page_id}", headers=headers,
        json={"slug": "meta2", "label": "Meta2", "is_published": False},
    )
    assert r.status_code == 200
    assert r.json()["slug"] == "meta2"
    assert r.json()["label"] == "Meta2"
    assert r.json()["is_published"] is False
    # Old slug no longer resolves publicly.
    assert (await client.get("/api/blocks/pages/meta1")).status_code == 404


async def test_create_page_writes_audit_log(client, make_user, session_factory):
    su, headers = await make_user(email="su-audit-create@example.com", role="super_admin")
    r = await client.post("/api/blocks/pages", headers=headers, json={"slug": "audited", "label": "Audited"})
    page_id = r.json()["id"]
    async with session_factory() as s:
        logs = (
            await s.execute(
                select(ModerationAuditLog).where(ModerationAuditLog.action == "create_block_page")
            )
        ).scalars().all()
    assert len(logs) == 1
    assert logs[0].target_type == "block_page"
    assert logs[0].target_id == page_id
    assert logs[0].actor_id == su.id
    assert logs[0].meta["slug"] == "audited"


async def test_delete_section_writes_audit_log(client, make_user, session_factory):
    _, headers, page_id = await _make_published_page(client, make_user, slug="audit-del", label="Aud")
    s = await client.post(
        f"/api/blocks/pages/{page_id}/sections", headers=headers,
        json={"block_type": "hero", "props": {}, "order": 0},
    )
    sid = s.json()["id"]
    await client.delete(f"/api/blocks/sections/{sid}", headers=headers)
    async with session_factory() as s2:
        logs = (
            await s2.execute(
                select(ModerationAuditLog).where(ModerationAuditLog.action == "delete_block_section")
            )
        ).scalars().all()
    assert len(logs) == 1
    assert logs[0].target_type == "block_section"
    assert logs[0].target_id == sid
    assert logs[0].meta["page_id"] == page_id
    assert logs[0].meta["block_type"] == "hero"
