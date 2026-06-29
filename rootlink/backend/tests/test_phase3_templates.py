"""Phase 3 — content templates (§5.4) and video poster derivation (§6.5)."""

import pytest_asyncio

from app.services.oembed import fetch_video_poster, youtube_id, youtube_thumbnail
from app.services.template_seed import STARTER_TEMPLATES, seed_content_templates


@pytest_asyncio.fixture
async def seeded(session_factory):
    async with session_factory() as s:
        await seed_content_templates(s)


# ── Seeding ──

async def test_seed_inserts_starter_set(session_factory):
    async with session_factory() as s:
        n = await seed_content_templates(s)
    assert n == len(STARTER_TEMPLATES)


async def test_seed_is_idempotent(session_factory):
    async with session_factory() as s:
        await seed_content_templates(s)
    async with session_factory() as s:
        n2 = await seed_content_templates(s)
    assert n2 == 0


# ── Public list ──

async def test_list_templates_public(client, seeded):
    r = await client.get("/api/content-templates", params={"kind": "article"})
    assert r.status_code == 200
    keys = {t["key"] for t in r.json()}
    assert {"how_to", "recipe", "blank"}.issubset(keys)
    # sorted by sort_order → blank (99) last
    assert r.json()[-1]["key"] == "blank"


async def test_list_only_active(client, make_user, seeded, session_factory):
    from sqlalchemy import select

    from app.models.content_template import ContentTemplate

    async with session_factory() as s:
        tpl = (await s.execute(select(ContentTemplate).where(ContentTemplate.key == "recipe"))).scalar_one()
        tpl.is_active = False
        await s.commit()
    r = await client.get("/api/content-templates", params={"kind": "article"})
    assert "recipe" not in {t["key"] for t in r.json()}


# ── Admin CRUD + permissions ──

async def test_create_requires_admin(client, make_user):
    _, headers = await make_user(email="user1@example.com", role="user")
    r = await client.post("/api/content-templates", headers=headers, json={
        "key": "x", "label_en": "X", "label_pt": "X", "body": {"blocks": []},
    })
    assert r.status_code == 403


async def test_admin_can_create_and_delete(client, make_user):
    _, headers = await make_user(email="admin3@example.com", role="admin")
    r = await client.post("/api/content-templates", headers=headers, json={
        "key": "custom", "label_en": "Custom", "label_pt": "Personalizado",
        "body": {"blocks": []}, "sort_order": 5,
    })
    assert r.status_code == 201
    tid = r.json()["id"]
    upd = await client.patch(f"/api/content-templates/{tid}", headers=headers, json={"label_en": "Renamed"})
    assert upd.json()["label_en"] == "Renamed"
    dl = await client.delete(f"/api/content-templates/{tid}", headers=headers)
    assert dl.status_code == 204


async def test_super_admin_can_manage(client, make_user, seeded):
    _, headers = await make_user(email="su@example.com", role="super_admin")
    r = await client.get("/api/content-templates/all", headers=headers)
    assert r.status_code == 200
    assert len(r.json()) >= len(STARTER_TEMPLATES)


# ── Video poster derivation ──

def test_youtube_id_variants():
    assert youtube_id("https://www.youtube.com/watch?v=dQw4w9WgXcQ") == "dQw4w9WgXcQ"
    assert youtube_id("https://youtu.be/dQw4w9WgXcQ") == "dQw4w9WgXcQ"
    assert youtube_id("https://www.youtube.com/embed/dQw4w9WgXcQ") == "dQw4w9WgXcQ"
    assert youtube_id("https://example.com/not-a-video") is None


def test_youtube_thumbnail():
    assert youtube_thumbnail("https://youtu.be/dQw4w9WgXcQ") == (
        "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg"
    )


async def test_fetch_poster_youtube_no_network():
    # YouTube is deterministic — no network call needed
    assert await fetch_video_poster("https://youtu.be/dQw4w9WgXcQ") == (
        "https://img.youtube.com/vi/dQw4w9WgXcQ/hqdefault.jpg"
    )


async def test_fetch_poster_unknown_returns_none():
    assert await fetch_video_poster("https://example.com/clip.mp4") is None
