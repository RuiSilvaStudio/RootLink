"""Phase 5 — delegation-grant CRUD (docs/roles-permissions/ROLES_PERMISSIONS.md §10)."""

from app.models.entity import Entity


async def _org(session_factory, name="Org"):
    async with session_factory() as s:
        entity = Entity(entity_type="organization", name=name, verification_status="verified")
        s.add(entity)
        await s.commit()
        await s.refresh(entity)
        return entity


async def test_entity_super_admin_can_grant_delegable_entity_action(client, make_user, session_factory):
    entity = await _org(session_factory)
    _super, super_headers = await make_user(
        email="orgsuper1@example.com", entity_kind="organization", entity_id=entity.id, rank=5,
    )
    grantee, _ = await make_user(
        email="grantee1@example.com", entity_kind="organization", entity_id=entity.id, rank=2,
    )
    r = await client.post("/api/delegations", headers=super_headers, json={
        "grantee_id": grantee.id, "action": "article.approve", "entity_id": entity.id,
    })
    assert r.status_code == 201
    assert r.json()["action"] == "article.approve"


async def test_non_delegable_action_rejected(client, make_user, session_factory):
    entity = await _org(session_factory, "Org2")
    _super, super_headers = await make_user(
        email="orgsuper2@example.com", entity_kind="organization", entity_id=entity.id, rank=5,
    )
    grantee, _ = await make_user(
        email="grantee2@example.com", entity_kind="organization", entity_id=entity.id, rank=2,
    )
    r = await client.post("/api/delegations", headers=super_headers, json={
        "grantee_id": grantee.id, "action": "user.promote", "entity_id": entity.id,
    })
    assert r.status_code == 400  # promote/demote never delegable, docs/roles-permissions/ROLES_PERMISSIONS.md §10


async def test_cannot_self_delegate(client, make_user, session_factory):
    entity = await _org(session_factory, "Org3")
    super_admin, super_headers = await make_user(
        email="orgsuper3@example.com", entity_kind="organization", entity_id=entity.id, rank=5,
    )
    r = await client.post("/api/delegations", headers=super_headers, json={
        "grantee_id": super_admin.id, "action": "article.approve", "entity_id": entity.id,
    })
    assert r.status_code == 400


async def test_non_super_admin_cannot_grant(client, make_user, session_factory):
    entity = await _org(session_factory, "Org4")
    _admin, admin_headers = await make_user(
        email="orgadmin4@example.com", entity_kind="organization", entity_id=entity.id, rank=4,
    )
    grantee, _ = await make_user(
        email="grantee4@example.com", entity_kind="organization", entity_id=entity.id, rank=2,
    )
    r = await client.post("/api/delegations", headers=admin_headers, json={
        "grantee_id": grantee.id, "action": "article.approve", "entity_id": entity.id,
    })
    assert r.status_code == 400


async def test_platform_super_admin_can_grant_platform_wide_delegable_action(client, make_user):
    _platform_super, headers = await make_user(email="platsuper@example.com", entity_kind="platform", rank=5)
    grantee, _ = await make_user(email="grantee5@example.com", entity_kind="individual", rank=1)
    r = await client.post("/api/delegations", headers=headers, json={
        "grantee_id": grantee.id, "action": "platform_ui.edit_content", "entity_id": None,
    })
    assert r.status_code == 201


async def test_grantee_can_list_own_grants_via_mine(client, make_user, session_factory):
    entity = await _org(session_factory, "Org5")
    _super, super_headers = await make_user(
        email="orgsuper5@example.com", entity_kind="organization", entity_id=entity.id, rank=5,
    )
    grantee, grantee_headers = await make_user(
        email="grantee6@example.com", entity_kind="organization", entity_id=entity.id, rank=2,
    )
    await client.post("/api/delegations", headers=super_headers, json={
        "grantee_id": grantee.id, "action": "article.approve", "entity_id": entity.id,
    })
    r = await client.get("/api/delegations?mine=true", headers=grantee_headers)
    assert r.status_code == 200
    assert len(r.json()) == 1


async def test_revoke_delegation(client, make_user, session_factory):
    entity = await _org(session_factory, "Org6")
    _super, super_headers = await make_user(
        email="orgsuper6@example.com", entity_kind="organization", entity_id=entity.id, rank=5,
    )
    grantee, _ = await make_user(
        email="grantee7@example.com", entity_kind="organization", entity_id=entity.id, rank=2,
    )
    r = await client.post("/api/delegations", headers=super_headers, json={
        "grantee_id": grantee.id, "action": "article.approve", "entity_id": entity.id,
    })
    grant_id = r.json()["id"]

    r = await client.post(f"/api/delegations/{grant_id}/revoke", headers=super_headers, json={"reason": "no longer needed"})
    assert r.status_code == 200
    assert r.json()["revoked_at"] is not None

    r = await client.get("/api/delegations?mine=true", headers=super_headers)
    # super admin isn't the grantee, so "mine" for them is empty regardless
    assert r.status_code == 200
