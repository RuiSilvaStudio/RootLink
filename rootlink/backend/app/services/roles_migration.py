"""Phase 1 data migration: backfill `User.entity_id`/`rank`/`entity_kind`,
and migrate the legacy `can_self_publish`/`can_edit_copy` booleans into
`delegation_grants` rows.

Implements the mapping rules signed off in
`docs/roles-permissions/phase0-decisions.md` (b) (and its addendum
on the `entity_kind` column). Both functions are idempotent and safe to call
on every app startup (called from `app.main`'s lifespan, guarded by the same
flock as the rest of the schema migration): each only processes rows it
hasn't touched yet (`entity_kind IS NULL`, or a `delegation_grants` row that
doesn't already exist for that grant), so a second run — or a second
uvicorn worker racing the first — is a no-op.

**Confirmed by the product owner (docs/roles-permissions/assessment.md §1/§3.3): production has no
real users today** — every row processed here is test/seed data created for
evaluation. That's why this can run directly and unconditionally rather than
behind a feature flag or a dry-run step; the *logic* still has to be right
for whenever real users exist, which is why it implements the full mapping
(including the `organization`/`practitioner` branches that happen to be
unused by today's actual seed data — see `IMPLEMENTATION_STATUS`-style notes
in the PR/session report for what was actually exercised).
"""

from datetime import UTC, datetime

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.entity import Entity, EntityVerificationStatus, UserEntity
from app.models.moderation import ModerationAction
from app.models.user import User
from app.services.audit import log_moderation

# role -> rank (docs/roles-permissions/ROLES_PERMISSIONS.md §5; `user` renamed to `persona`)
_ROLE_RANK = {
    "user": 1,
    "contributor": 2,
    "moderator": 3,
    "admin": 4,
    "super_admin": 5,
}

# Highest rank each entity can locally reach (docs/roles-permissions/ROLES_PERMISSIONS.md §3's ceilings
# table). `partners`/`suppliers` are capped at "persona + specific grants" —
# no contributor/moderator/admin/super-admin tier at all, per the spec's own
# framing, so their ceiling is rank 1, not 2.
_ENTITY_CEILING = {
    UserEntity.individual: 2,
    UserEntity.professional: 4,
    UserEntity.organization: 5,
    UserEntity.platform: 5,
    UserEntity.partners: 1,
    UserEntity.suppliers: 1,
}

# Keywords in `services`/`certifications` suggesting a practitioner row is
# actually an external platform-relationship business (→ `partners`) rather
# than an individual professional-services provider (→ `professional`,
# the default). Deliberately small and conservative — see docs/roles-permissions/phase0-decisions.md
# (b): "any `suppliers` entity is created manually post-migration", so this
# heuristic only ever redirects to `partners`, never `suppliers`.
_PARTNER_KEYWORDS = ("legal", "accounting", "law", "tech", "vendor", "consult", "audit")

# organization_kind values that read as an organizational structure rather
# than a solo practitioner (docs/roles-permissions/assessment.md §3.1's `EntityType`/`OrganizationKind`
# enum) — part of the `practitioner` → `partners` redirect heuristic.
_ORG_SHAPED_KINDS = {
    "ipss", "cooperative", "association", "cer", "ministry",
    "regulatory", "adr", "municipality", "company",
}


def _looks_like_partner(user: User) -> bool:
    if user.organization_kind not in _ORG_SHAPED_KINDS:
        return False
    haystack = " ".join(
        [*(user.services or []), *(user.certifications or [])]
    ).lower()
    return any(kw in haystack for kw in _PARTNER_KEYWORDS)


async def migrate_users_to_entity_rank(session: AsyncSession) -> dict:
    """Backfill `entity_id`/`rank`/`entity_kind` for every user not yet
    migrated (`entity_kind IS NULL`). Returns a stats dict for logging.
    """
    result = await session.execute(select(User).where(User.entity_kind.is_(None)))
    pending = list(result.scalars().all())
    stats = {
        "migrated": 0,
        "platform_override_admin_super_admin": 0,
        "platform_override_ceiling_safety_net": 0,
        "individual": 0,
        "professional": 0,
        "partners_from_practitioner_heuristic": 0,
        "organizations_created": 0,
        "organization_members_migrated": 0,
    }
    if not pending:
        return stats

    # --- Pass 1: blanket admin/super_admin -> platform override -------
    # Per docs/roles-permissions/phase0-decisions.md (b): today's flat `role` model only ever made
    # sense platform-wide, so any row currently holding `admin`/`super_admin`
    # was necessarily acting platform-wide already, regardless of
    # `account_type`. These are removed from further per-account_type
    # processing below.
    remaining: list[User] = []
    for user in pending:
        if user.role in ("admin", "super_admin"):
            user.entity_kind = UserEntity.platform
            user.entity_id = None
            user.rank = _ROLE_RANK[user.role]
            stats["platform_override_admin_super_admin"] += 1
            stats["migrated"] += 1
            await log_moderation(
                session,
                action=ModerationAction.migrate_entity_rank,
                target_type="user",
                target_id=user.id,
                actor_id=None,
                actor_label="phase1_migration",
                reason="admin/super_admin role has no valid ceiling below platform in the old flat-role model",
                meta={"old_role": user.role, "old_account_type": user.account_type,
                      "new_entity_kind": str(user.entity_kind), "new_rank": user.rank},
            )
        else:
            remaining.append(user)

    # --- Pass 2: per-account_type mapping for everyone else ------------
    org_groups: dict[tuple[str, str], list[User]] = {}
    for user in remaining:
        if user.account_type == "organization":
            key = (user.service_area or "", user.name or "")
            org_groups.setdefault(key, []).append(user)
            continue

        if user.account_type == "practitioner":
            if _looks_like_partner(user):
                entity = Entity(
                    entity_type="partners",
                    name=user.name,
                    verification_status=(
                        EntityVerificationStatus.verified if user.is_verified
                        else EntityVerificationStatus.pending
                    ),
                    verified_at=user.verified_at if user.is_verified else None,
                    verified_by=None,
                    primary_contact_user_id=None,
                    tax_registration_id=user.registration_number,
                )
                session.add(entity)
                await session.flush()  # need entity.id before assigning
                user.entity_kind = UserEntity.partners
                user.entity_id = entity.id
                user.rank = 1  # partners ceiling — persona only
                stats["partners_from_practitioner_heuristic"] += 1
            else:
                user.entity_kind = UserEntity.professional
                user.entity_id = None
                # Not clamped to the ceiling here — Pass 4 below is the single
                # place that resolves a ceiling conflict (by re-homing to
                # `platform`), so every conflict goes through the same,
                # explicit, logged path rather than being silently clamped.
                user.rank = _ROLE_RANK.get(user.role, 1)
                stats["professional"] += 1
        else:
            # account_type == "individual" (or any unrecognized legacy value
            # — defaults to individual, matching the model's own column
            # default of "individual").
            user.entity_kind = UserEntity.individual
            user.entity_id = None
            user.rank = _ROLE_RANK.get(user.role, 1)
            stats["individual"] += 1

        stats["migrated"] += 1
        await log_moderation(
            session,
            action=ModerationAction.migrate_entity_rank,
            target_type="user",
            target_id=user.id,
            actor_id=None,
            actor_label="phase1_migration",
            reason="phase0-decisions.md (b) mapping rule",
            meta={"old_role": user.role, "old_account_type": user.account_type,
                  "new_entity_kind": str(user.entity_kind), "new_rank": user.rank},
        )

    # --- Pass 3: organization backfill (group -> one Entity row) --------
    for (_key, members) in org_groups.items():
        # Highest-role member becomes the entity's bootstrapped super admin
        # (docs/roles-permissions/ROLES_PERMISSIONS.md "Bootstrapping a new entity" — no approval needed).
        members_sorted = sorted(
            members, key=lambda u: (-_ROLE_RANK.get(u.role, 1), u.id)
        )
        candidate = members_sorted[0]
        any_verified = any(u.is_verified for u in members)
        verified_source = next((u for u in members if u.is_verified), None)
        entity = Entity(
            entity_type="organization",
            name=candidate.name or f"Organization ({candidate.id})",
            verification_status=(
                EntityVerificationStatus.verified if any_verified
                else EntityVerificationStatus.pending
            ),
            verified_at=verified_source.verified_at if verified_source else None,
            verified_by=None,
            primary_contact_user_id=None,
            tax_registration_id=candidate.registration_number,
        )
        session.add(entity)
        await session.flush()
        stats["organizations_created"] += 1
        for member in members_sorted:
            member.entity_kind = UserEntity.organization
            member.entity_id = entity.id
            member.rank = 5 if member.id == candidate.id else 1
            stats["migrated"] += 1
            stats["organization_members_migrated"] += 1
            await log_moderation(
                session,
                action=ModerationAction.migrate_entity_rank,
                target_type="user",
                target_id=member.id,
                actor_id=None,
                actor_label="phase1_migration",
                reason=(
                    "organization backfill: bootstrapped as entity super admin"
                    if member.id == candidate.id
                    else "organization backfill: default persona rank within new entity"
                ),
                meta={"old_role": member.role, "old_account_type": member.account_type,
                      "entity_id": entity.id, "new_rank": member.rank},
            )

    # --- Pass 4: post-migration ceiling validation (safety net) ---------
    # docs/roles-permissions/assessment.md §8 / docs/roles-permissions/roadmap.md Phase 1 explicitly require verifying no
    # user lands in an invalid (entity, rank) combination post-migration.
    # Passes 1-3 above shouldn't produce one given today's role set, but this
    # closes the gap generally (e.g. a `moderator`-role `individual` user,
    # rank 3, would otherwise exceed `individual`'s ceiling of 2) using the
    # same reasoning docs/roles-permissions/phase0-decisions.md (b) already applies to admin/
    # super_admin: no valid ceiling locally -> the user is re-homed to
    # `platform`, which always accepts any rank up to 5.
    for user in pending:
        if user.entity_kind is None or user.rank is None:
            continue
        ceiling = _ENTITY_CEILING.get(UserEntity(user.entity_kind))
        if ceiling is not None and user.rank > ceiling and user.entity_kind != UserEntity.platform:
            old_kind, old_rank = user.entity_kind, user.rank
            user.entity_kind = UserEntity.platform
            user.entity_id = None
            # rank stays the same value — it already fits platform's ceiling (5)
            stats["platform_override_ceiling_safety_net"] += 1
            await log_moderation(
                session,
                action=ModerationAction.migrate_entity_rank,
                target_type="user",
                target_id=user.id,
                actor_id=None,
                actor_label="phase1_migration",
                reason=f"post-migration ceiling check: rank {old_rank} exceeded {old_kind}'s ceiling",
                meta={"old_entity_kind": str(old_kind), "new_entity_kind": str(user.entity_kind), "rank": user.rank},
            )

    await session.commit()
    return stats


async def migrate_legacy_delegations(session: AsyncSession) -> dict:
    """Backfill `can_self_publish`/`can_edit_copy` into `delegation_grants`
    rows (docs/roles-permissions/phase0-decisions.md's Step B summary: "these become the first two
    rows of the new mechanism, not left running as parallel special cases").

    The existing booleans are left untouched and still authoritative for
    enforcement — this only *also* records the equivalent grant in the new
    table, so Phase 3's eventual cutover has real data to read. Idempotent:
    skips any user who already has a matching, non-revoked grant.
    """
    # Imported lazily to avoid a hard import-order dependency at module load.
    from app.models.entity import DelegationGrant

    stats = {"self_publish_grants_created": 0, "edit_copy_grants_created": 0}
    now = datetime.now(UTC)

    result = await session.execute(
        select(User).where((User.can_self_publish.is_(True)) | (User.can_edit_copy.is_(True)))
    )
    users = list(result.scalars().all())
    if not users:
        return stats

    for user in users:
        if user.can_self_publish:
            existing = await session.execute(
                select(DelegationGrant).where(
                    DelegationGrant.grantee_id == user.id,
                    DelegationGrant.action == "self_publish",
                    DelegationGrant.revoked_at.is_(None),
                )
            )
            if existing.scalar_one_or_none() is None:
                grant = DelegationGrant(
                    # No real grantor was ever recorded for this legacy
                    # boolean toggle — default to self as a documented
                    # migration assumption (docs/roles-permissions/phase0-decisions.md addendum).
                    grantor_id=user.id,
                    grantee_id=user.id,
                    entity_id=None,  # platform-wide, matching the old global boolean
                    action="self_publish",
                    granted_at=user.self_publish_agreed_at or user.created_at or now,
                )
                session.add(grant)
                stats["self_publish_grants_created"] += 1
                await log_moderation(
                    session,
                    action=ModerationAction.migrate_legacy_delegation,
                    target_type="user",
                    target_id=user.id,
                    actor_id=None,
                    actor_label="phase1_migration",
                    reason="backfilled from legacy can_self_publish boolean",
                    meta={"action": "self_publish"},
                )
        if user.can_edit_copy:
            existing = await session.execute(
                select(DelegationGrant).where(
                    DelegationGrant.grantee_id == user.id,
                    DelegationGrant.action == "edit_copy",
                    DelegationGrant.revoked_at.is_(None),
                )
            )
            if existing.scalar_one_or_none() is None:
                grant = DelegationGrant(
                    grantor_id=user.id,
                    grantee_id=user.id,
                    entity_id=None,
                    action="edit_copy",
                    granted_at=user.created_at or now,
                )
                session.add(grant)
                stats["edit_copy_grants_created"] += 1
                await log_moderation(
                    session,
                    action=ModerationAction.migrate_legacy_delegation,
                    target_type="user",
                    target_id=user.id,
                    actor_id=None,
                    actor_label="phase1_migration",
                    reason="backfilled from legacy can_edit_copy boolean",
                    meta={"action": "edit_copy"},
                )

    await session.commit()
    return stats
