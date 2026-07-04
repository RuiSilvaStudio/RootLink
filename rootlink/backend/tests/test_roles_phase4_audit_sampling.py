"""Phase 4 — periodic audit-sampling process (docs/roles-permissions/phase0-decisions.md (h)).

A process, not new schema: queries the existing audit log for
self-approved promote/demote actions and returns a random sample for
platform super-admin review.
"""

import random
from datetime import UTC, datetime, timedelta

from app.models.moderation import ModerationAuditLog
from app.services.audit_sampling import find_self_approved_role_changes, monthly_self_approval_sample, sample_for_review


async def _log(session_factory, *, actor_id, requested_by, action="promote", created_at=None, self_approved=True):
    async with session_factory() as s:
        row = ModerationAuditLog(
            actor_id=actor_id, action=action, target_type="user", target_id=99,
            meta={"self_approved": self_approved, "requested_by": requested_by},
        )
        s.add(row)
        await s.commit()
        if created_at is not None:
            row.created_at = created_at
            await s.commit()
        await s.refresh(row)
        return row


async def test_finds_only_self_approved_promote_demote(client, session_factory):
    await _log(session_factory, actor_id=1, requested_by=1, action="promote", self_approved=True)
    await _log(session_factory, actor_id=2, requested_by=5, action="promote", self_approved=False)  # normal approval
    await _log(session_factory, actor_id=3, requested_by=3, action="demote", self_approved=True)
    await _log(session_factory, actor_id=4, requested_by=4, action="restrict", self_approved=True)  # wrong action

    async with session_factory() as s:
        found = await find_self_approved_role_changes(s)
    assert {r.actor_id for r in found} == {1, 3}


async def test_excludes_rows_older_than_30_days(client, session_factory):
    old = datetime.now(UTC) - timedelta(days=45)
    recent = datetime.now(UTC) - timedelta(days=5)
    await _log(session_factory, actor_id=10, requested_by=10, created_at=old)
    await _log(session_factory, actor_id=11, requested_by=11, created_at=recent)

    async with session_factory() as s:
        found = await find_self_approved_role_changes(s, since_days=30)
    assert {r.actor_id for r in found} == {11}


def test_sample_for_review_returns_at_least_one_of_nonempty():
    rows = [object() for _ in range(3)]
    sample = sample_for_review(rows, fraction=0.10, rng=random.Random(1))
    assert len(sample) == 1


def test_sample_for_review_ten_percent_of_larger_population():
    rows = [object() for _ in range(50)]
    sample = sample_for_review(rows, fraction=0.10, rng=random.Random(1))
    assert len(sample) == 5


def test_sample_for_review_empty_population():
    assert sample_for_review([], fraction=0.10) == []


async def test_monthly_sample_end_to_end(client, session_factory):
    for i in range(20):
        await _log(session_factory, actor_id=100 + i, requested_by=100 + i)
    async with session_factory() as s:
        sample = await monthly_self_approval_sample(s, fraction=0.10, rng=random.Random(42))
    assert len(sample) == 2
    assert all(r.meta.get("self_approved") for r in sample)
