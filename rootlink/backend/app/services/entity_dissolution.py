"""Entity dissolution (docs/roles-permissions/ROLES_PERMISSIONS.md §3 "Entity dissolution").

Applies to `organization`/`partners`/`suppliers` entities. Dissolution can be
TRIGGERED by that entity's own super admin or by the platform super admin,
but always REQUIRES platform super admin approval, regardless of who
triggered it — mirrored here as two states on `Entity`:
`dissolution_requested_at`/`_by` (pending, awaiting platform review) vs
`dissolved_at` (approved + executed). A platform-super-admin-triggered
dissolution skips the pending state entirely (it's already approved by the
only authority that can approve it).

On execution:
1. All members convert to plain `individual` `persona` accounts (rank/badges
   do not carry over).
2. The entity's content (owned by its members) is archived, not deleted —
   reversible within a 30-day grace period.
3. Logged as `dissolve_entity`.
4. Cross-entity footprint cascade-hide runs too (docs/roles-permissions/ROLES_PERMISSIONS.md §3), using
   the same grace window.

A snapshot of every affected member's prior (entity_kind, rank) and every
archived content id is recorded on `Entity.dissolution_snapshot` — without
it, "reversible within 30 days" (docs/roles-permissions/assessment.md §7's own flagged compliance
question) would have nothing concrete to restore.
"""

from datetime import UTC, datetime, timedelta

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.content import Content, ContentStatus
from app.models.entity import Entity
from app.models.moderation import ModerationAction
from app.models.user import User
from app.services.audit import log_moderation
from app.services.delegations import void_grants_for_departure
from app.services.entity_cascade import cascade_hide_entity_footprint, cascade_restore_entity_footprint

GRACE_PERIOD_DAYS = 30


class DissolutionError(Exception):
    def __init__(self, detail: str):
        self.detail = detail
        super().__init__(detail)


def _in_grace_window(expires_at: datetime | None) -> bool:
    if expires_at is None:
        return False
    now = datetime.now(UTC)
    exp = expires_at if expires_at.tzinfo else expires_at.replace(tzinfo=UTC)
    return exp > now


async def request_dissolution(db: AsyncSession, entity: Entity, requester: User, *, reason: str | None = None) -> Entity:
    if entity.entity_type not in ("organization", "partners", "suppliers"):
        raise DissolutionError("Only organization/partners/suppliers entities can be dissolved")
    if entity.dissolved_at is not None:
        raise DissolutionError("Entity is already dissolved")
    if entity.dissolution_requested_at is not None:
        raise DissolutionError("A dissolution request is already pending")
    entity.dissolution_requested_at = datetime.now(UTC)
    entity.dissolution_requested_by = requester.id
    await log_moderation(
        db, action=ModerationAction.request_dissolution, target_type="entity", target_id=entity.id,
        actor_id=requester.id, reason=reason,
    )
    return entity


async def reject_dissolution(db: AsyncSession, entity: Entity, approver: User, *, reason: str | None = None) -> Entity:
    if entity.dissolution_requested_at is None:
        raise DissolutionError("No pending dissolution request to reject")
    entity.dissolution_requested_at = None
    entity.dissolution_requested_by = None
    await log_moderation(
        db, action=ModerationAction.reject_dissolution, target_type="entity", target_id=entity.id,
        actor_id=approver.id, reason=reason,
    )
    return entity


async def approve_dissolution(
    db: AsyncSession, entity: Entity, approver: User, *, reason: str | None = None, triggered_directly: bool = False,
) -> Entity:
    """Executes dissolution. `triggered_directly=True` is the platform-super-
    admin-direct path (no prior pending request needed)."""
    if entity.entity_type not in ("organization", "partners", "suppliers"):
        raise DissolutionError("Only organization/partners/suppliers entities can be dissolved")
    if entity.dissolved_at is not None:
        raise DissolutionError("Entity is already dissolved")
    if not triggered_directly and entity.dissolution_requested_at is None:
        raise DissolutionError("No pending dissolution request to approve")

    members = (await db.execute(select(User).where(User.entity_id == entity.id))).scalars().all()
    member_snapshot: dict[str, dict] = {}
    member_ids = [m.id for m in members]
    for m in members:
        member_snapshot[str(m.id)] = {"entity_kind": m.entity_kind, "rank": m.rank}
        m.entity_kind = "individual"
        m.entity_id = None
        # "All members convert to plain individual persona accounts" — rank 1
        # (persona), not merely clamped to individual's ceiling (contributor,
        # rank 2): rank does not carry over at all (docs/roles-permissions/ROLES_PERMISSIONS.md §3).
        m.rank = 1
        # Phase 5 addition: delegated grants are auto-voided on entity
        # departure (docs/roles-permissions/ROLES_PERMISSIONS.md §10) — dissolution is the largest-blast-
        # radius departure case (every member leaves at once), so it gets
        # the same treatment `entity_team.remove_team_member` uses for a
        # single roster removal.
        await void_grants_for_departure(
            db, user_id=m.id, entity_id=entity.id, actor_id=approver.id,
            reason="entity dissolved",
        )

    content_ids: list[int] = []
    if member_ids:
        rows = (
            await db.execute(
                select(Content.id).where(
                    Content.created_by.in_(member_ids), Content.status == ContentStatus.published
                )
            )
        ).scalars().all()
        content_ids = list(rows)
        if content_ids:
            await db.execute(
                update(Content).where(Content.id.in_(content_ids)).values(status=ContentStatus.archived)
            )

    now = datetime.now(UTC)
    entity.dissolved_at = now
    entity.dissolution_grace_expires_at = now + timedelta(days=GRACE_PERIOD_DAYS)
    entity.dissolution_requested_at = None
    entity.dissolution_snapshot = {"members": member_snapshot, "content_ids": content_ids}

    await cascade_hide_entity_footprint(
        db, entity_id=entity.id, actor_id=approver.id, reason="entity dissolved"
    )

    await log_moderation(
        db, action=ModerationAction.dissolve_entity, target_type="entity", target_id=entity.id,
        actor_id=approver.id, reason=reason,
        meta={"member_count": len(member_ids), "content_archived": len(content_ids)},
    )
    return entity


async def reverse_dissolution(db: AsyncSession, entity: Entity, approver: User, *, reason: str | None = None) -> Entity:
    if entity.dissolved_at is None:
        raise DissolutionError("Entity is not dissolved")
    if not _in_grace_window(entity.dissolution_grace_expires_at):
        raise DissolutionError("Reversal window (30-day grace period) has expired")

    snapshot = entity.dissolution_snapshot or {}
    members_snapshot: dict = snapshot.get("members", {})
    content_ids: list[int] = snapshot.get("content_ids", [])

    for user_id_str, prior in members_snapshot.items():
        user = await db.get(User, int(user_id_str))
        if user is not None:
            user.entity_kind = prior.get("entity_kind")
            user.entity_id = entity.id
            user.rank = prior.get("rank")

    if content_ids:
        await db.execute(
            update(Content).where(Content.id.in_(content_ids)).values(status=ContentStatus.published)
        )

    await cascade_restore_entity_footprint(
        db, entity_id=entity.id, actor_id=approver.id, reason="dissolution reversed"
    )

    entity.dissolved_at = None
    entity.dissolution_grace_expires_at = None
    entity.dissolution_snapshot = None

    await log_moderation(
        db, action=ModerationAction.reverse_dissolution, target_type="entity", target_id=entity.id,
        actor_id=approver.id, reason=reason,
    )
    return entity


async def ban_entity(db: AsyncSession, entity: Entity, approver: User, *, reason: str | None = None) -> Entity:
    if entity.banned_at is not None:
        raise DissolutionError("Entity is already banned")
    now = datetime.now(UTC)
    entity.banned_at = now
    entity.ban_reason = reason
    entity.banned_by = approver.id
    entity.ban_cascade_grace_expires_at = now + timedelta(days=GRACE_PERIOD_DAYS)
    await cascade_hide_entity_footprint(db, entity_id=entity.id, actor_id=approver.id, reason="entity banned")
    await log_moderation(
        db, action=ModerationAction.ban_entity, target_type="entity", target_id=entity.id,
        actor_id=approver.id, reason=reason,
    )
    return entity


async def unban_entity(db: AsyncSession, entity: Entity, approver: User, *, reason: str | None = None) -> Entity:
    if entity.banned_at is None:
        raise DissolutionError("Entity is not banned")
    if not _in_grace_window(entity.ban_cascade_grace_expires_at):
        raise DissolutionError("Reversal window (30-day grace period) has expired")
    entity.banned_at = None
    entity.ban_reason = None
    entity.banned_by = None
    entity.ban_cascade_grace_expires_at = None
    await cascade_restore_entity_footprint(db, entity_id=entity.id, actor_id=approver.id, reason="entity unbanned")
    await log_moderation(
        db, action=ModerationAction.unban_entity, target_type="entity", target_id=entity.id,
        actor_id=approver.id, reason=reason,
    )
    return entity
