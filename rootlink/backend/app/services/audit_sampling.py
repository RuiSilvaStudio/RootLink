"""Periodic audit-sampling process (docs/roles-permissions/phase0-decisions.md (h)).

"Flagged for sampling" needs no extra flag at write time — the existing
audit log already records `actor_id` (the approver, per
`app.services.role_requests`) and `meta.requested_by` (the requester) for
every promote/demote decision. A self-approved action is exactly the case
`requested_by == actor_id` (the same person submitted AND approved their
own request under the capped-entity/super-admin exemption).

This is explicitly a **process, not new schema** (docs/roles-permissions/phase0-decisions.md (h)):
"no schema change is needed beyond the existing audit log recording
actor/target/reason (already true)." No scheduled-job framework (celery/
cron) exists anywhere in this codebase today (checked — this repo's only
"periodic" pattern is the app-startup lifespan migration block, which is a
one-shot-per-restart idempotent migration, not a recurring job scheduler),
so per the session briefing's own instruction not to over-build a scheduled
system where none exists elsewhere, this ships as a plain, callable,
testable query helper — run it manually (or wire it into whatever
job-running mechanism the platform adopts later; that's a real decision
this session deliberately does not make on the platform's behalf).
"""

import random
from datetime import UTC, datetime, timedelta

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.moderation import ModerationAction, ModerationAuditLog

_PROMOTE_DEMOTE_ACTIONS = (ModerationAction.promote, ModerationAction.demote)


async def find_self_approved_role_changes(
    db: AsyncSession, *, since_days: int = 30
) -> list[ModerationAuditLog]:
    """Every promote/demote audit-log row in the last `since_days` where the
    approver (`actor_id`) is the same person as the original requester
    (`meta.requested_by`) — the self-approval signature described in
    docs/roles-permissions/phase0-decisions.md (h)."""
    cutoff = datetime.now(UTC) - timedelta(days=since_days)
    rows = (
        await db.execute(
            select(ModerationAuditLog).where(
                ModerationAuditLog.action.in_(_PROMOTE_DEMOTE_ACTIONS),
                ModerationAuditLog.created_at >= cutoff,
            )
        )
    ).scalars().all()
    return [
        row for row in rows
        if row.meta and row.meta.get("self_approved") is True
        and row.meta.get("requested_by") == row.actor_id
    ]


def sample_for_review(
    rows: list[ModerationAuditLog], *, fraction: float = 0.10, rng: random.Random | None = None
) -> list[ModerationAuditLog]:
    """Random ~`fraction` sample, per docs/roles-permissions/phase0-decisions.md (h)'s "10% random
    sample... reviewed by the platform's own super admin team" cadence.
    Always samples at least 1 row if any qualify (a 0-row "sample" of a
    non-empty population isn't a real compensating control)."""
    if not rows:
        return []
    k = max(1, round(len(rows) * fraction))
    k = min(k, len(rows))
    chooser = rng or random
    return chooser.sample(rows, k)


async def monthly_self_approval_sample(
    db: AsyncSession, *, fraction: float = 0.10, rng: random.Random | None = None
) -> list[ModerationAuditLog]:
    """The actual monthly job's query, per docs/roles-permissions/phase0-decisions.md (h): pulls the
    last 30 days of self-approved promote/demote actions and returns a
    random 10% sample for the platform's super admin team to review."""
    rows = await find_self_approved_role_changes(db, since_days=30)
    return sample_for_review(rows, fraction=fraction, rng=rng)
