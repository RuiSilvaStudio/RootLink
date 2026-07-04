"""Phase 5 — role-change request listing (docs/roles-permissions/ROLES_PERMISSIONS.md §6 UI needs:
"submit a request, see pending requests awaiting your approval")."""

from app.models.entity import Entity


async def _org(session_factory, name="Org"):
    async with session_factory() as s:
        entity = Entity(entity_type="organization", name=name, verification_status="verified")
        s.add(entity)
        await s.commit()
        await s.refresh(entity)
        return entity


async def test_mine_scope_lists_my_submitted_requests(client, make_user, session_factory):
    entity = await _org(session_factory)
    _mod, mod_headers = await make_user(email="reqmod@example.com", entity_kind="organization", entity_id=entity.id, rank=3)
    target, _ = await make_user(email="reqtarget@example.com", entity_kind="organization", entity_id=entity.id, rank=1)

    r = await client.post("/api/role-requests", headers=mod_headers, json={"target_user_id": target.id, "to_rank": 2})
    assert r.status_code == 201

    r = await client.get("/api/role-requests?scope=mine", headers=mod_headers)
    assert r.status_code == 200
    assert len(r.json()) == 1


async def test_pending_approval_scope_lists_only_requests_i_can_decide(client, make_user, session_factory):
    entity = await _org(session_factory, "Org2")
    _mod, mod_headers = await make_user(email="reqmod2@example.com", entity_kind="organization", entity_id=entity.id, rank=3)
    target, _ = await make_user(email="reqtarget2@example.com", entity_kind="organization", entity_id=entity.id, rank=1)
    r = await client.post("/api/role-requests", headers=mod_headers, json={"target_user_id": target.id, "to_rank": 2})
    assert r.status_code == 201

    _admin, admin_headers = await make_user(email="reqadmin2@example.com", entity_kind="organization", entity_id=entity.id, rank=4)
    r = await client.get("/api/role-requests?scope=pending-approval", headers=admin_headers)
    assert r.status_code == 200
    assert len(r.json()) == 1

    # A stranger in a different entity should see none of it.
    other_entity = await _org(session_factory, "Org3")
    _other, other_headers = await make_user(
        email="reqother2@example.com", entity_kind="organization", entity_id=other_entity.id, rank=4,
    )
    r = await client.get("/api/role-requests?scope=pending-approval", headers=other_headers)
    assert r.status_code == 200
    assert len(r.json()) == 0


async def test_invalid_scope_rejected(client, make_user):
    _user, headers = await make_user(email="reqbad@example.com", entity_kind="individual", rank=1)
    r = await client.get("/api/role-requests?scope=bogus", headers=headers)
    assert r.status_code == 400
