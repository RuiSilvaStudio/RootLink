"""Phase 4 — cross-entity ban cascade (docs/roles-permissions/ROLES_PERMISSIONS.md §3 "Cross-entity ban
cascade"). Covers the real footprint mechanism found in this codebase
(EventSponsor/EventVendor.contributing_entity_id, added this phase) — see
app/services/entity_cascade.py's module docstring for why GroupMember is
deliberately out of scope.
"""

from datetime import UTC, datetime

from app.core.security import create_access_token, hash_password
from app.models.entity import Entity
from app.models.event import Event, EventSponsor, EventVendor
from app.models.user import User


def _headers_for(user):
    token = create_access_token({"sub": str(user.id)})
    return {"Authorization": f"Bearer {token}"}


async def _setup(session_factory):
    async with session_factory() as s:
        host = User(email="host@example.com", name="host", password_hash=hash_password("secret123"))
        s.add(host)
        await s.flush()
        event = Event(
            title="Community Fair", description="x", date=datetime(2027, 1, 1, 10, 0, tzinfo=UTC),
            created_by=host.id,
        )
        s.add(event)
        await s.flush()
        entity = Entity(entity_type="organization", name="Sponsor Org", verification_status="verified")
        s.add(entity)
        await s.flush()
        sponsor = EventSponsor(
            event_id=event.id, name="Sponsor Org", contributing_entity_id=entity.id,
        )
        vendor = EventVendor(
            event_id=event.id, name="Vendor Org", contributing_entity_id=entity.id,
            visible_to_attendees=True,
        )
        # An unrelated, free-text (no entity) sponsor on the SAME event — must
        # never be affected by the cascade (host's own primary content, and
        # any other contributor's footprint, must stay intact).
        other_sponsor = EventSponsor(event_id=event.id, name="Local Bakery")
        s.add_all([sponsor, vendor, other_sponsor])
        await s.commit()
        await s.refresh(event)
        await s.refresh(entity)
        await s.refresh(sponsor)
        await s.refresh(vendor)
        await s.refresh(other_sponsor)
        return event, entity, sponsor, vendor, other_sponsor


async def test_entity_ban_hides_its_sponsor_and_vendor_footprint(client, make_user, session_factory):
    event, entity, sponsor, vendor, other_sponsor = await _setup(session_factory)
    platform_admin, platform_headers = await make_user(email="plat@example.com", entity_kind="platform", rank=5)

    r = await client.post(f"/api/entities/{entity.id}/ban", headers=platform_headers, json={"reason": "policy"})
    assert r.status_code == 200

    r = await client.get(f"/api/events/{event.id}/sponsors")
    names = [s["name"] for s in r.json()]
    assert "Sponsor Org" not in names
    assert "Local Bakery" in names  # host's own/unrelated content stays intact

    r = await client.get(f"/api/events/{event.id}/vendors")
    names = [v["name"] for v in r.json()]
    assert "Vendor Org" not in names


async def test_cascade_reversible_within_grace_window_on_unban(client, make_user, session_factory):
    event, entity, sponsor, vendor, other_sponsor = await _setup(session_factory)
    platform_admin, platform_headers = await make_user(email="plat2@example.com", entity_kind="platform", rank=5)

    await client.post(f"/api/entities/{entity.id}/ban", headers=platform_headers, json={})
    r = await client.get(f"/api/events/{event.id}/sponsors")
    assert "Sponsor Org" not in [s["name"] for s in r.json()]

    await client.post(f"/api/entities/{entity.id}/unban", headers=platform_headers, json={})
    r = await client.get(f"/api/events/{event.id}/sponsors")
    assert "Sponsor Org" in [s["name"] for s in r.json()]

    r = await client.get(f"/api/events/{event.id}/vendors")
    assert "Vendor Org" in [v["name"] for v in r.json()]


async def test_dissolution_also_triggers_footprint_cascade(client, make_user, session_factory):
    event, entity, sponsor, vendor, other_sponsor = await _setup(session_factory)
    platform_admin, platform_headers = await make_user(email="plat3@example.com", entity_kind="platform", rank=5)

    r = await client.post(f"/api/entities/{entity.id}/dissolve", headers=platform_headers, json={})
    assert r.status_code == 200

    r = await client.get(f"/api/events/{event.id}/sponsors")
    assert "Sponsor Org" not in [s["name"] for s in r.json()]
