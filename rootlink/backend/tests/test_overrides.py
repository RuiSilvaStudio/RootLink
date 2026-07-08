"""Content Studio Phase 3 — override guardrail + draft/publish.

Mirrors test_theme.py: in-memory SQLite + ASGI client + user factory
(`tests/conftest.py`). The `make_user` fixture inserts directly into the DB
(bypassing the rate-limited /api/auth/register endpoint — lesson #27) and
mints a real JWT, so each test can assert both the public read surface and
the super_admin-only write surface.
"""

from sqlalchemy import select

from app.models.moderation import ModerationAuditLog

# ── Override log: public read ──

async def test_public_overrides_empty_by_default(client):
    r = await client.get("/api/overrides", params={"page": "landing"})
    assert r.status_code == 200
    assert r.json() == []


async def test_public_overrides_no_auth_required(client, make_user):
    """A logged-out visitor (no Authorization header) still reads overrides —
    the frontend needs them to render the 'has override' badges (§6)."""
    _, headers = await make_user(email="su-ov-pub@example.com", role="super_admin")
    await client.post(
        "/api/overrides",
        headers=headers,
        json={
            "page_slug": "landing",
            "element_path": "body > main > h1",
            "property": "color",
            "old_value": "rgb(28 25 23)",
            "new_value": "rgb(120 80 60)",
        },
    )
    r = await client.get("/api/overrides", params={"page": "landing"})
    assert r.status_code == 200
    assert len(r.json()) == 1


# ── Override log: super_admin-only writes ──

async def test_plain_user_cannot_create_override(client, make_user):
    _, headers = await make_user(email="plain-ov@example.com", role="user")
    r = await client.post(
        "/api/overrides",
        headers=headers,
        json={
            "page_slug": "landing",
            "element_path": "body > main > h1",
            "property": "color",
            "old_value": "rgb(28 25 23)",
            "new_value": "rgb(120 80 60)",
        },
    )
    assert r.status_code == 403


async def test_super_admin_creates_override_and_public_reads_it(client, make_user):
    _, headers = await make_user(email="su-ov@example.com", role="super_admin")
    r = await client.post(
        "/api/overrides",
        headers=headers,
        json={
            "page_slug": "landing",
            "element_path": "body > main > h1",
            "property": "color",
            "old_value": "rgb(28 25 23)",
            "new_value": "rgb(120 80 60)",
        },
    )
    assert r.status_code == 200
    override_id = r.json()["id"]
    assert override_id > 0
    pub = (await client.get("/api/overrides", params={"page": "landing"})).json()
    assert len(pub) == 1
    assert pub[0]["id"] == override_id
    assert pub[0]["element_path"] == "body > main > h1"
    assert pub[0]["property"] == "color"
    assert pub[0]["old_value"] == "rgb(28 25 23)"
    assert pub[0]["new_value"] == "rgb(120 80 60)"
    assert pub[0]["is_stale"] is False


async def test_create_override_upserts_existing(client, make_user):
    """Second POST on same page+element+property updates in place, never duplicates."""
    _, headers = await make_user(email="su-ov-up@example.com", role="super_admin")
    body = {
        "page_slug": "about",
        "element_path": "body > main > section > h2",
        "property": "background-color",
        "old_value": "rgb(243 240 235)",
        "new_value": "rgb(245 240 230)",
    }
    first = await client.post("/api/overrides", headers=headers, json=body)
    body["new_value"] = "rgb(255 255 255)"
    second = await client.post("/api/overrides", headers=headers, json=body)
    # Upsert keeps the same id — not a new row.
    assert second.json()["id"] == first.json()["id"]
    rows = (await client.get("/api/overrides", params={"page": "about"})).json()
    assert len(rows) == 1
    assert rows[0]["new_value"] == "rgb(255 255 255)"


async def test_reconfirming_override_clears_stale(client, make_user):
    """Re-confirming an override re-asserts intent, so is_stale resets to False."""
    _, headers = await make_user(email="su-ov-stale-reset@example.com", role="super_admin")
    body = {
        "page_slug": "landing",
        "element_path": "body > main > h1",
        "property": "color",
        "old_value": "rgb(28 25 23)",
        "new_value": "rgb(120 80 60)",
    }
    r = await client.post("/api/overrides", headers=headers, json=body)
    override_id = r.json()["id"]
    await client.put(f"/api/overrides/{override_id}/stale", headers=headers)
    assert (
        (await client.get("/api/overrides", params={"page": "landing"})).json()[0]["is_stale"]
        is True
    )
    # Re-confirm via a new POST on the same triple.
    await client.post("/api/overrides", headers=headers, json=body)
    rows = (await client.get("/api/overrides", params={"page": "landing"})).json()
    assert rows[0]["is_stale"] is False


async def test_plain_user_cannot_revert_override(client, make_user):
    _, su_headers = await make_user(email="su-ov-rev@example.com", role="super_admin")
    r = await client.post(
        "/api/overrides",
        headers=su_headers,
        json={
            "page_slug": "landing",
            "element_path": "body > main > h1",
            "property": "font-size",
            "old_value": "2rem",
            "new_value": "2.5rem",
        },
    )
    override_id = r.json()["id"]
    _, plain_headers = await make_user(email="plain-ov-rev@example.com", role="user")
    d = await client.delete(f"/api/overrides/{override_id}", headers=plain_headers)
    assert d.status_code == 403
    # Override survived the forbidden revert.
    rows = (await client.get("/api/overrides", params={"page": "landing"})).json()
    assert any(row["id"] == override_id for row in rows)


async def test_super_admin_can_revert_override(client, make_user):
    _, headers = await make_user(email="su-ov-rev2@example.com", role="super_admin")
    r = await client.post(
        "/api/overrides",
        headers=headers,
        json={
            "page_slug": "landing",
            "element_path": "body > main > h1",
            "property": "font-weight",
            "old_value": "400",
            "new_value": "700",
        },
    )
    override_id = r.json()["id"]
    d = await client.delete(f"/api/overrides/{override_id}", headers=headers)
    assert d.status_code == 200
    rows = (await client.get("/api/overrides", params={"page": "landing"})).json()
    assert all(row["id"] != override_id for row in rows)


async def test_all_requires_super_admin(client, make_user):
    _, headers = await make_user(email="plain-ov-all@example.com", role="user")
    r = await client.get("/api/overrides/all", headers=headers)
    assert r.status_code == 403
    _, su_headers = await make_user(email="su-ov-all@example.com", role="super_admin")
    assert (await client.get("/api/overrides/all", headers=su_headers)).status_code == 200


async def test_all_lists_across_pages(client, make_user):
    _, headers = await make_user(email="su-ov-all2@example.com", role="super_admin")
    for slug, path in [("landing", "body > main > h1"), ("about", "body > main > h2")]:
        await client.post(
            "/api/overrides",
            headers=headers,
            json={
                "page_slug": slug,
                "element_path": path,
                "property": "color",
                "old_value": "black",
                "new_value": "red",
            },
        )
    rows = (await client.get("/api/overrides/all", headers=headers)).json()
    slugs = {r["page_slug"] for r in rows}
    assert slugs == {"landing", "about"}


async def test_mark_override_stale(client, make_user):
    _, headers = await make_user(email="su-ov-stale@example.com", role="super_admin")
    r = await client.post(
        "/api/overrides",
        headers=headers,
        json={
            "page_slug": "landing",
            "element_path": "body > main > h1",
            "property": "color",
            "old_value": "rgb(28 25 23)",
            "new_value": "rgb(120 80 60)",
        },
    )
    override_id = r.json()["id"]
    s = await client.put(f"/api/overrides/{override_id}/stale", headers=headers)
    assert s.status_code == 200
    assert s.json()["is_stale"] is True
    rows = (await client.get("/api/overrides", params={"page": "landing"})).json()
    assert rows[0]["is_stale"] is True


async def test_mark_stale_404_when_missing(client, make_user):
    _, headers = await make_user(email="su-ov-stale-404@example.com", role="super_admin")
    r = await client.put("/api/overrides/999999/stale", headers=headers)
    assert r.status_code == 404


# ── Override log: audit trail ──

async def test_create_override_writes_audit_log(client, make_user, session_factory):
    su, headers = await make_user(email="su-ov-audit@example.com", role="super_admin")
    await client.post(
        "/api/overrides",
        headers=headers,
        json={
            "page_slug": "landing",
            "element_path": "body > main > h1",
            "property": "color",
            "old_value": "rgb(28 25 23)",
            "new_value": "rgb(120 80 60)",
        },
    )
    async with session_factory() as s:
        logs = (
            await s.execute(
                select(ModerationAuditLog).where(ModerationAuditLog.action == "create_override")
            )
        ).scalars().all()
    assert len(logs) == 1
    assert logs[0].target_type == "override"
    assert logs[0].actor_id == su.id
    assert logs[0].meta["property"] == "color"
    assert logs[0].meta["page_slug"] == "landing"


async def test_revert_override_writes_audit_log(client, make_user, session_factory):
    _, headers = await make_user(email="su-ov-audit-rev@example.com", role="super_admin")
    r = await client.post(
        "/api/overrides",
        headers=headers,
        json={
            "page_slug": "landing",
            "element_path": "body > main > h1",
            "property": "color",
            "old_value": "rgb(28 25 23)",
            "new_value": "rgb(120 80 60)",
        },
    )
    override_id = r.json()["id"]
    await client.delete(f"/api/overrides/{override_id}", headers=headers)
    async with session_factory() as s:
        logs = (
            await s.execute(
                select(ModerationAuditLog).where(ModerationAuditLog.action == "revert_override")
            )
        ).scalars().all()
    assert len(logs) == 1
    assert logs[0].target_type == "override"
    assert logs[0].target_id == override_id


# ── Drafts ──

async def test_get_draft_requires_super_admin(client, make_user):
    _, headers = await make_user(email="plain-dr@example.com", role="user")
    r = await client.get("/api/drafts", headers=headers, params={"page": "landing"})
    assert r.status_code == 403


async def test_get_draft_returns_null_when_absent(client, make_user):
    _, headers = await make_user(email="su-dr-none@example.com", role="super_admin")
    r = await client.get("/api/drafts", headers=headers, params={"page": "landing"})
    assert r.status_code == 200
    assert r.json() is None


async def test_save_draft_requires_super_admin(client, make_user):
    _, headers = await make_user(email="plain-dr-save@example.com", role="user")
    r = await client.post(
        "/api/drafts",
        headers=headers,
        json={
            "page_slug": "landing",
            "changes": [
                {"element_path": "h1", "property": "color", "value": "red", "old_value": "black"},
            ],
        },
    )
    assert r.status_code == 403


async def test_save_and_read_draft(client, make_user):
    _, headers = await make_user(email="su-dr@example.com", role="super_admin")
    r = await client.post(
        "/api/drafts",
        headers=headers,
        json={
            "page_slug": "landing",
            "changes": [
                {
                    "element_path": "body > main > h1",
                    "property": "color",
                    "value": "rgb(120 80 60)",
                    "old_value": "rgb(28 25 23)",
                },
            ],
        },
    )
    assert r.status_code == 200
    assert r.json()["status"] == "draft"
    got = (await client.get("/api/drafts", headers=headers, params={"page": "landing"})).json()
    assert got["page_slug"] == "landing"
    assert got["status"] == "draft"
    assert got["published_at"] is None
    assert len(got["changes"]) == 1
    assert got["changes"][0]["property"] == "color"
    assert got["changes"][0]["value"] == "rgb(120 80 60)"


async def test_save_draft_upserts_existing(client, make_user):
    """One draft per page — a second save replaces the changes, not spawns a row."""
    _, headers = await make_user(email="su-dr-up@example.com", role="super_admin")
    await client.post(
        "/api/drafts",
        headers=headers,
        json={
            "page_slug": "about",
            "changes": [
                {"element_path": "h1", "property": "color", "value": "red", "old_value": "black"},
            ],
        },
    )
    await client.post(
        "/api/drafts",
        headers=headers,
        json={
            "page_slug": "about",
            "changes": [
                {"element_path": "h2", "property": "color", "value": "blue", "old_value": "black"},
            ],
        },
    )
    got = (await client.get("/api/drafts", headers=headers, params={"page": "about"})).json()
    assert len(got["changes"]) == 1
    assert got["changes"][0]["element_path"] == "h2"


async def test_publish_draft(client, make_user):
    _, headers = await make_user(email="su-dr-pub@example.com", role="super_admin")
    await client.post(
        "/api/drafts",
        headers=headers,
        json={
            "page_slug": "landing",
            "changes": [
                {"element_path": "h1", "property": "color", "value": "red", "old_value": "black"},
            ],
        },
    )
    r = await client.post("/api/drafts/landing/publish", headers=headers)
    assert r.status_code == 200
    assert r.json()["status"] == "published"
    got = (await client.get("/api/drafts", headers=headers, params={"page": "landing"})).json()
    assert got["status"] == "published"
    assert got["published_at"] is not None


async def test_publish_draft_404_when_missing(client, make_user):
    _, headers = await make_user(email="su-dr-pub-404@example.com", role="super_admin")
    r = await client.post("/api/drafts/no-such-page/publish", headers=headers)
    assert r.status_code == 404


async def test_publish_draft_writes_audit_log(client, make_user, session_factory):
    _, headers = await make_user(email="su-dr-pub-audit@example.com", role="super_admin")
    await client.post(
        "/api/drafts",
        headers=headers,
        json={
            "page_slug": "landing",
            "changes": [
                {"element_path": "h1", "property": "color", "value": "red", "old_value": "black"},
            ],
        },
    )
    await client.post("/api/drafts/landing/publish", headers=headers)
    async with session_factory() as s:
        logs = (
            await s.execute(
                select(ModerationAuditLog).where(ModerationAuditLog.action == "publish_draft")
            )
        ).scalars().all()
    assert len(logs) == 1
    assert logs[0].target_type == "page_draft"
    assert logs[0].meta["page_slug"] == "landing"


async def test_discard_draft(client, make_user):
    _, headers = await make_user(email="su-dr-disc@example.com", role="super_admin")
    await client.post(
        "/api/drafts",
        headers=headers,
        json={
            "page_slug": "landing",
            "changes": [
                {"element_path": "h1", "property": "color", "value": "red", "old_value": "black"},
            ],
        },
    )
    d = await client.delete("/api/drafts/landing", headers=headers)
    assert d.status_code == 200
    got = (await client.get("/api/drafts", headers=headers, params={"page": "landing"})).json()
    assert got is None


async def test_discard_draft_writes_audit_log(client, make_user, session_factory):
    _, headers = await make_user(email="su-dr-disc-audit@example.com", role="super_admin")
    await client.post(
        "/api/drafts",
        headers=headers,
        json={
            "page_slug": "landing",
            "changes": [
                {"element_path": "h1", "property": "color", "value": "red", "old_value": "black"},
            ],
        },
    )
    await client.delete("/api/drafts/landing", headers=headers)
    async with session_factory() as s:
        logs = (
            await s.execute(
                select(ModerationAuditLog).where(ModerationAuditLog.action == "discard_draft")
            )
        ).scalars().all()
    assert len(logs) == 1
    assert logs[0].target_type == "page_draft"
    assert logs[0].meta["page_slug"] == "landing"
