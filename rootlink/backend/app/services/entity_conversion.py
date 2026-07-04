"""Entity conversion (docs/roles-permissions/ROLES_PERMISSIONS.md §3 "Entity conversion (lifecycle)").

Entity-type conversion is one-way and request-based:
- `individual` -> `professional` — requires "Verified professional" (§2).
- `professional` -> `organization` — bootstraps a brand-new `organization`
  entity, the converting user becomes its first super admin (§3
  "Bootstrapping a new entity" — no approval step).

On conversion: content ownership persists (tracked by user ID, untouched
here), rank resets to persona in the new entity, badges are not carried
over, and the conversion is logged as an audit event.

**Judgment call (see docs/roles-permissions/phase0-decisions.md addendum):** docs/roles-permissions/ROLES_PERMISSIONS.md
describes conversion as "request-based," which elsewhere in this same
document (§6) means a submit/approve workflow. But §3's own "Bootstrapping a
new entity" rule says the person completing an entity's
registration/verification is assigned that entity's top rank "with no
approval step" — because a brand-new entity needs *somebody* able to act,
and nobody outranks them yet locally. Individual->professional conversion
resets to persona (not a bootstrap-to-top-rank case — professional never
gets its own `entities` row, so there's no "new entity" to bootstrap an
admin for), while professional->organization *is* a bootstrap case (a real
new `entities` row, needing its first super admin). Both are therefore
implemented as immediate, self-service, one-shot endpoints once the stated
eligibility criteria are met — not a separate pending-request record — since
that's what docs/roles-permissions/ROLES_PERMISSIONS.md's own bootstrapping rule already resolves for the
"who approves the very first assignment" question these particular
conversions raise.
"""

from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.entity import Entity, EntityVerificationStatus
from app.models.moderation import ModerationAction
from app.models.user import User
from app.services.audit import log_moderation


class ConversionError(Exception):
    def __init__(self, detail: str):
        self.detail = detail
        super().__init__(detail)


async def convert_individual_to_professional(
    db: AsyncSession,
    user: User,
    *,
    tax_registration_id: str,
    activity_registration_number: str,
) -> User:
    if user.entity_kind not in (None, "individual"):
        raise ConversionError("Only individual accounts may convert to professional")
    if not user.email_verified:
        raise ConversionError(
            "Email must be verified before converting to professional (docs/roles-permissions/ROLES_PERMISSIONS.md §2)"
        )
    if not tax_registration_id or not activity_registration_number:
        raise ConversionError(
            "Both a tax/business registration ID and an activity registration number are required"
        )

    from_entity_kind = user.entity_kind or "individual"
    from_rank = user.rank

    user.registration_number = tax_registration_id
    user.activity_registration_number = activity_registration_number
    user.entity_kind = "professional"
    user.entity_id = None
    # Rank resets to persona in the new entity (docs/roles-permissions/ROLES_PERMISSIONS.md §3) — earned
    # fresh, not carried over.
    user.rank = 1
    # "Verified professional" is earned HERE, by this conversion step's own
    # check above (email_verified + both registration IDs present) — this is
    # not "carrying over" a badge from the individual entity (which never had
    # a meaningful is_verified value for this concept, per
    # docs/roles-permissions/phase0-decisions.md (g)); it's a fresh verification under the new
    # entity's own criteria.
    user.is_verified = True
    user.verified_at = datetime.now(UTC)
    # Badges are not carried over (docs/roles-permissions/ROLES_PERMISSIONS.md §3).
    user.can_self_publish = False
    user.self_publish_agreed_at = None

    await log_moderation(
        db, action=ModerationAction.convert_entity, target_type="user", target_id=user.id,
        actor_id=user.id,
        meta={"from_entity_kind": from_entity_kind, "from_rank": from_rank,
              "to_entity_kind": "professional", "to_rank": 1},
    )
    return user


async def convert_professional_to_organization(
    db: AsyncSession, user: User, *, organization_name: str
) -> tuple[User, Entity]:
    if user.entity_kind != "professional":
        raise ConversionError("Only professional accounts may convert to organization")
    if not organization_name or not organization_name.strip():
        raise ConversionError("An organization name is required")

    from_rank = user.rank

    entity = Entity(
        entity_type="organization",
        name=organization_name.strip(),
        verification_status=EntityVerificationStatus.pending,
    )
    db.add(entity)
    await db.flush()  # need entity.id before assigning it to the user

    user.entity_kind = "organization"
    user.entity_id = entity.id
    # Bootstrapping a new entity (docs/roles-permissions/ROLES_PERMISSIONS.md §3): the converting user
    # becomes the new organization's first super admin, no approval step.
    user.rank = 5
    # Badges are not carried over (docs/roles-permissions/ROLES_PERMISSIONS.md §3) — a professional's trust
    # track record doesn't automatically transfer to the brand-new org.
    user.is_verified = False
    user.verified_at = None
    user.can_self_publish = False
    user.self_publish_agreed_at = None

    await log_moderation(
        db, action=ModerationAction.convert_entity, target_type="user", target_id=user.id,
        actor_id=user.id,
        meta={"from_entity_kind": "professional", "from_rank": from_rank,
              "to_entity_kind": "organization", "to_rank": 5, "entity_id": entity.id,
              "entity_name": entity.name},
    )
    return user, entity
