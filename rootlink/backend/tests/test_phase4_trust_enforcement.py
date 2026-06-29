"""Phase 4 — trusted-author promotion (§3) and enforcement ladder (§4.4)."""

from datetime import UTC, datetime, timedelta

import pytest_asyncio

from app.models.content import (
    Content,
    ContentSource,
    ContentStatus,
    ContentType,
    VerificationStatus,
)


@pytest_asyncio.fixture
async def approved_author(make_user, session_factory):
    """A verified user with 3 community-reviewed items → eligible to self-publish."""
    user, headers = await make_user(email="author@example.com", is_verified=True)
    async with session_factory() as s:
        for i in range(3):
            s.add(Content(
                title=f"approved {i}", content_type=ContentType.article, source=ContentSource.user,
                status=ContentStatus.published, verification_status=VerificationStatus.community_reviewed,
                created_by=user.id,
            ))
        await s.commit()
    return user, headers


# ── Promotion flow ──

async def test_eligibility_reports_true(client, approved_author):
    _, headers = approved_author
    r = await client.get("/api/me/self-publish/eligibility", headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert body["eligible"] is True
    assert body["approved_count"] == 3


async def test_ineligible_user_cannot_accept(client, make_user):
    _, headers = await make_user(email="rookie@example.com", is_verified=False)
    r = await client.post("/api/me/self-publish/accept", headers=headers)
    assert r.status_code == 400


async def test_accept_then_admin_grant(client, approved_author, make_user, session_factory):
    user, headers = approved_author
    _, admin_h = await make_user(email="adm@example.com", role="admin")

    # admin grant fails before the user accepts
    pre = await client.patch(f"/api/admin/users/{user.id}/self-publish", headers=admin_h, json={"grant": True})
    assert pre.status_code == 400

    # user accepts the responsibility agreement
    acc = await client.post("/api/me/self-publish/accept", headers=headers)
    assert acc.status_code == 200

    # admin can now grant
    g = await client.patch(f"/api/admin/users/{user.id}/self-publish", headers=admin_h, json={"grant": True})
    assert g.status_code == 200
    assert g.json()["can_self_publish"] is True


async def test_super_admin_can_override_eligibility(client, make_user):
    target, _ = await make_user(email="nobody@example.com")
    _, su = await make_user(email="su4@example.com", role="super_admin")
    r = await client.patch(f"/api/admin/users/{target.id}/self-publish", headers=su, json={"grant": True})
    assert r.status_code == 200
    assert r.json()["can_self_publish"] is True


# ── Suspension ──

async def test_suspend_blocks_authoring_but_allows_read(client, make_user):
    target, target_h = await make_user(email="susp4@example.com")
    _, admin_h = await make_user(email="adm2@example.com", role="admin")
    until = (datetime.now(UTC) + timedelta(days=1)).isoformat()
    r = await client.post(f"/api/admin/users/{target.id}/suspend", headers=admin_h,
                          json={"until": until, "reason": "cooling off"})
    assert r.status_code == 200
    # read OK
    assert (await client.get("/api/auth/me", headers=target_h)).status_code == 200
    # authoring blocked
    w = await client.post("/api/articles/", headers=target_h, json={"title": "x", "body": {"blocks": []}})
    assert w.status_code == 403


async def test_lift_suspension_restores_authoring(client, make_user):
    target, target_h = await make_user(email="susp5@example.com")
    _, admin_h = await make_user(email="adm3@example.com", role="admin")
    until = (datetime.now(UTC) + timedelta(days=1)).isoformat()
    await client.post(f"/api/admin/users/{target.id}/suspend", headers=admin_h, json={"until": until})
    await client.post(f"/api/admin/users/{target.id}/lift-suspension", headers=admin_h)
    w = await client.post("/api/articles/", headers=target_h, json={"title": "ok", "body": {"blocks": []}})
    assert w.status_code == 201


# ── Ban ──

async def test_ban_blocks_and_unpublishes(client, make_user, session_factory):
    target, target_h = await make_user(email="bad@example.com", can_self_publish=True)
    _, admin_h = await make_user(email="adm4@example.com", role="admin")
    # target publishes something live
    aid = (await client.post("/api/articles/", headers=target_h, json={"title": "live", "body": {"blocks": []}})).json()["id"]
    await client.post(f"/api/articles/{aid}/publish", headers=target_h)

    r = await client.post(f"/api/admin/users/{target.id}/ban", headers=admin_h, json={"reason": "abuse"})
    assert r.status_code == 200
    # content unpublished
    async with session_factory() as s:
        art = await s.get(Content, aid)
        assert art.status == ContentStatus.archived
    # banned token rejected, public can't see content
    assert (await client.get("/api/auth/me", headers=target_h)).status_code == 403
    assert (await client.get(f"/api/content/{aid}")).status_code == 404


async def test_unban_restores_access(client, make_user):
    target, target_h = await make_user(email="redeemed@example.com")
    _, admin_h = await make_user(email="adm5@example.com", role="admin")
    await client.post(f"/api/admin/users/{target.id}/ban", headers=admin_h, json={"reason": "x"})
    await client.post(f"/api/admin/users/{target.id}/unban", headers=admin_h)
    assert (await client.get("/api/auth/me", headers=target_h)).status_code == 200


async def test_cannot_ban_self(client, make_user):
    _, admin_h = await make_user(email="adm6@example.com", role="admin")
    me = (await client.get("/api/auth/me", headers=admin_h)).json()
    r = await client.post(f"/api/admin/users/{me['id']}/ban", headers=admin_h, json={"reason": "oops"})
    assert r.status_code == 400
