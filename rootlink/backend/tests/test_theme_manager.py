"""Content Studio — Phase 4: dashboard theme manager (multi-theme + named tokens).

Mirrors tests/test_theme.py: strict `super_admin` authoring, public reads gated
by `is_published`, audit-logged writes. The app lifespan (which seeds the
default theme) does NOT run under ASGITransport, so tests build themes/tokens
through the API themselves.
"""

from sqlalchemy import select

from app.models.moderation import ModerationAuditLog


async def test_public_themes_empty_by_default(client):
    r = await client.get("/api/themes")
    assert r.status_code == 200
    assert r.json() == []


async def test_plain_user_cannot_create_theme(client, make_user):
    _, headers = await make_user(email="plain-tm@example.com", role="user")
    r = await client.post("/api/themes", headers=headers, json={"name": "X"})
    assert r.status_code == 403


async def test_can_edit_copy_user_cannot_create_theme(client, make_user):
    """Theming does NOT honor the can_edit_copy delegation (same as /api/theme)."""
    _, headers = await make_user(email="delegate-tm@example.com", can_edit_copy=True)
    r = await client.post("/api/themes", headers=headers, json={"name": "X"})
    assert r.status_code == 403


async def test_super_admin_creates_theme_draft_then_publish(client, make_user):
    _, headers = await make_user(email="su-tm@example.com", role="super_admin")
    r = await client.post(
        "/api/themes", headers=headers, json={"name": "Christmas", "description": "Seasonal"}
    )
    assert r.status_code == 200
    tid = r.json()["id"]
    assert r.json()["is_published"] is False  # draft by default
    assert r.json()["is_active"] is False
    # Not published yet → not in the public list
    assert (await client.get("/api/themes")).json() == []
    # Publish via PUT metadata update
    pu = await client.put(f"/api/themes/{tid}", headers=headers, json={"is_published": True})
    assert pu.status_code == 200
    assert pu.json()["is_published"] is True
    pub = (await client.get("/api/themes")).json()
    assert len(pub) == 1
    assert pub[0]["name"] == "Christmas"
    assert pub[0]["description"] == "Seasonal"


async def test_activate_sets_one_active_and_active_endpoint_returns_it(client, make_user):
    _, headers = await make_user(email="su-tm-act@example.com", role="super_admin")
    a = (await client.post("/api/themes", headers=headers, json={"name": "A"})).json()
    b = (await client.post("/api/themes", headers=headers, json={"name": "B"})).json()
    assert (await client.post(f"/api/themes/{a['id']}/activate", headers=headers)).status_code == 200
    # Activate B → A is no longer active
    assert (await client.post(f"/api/themes/{b['id']}/activate", headers=headers)).status_code == 200
    active = (await client.get("/api/themes/active")).json()
    assert active["id"] == b["id"]
    admin = (await client.get("/api/themes/admin", headers=headers)).json()
    by_id = {t["id"]: t for t in admin}
    assert by_id[a["id"]]["is_active"] is False
    assert by_id[b["id"]]["is_active"] is True


async def test_active_theme_includes_its_tokens(client, make_user):
    _, headers = await make_user(email="su-tm-tok@example.com", role="super_admin")
    t = (await client.post("/api/themes", headers=headers, json={"name": "T"})).json()
    await client.post(f"/api/themes/{t['id']}/activate", headers=headers)
    await client.post(
        f"/api/themes/{t['id']}/tokens",
        headers=headers,
        json={
            "token_name": "--color-primary-600",
            "light_value": "99 77 51",
            "dark_value": None,
            "category": "color",
        },
    )
    active = (await client.get("/api/themes/active")).json()
    assert active["id"] == t["id"]
    names = [tk["token_name"] for tk in active["tokens"]]
    assert "--color-primary-600" in names
    assert next(tk for tk in active["tokens"] if tk["token_name"] == "--color-primary-600")[
        "light_value"
    ] == "99 77 51"


async def test_upsert_token_updates_in_place_no_duplicate(client, make_user):
    _, headers = await make_user(email="su-tm-up@example.com", role="super_admin")
    t = (await client.post("/api/themes", headers=headers, json={"name": "U"})).json()
    await client.post(f"/api/themes/{t['id']}/activate", headers=headers)
    first = await client.post(
        f"/api/themes/{t['id']}/tokens",
        headers=headers,
        json={
            "token_name": "--radius-xl2",
            "light_value": "16px",
            "dark_value": None,
            "category": "radius",
        },
    )
    assert first.status_code == 200
    second = await client.post(
        f"/api/themes/{t['id']}/tokens",
        headers=headers,
        json={
            "token_name": "--radius-xl2",
            "light_value": "20px",
            "dark_value": None,
            "category": "radius",
        },
    )
    assert second.status_code == 200
    tokens = (await client.get(f"/api/themes/{t['id']}/tokens", headers=headers)).json()
    matching = [tk for tk in tokens if tk["token_name"] == "--radius-xl2"]
    assert len(matching) == 1  # upsert, not duplicate
    assert matching[0]["light_value"] == "20px"


async def test_update_token_light_and_dark_values(client, make_user):
    _, headers = await make_user(email="su-tm-put@example.com", role="super_admin")
    t = (await client.post("/api/themes", headers=headers, json={"name": "P"})).json()
    await client.post(f"/api/themes/{t['id']}/activate", headers=headers)
    created = (
        await client.post(
            f"/api/themes/{t['id']}/tokens",
            headers=headers,
            json={
                "token_name": "--color-rust-500",
                "light_value": "168 100 61",
                "dark_value": None,
                "category": "color",
            },
        )
    ).json()
    tid = created["id"]
    upd = await client.put(
        f"/api/themes/tokens/{tid}",
        headers=headers,
        json={"light_value": "170 100 61", "dark_value": "192 125 83"},
    )
    assert upd.status_code == 200
    assert upd.json()["light_value"] == "170 100 61"
    assert upd.json()["dark_value"] == "192 125 83"


async def test_tokens_on_unpublished_theme_require_super_admin(client, make_user):
    _, su = await make_user(email="su-tm-up2@example.com", role="super_admin")
    t = (await client.post("/api/themes", headers=su, json={"name": "Unpub"})).json()
    # Unpublished → public (no-auth) GET is 403
    assert (await client.get(f"/api/themes/{t['id']}/tokens")).status_code == 403
    # super_admin can read the unpublished theme's tokens
    assert (await client.get(f"/api/themes/{t['id']}/tokens", headers=su)).status_code == 200
    # Once published, public can read
    await client.put(f"/api/themes/{t['id']}", headers=su, json={"is_published": True})
    assert (await client.get(f"/api/themes/{t['id']}/tokens")).status_code == 200


async def test_plain_user_cannot_upsert_token(client, make_user):
    _, su = await make_user(email="su-tm-tok3@example.com", role="super_admin")
    _, plain = await make_user(email="plain-tm-tok3@example.com", role="user")
    t = (await client.post("/api/themes", headers=su, json={"name": "TokG"})).json()
    r = await client.post(
        f"/api/themes/{t['id']}/tokens",
        headers=plain,
        json={
            "token_name": "--color-cream",
            "light_value": "248 246 242",
            "category": "color",
        },
    )
    assert r.status_code == 403


async def test_admin_list_requires_super_admin(client, make_user):
    _, plain = await make_user(email="plain-tm-admin@example.com", role="user")
    assert (await client.get("/api/themes/admin", headers=plain)).status_code == 403
    _, su = await make_user(email="su-tm-admin@example.com", role="super_admin")
    assert (await client.get("/api/themes/admin", headers=su)).status_code == 200


async def test_delete_theme_requires_super_admin(client, make_user):
    _, su = await make_user(email="su-tm-del@example.com", role="super_admin")
    t = (await client.post("/api/themes", headers=su, json={"name": "Del"})).json()
    _, plain = await make_user(email="plain-tm-del@example.com", role="user")
    assert (await client.delete(f"/api/themes/{t['id']}", headers=plain)).status_code == 403
    # super_admin can delete a non-active theme
    assert (await client.delete(f"/api/themes/{t['id']}", headers=su)).status_code == 200
    admin = (await client.get("/api/themes/admin", headers=su)).json()
    assert all(x["id"] != t["id"] for x in admin)


async def test_cannot_delete_active_theme(client, make_user):
    _, headers = await make_user(email="su-tm-actdel@example.com", role="super_admin")
    t = (await client.post("/api/themes", headers=headers, json={"name": "ActDel"})).json()
    await client.post(f"/api/themes/{t['id']}/activate", headers=headers)
    d = await client.delete(f"/api/themes/{t['id']}", headers=headers)
    assert d.status_code == 409
    admin = (await client.get("/api/themes/admin", headers=headers)).json()
    assert any(x["id"] == t["id"] for x in admin)


async def test_create_theme_writes_audit_log(client, make_user, session_factory):
    su, headers = await make_user(email="su-tm-audit@example.com", role="super_admin")
    await client.post("/api/themes", headers=headers, json={"name": "Audited"})
    async with session_factory() as s:
        logs = (
            await s.execute(
                select(ModerationAuditLog).where(ModerationAuditLog.action == "create_theme")
            )
        ).scalars().all()
    assert len(logs) == 1
    assert logs[0].target_type == "theme"
    assert logs[0].actor_id == su.id
    assert logs[0].meta["name"] == "Audited"


async def test_activate_theme_writes_audit_log(client, make_user, session_factory):
    su, headers = await make_user(email="su-tm-audit2@example.com", role="super_admin")
    t = (await client.post("/api/themes", headers=headers, json={"name": "AudAct"})).json()
    await client.post(f"/api/themes/{t['id']}/activate", headers=headers)
    async with session_factory() as s:
        logs = (
            await s.execute(
                select(ModerationAuditLog).where(ModerationAuditLog.action == "activate_theme")
            )
        ).scalars().all()
    assert len(logs) == 1
    assert logs[0].target_type == "theme"
    assert logs[0].actor_id == su.id
    assert logs[0].meta["name"] == "AudAct"


async def test_delete_theme_writes_audit_log(client, make_user, session_factory):
    su, headers = await make_user(email="su-tm-audit3@example.com", role="super_admin")
    t = (await client.post("/api/themes", headers=headers, json={"name": "AudDel"})).json()
    await client.delete(f"/api/themes/{t['id']}", headers=headers)
    async with session_factory() as s:
        logs = (
            await s.execute(
                select(ModerationAuditLog).where(ModerationAuditLog.action == "delete_theme")
            )
        ).scalars().all()
    assert len(logs) == 1
    assert logs[0].target_type == "theme"
    assert logs[0].actor_id == su.id
    assert logs[0].meta["name"] == "AudDel"
