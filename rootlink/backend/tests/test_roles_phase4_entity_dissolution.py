"""Phase 4 — entity dissolution (docs/roles-permissions/ROLES_PERMISSIONS.md §3 "Entity dissolution").
Backend-only endpoints, app/api/entities.py.
"""

from datetime import UTC, datetime, timedelta

from app.models.content import Content, ContentSource, ContentStatus, ContentType
from app.models.entity import Entity
from app.models.user import User


async def _make_org(session_factory, super_admin_email="orgsuper@example.com"):
    from app.core.security import hash_password
    async with session_factory() as s:
        entity = Entity(entity_type="organization", name="Acme Org", verification_status="verified")
        s.add(entity)
        await s.flush()
        super_admin = User(
            email=super_admin_email, name="orgsuper", password_hash=hash_password("secret123"),
            entity_kind="organization", entity_id=entity.id, rank=5,
        )
        member = User(
            email="orgmember@example.com", name="orgmember", password_hash=hash_password("secret123"),
            entity_kind="organization", entity_id=entity.id, rank=1,
        )
        s.add_all([super_admin, member])
        await s.commit()
        await s.refresh(entity)
        await s.refresh(super_admin)
        await s.refresh(member)
        return entity, super_admin, member


def _headers_for(user):
    from app.core.security import create_access_token
    token = create_access_token({"sub": str(user.id)})
    return {"Authorization": f"Bearer {token}"}


async def test_org_super_admin_can_only_request_not_execute(client, session_factory):
    entity, super_admin, member = await _make_org(session_factory)
    headers = _headers_for(super_admin)

    r = await client.post(f"/api/entities/{entity.id}/dissolve", headers=headers, json={"reason": "closing shop"})
    assert r.status_code == 200
    body = r.json()
    assert body["dissolved_at"] is None
    assert body["dissolution_requested_at"] is not None


async def test_platform_super_admin_executes_immediately_and_converts_members(client, make_user, session_factory):
    entity, org_super, member = await _make_org(session_factory)
    platform_admin, platform_headers = await make_user(
        email="platsuper@example.com", entity_kind="platform", rank=5,
    )

    async with session_factory() as s:
        content = Content(
            title="Org piece", content_type=ContentType.article, source=ContentSource.user,
            status=ContentStatus.published, created_by=member.id,
        )
        s.add(content)
        await s.commit()
        cid = content.id

    r = await client.post(f"/api/entities/{entity.id}/dissolve", headers=platform_headers, json={"reason": "closing"})
    assert r.status_code == 200
    body = r.json()
    assert body["dissolved_at"] is not None
    assert body["dissolution_grace_expires_at"] is not None

    async with session_factory() as s:
        m = await s.get(User, member.id)
        assert m.entity_kind == "individual"
        assert m.entity_id is None
        assert m.rank == 1

        s_admin = await s.get(User, org_super.id)
        assert s_admin.entity_kind == "individual"
        assert s_admin.rank == 1

        c = await s.get(Content, cid)
        assert c.status == ContentStatus.archived


async def test_non_super_admin_member_cannot_dissolve(client, session_factory):
    entity, org_super, member = await _make_org(session_factory)
    headers = _headers_for(member)
    r = await client.post(f"/api/entities/{entity.id}/dissolve", headers=headers, json={})
    assert r.status_code == 403


async def test_reverse_dissolution_within_grace_window_restores_members_and_content(client, make_user, session_factory):
    entity, org_super, member = await _make_org(session_factory)
    platform_admin, platform_headers = await make_user(
        email="platsuper2@example.com", entity_kind="platform", rank=5,
    )
    async with session_factory() as s:
        content = Content(
            title="Org piece 2", content_type=ContentType.article, source=ContentSource.user,
            status=ContentStatus.published, created_by=member.id,
        )
        s.add(content)
        await s.commit()
        cid = content.id

    await client.post(f"/api/entities/{entity.id}/dissolve", headers=platform_headers, json={})

    r = await client.post(f"/api/entities/{entity.id}/reverse-dissolution", headers=platform_headers, json={})
    assert r.status_code == 200
    body = r.json()
    assert body["dissolved_at"] is None

    async with session_factory() as s:
        m = await s.get(User, member.id)
        assert m.entity_kind == "organization"
        assert m.entity_id == entity.id
        assert m.rank == 1  # original member rank restored

        c = await s.get(Content, cid)
        assert c.status == ContentStatus.published


async def test_reverse_dissolution_fails_after_grace_window_expires(client, make_user, session_factory):
    entity, org_super, member = await _make_org(session_factory, super_admin_email="expired@example.com")
    platform_admin, platform_headers = await make_user(
        email="platsuper3@example.com", entity_kind="platform", rank=5,
    )
    await client.post(f"/api/entities/{entity.id}/dissolve", headers=platform_headers, json={})

    # Force the grace window into the past.
    async with session_factory() as s:
        e = await s.get(Entity, entity.id)
        e.dissolution_grace_expires_at = datetime.now(UTC) - timedelta(days=1)
        await s.commit()

    r = await client.post(f"/api/entities/{entity.id}/reverse-dissolution", headers=platform_headers, json={})
    assert r.status_code == 400


async def test_platform_super_admin_can_approve_a_pending_request(client, make_user, session_factory):
    entity, org_super, member = await _make_org(session_factory, super_admin_email="pendingorg@example.com")
    org_headers = _headers_for(org_super)
    platform_admin, platform_headers = await make_user(
        email="platsuper4@example.com", entity_kind="platform", rank=5,
    )

    await client.post(f"/api/entities/{entity.id}/dissolve", headers=org_headers, json={"reason": "closing"})
    r = await client.post(f"/api/entities/{entity.id}/dissolve/approve", headers=platform_headers, json={})
    assert r.status_code == 200
    assert r.json()["dissolved_at"] is not None


async def test_platform_super_admin_can_reject_a_pending_request(client, make_user, session_factory):
    entity, org_super, member = await _make_org(session_factory, super_admin_email="rejectorg@example.com")
    org_headers = _headers_for(org_super)
    platform_admin, platform_headers = await make_user(
        email="platsuper5@example.com", entity_kind="platform", rank=5,
    )

    await client.post(f"/api/entities/{entity.id}/dissolve", headers=org_headers, json={"reason": "closing"})
    r = await client.post(f"/api/entities/{entity.id}/dissolve/reject", headers=platform_headers, json={"reason": "not eligible"})
    assert r.status_code == 200
    assert r.json()["dissolution_requested_at"] is None
    assert r.json()["dissolved_at"] is None


async def test_entity_ban_triggers_and_unban_reverses_within_grace_window(client, make_user, session_factory):
    entity, org_super, member = await _make_org(session_factory, super_admin_email="banorg@example.com")
    platform_admin, platform_headers = await make_user(
        email="platsuper6@example.com", entity_kind="platform", rank=5,
    )
    r = await client.post(f"/api/entities/{entity.id}/ban", headers=platform_headers, json={"reason": "policy violation"})
    assert r.status_code == 200
    assert r.json()["banned_at"] is not None

    # Ban does NOT convert members (unlike dissolution) — scoped minimally.
    async with session_factory() as s:
        m = await s.get(User, member.id)
        assert m.entity_kind == "organization"

    r = await client.post(f"/api/entities/{entity.id}/unban", headers=platform_headers, json={})
    assert r.status_code == 200
    assert r.json()["banned_at"] is None
