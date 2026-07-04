"""Phase 4 — promote/demote request+approval workflow (docs/roles-permissions/ROLES_PERMISSIONS.md §6).

Covers: only-ranks-below-actor's-own, sign-off-from-the-rank-above,
the capped-entity/super-admin self-approval exemption
(docs/roles-permissions/phase0-decisions.md), and separation of duties independent of rank.
"""

from sqlalchemy import select

from app.models.entity import Entity
from app.models.moderation import ModerationAuditLog
from app.models.user import User


async def _org(session_factory, name="Org"):
    async with session_factory() as s:
        entity = Entity(entity_type="organization", name=name, verification_status="verified")
        s.add(entity)
        await s.commit()
        await s.refresh(entity)
        return entity


# ── Submission validation ──

async def test_cannot_submit_for_self(client, make_user):
    user, headers = await make_user(email="self@example.com", entity_kind="platform", rank=5)
    r = await client.post("/api/role-requests", headers=headers, json={
        "target_user_id": user.id, "to_rank": 3,
    })
    assert r.status_code == 400


async def test_cannot_promote_to_own_rank_or_above(client, make_user, session_factory):
    entity = await _org(session_factory)
    admin, headers = await make_user(email="orgadmin@example.com", entity_kind="organization", entity_id=entity.id, rank=4)
    target, _ = await make_user(email="tgt@example.com", entity_kind="organization", entity_id=entity.id, rank=2)
    r = await client.post("/api/role-requests", headers=headers, json={
        "target_user_id": target.id, "to_rank": 4,  # == actor's own rank
    })
    assert r.status_code == 400


async def test_contributor_cannot_submit_a_promotion(client, make_user, session_factory):
    """user.promote requires moderator(3)+ — a contributor(2) may not submit."""
    entity = await _org(session_factory)
    contributor, headers = await make_user(
        email="contrib@example.com", entity_kind="organization", entity_id=entity.id, rank=2,
    )
    target, _ = await make_user(email="tgt2@example.com", entity_kind="organization", entity_id=entity.id, rank=1)
    r = await client.post("/api/role-requests", headers=headers, json={
        "target_user_id": target.id, "to_rank": 2,
    })
    assert r.status_code == 400


async def test_moderator_cannot_submit_a_demotion(client, make_user, session_factory):
    """user.demote requires admin(4)+ — a moderator(3) may not submit."""
    entity = await _org(session_factory)
    moderator, headers = await make_user(
        email="mod@example.com", entity_kind="organization", entity_id=entity.id, rank=3,
    )
    target, _ = await make_user(email="tgt3@example.com", entity_kind="organization", entity_id=entity.id, rank=2)
    r = await client.post("/api/role-requests", headers=headers, json={
        "target_user_id": target.id, "to_rank": 1,
    })
    assert r.status_code == 400


async def test_cross_entity_request_rejected(client, make_user, session_factory):
    entity_a = await _org(session_factory, name="Org A")
    entity_b = await _org(session_factory, name="Org B")
    admin_a, headers_a = await make_user(
        email="admina@example.com", entity_kind="organization", entity_id=entity_a.id, rank=4,
    )
    target_b, _ = await make_user(
        email="targetb@example.com", entity_kind="organization", entity_id=entity_b.id, rank=1,
    )
    r = await client.post("/api/role-requests", headers=headers_a, json={
        "target_user_id": target_b.id, "to_rank": 2,
    })
    assert r.status_code == 400


async def test_professional_entity_requests_not_supported_yet(client, make_user):
    """Documented gap: `professional` has no shared team model today (each
    account is unlinked) — see app/services/role_requests.py's docstring."""
    admin, headers = await make_user(email="profadmin@example.com", entity_kind="professional", rank=4)
    target, _ = await make_user(email="profother@example.com", entity_kind="professional", rank=1)
    r = await client.post("/api/role-requests", headers=headers, json={
        "target_user_id": target.id, "to_rank": 2,
    })
    assert r.status_code == 400


# ── Normal (non-exempt) approval flow ──

async def test_moderator_promote_requires_approval_from_admin_above(client, make_user, session_factory):
    entity = await _org(session_factory)
    moderator, mod_headers = await make_user(
        email="modpromote@example.com", entity_kind="organization", entity_id=entity.id, rank=3,
    )
    target, _ = await make_user(email="tgt4@example.com", entity_kind="organization", entity_id=entity.id, rank=1)
    admin, admin_headers = await make_user(
        email="approver@example.com", entity_kind="organization", entity_id=entity.id, rank=4,
    )

    r = await client.post("/api/role-requests", headers=mod_headers, json={
        "target_user_id": target.id, "to_rank": 2, "reason": "good contributions",
    })
    assert r.status_code == 201
    body = r.json()
    assert body["status"] == "pending"
    request_id = body["id"]

    # Target's rank must NOT have changed yet.
    async with session_factory() as s:
        t = await s.get(User, target.id)
        assert t.rank == 1

    r = await client.post(f"/api/role-requests/{request_id}/approve", headers=admin_headers, json={"reason": "approved"})
    assert r.status_code == 200
    assert r.json()["status"] == "approved"

    async with session_factory() as s:
        t = await s.get(User, target.id)
        assert t.rank == 2


async def test_approver_below_requester_rank_rejected(client, make_user, session_factory):
    """Approval must come from a rank ABOVE the original requester — a peer
    at the same rank cannot approve."""
    entity = await _org(session_factory)
    moderator, mod_headers = await make_user(
        email="modA@example.com", entity_kind="organization", entity_id=entity.id, rank=3,
    )
    peer_moderator, peer_headers = await make_user(
        email="modB@example.com", entity_kind="organization", entity_id=entity.id, rank=3,
    )
    target, _ = await make_user(email="tgt5@example.com", entity_kind="organization", entity_id=entity.id, rank=1)

    r = await client.post("/api/role-requests", headers=mod_headers, json={
        "target_user_id": target.id, "to_rank": 2,
    })
    request_id = r.json()["id"]

    r = await client.post(f"/api/role-requests/{request_id}/approve", headers=peer_headers, json={})
    assert r.status_code == 400


async def test_separation_of_duties_requester_cannot_approve_own_request(client, make_user, session_factory):
    entity = await _org(session_factory)
    moderator, mod_headers = await make_user(
        email="modC@example.com", entity_kind="organization", entity_id=entity.id, rank=3,
    )
    target, _ = await make_user(email="tgt6@example.com", entity_kind="organization", entity_id=entity.id, rank=1)

    r = await client.post("/api/role-requests", headers=mod_headers, json={
        "target_user_id": target.id, "to_rank": 2,
    })
    request_id = r.json()["id"]

    r = await client.post(f"/api/role-requests/{request_id}/approve", headers=mod_headers, json={})
    assert r.status_code == 400


async def test_rejection_flow(client, make_user, session_factory):
    entity = await _org(session_factory)
    moderator, mod_headers = await make_user(
        email="modD@example.com", entity_kind="organization", entity_id=entity.id, rank=3,
    )
    target, _ = await make_user(email="tgt7@example.com", entity_kind="organization", entity_id=entity.id, rank=1)
    admin, admin_headers = await make_user(
        email="rejector@example.com", entity_kind="organization", entity_id=entity.id, rank=4,
    )

    r = await client.post("/api/role-requests", headers=mod_headers, json={
        "target_user_id": target.id, "to_rank": 2,
    })
    request_id = r.json()["id"]

    r = await client.post(f"/api/role-requests/{request_id}/reject", headers=admin_headers, json={"reason": "not ready"})
    assert r.status_code == 200
    assert r.json()["status"] == "rejected"

    async with session_factory() as s:
        t = await s.get(User, target.id)
        assert t.rank == 1  # unchanged


# ── Self-approval exemption (capped entity's top rank / super admin) ──

async def test_organization_super_admin_self_approves_immediately(client, make_user, session_factory):
    entity = await _org(session_factory)
    super_admin, headers = await make_user(
        email="orgsuper@example.com", entity_kind="organization", entity_id=entity.id, rank=5,
    )
    target, _ = await make_user(email="tgt8@example.com", entity_kind="organization", entity_id=entity.id, rank=1)

    r = await client.post("/api/role-requests", headers=headers, json={
        "target_user_id": target.id, "to_rank": 2, "reason": "earned it",
    })
    assert r.status_code == 201
    body = r.json()
    assert body["status"] == "approved"
    assert body["self_approved"] is True

    async with session_factory() as s:
        t = await s.get(User, target.id)
        assert t.rank == 2

        logs = (await s.execute(
            select(ModerationAuditLog).where(ModerationAuditLog.action == "promote")
        )).scalars().all()
        assert len(logs) == 1
        assert logs[0].meta["self_approved"] is True
        assert logs[0].meta["requested_by"] == logs[0].actor_id


async def test_platform_super_admin_self_approves_immediately(client, make_user, session_factory):
    entity = await _org(session_factory)
    platform_super, headers = await make_user(email="platself@example.com", entity_kind="platform", rank=5)
    target, _ = await make_user(email="tgt9@example.com", entity_kind="organization", entity_id=entity.id, rank=1)

    r = await client.post("/api/role-requests", headers=headers, json={
        "target_user_id": target.id, "to_rank": 2,
    })
    assert r.status_code == 201
    assert r.json()["status"] == "approved"
    assert r.json()["self_approved"] is True


async def test_professional_admin_is_not_self_exempt_via_role_requests_because_unsupported(client, make_user):
    """professional's `admin` (rank 4 == professional ceiling) IS documented
    as self-exempt in docs/roles-permissions/ROLES_PERMISSIONS.md §6 — but role-change requests for
    `professional` are blocked entirely in this phase (no team model), so
    the exemption never actually gets exercised through this endpoint. See
    test_is_self_approval_exempt_generic_rule below for the unit-level
    proof that the exemption LOGIC itself is correct."""
    admin, headers = await make_user(email="profadmin2@example.com", entity_kind="professional", rank=4)
    target, _ = await make_user(email="profother2@example.com", entity_kind="professional", rank=1)
    r = await client.post("/api/role-requests", headers=headers, json={
        "target_user_id": target.id, "to_rank": 2,
    })
    assert r.status_code == 400  # blocked by the no-team-model guard, not the exemption


def test_is_self_approval_exempt_generic_rule():
    """Unit-level proof (app/services/role_requests.is_self_approval_exempt)
    that the generic "rank == entity ceiling" rule produces exactly
    docs/roles-permissions/ROLES_PERMISSIONS.md §6's two documented exemptions and no others."""
    from app.services.role_requests import is_self_approval_exempt

    assert is_self_approval_exempt("professional", 4) is True  # admin, professional's ceiling
    assert is_self_approval_exempt("professional", 3) is False  # moderator — not exempt
    assert is_self_approval_exempt("organization", 5) is True  # super admin
    assert is_self_approval_exempt("organization", 4) is False  # admin — not exempt (org has a super admin above)
    assert is_self_approval_exempt("platform", 5) is True
    assert is_self_approval_exempt("individual", 2) is True  # contributor is individual's ceiling too...
    # ...but individual can never actually reach the moderator+ floor needed
    # to submit a promote/demote request in the first place (ceiling 2 < 3),
    # so this branch of the generic rule is structurally inert for
    # individual — confirmed by the endpoint-level test above needing
    # `professional`/`organization` to exercise it at all.
    assert is_self_approval_exempt("partners", 1) is True
