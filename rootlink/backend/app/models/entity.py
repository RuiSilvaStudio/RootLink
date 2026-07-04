import enum
from datetime import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin

# Roles/permissions redesign — Phase 1 first slice.
# See docs/roles-permissions/ROLES_PERMISSIONS.md §3 and
# docs/roles-permissions/phase0-decisions.md (g) for the design this
# table implements. Backs `organization`/`partners`/`suppliers` entities only —
# `individual`/`professional`/`platform` are default/umbrella entities and do
# not get a row here (docs/roles-permissions/ROLES_PERMISSIONS.md §3, docs/roles-permissions/assessment.md §3.2).


class EntityKind(enum.StrEnum):
    organization = "organization"
    partners = "partners"
    suppliers = "suppliers"


class UserEntity(enum.StrEnum):
    """The 6 entities from docs/roles-permissions/ROLES_PERMISSIONS.md §3 that a user's `rank` is scoped to.

    Distinct from `EntityKind` above (which only enumerates the 3 kinds that
    back a real `entities` row) — `User.entity_kind` (see `models/user.py`)
    always records one of these 6 values, including the 3 that never get an
    `entities` row (`individual`/`professional`/`platform`). This column was
    identified as necessary during the Phase 1 data-migration slice: without
    it, a user with `entity_id IS NULL` is ambiguous between "individual",
    "professional", and "platform" — three different entities with three
    different rank ceilings (docs/roles-permissions/ROLES_PERMISSIONS.md §3's ceilings table) — which the
    `entity_id` FK alone can't disambiguate, since none of those three ever
    get an `entities` row. See
    docs/roles-permissions/phase0-decisions.md addendum.
    """

    individual = "individual"
    professional = "professional"
    organization = "organization"
    platform = "platform"
    partners = "partners"
    suppliers = "suppliers"


class EntityVerificationStatus(enum.StrEnum):
    pending = "pending"
    verified = "verified"
    rejected = "rejected"
    # Phase 5 addition (docs/roles-permissions/assessment.md §10a document-upload verification):
    # staff reviewed the submitted documents and need something more before
    # deciding either way — distinct from `rejected` (a final no) and
    # `pending` (not yet looked at). Additive, same bare-string-column
    # pattern as `AccountStatus.restricted` (docs/roles-permissions/phase0-decisions.md (c)) — no
    # migration needed, just the new enum member.
    more_info_requested = "more_info_requested"


class Entity(TimestampMixin, Base):
    __tablename__ = "entities"

    id: Mapped[int] = mapped_column(primary_key=True)
    entity_type: Mapped[str] = mapped_column(String(20))  # EntityKind value
    name: Mapped[str] = mapped_column(String(255))
    verification_status: Mapped[str] = mapped_column(
        String(20), default=EntityVerificationStatus.pending
    )
    verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    verified_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    # partners/suppliers only (docs/roles-permissions/ROLES_PERMISSIONS.md §3 "Partners/suppliers: primary contact");
    # nullable for organization entities, which use their own super-admin rank instead.
    primary_contact_user_id: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    tax_registration_id: Mapped[str | None] = mapped_column(String(50), nullable=True)
    tax_registration_scheme: Mapped[str | None] = mapped_column(String(20), nullable=True)
    dissolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    dissolution_grace_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    # Phase 4 (docs/roles-permissions/ROLES_PERMISSIONS.md §3 "Entity dissolution"): dissolution is
    # request-based when triggered by the entity's own super admin (needs
    # platform super admin approval, regardless of who triggered it), but
    # immediate when the platform super admin acts directly. These two nullable
    # fields hold the "awaiting platform review" pending state; `dissolved_at`
    # above is only ever set once approved+executed, never at request time.
    dissolution_requested_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    dissolution_requested_by: Mapped[int | None] = mapped_column(
        ForeignKey("users.id"), nullable=True
    )
    # Snapshot of {"members": {user_id: {"entity_kind":..,"rank":..}},
    # "content_ids": [...]} taken at the moment dissolution executes, so a
    # same-grace-window reversal (`reverse_dissolution`) can restore exactly
    # what was converted/archived — docs/roles-permissions/ROLES_PERMISSIONS.md §3 says dissolution is
    # "reversible within a 30-day grace period," which is meaningless without
    # recording what to reverse *to*.
    dissolution_snapshot: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    # Phase 4 addendum: docs/roles-permissions/ROLES_PERMISSIONS.md §3's "Cross-entity ban cascade" section
    # presupposes an entity itself can be "banned" (distinct from banning its
    # individual member users, which already exists at the User level) — no
    # such mechanism existed before this phase. Added here, deliberately
    # minimal/symmetric with `User`'s ban fields: this does NOT auto-ban the
    # entity's member users (that stays a separate, per-user admin action) and
    # does NOT run the dissolution lifecycle (no member conversion, no content
    # archival) — its only two effects are the audit record and triggering
    # the cross-entity footprint cascade-hide below. See docs/roles-permissions/phase0-decisions.md
    # addendum for the full reasoning.
    banned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ban_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    banned_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    # Separate from `dissolution_grace_expires_at` — an entity can be banned
    # without being dissolved, and docs/roles-permissions/ROLES_PERMISSIONS.md §3 gives the ban-triggered
    # cascade its own "same 30-day grace period" reversibility window.
    ban_cascade_grace_expires_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )


class DelegationGrant(TimestampMixin, Base):
    """Generalized action -> user ID delegation grant (docs/roles-permissions/ROLES_PERMISSIONS.md §10).

    Replaces the one-off `can_self_publish`/`can_edit_copy` booleans on `User`
    as a mechanism going forward. Migrating those two existing booleans into
    rows here is Phase 2+ work (docs/roles-permissions/assessment.md §3.1) — not done in this slice;
    the existing booleans are left untouched and working.
    """

    __tablename__ = "delegation_grants"

    id: Mapped[int] = mapped_column(primary_key=True)
    grantor_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    grantee_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    # Nullable = platform-wide grant (docs/roles-permissions/ROLES_PERMISSIONS.md §10's platform table).
    entity_id: Mapped[int | None] = mapped_column(ForeignKey("entities.id"), nullable=True)
    # Free string for now — references the Phase 2 permissions registry once
    # it exists (docs/roles-permissions/phase0-decisions.md (d)); not FK-constrained yet.
    action: Mapped[str] = mapped_column(String(100))
    granted_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    revoked_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)


class EntityDocument(TimestampMixin, Base):
    """Verification document uploaded for an `entities` row — Phase 5
    (docs/roles-permissions/assessment.md §10a, promoted into v1 scope: document-upload +
    human-review verification, replacing the bare admin's-word toggle).

    Deliberately a **separate, minimal storage path** from
    `app.models.image_asset.ImageAsset`/`app.services.image_storage` rather
    than reusing that pipeline outright: the existing image pipeline forces
    every upload through Pillow (`process_image_async`) and re-encodes it to
    WebP, which is correct for photos but actively wrong for a PDF business
    registration certificate (Pillow cannot open one, and re-encoding a legal
    document into a lossy image format would be a data-integrity bug, not
    just a missed optimization). `app.services.document_storage` reuses the
    same *architectural pattern* instead — content-addressed (sha256) local
    filesystem storage, one row per stored file — without forcing the
    image-specific resize/re-encode step, per this session's own instruction
    to reuse existing patterns rather than invent an unrelated one from
    scratch.
    """

    __tablename__ = "entity_documents"

    id: Mapped[int] = mapped_column(primary_key=True)
    entity_id: Mapped[int] = mapped_column(ForeignKey("entities.id"))
    uploaded_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    filename: Mapped[str] = mapped_column(String(255))
    content_type: Mapped[str] = mapped_column(String(100))
    size_bytes: Mapped[int] = mapped_column()
    storage_path: Mapped[str] = mapped_column(String(500))
    sha256: Mapped[str] = mapped_column(String(64))
    # Set by staff when requesting more info or rejecting — surfaced back to
    # the applicant so they know what's missing from THIS document
    # specifically (as opposed to the entity-level `verification_status`'s
    # own reason, which is the overall decision's reason).
    review_note: Mapped[str | None] = mapped_column(String(1000), nullable=True)
