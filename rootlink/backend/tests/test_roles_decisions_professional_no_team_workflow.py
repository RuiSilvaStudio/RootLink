"""Post-Phase-6 product decision 1 (docs/roles-permissions/phase0-decisions.md
Addendum 5): professional entities never get promote/demote capability —
verification, not new logic. Professional-kind users' rank changes are
handled directly by the platform (`/admin/users`), never through the
entity-scoped role-change-request workflow, which is organization-only.

Covers, with real requests/assertions rather than just reading the code:
1. A professional's admin(4) cannot submit a role-change request about
   another professional user (already enforced by `role_requests.py`,
   re-proven here under this decision's own name).
2. A professional user has no `entity_id` and therefore no real path to
   `/api/entities/{id}/members` (the backend half of `/entity/[entityId]/team`)
   for ANY entity — `can_view_team` requires either entity membership
   (impossible for professional, which never gets an `entity_id`) or being
   that specific entity's primary contact (impossible for an
   organization/partners/suppliers entity from a professional account).
3. `entity.convert_professional_to_individual`'s target is fully covered by
   decision 2's own test file — not re-tested here.
"""

from app.models.entity import Entity


async def _org(session_factory, name="Org"):
    async with session_factory() as s:
        entity = Entity(entity_type="organization", name=name, verification_status="verified")
        s.add(entity)
        await s.commit()
        await s.refresh(entity)
        return entity


async def test_professional_admin_cannot_submit_role_change_request(client, make_user):
    admin, headers = await make_user(email="prof-admin-blocked@example.com", entity_kind="professional", rank=4)
    target, _ = await make_user(email="prof-target-blocked@example.com", entity_kind="professional", rank=1)
    r = await client.post("/api/role-requests", headers=headers, json={
        "target_user_id": target.id, "to_rank": 2,
    })
    assert r.status_code == 400
    assert "organization-only" in r.json()["detail"] or "never will" in r.json()["detail"] or "team model" in r.json()["detail"]


async def test_professional_user_never_has_entity_id(client, make_user):
    """Structural confirmation: professional-kind users never get an
    `entity_id` (only `organization`/`partners`/`suppliers` do) — this is
    what makes `/entity/[entityId]/team` structurally unreachable for them
    (no entity_id to build the URL from in the first place)."""
    user, _ = await make_user(email="prof-no-entity-id@example.com", entity_kind="professional", rank=4)
    assert user.entity_id is None


async def test_professional_admin_cannot_view_any_organizations_team_roster(client, make_user, session_factory):
    """Even if a professional admin manually guesses/types another
    organization's `/entity/{id}/members` URL, the backend still denies it —
    `can_view_team` requires real entity membership or primary-contact
    status, neither of which a professional account can ever have."""
    entity = await _org(session_factory, "SomeOrg")
    admin, headers = await make_user(email="prof-admin-teamview@example.com", entity_kind="professional", rank=4)
    r = await client.get(f"/api/entities/{entity.id}/members", headers=headers)
    assert r.status_code == 403


async def test_professional_admin_cannot_add_to_organization_roster(client, make_user, session_factory):
    entity = await _org(session_factory, "SomeOrg2")
    admin, headers = await make_user(email="prof-admin-rosteradd@example.com", entity_kind="professional", rank=4)
    target, _ = await make_user(email="prof-roster-target@example.com", entity_kind="individual", rank=1)
    r = await client.post(f"/api/entities/{entity.id}/roster", headers=headers, json={"user_id": target.id})
    assert r.status_code in (400, 403)


async def test_professional_registry_action_is_entity_scoped_persona_only_no_delegation(client, make_user):
    """`entity.convert_professional_to_individual` (the new decision-2
    action) must remain registered as entity-scoped, non-delegable — it's a
    self-service conversion action, never a promote/demote-style delegable
    authority."""
    r = await client.get("/api/permissions/registry")
    assert r.status_code == 200
    body = r.json()
    entry = body["entity.convert_professional_to_individual"]
    assert entry["entity_scope"] == "entity"
    assert entry["delegable"] is False
