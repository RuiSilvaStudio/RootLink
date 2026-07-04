"""Phase 4 — entity conversion (docs/roles-permissions/ROLES_PERMISSIONS.md §3 "Entity conversion
(lifecycle)"). Backend-only endpoints, app/api/entity_conversion.py.
"""

from sqlalchemy import select

from app.models.entity import Entity
from app.models.moderation import ModerationAuditLog
from app.models.user import User


async def test_individual_to_professional_requires_email_verified(client, make_user):
    user, headers = await make_user(email="unverified@example.com", entity_kind="individual", rank=1)
    r = await client.post("/api/entity-conversion/to-professional", headers=headers, json={
        "tax_registration_id": "PT123", "activity_registration_number": "ACT456",
    })
    assert r.status_code == 400


async def test_individual_to_professional_success(client, make_user, session_factory):
    user, headers = await make_user(
        email="ind@example.com", entity_kind="individual", rank=1, email_verified=True,
    )
    r = await client.post("/api/entity-conversion/to-professional", headers=headers, json={
        "tax_registration_id": "PT123", "activity_registration_number": "ACT456",
    })
    assert r.status_code == 200

    async with session_factory() as s:
        refreshed = await s.get(User, user.id)
        assert refreshed.entity_kind == "professional"
        # Rank resets to persona in the new entity (docs/roles-permissions/ROLES_PERMISSIONS.md §3).
        assert refreshed.rank == 1
        assert refreshed.entity_id is None
        assert refreshed.is_verified is True  # earned fresh by this conversion's own check
        assert refreshed.registration_number == "PT123"
        assert refreshed.activity_registration_number == "ACT456"

        logs = (await s.execute(
            select(ModerationAuditLog).where(ModerationAuditLog.action == "convert_entity")
        )).scalars().all()
        assert len(logs) == 1
        assert logs[0].actor_id == user.id


async def test_individual_to_professional_badges_not_carried_over(client, make_user, session_factory):
    """A pre-existing trusted-publisher badge must NOT survive conversion."""
    user, headers = await make_user(
        email="trusted@example.com", entity_kind="individual", rank=2, email_verified=True,
        can_self_publish=True,
    )
    r = await client.post("/api/entity-conversion/to-professional", headers=headers, json={
        "tax_registration_id": "PT1", "activity_registration_number": "ACT1",
    })
    assert r.status_code == 200
    async with session_factory() as s:
        refreshed = await s.get(User, user.id)
        assert refreshed.can_self_publish is False


async def test_professional_to_organization_requires_professional_entity(client, make_user):
    user, headers = await make_user(email="notprof@example.com", entity_kind="individual", rank=1)
    r = await client.post("/api/entity-conversion/to-organization", headers=headers, json={
        "organization_name": "Acme Coop",
    })
    assert r.status_code == 400


async def test_professional_to_organization_success_bootstraps_super_admin(client, make_user, session_factory):
    user, headers = await make_user(
        email="prof@example.com", entity_kind="professional", rank=4, is_verified=True,
    )
    r = await client.post("/api/entity-conversion/to-organization", headers=headers, json={
        "organization_name": "Acme Cooperative",
    })
    assert r.status_code == 200

    async with session_factory() as s:
        refreshed = await s.get(User, user.id)
        assert refreshed.entity_kind == "organization"
        assert refreshed.entity_id is not None
        # Bootstrapping a new entity — no approval step, becomes super admin.
        assert refreshed.rank == 5
        assert refreshed.is_verified is False  # badge not carried over

        entity = await s.get(Entity, refreshed.entity_id)
        assert entity.entity_type == "organization"
        assert entity.name == "Acme Cooperative"
        assert entity.verification_status == "pending"


async def test_conversion_is_one_way_cannot_reconvert(client, make_user, session_factory):
    user, headers = await make_user(
        email="onceonly@example.com", entity_kind="professional", rank=4,
    )
    r1 = await client.post("/api/entity-conversion/to-organization", headers=headers, json={
        "organization_name": "First Org",
    })
    assert r1.status_code == 200
    # Now entity_kind is "organization" — a second professional->organization
    # attempt must fail (no longer a professional).
    r2 = await client.post("/api/entity-conversion/to-organization", headers=headers, json={
        "organization_name": "Second Org",
    })
    assert r2.status_code == 400
