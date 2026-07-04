"""Phase 5 — entity self-service registration + verification review
(docs/roles-permissions/assessment.md §5.2, §10a; docs/roles-permissions/ROLES_PERMISSIONS.md §3 "How entities are created").
"""

from app.models.entity import Entity
from app.models.user import User


async def test_register_organization_creates_pending_entity(client, make_user):
    _user, headers = await make_user(email="founder@example.com", entity_kind="individual", rank=1)
    r = await client.post("/api/entities/register", headers=headers, json={
        "entity_type": "organization", "name": "Green Co-op",
    })
    assert r.status_code == 201
    body = r.json()
    assert body["verification_status"] == "pending"
    assert body["entity_type"] == "organization"
    assert body["primary_contact_user_id"] == _user.id


async def test_registrant_not_bootstrapped_until_verified(client, make_user, session_factory):
    user, headers = await make_user(email="founder2@example.com", entity_kind="individual", rank=1)
    r = await client.post("/api/entities/register", headers=headers, json={
        "entity_type": "organization", "name": "Pending Org",
    })
    entity_id = r.json()["id"]

    async with session_factory() as s:
        u = await s.get(User, user.id)
        assert u.entity_id is None  # "treated as a plain persona until verification succeeds"


async def test_cannot_register_if_already_in_an_entity(client, make_user, session_factory):
    async with session_factory() as s:
        entity = Entity(entity_type="organization", name="Existing Org", verification_status="verified")
        s.add(entity)
        await s.commit()
        await s.refresh(entity)
        entity_id = entity.id

    _user, headers = await make_user(
        email="already@example.com", entity_kind="organization", entity_id=entity_id, rank=5,
    )
    r = await client.post("/api/entities/register", headers=headers, json={
        "entity_type": "partners", "name": "Another Org",
    })
    assert r.status_code == 400


async def test_non_staff_cannot_see_verification_queue(client, make_user):
    _user, headers = await make_user(email="plain@example.com", entity_kind="individual", rank=1)
    r = await client.get("/api/entities/verification-queue", headers=headers)
    assert r.status_code == 403


async def test_platform_admin_sees_pending_queue_and_approves(client, make_user, session_factory):
    founder, founder_headers = await make_user(email="founder3@example.com", entity_kind="individual", rank=1)
    r = await client.post("/api/entities/register", headers=founder_headers, json={
        "entity_type": "organization", "name": "Queue Org",
    })
    entity_id = r.json()["id"]

    _admin, admin_headers = await make_user(email="staffadmin@example.com", entity_kind="platform", rank=4)
    r = await client.get("/api/entities/verification-queue", headers=admin_headers)
    assert r.status_code == 200
    assert any(e["id"] == entity_id for e in r.json())

    r = await client.post(
        f"/api/entities/{entity_id}/verification/approve", headers=admin_headers, json={"reason": "docs checked out"},
    )
    assert r.status_code == 200
    assert r.json()["verification_status"] == "verified"

    async with session_factory() as s:
        u = await s.get(User, founder.id)
        assert u.entity_id == entity_id
        assert u.entity_kind == "organization"
        assert u.rank == 5  # bootstrap: new organization's first super admin


async def test_verify_bootstraps_partners_at_persona_not_super_admin(client, make_user, session_factory):
    founder, founder_headers = await make_user(email="founder4@example.com", entity_kind="individual", rank=1)
    r = await client.post("/api/entities/register", headers=founder_headers, json={
        "entity_type": "partners", "name": "Law Firm LLP",
    })
    entity_id = r.json()["id"]

    _admin, admin_headers = await make_user(email="staffadmin2@example.com", entity_kind="platform", rank=4)
    r = await client.post(f"/api/entities/{entity_id}/verification/approve", headers=admin_headers, json={})
    assert r.status_code == 200

    async with session_factory() as s:
        u = await s.get(User, founder.id)
        assert u.entity_kind == "partners"
        assert u.rank == 1  # partners: persona + specific grants, no super-admin tier


async def test_reject_verification_does_not_bootstrap(client, make_user, session_factory):
    founder, founder_headers = await make_user(email="founder5@example.com", entity_kind="individual", rank=1)
    r = await client.post("/api/entities/register", headers=founder_headers, json={
        "entity_type": "organization", "name": "Rejected Org",
    })
    entity_id = r.json()["id"]

    _admin, admin_headers = await make_user(email="staffadmin3@example.com", entity_kind="platform", rank=4)
    r = await client.post(
        f"/api/entities/{entity_id}/verification/reject", headers=admin_headers, json={"reason": "insufficient proof"},
    )
    assert r.status_code == 200
    assert r.json()["verification_status"] == "rejected"

    async with session_factory() as s:
        u = await s.get(User, founder.id)
        assert u.entity_id is None
        assert u.entity_kind == "individual"


async def test_request_more_info(client, make_user):
    _founder, founder_headers = await make_user(email="founder6@example.com", entity_kind="individual", rank=1)
    r = await client.post("/api/entities/register", headers=founder_headers, json={
        "entity_type": "suppliers", "name": "Cloud Storage Inc",
    })
    entity_id = r.json()["id"]

    _admin, admin_headers = await make_user(email="staffadmin4@example.com", entity_kind="platform", rank=4)
    r = await client.post(
        f"/api/entities/{entity_id}/verification/request-more-info", headers=admin_headers,
        json={"reason": "need a scanned business registration"},
    )
    assert r.status_code == 200
    assert r.json()["verification_status"] == "more_info_requested"


async def test_my_entity_endpoint_shows_pending_registration(client, make_user):
    _founder, founder_headers = await make_user(email="founder7@example.com", entity_kind="individual", rank=1)
    r = await client.post("/api/entities/register", headers=founder_headers, json={
        "entity_type": "organization", "name": "My Pending Org",
    })
    entity_id = r.json()["id"]

    r = await client.get("/api/entities/mine", headers=founder_headers)
    assert r.status_code == 200
    assert r.json()["id"] == entity_id
