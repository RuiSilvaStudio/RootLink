"""Entity-scoped "manage my team" backend surface (docs/roles-permissions/ROLES_PERMISSIONS.md §3
"Partners/suppliers: primary contact" + the general "organization's own
super admin manages members/ranks" case) — Phase 5.

Two distinct capabilities, matching docs/roles-permissions/ROLES_PERMISSIONS.md's own split:
- **Roster membership** (add/remove which user IDs belong to the entity at
  all) — only meaningful for `partners`/`suppliers` (§3: "no admin/
  moderator/super-admin tier... a lightweight, non-elevated primary contact
  designation... can add or remove which user IDs are associated with that
  partner/supplier entity"). `organization` entities have no equivalent
  self-service "add a member" action in docs/roles-permissions/ROLES_PERMISSIONS.md — an organization's
  own super admin manages *rank* via the existing promote/demote
  request workflow (`app.services.role_requests`), not a roster add/remove
  endpoint; this module's roster functions therefore reject `organization`
  entities outright rather than silently doing something docs/roles-permissions/ROLES_PERMISSIONS.md
  never described.
- **Member listing** (`list_members`) — available for all three entity
  kinds, so an organization's own super admin (or a partners/suppliers
  primary contact) can actually see their team before deciding what to do
  next (promote/demote request, or roster add/remove).
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.entity import Entity
from app.models.moderation import ModerationAction
from app.models.user import User
from app.services.audit import log_moderation
from app.services.delegations import void_grants_for_departure

_ROSTER_MANAGED_KINDS = ("partners", "suppliers")


class TeamManagementError(Exception):
    def __init__(self, detail: str):
        self.detail = detail
        super().__init__(detail)


def can_view_team(user: User, entity: Entity) -> bool:
    if user.entity_id is not None and user.entity_id == entity.id:
        return True
    return entity.primary_contact_user_id == user.id


def _is_roster_authority(user: User, entity: Entity) -> bool:
    """The primary contact for that specific partners/suppliers entity, or
    the platform super admin (entity precedence) — see
    permissions_registry.py's `partner_team.manage_roster` note for why this
    is a designation check, not a rank check: partners/suppliers have no
    rank tier to hold "super admin" at in the first place."""
    from app.core.entity_resolution import resolve_entity_and_rank

    entity_kind, rank = resolve_entity_and_rank(user)
    if entity_kind == "platform" and rank >= 5:
        return True
    return entity.primary_contact_user_id == user.id


async def list_members(db: AsyncSession, entity_id: int) -> list[User]:
    rows = (await db.execute(select(User).where(User.entity_id == entity_id))).scalars().all()
    return list(rows)


async def add_team_member(
    db: AsyncSession, actor: User, entity: Entity, target: User,
) -> User:
    if entity.entity_type not in _ROSTER_MANAGED_KINDS:
        raise TeamManagementError(
            "Roster add/remove only applies to partners/suppliers entities — "
            "organization membership changes go through the promote/demote request workflow"
        )
    if not _is_roster_authority(actor, entity):
        raise TeamManagementError("Only the entity's primary contact (or platform super admin) may manage the roster")
    if target.entity_id is not None:
        raise TeamManagementError("That user already belongs to another entity")

    target.entity_kind = entity.entity_type
    target.entity_id = entity.id
    # partners/suppliers are capped at "persona + specific grants" (§3) — no
    # rank tier to assign beyond persona(1).
    target.rank = 1

    await log_moderation(
        db, action=ModerationAction.add_team_member, target_type="user", target_id=target.id,
        actor_id=actor.id, meta={"entity_id": entity.id},
    )
    return target


async def remove_team_member(
    db: AsyncSession, actor: User, entity: Entity, target: User,
) -> User:
    if entity.entity_type not in _ROSTER_MANAGED_KINDS:
        raise TeamManagementError(
            "Roster add/remove only applies to partners/suppliers entities"
        )
    if not _is_roster_authority(actor, entity):
        raise TeamManagementError("Only the entity's primary contact (or platform super admin) may manage the roster")
    if target.entity_id != entity.id:
        raise TeamManagementError("That user does not belong to this entity")
    if target.id == entity.primary_contact_user_id:
        raise TeamManagementError("Cannot remove the entity's own primary contact from its roster")

    target.entity_kind = "individual"
    target.entity_id = None
    target.rank = 1

    voided = await void_grants_for_departure(
        db, user_id=target.id, entity_id=entity.id, actor_id=actor.id,
        reason="entity departure (roster removal)",
    )

    await log_moderation(
        db, action=ModerationAction.remove_team_member, target_type="user", target_id=target.id,
        actor_id=actor.id, meta={"entity_id": entity.id, "grants_voided": voided},
    )
    return target
