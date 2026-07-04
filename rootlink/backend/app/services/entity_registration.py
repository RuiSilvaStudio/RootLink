"""Entity self-service registration + verification review (docs/roles-permissions/ROLES_PERMISSIONS.md §3
"How entities are created" + docs/roles-permissions/assessment.md §5.2/§10a). Phase 5.

**Distinct from `app.services.entity_conversion`.** Conversion is an
*existing user* switching their own entity kind (`individual`->`professional`,
`professional`->`organization`) and is immediate/self-service per Phase 4's
own judgment call (see that module's docstring — there's nobody local to
approve a brand-new entity's very first assignment). Registration here is
the *other* half docs/roles-permissions/ROLES_PERMISSIONS.md §3 describes: "`organization`, `partners`,
and `suppliers` are created either by the platform super admin directly, or
via a self-service registration page (which then needs verification, per
above)." A registered-but-unverified entity "cannot create users under it
yet; its owner is treated as a plain persona until verification succeeds" —
so registration and verification are two distinct steps here, unlike
conversion's single immediate step.

**Bootstrap timing judgment call:** the registrant is NOT assigned the
entity's top rank (`super_admin` for organization, persona for
partners/suppliers) at registration time — only once a platform admin
approves verification. This is the literal reading of docs/roles-permissions/ROLES_PERMISSIONS.md §3's
"cannot create users under it yet... treated as a plain persona until
verification succeeds," and mirrors Phase 4's entity-dissolution pattern of
two distinct states (`request` vs `approve/execute`) rather than one
immediate step. `Entity.primary_contact_user_id` is repurposed during the
pending window to mean "the user who registered this entity and will be
bootstrapped into it on verification" — for `organization` entities this is
a temporary meaning (post-verification, that field goes back to being
unused/null-equivalent for organizations per its own original docstring,
since organizations use their super-admin rank instead of a primary-contact
designation); for `partners`/`suppliers` it's exactly the field's intended
long-term meaning already (docs/roles-permissions/ROLES_PERMISSIONS.md §3 "Partners/suppliers: primary
contact"), so no rename/second field was needed — see docs/roles-permissions/phase0-decisions.md's
Phase 5 addendum for the full reasoning.
"""

from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.entity import Entity, EntityVerificationStatus
from app.models.moderation import ModerationAction
from app.models.user import User
from app.services.audit import log_moderation

_REGISTERABLE_KINDS = ("organization", "partners", "suppliers")


class EntityRegistrationError(Exception):
    def __init__(self, detail: str):
        self.detail = detail
        super().__init__(detail)


async def register_entity(
    db: AsyncSession,
    registrant: User,
    *,
    entity_type: str,
    name: str,
    tax_registration_id: str | None = None,
    tax_registration_scheme: str | None = None,
) -> Entity:
    if entity_type not in _REGISTERABLE_KINDS:
        raise EntityRegistrationError(
            f"entity_type must be one of {_REGISTERABLE_KINDS}"
        )
    if not name or not name.strip():
        raise EntityRegistrationError("A name is required")
    if registrant.entity_id is not None:
        raise EntityRegistrationError(
            "You already belong to an entity — dissolve/leave it before registering a new one"
        )

    entity = Entity(
        entity_type=entity_type,
        name=name.strip(),
        verification_status=EntityVerificationStatus.pending,
        primary_contact_user_id=registrant.id,
        tax_registration_id=tax_registration_id,
        tax_registration_scheme=tax_registration_scheme,
    )
    db.add(entity)
    await db.flush()

    await log_moderation(
        db, action=ModerationAction.register_entity, target_type="entity", target_id=entity.id,
        actor_id=registrant.id, meta={"entity_type": entity_type, "name": entity.name},
    )
    return entity


def _bootstrap_registrant(entity: Entity, registrant: User) -> None:
    """Bootstrapping a new entity (docs/roles-permissions/ROLES_PERMISSIONS.md §3) — no approval step
    beyond the verification decision itself, since nobody outranks the
    registrant locally in a brand-new entity."""
    registrant.entity_kind = entity.entity_type
    registrant.entity_id = entity.id
    registrant.rank = 5 if entity.entity_type == "organization" else 1


async def approve_verification(
    db: AsyncSession, approver: User, entity: Entity, *, reason: str | None = None,
) -> Entity:
    if entity.entity_type not in _REGISTERABLE_KINDS:
        raise EntityRegistrationError("Not a registerable entity type")
    if entity.verification_status == EntityVerificationStatus.verified:
        raise EntityRegistrationError("Entity is already verified")

    entity.verification_status = EntityVerificationStatus.verified
    entity.verified_at = datetime.now(UTC)
    entity.verified_by = approver.id

    registrant = None
    if entity.primary_contact_user_id is not None:
        registrant = await db.get(User, entity.primary_contact_user_id)
    if registrant is not None and registrant.entity_id is None:
        _bootstrap_registrant(entity, registrant)

    await log_moderation(
        db, action=ModerationAction.verify_entity, target_type="entity", target_id=entity.id,
        actor_id=approver.id, reason=reason,
        meta={"registrant_id": entity.primary_contact_user_id},
    )
    return entity


async def reject_verification(
    db: AsyncSession, approver: User, entity: Entity, *, reason: str | None = None,
) -> Entity:
    if entity.verification_status == EntityVerificationStatus.verified:
        raise EntityRegistrationError("Cannot reject an already-verified entity")
    entity.verification_status = EntityVerificationStatus.rejected
    await log_moderation(
        db, action=ModerationAction.reject_entity_verification, target_type="entity",
        target_id=entity.id, actor_id=approver.id, reason=reason,
    )
    return entity


async def request_more_info(
    db: AsyncSession, approver: User, entity: Entity, *, reason: str | None = None,
) -> Entity:
    if entity.verification_status == EntityVerificationStatus.verified:
        raise EntityRegistrationError("Cannot request more info for an already-verified entity")
    entity.verification_status = EntityVerificationStatus.more_info_requested
    await log_moderation(
        db, action=ModerationAction.request_entity_more_info, target_type="entity",
        target_id=entity.id, actor_id=approver.id, reason=reason,
    )
    return entity
