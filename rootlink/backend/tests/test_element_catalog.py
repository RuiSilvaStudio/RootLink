"""Content Studio — Phase 5: element catalog + font library (dashboard control room).

Mirrors tests/test_theme_manager.py: strict `super_admin` authoring, public
reads, audit-logged writes (POST upsert + DELETE for both resources). The app
lifespan (which seeds the default element schemas and fonts) does NOT run
under ASGITransport, so tests build their own schemas/fonts through the API
themselves — same as the theme-manager suite builds its own themes/tokens.
"""

from sqlalchemy import select

from app.models.moderation import ModerationAuditLog

# ── Element schemas: public reads ──────────────────────────────────────────


async def test_public_element_schemas_empty_by_default(client):
    r = await client.get("/api/element-schemas")
    assert r.status_code == 200
    assert r.json() == {}


async def test_get_schemas_by_element_type_returns_flat_list(client, make_user):
    _, headers = await make_user(email="su-ec-bytype@example.com", role="super_admin")
    await client.post(
        "/api/element-schemas",
        headers=headers,
        json={
            "element_type": "button",
            "property_name": "background-color",
            "property_type": "intrinsic",
            "control_type": "palette",
        },
    )
    await client.post(
        "/api/element-schemas",
        headers=headers,
        json={
            "element_type": "button",
            "property_name": "border-radius",
            "property_type": "extrinsic",
            "control_type": "slider",
        },
    )
    # Another element type must not bleed into the "button" list
    await client.post(
        "/api/element-schemas",
        headers=headers,
        json={
            "element_type": "section",
            "property_name": "gap",
            "property_type": "extrinsic",
            "control_type": "slider",
        },
    )
    btn = (await client.get("/api/element-schemas/button")).json()
    assert sorted(p["property_name"] for p in btn) == ["background-color", "border-radius"]
    sec = (await client.get("/api/element-schemas/section")).json()
    assert [p["property_name"] for p in sec] == ["gap"]
    # An element type with no curated properties returns [], not 404
    assert (await client.get("/api/element-schemas/nonexistent")).json() == []


# ── Element schemas: writes (super_admin only) ─────────────────────────────


async def test_plain_user_cannot_create_schema(client, make_user):
    _, headers = await make_user(email="plain-ec@example.com", role="user")
    r = await client.post(
        "/api/element-schemas",
        headers=headers,
        json={
            "element_type": "heading",
            "property_name": "color",
            "property_type": "extrinsic",
            "control_type": "palette",
        },
    )
    assert r.status_code == 403


async def test_can_edit_copy_user_cannot_create_schema(client, make_user):
    """The element catalog does NOT honor the can_edit_copy delegation."""
    _, headers = await make_user(email="delegate-ec@example.com", can_edit_copy=True)
    r = await client.post(
        "/api/element-schemas",
        headers=headers,
        json={
            "element_type": "heading",
            "property_name": "color",
            "property_type": "extrinsic",
            "control_type": "palette",
        },
    )
    assert r.status_code == 403


async def test_super_admin_creates_schema_and_grouped_listing_shows_it(client, make_user):
    _, headers = await make_user(email="su-ec@example.com", role="super_admin")
    r = await client.post(
        "/api/element-schemas",
        headers=headers,
        json={
            "element_type": "heading",
            "property_name": "color",
            "property_type": "extrinsic",
            "control_type": "palette",
            "default_value": "stone-800",
        },
    )
    assert r.status_code == 200
    assert r.json()["element_type"] == "heading"
    assert r.json()["property_name"] == "color"
    assert r.json()["default_value"] == "stone-800"
    assert r.json()["is_visible"] is True  # default visibility
    grouped = (await client.get("/api/element-schemas")).json()
    assert "heading" in grouped
    assert any(p["property_name"] == "color" for p in grouped["heading"])


async def test_upsert_schema_updates_in_place_no_duplicate(client, make_user):
    _, headers = await make_user(email="su-ec-up@example.com", role="super_admin")
    first = await client.post(
        "/api/element-schemas",
        headers=headers,
        json={
            "element_type": "card",
            "property_name": "padding",
            "property_type": "extrinsic",
            "control_type": "slider",
        },
    )
    assert first.status_code == 200
    second = await client.post(
        "/api/element-schemas",
        headers=headers,
        json={
            "element_type": "card",
            "property_name": "padding",
            "property_type": "extrinsic",
            "control_type": "slider",
            "default_value": "md",
        },
    )
    assert second.status_code == 200
    assert second.json()["default_value"] == "md"
    props = (await client.get("/api/element-schemas/card")).json()
    matching = [p for p in props if p["property_name"] == "padding"]
    assert len(matching) == 1  # upsert, not duplicate
    assert matching[0]["default_value"] == "md"


async def test_update_schema_fields(client, make_user):
    _, headers = await make_user(email="su-ec-put@example.com", role="super_admin")
    created = (
        await client.post(
            "/api/element-schemas",
            headers=headers,
            json={
                "element_type": "heading",
                "property_name": "letter-spacing",
                "property_type": "extrinsic",
                "control_type": "slider",
                "is_visible": True,
            },
        )
    ).json()
    sid = created["id"]
    upd = await client.put(
        f"/api/element-schemas/{sid}",
        headers=headers,
        json={"default_value": "tight", "is_visible": False},
    )
    assert upd.status_code == 200
    assert upd.json()["default_value"] == "tight"
    assert upd.json()["is_visible"] is False
    assert upd.json()["element_type"] == "heading"
    assert upd.json()["property_name"] == "letter-spacing"


async def test_delete_schema_requires_super_admin(client, make_user):
    _, su = await make_user(email="su-ec-del@example.com", role="super_admin")
    created = (
        await client.post(
            "/api/element-schemas",
            headers=su,
            json={
                "element_type": "card",
                "property_name": "border-width",
                "property_type": "extrinsic",
                "control_type": "slider",
            },
        )
    ).json()
    sid = created["id"]
    _, plain = await make_user(email="plain-ec-del@example.com", role="user")
    assert (await client.delete(f"/api/element-schemas/{sid}", headers=plain)).status_code == 403
    assert (await client.delete(f"/api/element-schemas/{sid}", headers=su)).status_code == 200
    grouped = (await client.get("/api/element-schemas")).json()
    assert all(
        p["property_name"] != "border-width"
        for props in grouped.values()
        for p in props
    )


# ── Fonts: public reads + writes ───────────────────────────────────────────


async def test_public_fonts_empty_by_default(client):
    r = await client.get("/api/fonts")
    assert r.status_code == 200
    assert r.json() == []


async def test_plain_user_cannot_create_font(client, make_user):
    _, headers = await make_user(email="plain-font@example.com", role="user")
    r = await client.post(
        "/api/fonts",
        headers=headers,
        json={"name": "Fraunces", "family": '"Fraunces", Georgia, serif'},
    )
    assert r.status_code == 403


async def test_super_admin_creates_font_and_public_list_returns_it(client, make_user):
    _, headers = await make_user(email="su-font@example.com", role="super_admin")
    r = await client.post(
        "/api/fonts",
        headers=headers,
        json={
            "name": "Fraunces",
            "family": '"Fraunces", Georgia, serif',
            "url": "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300..900&display=swap",
        },
    )
    assert r.status_code == 200
    assert r.json()["name"] == "Fraunces"
    assert r.json()["is_active"] is True
    pub = (await client.get("/api/fonts")).json()
    assert len(pub) == 1
    assert pub[0]["name"] == "Fraunces"
    assert pub[0]["family"] == '"Fraunces", Georgia, serif'
    # Public list returns exactly {id, name, family, url, is_active} — no internal fields.
    assert set(pub[0].keys()) == {"id", "name", "family", "url", "is_active"}


async def test_create_duplicate_font_name_conflicts(client, make_user):
    _, headers = await make_user(email="su-font-dup@example.com", role="super_admin")
    await client.post(
        "/api/fonts", headers=headers, json={"name": "Inter", "family": "Inter, sans-serif"}
    )
    r = await client.post(
        "/api/fonts", headers=headers, json={"name": "Inter", "family": "Inter, sans-serif"}
    )
    assert r.status_code == 409


async def test_update_font_and_inactive_hidden_from_public(client, make_user):
    _, headers = await make_user(email="su-font-put@example.com", role="super_admin")
    created = (
        await client.post(
            "/api/fonts",
            headers=headers,
            json={"name": "Source Serif 4", "family": '"Source Serif 4", Georgia, serif'},
        )
    ).json()
    fid = created["id"]
    upd = await client.put(
        f"/api/fonts/{fid}",
        headers=headers,
        json={"is_active": False, "family": '"Source Serif 4", serif'},
    )
    assert upd.status_code == 200
    assert upd.json()["is_active"] is False
    assert upd.json()["family"] == '"Source Serif 4", serif'
    # Inactive font disappears from the public active list
    assert (await client.get("/api/fonts")).json() == []


async def test_delete_font_requires_super_admin(client, make_user):
    _, su = await make_user(email="su-font-del@example.com", role="super_admin")
    created = (
        await client.post(
            "/api/fonts", headers=su, json={"name": "Mono", "family": "ui-monospace, monospace"}
        )
    ).json()
    fid = created["id"]
    _, plain = await make_user(email="plain-font-del@example.com", role="user")
    assert (await client.delete(f"/api/fonts/{fid}", headers=plain)).status_code == 403
    assert (await client.delete(f"/api/fonts/{fid}", headers=su)).status_code == 200
    assert (await client.get("/api/fonts")).json() == []


# ── Audit logs ─────────────────────────────────────────────────────────────


async def test_create_schema_writes_audit_log(client, make_user, session_factory):
    su, headers = await make_user(email="su-ec-audit@example.com", role="super_admin")
    await client.post(
        "/api/element-schemas",
        headers=headers,
        json={
            "element_type": "heading",
            "property_name": "font-weight",
            "property_type": "extrinsic",
            "control_type": "button-group",
        },
    )
    async with session_factory() as s:
        logs = (
            await s.execute(
                select(ModerationAuditLog).where(
                    ModerationAuditLog.action == "upsert_element_schema"
                )
            )
        ).scalars().all()
    assert len(logs) == 1
    assert logs[0].target_type == "element_schema"
    assert logs[0].actor_id == su.id
    assert logs[0].meta["element_type"] == "heading"
    assert logs[0].meta["property_name"] == "font-weight"


async def test_delete_schema_writes_audit_log(client, make_user, session_factory):
    su, headers = await make_user(email="su-ec-audit2@example.com", role="super_admin")
    created = (
        await client.post(
            "/api/element-schemas",
            headers=headers,
            json={
                "element_type": "heading",
                "property_name": "text-align",
                "property_type": "extrinsic",
                "control_type": "button-group",
            },
        )
    ).json()
    sid = created["id"]
    await client.delete(f"/api/element-schemas/{sid}", headers=headers)
    async with session_factory() as s:
        logs = (
            await s.execute(
                select(ModerationAuditLog).where(
                    ModerationAuditLog.action == "delete_element_schema"
                )
            )
        ).scalars().all()
    assert len(logs) == 1
    assert logs[0].target_type == "element_schema"
    assert logs[0].actor_id == su.id
    assert logs[0].meta["property_name"] == "text-align"


async def test_create_font_writes_audit_log(client, make_user, session_factory):
    su, headers = await make_user(email="su-font-audit@example.com", role="super_admin")
    await client.post(
        "/api/fonts",
        headers=headers,
        json={"name": "Fraunces", "family": '"Fraunces", Georgia, serif'},
    )
    async with session_factory() as s:
        logs = (
            await s.execute(
                select(ModerationAuditLog).where(ModerationAuditLog.action == "create_font")
            )
        ).scalars().all()
    assert len(logs) == 1
    assert logs[0].target_type == "font"
    assert logs[0].actor_id == su.id
    assert logs[0].meta["name"] == "Fraunces"


async def test_delete_font_writes_audit_log(client, make_user, session_factory):
    su, headers = await make_user(email="su-font-audit2@example.com", role="super_admin")
    created = (
        await client.post(
            "/api/fonts", headers=headers, json={"name": "Inter", "family": "Inter, sans-serif"}
        )
    ).json()
    fid = created["id"]
    await client.delete(f"/api/fonts/{fid}", headers=headers)
    async with session_factory() as s:
        logs = (
            await s.execute(
                select(ModerationAuditLog).where(ModerationAuditLog.action == "delete_font")
            )
        ).scalars().all()
    assert len(logs) == 1
    assert logs[0].target_type == "font"
    assert logs[0].actor_id == su.id
    assert logs[0].meta["name"] == "Inter"
