"""Entity-scoped notification broadcast (docs/roles-permissions/
ROLES_PERMISSIONS.md §7 "notification.send_to_entity_members"):

- POST /api/entities/{entity_id}/notify-members

Authorization (registry floor: admin(4), entity-scoped): the SAME entity's
admin or super admin, or the platform (via `can()`'s platform-precedence
branch). A same-entity member below rank 4, or a different entity's admin,
is always 403. Every member of the entity EXCEPT the sender gets a
Notification row — same mechanics as the platform-wide broadcast
(app/api/admin.py broadcast_notification).
"""

from sqlalchemy import select

from app.models.entity import Entity
from app.models.moderation import ModerationAuditLog
from app.models.notification import Notification


async def _make_entity(session_factory, name="Acme Org", entity_type="organization"):
    async with session_factory() as session:
        entity = Entity(entity_type=entity_type, name=name, verification_status="verified")
        session.add(entity)
        await session.commit()
        await session.refresh(entity)
        return entity.id


async def _notifications_for(session_factory, user_id):
    async with session_factory() as session:
        return (
            await session.execute(select(Notification).where(Notification.user_id == user_id))
        ).scalars().all()


async def test_entity_admin_can_notify_members(client, make_user, session_factory):
    """Rank-4 admin (the registry floor) sends; every member EXCEPT the
    sender gets a Notification row; count matches; audit-logged."""
    entity_id = await _make_entity(session_factory)
    member_a, _ = await make_user(
        email="member-a-nm@example.com", role="user",
        entity_kind="organization", entity_id=entity_id, rank=2,
    )
    member_b, _ = await make_user(
        email="member-b-nm@example.com", role="user",
        entity_kind="organization", entity_id=entity_id, rank=3,
    )
    admin, admin_headers = await make_user(
        email="orgadmin-nm@example.com", role="admin",
        entity_kind="organization", entity_id=entity_id, rank=4,
    )

    resp = await client.post(
        f"/api/entities/{entity_id}/notify-members",
        headers=admin_headers,
        json={"message": "The AGM has been rescheduled"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json() == {"sent_to": 2}

    for member in (member_a, member_b):
        rows = await _notifications_for(session_factory, member.id)
        assert len(rows) == 1
        assert rows[0].message == "The AGM has been rescheduled"
        assert rows[0].actor_id == admin.id
        assert rows[0].type == "system"
        assert rows[0].link == f"/entity/{entity_id}"

    # Sender does NOT get a notification
    assert await _notifications_for(session_factory, admin.id) == []

    # Audit-logged
    async with session_factory() as session:
        log = (
            await session.execute(
                select(ModerationAuditLog).where(
                    ModerationAuditLog.action == "notify_entity_members",
                    ModerationAuditLog.target_id == entity_id,
                )
            )
        ).scalars().first()
        assert log is not None
        assert log.actor_id == admin.id
        assert log.meta == {"entity_id": entity_id, "sent_to": 2}


async def test_entity_super_admin_can_notify_members(client, make_user, session_factory):
    entity_id = await _make_entity(session_factory)
    member, _ = await make_user(
        email="member-sa-nm@example.com", role="user",
        entity_kind="organization", entity_id=entity_id, rank=2,
    )
    _, super_headers = await make_user(
        email="orgsuper-nm@example.com", role="admin",
        entity_kind="organization", entity_id=entity_id, rank=5,
    )

    resp = await client.post(
        f"/api/entities/{entity_id}/notify-members",
        headers=super_headers,
        json={"message": "Hello team"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json() == {"sent_to": 1}
    assert len(await _notifications_for(session_factory, member.id)) == 1


async def test_below_floor_member_cannot_notify(client, make_user, session_factory):
    """rank < 4 in the SAME entity — even a rank-3 moderator — is 403."""
    entity_id = await _make_entity(session_factory)
    member, _ = await make_user(
        email="member-bf-nm@example.com", role="user",
        entity_kind="organization", entity_id=entity_id, rank=2,
    )
    _, mod_headers = await make_user(
        email="orgmod-nm@example.com", role="user",
        entity_kind="organization", entity_id=entity_id, rank=3,
    )

    resp = await client.post(
        f"/api/entities/{entity_id}/notify-members",
        headers=mod_headers,
        json={"message": "Should not send"},
    )
    assert resp.status_code == 403
    assert await _notifications_for(session_factory, member.id) == []


async def test_different_entity_admin_cannot_notify(client, make_user, session_factory):
    entity_id = await _make_entity(session_factory, name="Org A")
    other_entity_id = await _make_entity(session_factory, name="Org B")
    member, _ = await make_user(
        email="member-de-nm@example.com", role="user",
        entity_kind="organization", entity_id=entity_id, rank=2,
    )
    _, other_admin_headers = await make_user(
        email="otheradmin-nm@example.com", role="admin",
        entity_kind="organization", entity_id=other_entity_id, rank=4,
    )

    resp = await client.post(
        f"/api/entities/{entity_id}/notify-members",
        headers=other_admin_headers,
        json={"message": "Cross-entity attempt"},
    )
    assert resp.status_code == 403
    assert await _notifications_for(session_factory, member.id) == []


async def test_platform_super_admin_can_notify(client, make_user, session_factory):
    entity_id = await _make_entity(session_factory)
    member, _ = await make_user(
        email="member-ps-nm@example.com", role="user",
        entity_kind="organization", entity_id=entity_id, rank=2,
    )
    _, platform_headers = await make_user(email="platsuper-nm@example.com", role="super_admin")

    resp = await client.post(
        f"/api/entities/{entity_id}/notify-members",
        headers=platform_headers,
        json={"message": "Platform notice"},
    )
    assert resp.status_code == 200, resp.text
    assert resp.json() == {"sent_to": 1}
    assert len(await _notifications_for(session_factory, member.id)) == 1


async def test_empty_message_rejected(client, make_user, session_factory):
    entity_id = await _make_entity(session_factory)
    _, admin_headers = await make_user(
        email="orgadmin-em-nm@example.com", role="admin",
        entity_kind="organization", entity_id=entity_id, rank=4,
    )

    resp = await client.post(
        f"/api/entities/{entity_id}/notify-members",
        headers=admin_headers,
        json={"message": ""},
    )
    assert resp.status_code == 422

    # Whitespace-only is also rejected
    resp = await client.post(
        f"/api/entities/{entity_id}/notify-members",
        headers=admin_headers,
        json={"message": "   "},
    )
    assert resp.status_code == 422

    # Over the 500-char Notification.message column cap
    resp = await client.post(
        f"/api/entities/{entity_id}/notify-members",
        headers=admin_headers,
        json={"message": "x" * 501},
    )
    assert resp.status_code == 422


async def test_nonexistent_entity_404(client, make_user):
    _, platform_headers = await make_user(email="platsuper2-nm@example.com", role="super_admin")
    resp = await client.post(
        "/api/entities/999999/notify-members",
        headers=platform_headers,
        json={"message": "Hello"},
    )
    assert resp.status_code == 404
