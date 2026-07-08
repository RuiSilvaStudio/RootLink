"""Content Studio — Theming module: CSS token overrides + strict super_admin permission."""


from sqlalchemy import select

from app.models.moderation import ModerationAuditLog


async def test_public_overrides_empty_by_default(client):
    r = await client.get("/api/theme")
    assert r.status_code == 200
    assert r.json() == {}


async def test_plain_user_cannot_set(client, make_user):
    _, headers = await make_user(email="plain-theme@example.com", role="user")
    r = await client.put(
        "/api/theme/--color-primary-600",
        headers=headers,
        json={"value": "99 77 51"},
    )
    assert r.status_code == 403


async def test_can_edit_copy_user_cannot_set(client, make_user):
    """Like /api/content-ui, theming does NOT honor the can_edit_copy delegation."""
    _, headers = await make_user(email="delegate-theme@example.com", can_edit_copy=True)
    r = await client.put(
        "/api/theme/--color-primary-600",
        headers=headers,
        json={"value": "99 77 51"},
    )
    assert r.status_code == 403


async def test_super_admin_can_set_and_public_reads_it(client, make_user):
    _, headers = await make_user(email="su-theme@example.com", role="super_admin")
    r = await client.put(
        "/api/theme/--color-primary-600",
        headers=headers,
        json={"value": "99 77 51"},
    )
    assert r.status_code == 200
    pub = (await client.get("/api/theme")).json()
    assert pub["--color-primary-600"] == "99 77 51"


async def test_super_admin_can_set_and_revert(client, make_user):
    _, headers = await make_user(email="su-theme-rev@example.com", role="super_admin")
    await client.put(
        "/api/theme/--color-accent-500",
        headers=headers,
        json={"value": "120 80 60"},
    )
    assert (await client.get("/api/theme")).json().get("--color-accent-500") is not None
    d = await client.delete("/api/theme/--color-accent-500", headers=headers)
    assert d.status_code == 200
    assert "--color-accent-500" not in (await client.get("/api/theme")).json()


async def test_plain_user_cannot_revert(client, make_user):
    _, su_headers = await make_user(email="su-theme-rev2@example.com", role="super_admin")
    await client.put(
        "/api/theme/--color-rust-700",
        headers=su_headers,
        json={"value": "140 60 40"},
    )
    _, plain_headers = await make_user(email="plain-theme-rev@example.com", role="user")
    d = await client.delete("/api/theme/--color-rust-700", headers=plain_headers)
    assert d.status_code == 403


async def test_update_existing_override(client, make_user):
    """Second PUT on the same token updates in place (upsert), never duplicates."""
    _, headers = await make_user(email="su-theme-upd@example.com", role="super_admin")
    await client.put(
        "/api/theme/--radius-xl2",
        headers=headers,
        json={"value": "1.25rem"},
    )
    await client.put(
        "/api/theme/--radius-xl2",
        headers=headers,
        json={"value": "1.5rem"},
    )
    pub = (await client.get("/api/theme")).json()
    assert pub["--radius-xl2"] == "1.5rem"
    # /all returns exactly one row for this token (upsert, not duplicate)
    all_rows = (await client.get("/api/theme/all", headers=headers)).json()
    matching = [r for r in all_rows if r["token"] == "--radius-xl2"]
    assert len(matching) == 1
    assert matching[0]["value"] == "1.5rem"


async def test_all_requires_super_admin(client, make_user):
    _, headers = await make_user(email="plain-theme-all@example.com", role="user")
    r = await client.get("/api/theme/all", headers=headers)
    assert r.status_code == 403
    _, su_headers = await make_user(email="su-theme-all@example.com", role="super_admin")
    assert (await client.get("/api/theme/all", headers=su_headers)).status_code == 200


async def test_put_writes_audit_log(client, make_user, session_factory):
    su, headers = await make_user(email="su-theme-audit@example.com", role="super_admin")
    await client.put(
        "/api/theme/--font-display",
        headers=headers,
        json={"value": "Fraunces, serif"},
    )
    async with session_factory() as s:
        logs = (
            await s.execute(
                select(ModerationAuditLog).where(ModerationAuditLog.action == "edit_theme")
            )
        ).scalars().all()
    assert len(logs) == 1
    assert logs[0].target_type == "theme"
    assert logs[0].actor_id == su.id
    assert logs[0].meta["token"] == "--font-display"


async def test_delete_writes_audit_log(client, make_user, session_factory):
    _, headers = await make_user(email="su-theme-audit-del@example.com", role="super_admin")
    await client.put(
        "/api/theme/--color-cream",
        headers=headers,
        json={"value": "245 240 230"},
    )
    await client.delete("/api/theme/--color-cream", headers=headers)
    async with session_factory() as s:
        logs = (
            await s.execute(
                select(ModerationAuditLog).where(ModerationAuditLog.action == "revert_theme")
            )
        ).scalars().all()
    assert len(logs) == 1
    assert logs[0].target_type == "theme"
    assert logs[0].meta["token"] == "--color-cream"
