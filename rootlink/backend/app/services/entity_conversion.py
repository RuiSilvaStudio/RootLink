"""Entity conversion (docs/roles-permissions/ROLES_PERMISSIONS.md §3 "Entity conversion (lifecycle)").

Entity-type conversion is one-way and self-service (see "Self-service only"
below):
- `individual` -> `professional` — requires "Verified professional" (§2).
- `professional` -> `individual` — the reverse direction (added post-Phase-6,
  docs/roles-permissions/phase0-decisions.md Addendum 5). No eligibility
  criteria beyond currently being `professional` — converting DOWN never
  needs to re-verify anything.
- `professional` -> `organization` — bootstraps a brand-new `organization`
  entity, the converting user becomes its first super admin (§3
  "Bootstrapping a new entity" — no approval step). **Untouched by the
  Addendum 5 rank-cap rule below** — this direction's bootstrap-to-super-
  admin(5) logic is a different case (a brand-new entity being founded, not
  a rank comparison between two existing ceilings) and stays exactly as
  Phase 4 shipped it.

On conversion: content ownership persists (tracked by user ID, untouched
here); badges (`is_verified`/"verified", `can_self_publish`/"trusted
publisher") are never carried over — must be re-earned/re-verified under the
new entity's own criteria; the conversion is logged as an audit event.

**Self-service only.** Every function here takes the acting `User` row
directly (`user`/`current_user`) — there is no `user_id` parameter anywhere
in this module or `app/api/entity_conversion.py`'s request schemas
(`app/schemas/entity.py`), and no admin-triggered conversion path exists.
The only way to reach any of these functions is
`Depends(get_current_user)` resolving the caller's own row — confirmed by
reading every call site, not assumed (docs/roles-permissions/phase0-decisions.md Addendum 5).

**Rank rule for `individual` <-> `professional` (both directions) — decided
post-Phase-6 (docs/roles-permissions/phase0-decisions.md Addendum 5),
replacing this module's original "rank always resets to persona(1)"
behavior for these two directions specifically:** rank is **preserved
as-is** if it already fits within the destination entity's ceiling,
otherwise **capped down** to that ceiling (never reset to 1 outright). Since
`individual`'s ceiling is contributor(2) and `professional`'s ceiling is
admin(4), `individual` -> `professional` always preserves rank unchanged (1
or 2 always fits in 1-4). `professional` -> `individual` preserves rank 1/2
unchanged but caps rank 3 (moderator) or 4 (admin) down to 2 (contributor) —
never silently discarding standing beyond what the destination can actually
hold. See `_preserve_or_cap_rank`/`_projected_state_individual_professional`
below — the same helper computes both the real conversion's mutation AND
`compute_conversion_preview`'s dry-run projection, so the two can never
drift apart.

**Judgment call (see docs/roles-permissions/phase0-decisions.md addendum):** docs/roles-permissions/ROLES_PERMISSIONS.md
describes conversion as "request-based," which elsewhere in this same
document (§6) means a submit/approve workflow. But §3's own "Bootstrapping a
new entity" rule says the person completing an entity's
registration/verification is assigned that entity's top rank "with no
approval step" — because a brand-new entity needs *somebody* able to act,
and nobody outranks them yet locally. Individual->professional (and its
reverse) conversion is not a bootstrap-to-top-rank case — professional never
gets its own `entities` row, so there's no "new entity" to bootstrap an
admin for — while professional->organization *is* a bootstrap case (a real
new `entities` row, needing its first super admin). All three are therefore
implemented as immediate, self-service, one-shot endpoints once the stated
eligibility criteria are met — not a separate pending-request record — since
that's what docs/roles-permissions/ROLES_PERMISSIONS.md's own bootstrapping rule already resolves for the
"who approves the very first assignment" question these particular
conversions raise.
"""

from datetime import UTC, datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.core.entity_resolution import ENTITY_CEILING, resolve_entity_and_rank
from app.models.entity import Entity, EntityVerificationStatus
from app.models.moderation import ModerationAction
from app.models.user import User
from app.services.audit import log_moderation

# Mirrors docs/roles-permissions/ROLES_PERMISSIONS.md §5's rank table — used only for the preview
# endpoint's human-readable labels, never for any enforcement decision.
_RANK_LABELS: dict[int, str] = {
    0: "Visitor", 1: "Persona", 2: "Contributor", 3: "Moderator", 4: "Admin", 5: "Super Admin",
}


def _rank_label(rank: int | None) -> str | None:
    if rank is None:
        return None
    return _RANK_LABELS.get(rank, str(rank))


class ConversionError(Exception):
    def __init__(self, detail: str):
        self.detail = detail
        super().__init__(detail)


def _preserve_or_cap_rank(current_rank: int, destination_ceiling: int) -> int:
    """docs/roles-permissions/phase0-decisions.md Addendum 5's rank rule: preserved as-is if it
    already fits the destination entity's ceiling, otherwise capped DOWN to
    that ceiling — never reset to persona(1) and never raised."""
    return current_rank if current_rank <= destination_ceiling else destination_ceiling


def _projected_state_individual_professional(user: User, direction: str) -> dict:
    """The field -> new-value mapping the `individual`<->`professional`
    conversion directions apply, computed but NOT applied to `user`. Shared
    by the real conversion functions below (which apply it) and
    `compute_conversion_preview` (which only reports it) so the two can
    never drift apart — see this module's own docstring, Addendum 5.
    """
    from_rank = user.rank if user.rank is not None else 1

    if direction == "to_professional":
        return {
            "entity_kind": "professional",
            "entity_id": None,
            "rank": _preserve_or_cap_rank(from_rank, ENTITY_CEILING["professional"]),
            # "Verified professional" is earned HERE, by this conversion
            # step's own eligibility check (email_verified + both
            # registration IDs present) — not "carried over" from the
            # individual entity (which never had a meaningful is_verified
            # value for this concept, docs/roles-permissions/phase0-decisions.md (g)).
            "is_verified": True,
            # Badges are not carried over (docs/roles-permissions/ROLES_PERMISSIONS.md §3).
            "can_self_publish": False,
            "self_publish_agreed_at": None,
        }
    if direction == "to_individual":
        return {
            "entity_kind": "individual",
            "entity_id": None,
            "rank": _preserve_or_cap_rank(from_rank, ENTITY_CEILING["individual"]),
            # Badges are not carried over (docs/roles-permissions/ROLES_PERMISSIONS.md §3) — same rule
            # applied in the reverse direction as professional->organization
            # already applies going forward.
            "is_verified": False,
            "verified_at": None,
            "can_self_publish": False,
            "self_publish_agreed_at": None,
        }
    raise ValueError(f"Unsupported direction: {direction!r}")


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
    from_rank = user.rank if user.rank is not None else 1

    changes = _projected_state_individual_professional(user, "to_professional")
    for field, value in changes.items():
        setattr(user, field, value)
    # Fields specific to THIS direction's eligibility check, not part of the
    # shared cap-rule projection (professional->individual has no equivalent
    # registration data to set).
    user.registration_number = tax_registration_id
    user.activity_registration_number = activity_registration_number
    user.verified_at = datetime.now(UTC)

    await log_moderation(
        db, action=ModerationAction.convert_entity, target_type="user", target_id=user.id,
        actor_id=user.id,
        meta={"from_entity_kind": from_entity_kind, "from_rank": from_rank,
              "to_entity_kind": "professional", "to_rank": user.rank},
    )
    return user


async def convert_professional_to_individual(db: AsyncSession, user: User) -> User:
    """The reverse of `convert_individual_to_professional` — added post-Phase-6
    (docs/roles-permissions/phase0-decisions.md Addendum 5). No eligibility
    criteria beyond currently being `professional`: converting DOWN to a
    lower-ceiling entity never needs re-verification, unlike converting up.
    Rank is preserved-or-capped per `_preserve_or_cap_rank`, NOT reset to
    persona(1) — see this module's docstring.
    """
    if user.entity_kind != "professional":
        raise ConversionError("Only professional accounts may convert to individual")

    from_rank = user.rank if user.rank is not None else 1

    changes = _projected_state_individual_professional(user, "to_individual")
    for field, value in changes.items():
        setattr(user, field, value)

    await log_moderation(
        db, action=ModerationAction.convert_entity, target_type="user", target_id=user.id,
        actor_id=user.id,
        meta={"from_entity_kind": "professional", "from_rank": from_rank,
              "to_entity_kind": "individual", "to_rank": user.rank},
    )
    return user


# --- Mandatory live preview / dry-run (docs/roles-permissions/phase0-decisions.md Addendum 5,
# decision 2's "before vs. after" comparison + explicit consent requirement) ---

# Fields, beyond entity_kind/entity_id/rank themselves, worth showing in the
# comparison — deliberately a plain list of real `User` attribute names (not
# a hand-copied static example) so a future field added to this list
# automatically shows up in both `current` and `projected` without any other
# code changing. Covers every badge/flag named in the decision explicitly
# (`can_self_publish`, `can_edit_copy`, `is_verified`) plus the other
# account-state fields relevant to what the user actually holds right now.
PREVIEW_FIELDS: tuple[str, ...] = (
    "is_verified", "verified_at",
    "can_self_publish", "self_publish_agreed_at",
    "can_edit_copy",
    "email_verified",
    "registration_number", "activity_registration_number",
    "account_status",
)


def _snapshot(user: User, *, entity_kind: str | None, entity_id: int | None, rank: int | None) -> dict:
    snap = {field: getattr(user, field, None) for field in PREVIEW_FIELDS}
    snap["entity_kind"] = entity_kind
    snap["entity_id"] = entity_id
    snap["rank"] = rank
    snap["rank_label"] = _rank_label(rank)
    return snap


def compute_conversion_preview(user: User, to: str) -> dict:
    """Dry-run: computes the REAL current state and REAL projected
    post-conversion state for `to` in {"individual", "professional"} —
    powers `GET /api/entity-conversion/preview`. Never mutates `user` or
    touches the DB; reuses the exact same
    `_projected_state_individual_professional` mapping the real conversion
    functions apply, so preview can never silently drift from what actually
    happens on confirm.
    """
    current_entity_kind, current_rank = resolve_entity_and_rank(user)

    if to == "professional":
        if current_entity_kind != "individual":
            raise ConversionError(
                f"Only individual accounts may preview conversion to professional "
                f"(current: {current_entity_kind})"
            )
        direction = "to_professional"
    elif to == "individual":
        if current_entity_kind != "professional":
            raise ConversionError(
                f"Only professional accounts may preview conversion to individual "
                f"(current: {current_entity_kind})"
            )
        direction = "to_individual"
    else:
        raise ConversionError("Preview only supports to=individual or to=professional")

    changes = _projected_state_individual_professional(user, direction)

    current = _snapshot(user, entity_kind=current_entity_kind, entity_id=user.entity_id, rank=current_rank)
    projected = dict(current)
    projected.update(changes)
    projected["rank_label"] = _rank_label(projected["rank"])

    return {
        "to": to,
        "current": current,
        "projected": projected,
        "rank_capped": projected["rank"] < current["rank"],
    }


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
