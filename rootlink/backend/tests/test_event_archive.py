"""Platform-only event soft-archive (docs/roles-permissions/ROLES_PERMISSIONS.md
§8 "Archive event") — reserved for the PLATFORM super admin, deliberately NOT the
event's owner or any entity's own super admin (blast-radius reasoning, same as
group.archive: attendees can come from multiple entities)."""

from datetime import UTC, datetime, timedelta

import pytest_asyncio
from sqlalchemy import select

from app.models.event import Event, EventRSVP
from app.models.moderation import ModerationAuditLog
from app.models.notification import Notification


@pytest_asyncio.fixture
async def an_event(make_user, session_factory):
    """An event created by its owner, with one RSVP'd attendee (direct DB inserts —
    no live register/login calls, see docs/LESSONS.md #27)."""
    owner, owner_headers = await make_user(email="eowner@example.com")
    attendee, _ = await make_user(email="attendee@example.com")
    async with session_factory() as s:
        ev = Event(
            title="Community seed swap",
            date=datetime.now(UTC) + timedelta(days=7),
            created_by=owner.id,
        )
        s.add(ev)
        await s.commit()
        await s.refresh(ev)
        s.add(EventRSVP(event_id=ev.id, user_id=attendee.id))
        await s.commit()
        event_id = ev.id
    return owner, owner_headers, attendee, event_id


# ── Auth gate: platform super admin only ──

async def test_platform_super_admin_can_archive(client, an_event, make_user, session_factory):
    _, _, attendee, event_id = an_event
    _, su = await make_user(email="platform-super@example.com", role="super_admin")

    r = await client.post(f"/api/admin/events/{event_id}/archive", headers=su)
    assert r.status_code == 200
    body = r.json()
    assert body["status"] == "archived"
    assert body["notified"] == 1

    async with session_factory() as s:
        ev = await s.get(Event, event_id)
        assert ev is not None  # soft — not deleted
        assert ev.status == "archived"
        assert ev.archived_at is not None
        # attendee got notified
        notifs = (await s.execute(select(Notification).where(Notification.user_id == attendee.id))).scalars().all()
        assert any("archiv" in n.message.lower() or "retired" in n.message.lower() for n in notifs)
        # audit-logged
        logs = (await s.execute(select(ModerationAuditLog).where(
            ModerationAuditLog.action == "archive_event",
            ModerationAuditLog.target_id == event_id,
        ))).scalars().all()
        assert len(logs) == 1

    # idempotent second call
    r2 = await client.post(f"/api/admin/events/{event_id}/archive", headers=su)
    assert r2.status_code == 200
    assert r2.json()["status"] == "archived"


async def test_owner_cannot_archive(client, an_event):
    _, owner_headers, _, event_id = an_event
    r = await client.post(f"/api/admin/events/{event_id}/archive", headers=owner_headers)
    assert r.status_code == 403


async def test_moderator_cannot_archive(client, an_event, make_user):
    _, _, _, event_id = an_event
    _, mod = await make_user(email="mod@example.com", role="moderator")
    r = await client.post(f"/api/admin/events/{event_id}/archive", headers=mod)
    assert r.status_code == 403


async def test_org_entity_super_admin_cannot_archive(client, an_event, make_user):
    """An organization's OWN super admin (rank 5, entity_kind='organization') is
    NOT the platform super admin — event.archive is entity_scope='platform'."""
    _, _, _, event_id = an_event
    _, org_su = await make_user(
        email="org-super@example.com",
        entity_kind="organization", entity_id=42, rank=5,
    )
    r = await client.post(f"/api/admin/events/{event_id}/archive", headers=org_su)
    assert r.status_code == 403


# ── Public surfaces exclude archived ──

async def test_archived_event_hidden_from_public_list_and_detail(client, an_event, make_user):
    _, _, _, event_id = an_event
    # visible before archiving
    listed = await client.get("/api/events/")
    assert any(e["id"] == event_id for e in listed.json())

    _, su = await make_user(email="platform-super2@example.com", role="super_admin")
    r = await client.post(f"/api/admin/events/{event_id}/archive", headers=su)
    assert r.status_code == 200

    # excluded from the public list
    listed = await client.get("/api/events/")
    assert all(e["id"] != event_id for e in listed.json())
    # detail 404s for anonymous (matches archived-group precedent)
    detail = await client.get(f"/api/events/{event_id}")
    assert detail.status_code == 404


# ── Admin listing includes archived ──

async def test_admin_list_includes_archived(client, an_event, make_user):
    _, _, _, event_id = an_event
    _, su = await make_user(email="platform-super3@example.com", role="super_admin")
    await client.post(f"/api/admin/events/{event_id}/archive", headers=su)

    _, mod = await make_user(email="mod2@example.com", role="moderator")
    r = await client.get("/api/admin/events", headers=mod)
    assert r.status_code == 200
    rows = r.json()
    row = next((e for e in rows if e["id"] == event_id), None)
    assert row is not None
    assert row["status"] == "archived"
    assert row["archived_at"] is not None
    assert row["creator_name"] == "eowner"

    # q search filters by title
    r2 = await client.get("/api/admin/events?q=seed swap", headers=mod)
    assert any(e["id"] == event_id for e in r2.json())
    r3 = await client.get("/api/admin/events?q=zzz-no-match", headers=mod)
    assert all(e["id"] != event_id for e in r3.json())
