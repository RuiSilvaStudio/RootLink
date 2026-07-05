"""Entity-scoped member account admin endpoints (docs/roles-permissions/
ROLES_PERMISSIONS.md §7 "password.reset_entity_member" /
"trusted_publisher.grant_revoke_entity"):

- POST  /api/entities/{entity_id}/members/{user_id}/reset-password
- PATCH /api/entities/{entity_id}/members/{user_id}/self-publish

Authorization for both: the SAME entity's super admin (rank 5), or the
platform (via `can()`'s platform-precedence branch). A different entity's
super admin — or a same-entity member below rank 5 — is always 403; a
target outside the entity is 404.
"""

from datetime import UTC, datetime

from sqlalchemy import select

from app.core.security import verify_password
from app.models.content import Content, ContentSource, ContentType, VerificationStatus
from app.models.entity import Entity
from app.models.moderation import ModerationAuditLog
from app.models.user import User


async def _make_entity(session_factory, name="Acme Org", entity_type="organization"):
    async with session_factory() as session:
        entity = Entity(entity_type=entity_type, name=name, verification_status="verified")
        session.add(entity)
        await session.commit()
        await session.refresh(entity)
        return entity.id


async def _get_user(session_factory, user_id):
    async with session_factory() as session:
        return (await session.execute(select(User).where(User.id == user_id))).scalar_one()


async def _make_eligible(session_factory, user_id):
    """Satisfy self_publish_eligibility: 3 community-reviewed items (the
    user is created is_verified=True + agreed in the tests below)."""
    async with session_factory() as session:
        for i in range(3):
            session.add(
                Content(
                    title=f"Approved piece {i}",
                    content_type=ContentType.article,
                    source=ContentSource.user,
                    created_by=user_id,
                    verification_status=VerificationStatus.community_reviewed,
                )
            )
        await session.commit()


# --- Password reset ---


async def test_same_entity_super_admin_can_reset_member_password(client, make_user, session_factory):
    entity_id = await _make_entity(session_factory)
    member, _ = await make_user(
        email="member-pw@example.com", role="user",
        entity_kind="organization", entity_id=entity_id, rank=2,
    )
    _, super_headers = await make_user(
        email="orgsuper-pw@example.com", role="admin",
        entity_kind="organization", entity_id=entity_id, rank=5,
    )

    resp = await client.post(
        f"/api/entities/{entity_id}/members/{member.id}/reset-password",
        headers=super_headers,
        json={"password": "newsecret1"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json() == {"ok": True}

    refreshed = await _get_user(session_factory, member.id)
    assert verify_password("newsecret1", refreshed.password_hash)

    # Audit-logged
    async with session_factory() as session:
        log = (
            await session.execute(
                select(ModerationAuditLog).where(
                    ModerationAuditLog.action == "reset_member_password",
                    ModerationAuditLog.target_id == member.id,
                )
            )
        ).scalars().first()
        assert log is not None
        assert log.meta == {"entity_id": entity_id}


async def test_same_entity_non_super_admin_cannot_reset_password(client, make_user, session_factory):
    """rank < 5 in the SAME entity — even a rank-4 admin — is 403."""
    entity_id = await _make_entity(session_factory)
    member, _ = await make_user(
        email="member2-pw@example.com", role="user",
        entity_kind="organization", entity_id=entity_id, rank=2,
    )
    _, admin_headers = await make_user(
        email="orgadmin-pw@example.com", role="admin",
        entity_kind="organization", entity_id=entity_id, rank=4,
    )

    resp = await client.post(
        f"/api/entities/{entity_id}/members/{member.id}/reset-password",
        headers=admin_headers,
        json={"password": "newsecret1"},
    )
    assert resp.status_code == 403


async def test_different_entity_super_admin_cannot_reset_password(client, make_user, session_factory):
    entity_id = await _make_entity(session_factory, name="Org A")
    other_entity_id = await _make_entity(session_factory, name="Org B")
    member, _ = await make_user(
        email="member3-pw@example.com", role="user",
        entity_kind="organization", entity_id=entity_id, rank=2,
    )
    _, other_super_headers = await make_user(
        email="othersuper-pw@example.com", role="admin",
        entity_kind="organization", entity_id=other_entity_id, rank=5,
    )

    resp = await client.post(
        f"/api/entities/{entity_id}/members/{member.id}/reset-password",
        headers=other_super_headers,
        json={"password": "newsecret1"},
    )
    assert resp.status_code == 403


async def test_platform_super_admin_can_reset_member_password(client, make_user, session_factory):
    entity_id = await _make_entity(session_factory)
    member, _ = await make_user(
        email="member4-pw@example.com", role="user",
        entity_kind="organization", entity_id=entity_id, rank=2,
    )
    _, platform_headers = await make_user(email="platsuper-pw@example.com", role="super_admin")

    resp = await client.post(
        f"/api/entities/{entity_id}/members/{member.id}/reset-password",
        headers=platform_headers,
        json={"password": "newsecret1"},
    )
    assert resp.status_code == 200, resp.text


async def test_reset_password_target_not_in_entity_404(client, make_user, session_factory):
    entity_id = await _make_entity(session_factory)
    outsider, _ = await make_user(email="outsider-pw@example.com", role="user")
    _, super_headers = await make_user(
        email="orgsuper2-pw@example.com", role="admin",
        entity_kind="organization", entity_id=entity_id, rank=5,
    )

    resp = await client.post(
        f"/api/entities/{entity_id}/members/{outsider.id}/reset-password",
        headers=super_headers,
        json={"password": "newsecret1"},
    )
    assert resp.status_code == 404

    # Nonexistent user id: also 404
    resp = await client.post(
        f"/api/entities/{entity_id}/members/999999/reset-password",
        headers=super_headers,
        json={"password": "newsecret1"},
    )
    assert resp.status_code == 404


async def test_reset_password_too_short_rejected(client, make_user, session_factory):
    entity_id = await _make_entity(session_factory)
    member, _ = await make_user(
        email="member5-pw@example.com", role="user",
        entity_kind="organization", entity_id=entity_id, rank=2,
    )
    _, super_headers = await make_user(
        email="orgsuper3-pw@example.com", role="admin",
        entity_kind="organization", entity_id=entity_id, rank=5,
    )

    resp = await client.post(
        f"/api/entities/{entity_id}/members/{member.id}/reset-password",
        headers=super_headers,
        json={"password": "short"},
    )
    assert resp.status_code == 422


# --- Trusted-publisher grant/revoke ---


async def test_same_entity_super_admin_can_grant_and_revoke_self_publish(client, make_user, session_factory):
    entity_id = await _make_entity(session_factory)
    member, _ = await make_user(
        email="member-sp@example.com", role="user",
        entity_kind="organization", entity_id=entity_id, rank=2,
        is_verified=True, self_publish_agreed_at=datetime.now(UTC),
    )
    await _make_eligible(session_factory, member.id)
    _, super_headers = await make_user(
        email="orgsuper-sp@example.com", role="admin",
        entity_kind="organization", entity_id=entity_id, rank=5,
    )

    resp = await client.patch(
        f"/api/entities/{entity_id}/members/{member.id}/self-publish",
        headers=super_headers,
        json={"grant": True},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["can_self_publish"] is True
    assert (await _get_user(session_factory, member.id)).can_self_publish is True

    resp = await client.patch(
        f"/api/entities/{entity_id}/members/{member.id}/self-publish",
        headers=super_headers,
        json={"grant": False},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["can_self_publish"] is False
    assert (await _get_user(session_factory, member.id)).can_self_publish is False


async def test_entity_super_admin_grant_requires_eligibility(client, make_user, session_factory):
    """Unlike the platform super admin, an entity super admin may NOT
    override the eligibility check (mirrors the platform endpoint, where
    only super_admin overrides)."""
    entity_id = await _make_entity(session_factory)
    member, _ = await make_user(
        email="member2-sp@example.com", role="user",
        entity_kind="organization", entity_id=entity_id, rank=2,
    )
    _, super_headers = await make_user(
        email="orgsuper2-sp@example.com", role="admin",
        entity_kind="organization", entity_id=entity_id, rank=5,
    )

    resp = await client.patch(
        f"/api/entities/{entity_id}/members/{member.id}/self-publish",
        headers=super_headers,
        json={"grant": True},
    )
    assert resp.status_code == 400


async def test_same_entity_non_super_admin_cannot_grant_self_publish(client, make_user, session_factory):
    entity_id = await _make_entity(session_factory)
    member, _ = await make_user(
        email="member3-sp@example.com", role="user",
        entity_kind="organization", entity_id=entity_id, rank=2,
    )
    _, admin_headers = await make_user(
        email="orgadmin-sp@example.com", role="admin",
        entity_kind="organization", entity_id=entity_id, rank=4,
    )

    resp = await client.patch(
        f"/api/entities/{entity_id}/members/{member.id}/self-publish",
        headers=admin_headers,
        json={"grant": True},
    )
    assert resp.status_code == 403


async def test_different_entity_super_admin_cannot_grant_self_publish(client, make_user, session_factory):
    entity_id = await _make_entity(session_factory, name="Org C")
    other_entity_id = await _make_entity(session_factory, name="Org D")
    member, _ = await make_user(
        email="member4-sp@example.com", role="user",
        entity_kind="organization", entity_id=entity_id, rank=2,
    )
    _, other_super_headers = await make_user(
        email="othersuper-sp@example.com", role="admin",
        entity_kind="organization", entity_id=other_entity_id, rank=5,
    )

    resp = await client.patch(
        f"/api/entities/{entity_id}/members/{member.id}/self-publish",
        headers=other_super_headers,
        json={"grant": True},
    )
    assert resp.status_code == 403


async def test_platform_super_admin_can_grant_self_publish_with_override(client, make_user, session_factory):
    """Platform super admin bypasses eligibility/agreement, same as the
    platform-wide endpoint's super_admin override."""
    entity_id = await _make_entity(session_factory)
    member, _ = await make_user(
        email="member5-sp@example.com", role="user",
        entity_kind="organization", entity_id=entity_id, rank=2,
    )
    _, platform_headers = await make_user(email="platsuper-sp@example.com", role="super_admin")

    resp = await client.patch(
        f"/api/entities/{entity_id}/members/{member.id}/self-publish",
        headers=platform_headers,
        json={"grant": True},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json()["can_self_publish"] is True


async def test_self_publish_target_not_in_entity_404(client, make_user, session_factory):
    entity_id = await _make_entity(session_factory)
    outsider, _ = await make_user(email="outsider-sp@example.com", role="user")
    _, super_headers = await make_user(
        email="orgsuper3-sp@example.com", role="admin",
        entity_kind="organization", entity_id=entity_id, rank=5,
    )

    resp = await client.patch(
        f"/api/entities/{entity_id}/members/{outsider.id}/self-publish",
        headers=super_headers,
        json={"grant": True},
    )
    assert resp.status_code == 404


async def test_members_list_includes_can_self_publish(client, make_user, session_factory):
    entity_id = await _make_entity(session_factory)
    member, _ = await make_user(
        email="member6-sp@example.com", role="user",
        entity_kind="organization", entity_id=entity_id, rank=2,
        can_self_publish=True,
    )
    _, super_headers = await make_user(
        email="orgsuper4-sp@example.com", role="admin",
        entity_kind="organization", entity_id=entity_id, rank=5,
    )

    resp = await client.get(f"/api/entities/{entity_id}/members", headers=super_headers)
    assert resp.status_code == 200, resp.text
    by_id = {m["id"]: m for m in resp.json()}
    assert by_id[member.id]["can_self_publish"] is True
    assert by_id[member.id]["rank"] == 2
