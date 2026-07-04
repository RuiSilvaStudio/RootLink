"""Post-Phase-6 product decisions (docs/roles-permissions/phase0-decisions.md
Addendum 5) — decision 2: entity conversion is self-service only, rank is
preserved-or-capped (not reset to persona) for `individual` <-> `professional`,
and a mandatory live preview/dry-run endpoint exists for both directions.

`professional` -> `organization`'s existing bootstrap-to-super-admin(5)
behavior is deliberately untouched — not re-tested here beyond confirming it
still passes in `test_roles_phase4_entity_conversion.py` (unmodified).
"""

from sqlalchemy import select

from app.models.moderation import ModerationAuditLog
from app.models.user import User

# --- Rank preserved-or-capped: individual -> professional ---

async def test_individual_to_professional_preserves_rank_2_not_reset_to_1(client, make_user, session_factory):
    """Addendum 5: rank is preserved as-is when it already fits the
    destination ceiling — NOT reset to persona(1), unlike the original
    Phase 4 behavior this replaces for this direction."""
    user, headers = await make_user(
        email="contrib-ind@example.com", entity_kind="individual", rank=2, email_verified=True,
    )
    r = await client.post("/api/entity-conversion/to-professional", headers=headers, json={
        "tax_registration_id": "PT1", "activity_registration_number": "ACT1",
    })
    assert r.status_code == 200
    async with session_factory() as s:
        refreshed = await s.get(User, user.id)
        assert refreshed.entity_kind == "professional"
        assert refreshed.rank == 2  # preserved, not reset to 1


async def test_individual_to_professional_rank_1_stays_1(client, make_user, session_factory):
    """Rank 1 is already <= professional's ceiling(4) — preserved, and
    happens to look identical to the old "reset to persona" behavior for
    this specific starting rank, which is why the original Phase 4 test
    (rank=1) still passes unmodified."""
    user, headers = await make_user(
        email="persona-ind@example.com", entity_kind="individual", rank=1, email_verified=True,
    )
    r = await client.post("/api/entity-conversion/to-professional", headers=headers, json={
        "tax_registration_id": "PT2", "activity_registration_number": "ACT2",
    })
    assert r.status_code == 200
    async with session_factory() as s:
        refreshed = await s.get(User, user.id)
        assert refreshed.rank == 1


# --- New direction: professional -> individual, rank preserved-or-capped ---

async def test_professional_to_individual_preserves_rank_1(client, make_user, session_factory):
    user, headers = await make_user(email="prof-r1@example.com", entity_kind="professional", rank=1)
    r = await client.post("/api/entity-conversion/to-individual", headers=headers)
    assert r.status_code == 200
    async with session_factory() as s:
        refreshed = await s.get(User, user.id)
        assert refreshed.entity_kind == "individual"
        assert refreshed.rank == 1


async def test_professional_to_individual_preserves_rank_2(client, make_user, session_factory):
    user, headers = await make_user(email="prof-r2@example.com", entity_kind="professional", rank=2)
    r = await client.post("/api/entity-conversion/to-individual", headers=headers)
    assert r.status_code == 200
    async with session_factory() as s:
        refreshed = await s.get(User, user.id)
        assert refreshed.entity_kind == "individual"
        assert refreshed.rank == 2


async def test_professional_to_individual_caps_rank_3_down_to_2(client, make_user, session_factory):
    """Moderator(3) exceeds individual's ceiling(2) — capped DOWN to 2, NOT
    reset all the way to persona(1)."""
    user, headers = await make_user(email="prof-r3@example.com", entity_kind="professional", rank=3)
    r = await client.post("/api/entity-conversion/to-individual", headers=headers)
    assert r.status_code == 200
    async with session_factory() as s:
        refreshed = await s.get(User, user.id)
        assert refreshed.entity_kind == "individual"
        assert refreshed.rank == 2


async def test_professional_to_individual_caps_rank_4_down_to_2(client, make_user, session_factory):
    """Admin(4) exceeds individual's ceiling(2) — capped DOWN to 2, the
    exact scenario named in the product decision."""
    user, headers = await make_user(
        email="prof-r4@example.com", entity_kind="professional", rank=4, is_verified=True,
    )
    r = await client.post("/api/entity-conversion/to-individual", headers=headers)
    assert r.status_code == 200
    async with session_factory() as s:
        refreshed = await s.get(User, user.id)
        assert refreshed.entity_kind == "individual"
        assert refreshed.rank == 2
        assert refreshed.is_verified is False  # badge not carried over

        logs = (await s.execute(
            select(ModerationAuditLog).where(ModerationAuditLog.action == "convert_entity")
        )).scalars().all()
        assert len(logs) == 1
        assert logs[0].meta["from_rank"] == 4
        assert logs[0].meta["to_rank"] == 2


async def test_professional_to_individual_requires_professional_entity(client, make_user):
    user, headers = await make_user(email="notprof@example.com", entity_kind="individual", rank=1)
    r = await client.post("/api/entity-conversion/to-individual", headers=headers)
    assert r.status_code == 400


async def test_professional_to_individual_badges_cleared(client, make_user, session_factory):
    user, headers = await make_user(
        email="prof-badges@example.com", entity_kind="professional", rank=4,
        is_verified=True, can_self_publish=True,
    )
    r = await client.post("/api/entity-conversion/to-individual", headers=headers)
    assert r.status_code == 200
    async with session_factory() as s:
        refreshed = await s.get(User, user.id)
        assert refreshed.is_verified is False
        assert refreshed.can_self_publish is False


# --- Self-service only: no user_id parameter, always acts on the caller ---

async def test_conversion_ignores_any_user_id_in_payload_acts_on_caller_only(client, make_user, session_factory):
    """Proves self-service-only behavior via actual runtime behavior, not
    just reading the code: even if a `user_id` (or similar) key is smuggled
    into the request body, the endpoint has no schema field for it and the
    conversion applies to the AUTHENTICATED caller, never a different
    target — there is no admin-triggered path."""
    actor, headers = await make_user(email="selfserve@example.com", entity_kind="professional", rank=2)
    other, _ = await make_user(email="bystander@example.com", entity_kind="professional", rank=2)

    r = await client.post(
        "/api/entity-conversion/to-individual",
        headers=headers,
        json={"user_id": other.id, "target_user_id": other.id},
    )
    assert r.status_code == 200

    async with session_factory() as s:
        actor_refreshed = await s.get(User, actor.id)
        other_refreshed = await s.get(User, other.id)
        assert actor_refreshed.entity_kind == "individual"  # the caller converted
        assert other_refreshed.entity_kind == "professional"  # bystander untouched


# --- Mandatory live preview / dry-run endpoint ---

async def test_preview_to_professional_shows_rank_preserved(client, make_user):
    user, headers = await make_user(
        email="preview-ind@example.com", entity_kind="individual", rank=2, email_verified=True,
        can_self_publish=True,
    )
    r = await client.get("/api/entity-conversion/preview?to=professional", headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert body["to"] == "professional"
    assert body["current"]["entity_kind"] == "individual"
    assert body["current"]["rank"] == 2
    assert body["current"]["can_self_publish"] is True
    assert body["projected"]["entity_kind"] == "professional"
    assert body["projected"]["rank"] == 2  # preserved
    assert body["projected"]["can_self_publish"] is False  # badge cleared
    assert body["rank_capped"] is False


async def test_preview_to_individual_shows_rank_capped_4_to_2(client, make_user):
    """The exact live-verification scenario from the briefing: a rank-4
    (admin) professional previewing conversion to individual must see
    4 -> 2 (capped), never 4 -> 1 (reset)."""
    user, headers = await make_user(
        email="preview-prof-admin@example.com", entity_kind="professional", rank=4, is_verified=True,
    )
    r = await client.get("/api/entity-conversion/preview?to=individual", headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert body["to"] == "individual"
    assert body["current"]["entity_kind"] == "professional"
    assert body["current"]["rank"] == 4
    assert body["current"]["is_verified"] is True
    assert body["projected"]["entity_kind"] == "individual"
    assert body["projected"]["rank"] == 2  # capped, not reset to 1
    assert body["projected"]["is_verified"] is False
    assert body["rank_capped"] is True


async def test_preview_to_individual_rank_2_not_capped(client, make_user):
    user, headers = await make_user(email="preview-prof-r2@example.com", entity_kind="professional", rank=2)
    r = await client.get("/api/entity-conversion/preview?to=individual", headers=headers)
    assert r.status_code == 200
    body = r.json()
    assert body["projected"]["rank"] == 2
    assert body["rank_capped"] is False


async def test_preview_rejects_wrong_direction_for_current_entity(client, make_user):
    """An individual cannot preview to=individual (a no-op direction), and a
    professional cannot preview to=professional."""
    ind_user, ind_headers = await make_user(email="preview-wrong1@example.com", entity_kind="individual", rank=1)
    r1 = await client.get("/api/entity-conversion/preview?to=individual", headers=ind_headers)
    assert r1.status_code == 400

    prof_user, prof_headers = await make_user(email="preview-wrong2@example.com", entity_kind="professional", rank=1)
    r2 = await client.get("/api/entity-conversion/preview?to=professional", headers=prof_headers)
    assert r2.status_code == 400


async def test_preview_rejects_organization_users(client, make_user, session_factory):
    from app.models.entity import Entity

    async with session_factory() as s:
        entity = Entity(entity_type="organization", name="PreviewOrg", verification_status="verified")
        s.add(entity)
        await s.commit()
        await s.refresh(entity)

    user, headers = await make_user(
        email="preview-org@example.com", entity_kind="organization", entity_id=entity.id, rank=5,
    )
    r = await client.get("/api/entity-conversion/preview?to=individual", headers=headers)
    assert r.status_code == 400


async def test_preview_does_not_mutate_anything(client, make_user, session_factory):
    """A dry-run must never write to the DB — calling preview repeatedly
    must not change the user's actual stored rank/entity_kind."""
    user, headers = await make_user(email="preview-nomut@example.com", entity_kind="professional", rank=4)
    for _ in range(3):
        r = await client.get("/api/entity-conversion/preview?to=individual", headers=headers)
        assert r.status_code == 200
    async with session_factory() as s:
        refreshed = await s.get(User, user.id)
        assert refreshed.entity_kind == "professional"  # untouched
        assert refreshed.rank == 4  # untouched
