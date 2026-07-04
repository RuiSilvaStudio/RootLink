"""Delegation-grant CRUD (docs/roles-permissions/ROLES_PERMISSIONS.md §10) — Phase 5.

`app.models.entity.DelegationGrant` has existed since Phase 1 (it's where
the legacy `can_self_publish`/`can_edit_copy` booleans were backfilled to,
per docs/roles-permissions/phase0-decisions.md's addendum) but had no API surface at all until now.

Only actions the permissions registry marks `delegable: True`
(`app.core.permissions_registry`) may be granted — docs/roles-permissions/ROLES_PERMISSIONS.md §10's own
framing ("not every permission is delegable"). A grant's `entity_id` must
agree with the action's own `entity_scope`: `None` (platform-wide) only for
`entity_scope == "platform"` actions, a real entity id only for
`entity_scope == "entity"` actions.

**Who may grant:** the entity's own super admin (rank 5, matching
`entity_id`) for entity-scoped delegable actions, or the platform super
admin for either (entity precedence, docs/roles-permissions/ROLES_PERMISSIONS.md §3) — mirrors
`app.services.entity_dissolution`'s own
platform-super-admin-or-entity-super-admin pattern rather than inventing a
new authority model.

**No self-delegation.** Not explicitly named in docs/roles-permissions/ROLES_PERMISSIONS.md §10 for the
general case, but docs/roles-permissions/ROLES_PERMISSIONS.md §3's primary-contact rule ("cannot
self-grant elevated permissions") states the *principle* this generalizes:
if any super admin could delegate an action to themselves, the "who granted
this to whom, and why" audit trail that's supposed to make delegation safe
degenerates into a rank-holder just extending their own reach with an extra
audit-log line, which is exactly the kind of drift docs/roles-permissions/ROLES_PERMISSIONS.md's
log-everything baseline rule (§1) exists to prevent. Enforced as a hard
`grantor_id != grantee_id` check here, independent of rank.

**Auto-void on departure** is implemented where a departure actually occurs
today (`app.services.entity_team.remove_team_member`,
`app.services.entity_dissolution`'s member-conversion loop) — see
`void_grants_for_departure` below. **Not yet wired into demotion**
(`app.services.role_requests._decide`): docs/roles-permissions/ROLES_PERMISSIONS.md §10 says grants are
voided "on any demotion... of the grantee," but doing this correctly needs
comparing the delegated action's `min_rank` against the grantee's *new*
rank (a grant to a still-sufficiently-ranked user after a partial demotion
arguably shouldn't be voided) — a real design question left honestly
un-modeled here rather than half-built, per this session's own instruction
to flag rather than guess. Recorded as a gap in docs/roles-permissions/phase0-decisions.md's Phase
5 addendum.
"""

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.entity_resolution import resolve_entity_and_rank
from app.core.permissions_registry import get as registry_get
from app.models.entity import DelegationGrant
from app.models.moderation import ModerationAction
from app.models.user import User
from app.services.audit import log_moderation


class DelegationError(Exception):
    def __init__(self, detail: str):
        self.detail = detail
        super().__init__(detail)


def has_grantor_authority(grantor: User, entity_id: int | None) -> bool:
    """Public (non-underscore) on purpose — `app/api/delegations.py`'s
    listing endpoint reuses this exact authority check to decide who may
    VIEW an entity's/platform's delegation list, not just grant/revoke."""
    entity_kind, rank = resolve_entity_and_rank(grantor)
    if entity_kind == "platform":
        return rank >= 5
    if entity_id is None:
        return False  # only the platform super admin may grant platform-wide actions
    return grantor.entity_id is not None and grantor.entity_id == entity_id and rank >= 5


async def grant_delegation(
    db: AsyncSession,
    grantor: User,
    *,
    grantee: User,
    action: str,
    entity_id: int | None,
) -> DelegationGrant:
    if grantor.id == grantee.id:
        raise DelegationError("Cannot delegate an action to yourself")

    entry = registry_get(action)
    if entry is None:
        raise DelegationError(f"Unknown action '{action}'")
    if not entry.delegable:
        raise DelegationError(f"Action '{action}' is not delegable")
    if entry.entity_scope == "platform" and entity_id is not None:
        raise DelegationError("Platform-wide actions must be granted with entity_id=null")
    if entry.entity_scope == "entity" and entity_id is None:
        raise DelegationError("Entity-scoped actions require an entity_id")

    if not has_grantor_authority(grantor, entity_id):
        raise DelegationError(
            "Only that entity's super admin (or the platform super admin) may grant this"
        )

    grant = DelegationGrant(
        grantor_id=grantor.id,
        grantee_id=grantee.id,
        entity_id=entity_id,
        action=action,
        granted_at=datetime.now(UTC),
    )
    db.add(grant)
    await db.flush()

    await log_moderation(
        db, action=ModerationAction.grant_delegation, target_type="user", target_id=grantee.id,
        actor_id=grantor.id, meta={"grant_id": grant.id, "delegated_action": action, "entity_id": entity_id},
    )
    return grant


async def revoke_delegation(
    db: AsyncSession, actor: User, grant: DelegationGrant, *, reason: str | None = None,
) -> DelegationGrant:
    if grant.revoked_at is not None:
        raise DelegationError("Grant is already revoked")
    if not has_grantor_authority(actor, grant.entity_id):
        raise DelegationError(
            "Only that entity's super admin (or the platform super admin) may revoke this"
        )
    grant.revoked_at = datetime.now(UTC)
    grant.revoked_reason = reason
    await log_moderation(
        db, action=ModerationAction.revoke_delegation, target_type="user", target_id=grant.grantee_id,
        actor_id=actor.id, reason=reason, meta={"grant_id": grant.id, "delegated_action": grant.action},
    )
    return grant


async def list_delegations(
    db: AsyncSession,
    *,
    entity_id: int | None = None,
    grantee_id: int | None = None,
    active_only: bool = True,
) -> list[DelegationGrant]:
    stmt = select(DelegationGrant)
    if entity_id is not None:
        stmt = stmt.where(DelegationGrant.entity_id == entity_id)
    if grantee_id is not None:
        stmt = stmt.where(DelegationGrant.grantee_id == grantee_id)
    if active_only:
        stmt = stmt.where(DelegationGrant.revoked_at.is_(None))
    rows = (await db.execute(stmt)).scalars().all()
    return list(rows)


async def void_grants_for_departure(
    db: AsyncSession, *, user_id: int, entity_id: int, actor_id: int | None, reason: str,
) -> int:
    """Auto-void (docs/roles-permissions/ROLES_PERMISSIONS.md §10) every active grant a departing member
    held within the entity they just left. Returns the count voided."""
    grants = await list_delegations(db, entity_id=entity_id, grantee_id=user_id, active_only=True)
    now = datetime.now(UTC)
    for grant in grants:
        grant.revoked_at = now
        grant.revoked_reason = reason
        await log_moderation(
            db, action=ModerationAction.revoke_delegation, target_type="user", target_id=user_id,
            actor_id=actor_id, reason=reason, meta={"grant_id": grant.id, "delegated_action": grant.action, "auto": True},
        )
    return len(grants)
