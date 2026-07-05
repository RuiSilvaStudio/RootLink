"""Compost facility listing management (docs/roles-permissions/ROLES_PERMISSIONS.md
§7 "Create/edit own compost listing", §8 "Archive compost listing"):
contributor+ can create/edit their own hub; an organization's own super
admin can edit a fellow member's hub; only a PLATFORM super admin (never an
entity's own super admin) can archive one, since a hub can be used by
members of many different entities.
"""

from app.models.waste import CompostingHub


async def _make_hub(session_factory, manager_id, status="active"):
    async with session_factory() as session:
        hub = CompostingHub(
            name="Riverside Compost",
            manager_id=manager_id,
            location="Riverside",
            status=status,
        )
        session.add(hub)
        await session.commit()
        await session.refresh(hub)
        return hub.id


async def test_create_hub_requires_contributor_rank(client, make_user):
    _, plain_headers = await make_user(email="plain-hub@example.com", role="user")
    resp = await client.post(
        "/api/waste/hubs",
        headers=plain_headers,
        json={"name": "My Hub", "location": "Somewhere"},
    )
    assert resp.status_code == 403


async def test_create_hub_allowed_for_contributor(client, make_user):
    _, contrib_headers = await make_user(email="contrib-hub@example.com", role="contributor")
    resp = await client.post(
        "/api/waste/hubs",
        headers=contrib_headers,
        json={"name": "My Hub", "location": "Somewhere"},
    )
    assert resp.status_code == 201, resp.text


async def test_owner_can_edit_own_hub(client, make_user, session_factory):
    owner, owner_headers = await make_user(email="owner-hub@example.com", role="contributor")
    hub_id = await _make_hub(session_factory, owner.id)

    resp = await client.patch(
        f"/api/waste/hubs/{hub_id}",
        headers=owner_headers,
        json={"description": "Updated description", "status": "full"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["description"] == "Updated description"
    assert resp.json()["status"] == "full"


async def test_non_owner_cannot_edit_hub(client, make_user, session_factory):
    owner, _ = await make_user(email="owner2-hub@example.com", role="contributor")
    _, other_headers = await make_user(email="other-hub@example.com", role="moderator")
    hub_id = await _make_hub(session_factory, owner.id)

    resp = await client.patch(
        f"/api/waste/hubs/{hub_id}",
        headers=other_headers,
        json={"description": "Hijacked"},
    )
    assert resp.status_code == 403


async def test_org_super_admin_can_edit_fellow_member_hub(client, make_user, session_factory):
    owner, _ = await make_user(
        email="member-hub@example.com", role="contributor",
        entity_kind="organization", entity_id=42, rank=2,
    )
    _, admin_headers = await make_user(
        email="orgadmin-hub@example.com", role="admin",
        entity_kind="organization", entity_id=42, rank=5,
    )
    hub_id = await _make_hub(session_factory, owner.id)

    resp = await client.patch(
        f"/api/waste/hubs/{hub_id}",
        headers=admin_headers,
        json={"description": "Edited by org super admin"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["description"] == "Edited by org super admin"


async def test_different_org_super_admin_cannot_edit(client, make_user, session_factory):
    owner, _ = await make_user(
        email="member2-hub@example.com", role="contributor",
        entity_kind="organization", entity_id=42, rank=2,
    )
    _, other_org_admin_headers = await make_user(
        email="otherorgadmin-hub@example.com", role="admin",
        entity_kind="organization", entity_id=99, rank=5,
    )
    hub_id = await _make_hub(session_factory, owner.id)

    resp = await client.patch(
        f"/api/waste/hubs/{hub_id}",
        headers=other_org_admin_headers,
        json={"description": "Should not work"},
    )
    assert resp.status_code == 403


async def test_org_moderator_admin_cannot_edit_fellow_member_hub_no_middle_tier(client, make_user, session_factory):
    """No ☑️ tier — a moderator/admin below super_admin rank in the SAME org
    still can't edit someone else's listing (docs/roles-permissions/
    ROLES_PERMISSIONS.md §7's own note on this row)."""
    owner, _ = await make_user(
        email="member3-hub@example.com", role="contributor",
        entity_kind="organization", entity_id=7, rank=2,
    )
    _, mod_headers = await make_user(
        email="orgmod-hub@example.com", role="moderator",
        entity_kind="organization", entity_id=7, rank=3,
    )
    hub_id = await _make_hub(session_factory, owner.id)

    resp = await client.patch(
        f"/api/waste/hubs/{hub_id}",
        headers=mod_headers,
        json={"description": "Should not work either"},
    )
    assert resp.status_code == 403


async def test_owner_cannot_set_status_to_archived_via_edit(client, make_user, session_factory):
    owner, owner_headers = await make_user(email="owner3-hub@example.com", role="contributor")
    hub_id = await _make_hub(session_factory, owner.id)

    resp = await client.patch(
        f"/api/waste/hubs/{hub_id}",
        headers=owner_headers,
        json={"status": "archived"},
    )
    assert resp.status_code == 400


async def test_org_super_admin_cannot_archive_own_org_hub(client, make_user, session_factory):
    """Archive is platform-only — an entity's own super admin, even at rank
    5 in their own org, may not archive a hub used across entities."""
    owner, _ = await make_user(
        email="member4-hub@example.com", role="contributor",
        entity_kind="organization", entity_id=11, rank=2,
    )
    _, org_super_headers = await make_user(
        email="orgsuper-hub@example.com", role="admin",
        entity_kind="organization", entity_id=11, rank=5,
    )
    hub_id = await _make_hub(session_factory, owner.id)

    resp = await client.post(f"/api/waste/hubs/{hub_id}/archive", headers=org_super_headers)
    assert resp.status_code == 403


async def test_hub_manager_cannot_archive_own_hub(client, make_user, session_factory):
    owner, owner_headers = await make_user(email="owner4-hub@example.com", role="contributor")
    hub_id = await _make_hub(session_factory, owner.id)

    resp = await client.post(f"/api/waste/hubs/{hub_id}/archive", headers=owner_headers)
    assert resp.status_code == 403


async def test_platform_super_admin_can_archive(client, make_user, session_factory):
    owner, _ = await make_user(email="owner5-hub@example.com", role="contributor")
    _, platform_headers = await make_user(email="platsuper-hub@example.com", role="super_admin")
    hub_id = await _make_hub(session_factory, owner.id)

    resp = await client.post(f"/api/waste/hubs/{hub_id}/archive", headers=platform_headers)
    assert resp.status_code == 200, resp.text
    assert resp.json()["status"] == "archived"


async def test_archived_hub_excluded_from_default_list(client, make_user, session_factory):
    owner, _ = await make_user(email="owner6-hub@example.com", role="contributor")
    _, platform_headers = await make_user(email="platsuper2-hub@example.com", role="super_admin")
    hub_id = await _make_hub(session_factory, owner.id)

    await client.post(f"/api/waste/hubs/{hub_id}/archive", headers=platform_headers)

    resp = await client.get("/api/waste/hubs")
    assert resp.status_code == 200
    ids = {h["id"] for h in resp.json()}
    assert hub_id not in ids
