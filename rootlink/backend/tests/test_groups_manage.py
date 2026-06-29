"""Group edit (issue 5) + super-admin soft-archive (issue 6)."""

import pytest_asyncio

from app.models.group import Group, GroupStatus
from app.models.notification import Notification


@pytest_asyncio.fixture
async def a_group(make_user, session_factory, client):
    """A group created by its owner (owner becomes group admin)."""
    owner, headers = await make_user(email="gowner@example.com")
    r = await client.post("/api/groups/", headers=headers, json={
        "name": "Tomatoes", "slug": "tomatoes", "description": "x", "family": "gardening",
    })
    assert r.status_code in (200, 201)
    return owner, headers, r.json()


# ── Create gets a default cover ──

async def test_group_create_default_cover(a_group):
    _, _, g = a_group
    assert g["image_url"].endswith("/gardening.svg")
    assert g["status"] == "active"


# ── Edit (issue 5) ──

async def test_owner_can_update_group(client, a_group):
    _, headers, g = a_group
    r = await client.patch(f"/api/groups/{g['id']}", headers=headers, json={"name": "Tomatoes & Co", "description": "y"})
    assert r.status_code == 200
    assert r.json()["name"] == "Tomatoes & Co"


async def test_non_member_cannot_update_group(client, a_group, make_user):
    _, _, g = a_group
    _, other = await make_user(email="stranger@example.com")
    r = await client.patch(f"/api/groups/{g['id']}", headers=other, json={"name": "hijack"})
    assert r.status_code == 403


async def test_platform_admin_can_update_group(client, a_group, make_user):
    _, _, g = a_group
    _, admin = await make_user(email="padmin@example.com", role="admin")
    r = await client.patch(f"/api/groups/{g['id']}", headers=admin, json={"description": "moderated"})
    assert r.status_code == 200


# ── Archive (issue 6) ──

async def test_admin_cannot_archive_only_super(client, a_group, make_user):
    _, _, g = a_group
    _, admin = await make_user(email="padmin2@example.com", role="admin")
    r = await client.post(f"/api/admin/groups/{g['id']}/archive", headers=admin)
    assert r.status_code == 403


async def test_super_admin_archive_hides_and_notifies(client, a_group, make_user, session_factory):
    owner, _, g = a_group
    _, su = await make_user(email="super2@example.com", role="super_admin")
    r = await client.post(f"/api/admin/groups/{g['id']}/archive", headers=su)
    assert r.status_code == 200
    assert r.json()["status"] == "archived"

    # hidden from public list
    listed = await client.get("/api/groups/")
    assert all(item["id"] != g["id"] for item in listed.json())

    # owner (a member) got a notification, and the group is soft-archived (not deleted)
    async with session_factory() as s:
        grp = await s.get(Group, g["id"])
        assert grp is not None and grp.status == GroupStatus.archived
        from sqlalchemy import select
        notifs = (await s.execute(select(Notification).where(Notification.user_id == owner.id))).scalars().all()
        assert any("retired" in n.message.lower() or "archiv" in n.message.lower() for n in notifs)


async def test_public_get_archived_group_404(client, a_group, make_user):
    _, _, g = a_group
    _, su = await make_user(email="super3@example.com", role="super_admin")
    await client.post(f"/api/admin/groups/{g['id']}/archive", headers=su)
    # anonymous request → hidden
    r = await client.get(f"/api/groups/{g['id']}")
    assert r.status_code == 404
