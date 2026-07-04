"""Phase 5 — entity-scoped "manage my team" (docs/roles-permissions/ROLES_PERMISSIONS.md §3)."""

from app.models.entity import DelegationGrant, Entity
from app.models.user import User
from sqlalchemy import select


async def _partners(session_factory, primary_contact_id=None, name="Law Firm"):
    async with session_factory() as s:
        entity = Entity(
            entity_type="partners", name=name, verification_status="verified",
            primary_contact_user_id=primary_contact_id,
        )
        s.add(entity)
        await s.commit()
        await s.refresh(entity)
        return entity


async def _org(session_factory, name="Org"):
    async with session_factory() as s:
        entity = Entity(entity_type="organization", name=name, verification_status="verified")
        s.add(entity)
        await s.commit()
        await s.refresh(entity)
        return entity


async def test_member_can_view_team(client, make_user, session_factory):
    entity = await _org(session_factory)
    member, headers = await make_user(email="teammember@example.com", entity_kind="organization", entity_id=entity.id, rank=2)
    r = await client.get(f"/api/entities/{entity.id}/members", headers=headers)
    assert r.status_code == 200
    assert any(m["id"] == member.id for m in r.json())


async def test_stranger_cannot_view_team(client, make_user, session_factory):
    entity = await _org(session_factory, "Org7")
    _stranger, headers = await make_user(email="teamstranger@example.com", entity_kind="individual", rank=1)
    r = await client.get(f"/api/entities/{entity.id}/members", headers=headers)
    assert r.status_code == 403


async def test_primary_contact_can_add_roster_member(client, make_user, session_factory):
    contact, contact_headers = await make_user(email="primarycontact@example.com", entity_kind="partners", rank=1)
    entity = await _partners(session_factory, primary_contact_id=contact.id)
    # backfill contact's entity_id now that the entity exists
    async with session_factory() as s:
        u = await s.get(User, contact.id)
        u.entity_id = entity.id
        await s.commit()

    new_member, _ = await make_user(email="newmember@example.com", entity_kind="individual", rank=1)
    r = await client.post(f"/api/entities/{entity.id}/roster", headers=contact_headers, json={"user_id": new_member.id})
    assert r.status_code == 200
    assert r.json()["entity_kind"] == "partners"
    assert r.json()["rank"] == 1


async def test_non_primary_contact_cannot_add_roster_member(client, make_user, session_factory):
    entity = await _partners(session_factory, primary_contact_id=None, name="Law Firm2")
    _other, other_headers = await make_user(
        email="otherpartner@example.com", entity_kind="partners", entity_id=entity.id, rank=1,
    )
    new_member, _ = await make_user(email="newmember2@example.com", entity_kind="individual", rank=1)
    r = await client.post(f"/api/entities/{entity.id}/roster", headers=other_headers, json={"user_id": new_member.id})
    assert r.status_code == 400


async def test_roster_add_rejected_for_organization_entities(client, make_user, session_factory):
    entity = await _org(session_factory, "Org8")
    _super, headers = await make_user(
        email="orgsuper8@example.com", entity_kind="organization", entity_id=entity.id, rank=5,
    )
    new_member, _ = await make_user(email="newmember3@example.com", entity_kind="individual", rank=1)
    r = await client.post(f"/api/entities/{entity.id}/roster", headers=headers, json={"user_id": new_member.id})
    assert r.status_code == 400


async def test_remove_roster_member_voids_delegations_and_resets_to_individual(client, make_user, session_factory):
    contact, contact_headers = await make_user(email="primarycontact2@example.com", entity_kind="partners", rank=1)
    entity = await _partners(session_factory, primary_contact_id=contact.id, name="Law Firm3")
    async with session_factory() as s:
        u = await s.get(User, contact.id)
        u.entity_id = entity.id
        await s.commit()

    member, _ = await make_user(
        email="rosteredmember@example.com", entity_kind="partners", entity_id=entity.id, rank=1,
    )
    # Grant a delegation to the member first, within this entity.
    async with session_factory() as s:
        grant = DelegationGrant(
            grantor_id=contact.id, grantee_id=member.id, entity_id=entity.id,
            action="password.reset_entity_member", granted_at=__import__("datetime").datetime.now(__import__("datetime").UTC),
        )
        s.add(grant)
        await s.commit()

    r = await client.delete(f"/api/entities/{entity.id}/roster/{member.id}", headers=contact_headers)
    assert r.status_code == 200
    assert r.json()["entity_kind"] == "individual"

    async with session_factory() as s:
        u = await s.get(User, member.id)
        assert u.entity_id is None
        assert u.rank == 1

        rows = (await s.execute(select(DelegationGrant).where(DelegationGrant.grantee_id == member.id))).scalars().all()
        assert len(rows) == 1
        assert rows[0].revoked_at is not None


async def test_cannot_remove_the_primary_contact_from_own_roster(client, make_user, session_factory):
    contact, contact_headers = await make_user(email="primarycontact3@example.com", entity_kind="partners", rank=1)
    entity = await _partners(session_factory, primary_contact_id=contact.id, name="Law Firm4")
    async with session_factory() as s:
        u = await s.get(User, contact.id)
        u.entity_id = entity.id
        await s.commit()

    r = await client.delete(f"/api/entities/{entity.id}/roster/{contact.id}", headers=contact_headers)
    assert r.status_code == 400
