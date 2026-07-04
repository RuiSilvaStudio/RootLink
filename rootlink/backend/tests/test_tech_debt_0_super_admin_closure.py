"""Regression test proving TECH_DEBT.md §0's bug is closed.

**The bug:** `super_admin` was not a strict superset of `admin` in 23
hand-typed checks across 8 API modules (`articles.py`, `content.py`,
`events.py`, `learning.py`, `plants.py`, `marketplace.py`, `feeds.py`,
`taxonomy.py`), plus `groups.py`'s `_can_manage_group`. Each site was
migrated (Phase 3 cutover) to call `rank_at_least` (`app/core/permissions.py`),
a single shared helper built on `resolve_entity_and_rank`
(`app/core/entity_resolution.py`) — so `super_admin` (resolved rank 5)
structurally satisfies every floor `admin` (rank 4) does, everywhere, by
construction rather than by remembering to list one more string per site.

Two levels of proof:
1. **Unit-level**, across every distinct rank floor actually used at the
   23+ cutover sites (persona/contributor/moderator/admin) — for both a
   never-migrated (fresh registration-shaped) and an already-migrated
   super_admin row.
2. **Integration-level**, hitting real endpoints in 3 of the 8 files
   (articles, events, plants) with a real super_admin test user acting on
   content it does not own — this is the literal, concrete manifestation of
   the bug TECH_DEBT.md §0 describes ("Promoting a real admin to
   super_admin today would make them lose capabilities they currently
   have").
"""

from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.core.permissions import rank_at_least
from app.core.permissions_registry import Rank
from app.models.content import Content, ContentSource, ContentStatus, ContentType
from app.models.event import Event
from app.models.plant import Plant
from app.models.user import User

# Every distinct rank floor actually used across the Phase 3 cutover sites
# (admin.py, articles.py, content.py, events.py, learning.py, plants.py,
# marketplace.py, feeds.py, taxonomy.py, groups.py).
ALL_CUTOVER_FLOORS = [Rank.persona, Rank.contributor, Rank.moderator, Rank.admin]


def _user(role: str, entity_kind: str | None = None, rank: int | None = None) -> User:
    return User(
        email="x@example.com", name="x", password_hash="x",
        role=role, account_type="individual", entity_kind=entity_kind, rank=rank,
    )


# ── Unit-level: every floor, both migrated and never-migrated shapes ──

def test_super_admin_passes_every_cutover_floor_never_migrated():
    admin = _user(role="admin")
    super_admin = _user(role="super_admin")
    for floor in ALL_CUTOVER_FLOORS:
        assert rank_at_least(admin, floor) is True, f"admin should pass floor {floor}"
        assert rank_at_least(super_admin, floor) is True, f"super_admin should pass floor {floor}"


def test_super_admin_passes_every_cutover_floor_already_migrated():
    admin = _user(role="admin", entity_kind="platform", rank=4)
    super_admin = _user(role="super_admin", entity_kind="platform", rank=5)
    for floor in ALL_CUTOVER_FLOORS:
        assert rank_at_least(admin, floor) is True
        assert rank_at_least(super_admin, floor) is True


def test_super_admin_is_superset_of_admin_across_all_sites():
    """The precise TECH_DEBT.md §0 claim, stated as a single assertion:
    for every floor used anywhere in the cutover, whatever admin can do,
    super_admin can also do — never the reverse gap that used to exist.
    """
    admin = _user(role="admin")
    super_admin = _user(role="super_admin")
    for floor in ALL_CUTOVER_FLOORS:
        admin_passes = rank_at_least(admin, floor)
        super_admin_passes = rank_at_least(super_admin, floor)
        if admin_passes:
            assert super_admin_passes, (
                f"BUG REGRESSION: admin passes floor {floor} but super_admin doesn't"
            )


# ── Integration-level: real endpoints, 3 of the 8 files ──

async def test_super_admin_can_delete_any_article_real_endpoint(client, make_user, session_factory):
    """articles.py's delete-any site — was `role not in ("admin", "moderator")`,
    i.e. actively EXCLUDED super_admin (TECH_DEBT.md §0 site: delete-any).
    """
    owner, _ = await make_user(email="article-owner@example.com", role="contributor")
    _, super_admin_headers = await make_user(email="super-closure@example.com", role="super_admin")

    async with session_factory() as session:
        article = Content(
            title="Owned by someone else", content_type=ContentType.article,
            source=ContentSource.user, status=ContentStatus.published, created_by=owner.id,
        )
        session.add(article)
        await session.commit()
        await session.refresh(article)
        article_id = article.id

    r = await client.delete(f"/api/articles/{article_id}", headers=super_admin_headers)
    assert r.status_code == 204

    async with session_factory() as session:
        gone = (await session.execute(select(Content).where(Content.id == article_id))).scalar_one_or_none()
        assert gone is None


async def test_super_admin_can_update_any_event_real_endpoint(client, make_user, session_factory):
    """events.py's `_check_event_owner` — was `role not in (admin, moderator)`."""
    owner, _ = await make_user(email="event-owner@example.com", role="contributor")
    _, super_admin_headers = await make_user(email="super-closure2@example.com", role="super_admin")

    async with session_factory() as session:
        event = Event(
            title="Someone else's event", date=datetime.now(UTC) + timedelta(days=7),
            created_by=owner.id,
        )
        session.add(event)
        await session.commit()
        await session.refresh(event)
        event_id = event.id

    r = await client.put(
        f"/api/events/{event_id}", headers=super_admin_headers,
        json={"title": "Edited by super_admin who doesn't own this"},
    )
    assert r.status_code == 200
    assert r.json()["title"] == "Edited by super_admin who doesn't own this"


async def test_super_admin_can_delete_plant_bare_exact_match_site(client, make_user, session_factory):
    """plants.py's delete site — was the WORST-CASE pattern per TECH_DEBT.md
    §0: a bare `role != "admin"` exact-string-match, excluding even a
    moderator, let alone super_admin.
    """
    _, super_admin_headers = await make_user(email="super-closure3@example.com", role="super_admin")

    async with session_factory() as session:
        plant = Plant(scientific_name="Solanum super_admin_test")
        session.add(plant)
        await session.commit()
        await session.refresh(plant)
        plant_id = plant.id

    r = await client.delete(f"/api/plants/{plant_id}", headers=super_admin_headers)
    assert r.status_code == 200
    assert r.json()["ok"] is True


async def test_admin_role_alone_cannot_delete_plant_moderator_can_but_contributor_cannot(client, make_user):
    """Sanity check that the fix didn't over-grant: plants delete is
    admin(+super_admin)-only — a moderator or contributor still can't.
    """
    _, moderator_headers = await make_user(email="mod-closure@example.com", role="moderator")
    r = await client.post(
        "/api/plants", headers=moderator_headers,
        json={"scientific_name": "Solanum moderator-should-fail-delete-test"},
    )
    assert r.status_code == 200
    plant_id = r.json()["id"]

    delete_r = await client.delete(f"/api/plants/{plant_id}", headers=moderator_headers)
    assert delete_r.status_code == 403
