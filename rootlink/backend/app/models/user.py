import enum
from datetime import UTC, datetime

from sqlalchemy import JSON, Boolean, DateTime, Float, ForeignKey, Integer, String, Text
from sqlalchemy import Enum as SAEnum
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class UserRole(enum.StrEnum):
    super_admin = "super_admin"
    admin = "admin"
    moderator = "moderator"
    contributor = "contributor"
    user = "user"


class AccountStatus(enum.StrEnum):
    active = "active"
    # Roles/permissions redesign Phase 4 (docs/roles-permissions/ROLES_PERMISSIONS.md §4, docs/roles-permissions/phase0-decisions.md
    # (c)): the 4th enforcement-ladder rung. Full read/write access retained;
    # future content submissions are forced back to `in_review` regardless of
    # any trusted-publisher badge. Purely additive — `account_status` was
    # already a bare, un-enum-enforced `String(20)` column (docs/roles-permissions/assessment.md
    # §3.1), so no DB migration is needed for this new value, only this enum
    # member. Existing `active`/`suspended`/`banned` behavior is untouched.
    restricted = "restricted"
    suspended = "suspended"
    banned = "banned"


class AccountType(enum.StrEnum):
    individual = "individual"
    organization = "organization"
    practitioner = "practitioner"


class OrganizationKind(enum.StrEnum):
    """Sub-classification *of* an `organization`-type `account_type` row (e.g.
    "ipss", "cooperative", ...). Renamed from `EntityType` (Phase 0 decision
    (f), docs/roles-permissions/phase0-decisions.md) to avoid
    colliding with the roles/permissions redesign's own "entity" concept
    (`entity_id`/`rank` below, backed by `app.models.entity.Entity`) — this
    enum/column is unrelated to that and only ever describes an organization
    sub-kind, never the new entity/rank model.
    """

    ipss = "ipss"
    cooperative = "cooperative"
    association = "association"
    cer = "cer"
    ministry = "ministry"
    regulatory = "regulatory"
    adr = "adr"
    municipality = "municipality"
    company = "company"
    other = "other"


class User(TimestampMixin, Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(primary_key=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(255))
    password_hash: Mapped[str] = mapped_column(String(255))
    bio: Mapped[str | None] = mapped_column(Text, nullable=True)
    location: Mapped[str | None] = mapped_column(String(255), nullable=True)
    lat: Mapped[float | None] = mapped_column(Float, nullable=True)
    lng: Mapped[float | None] = mapped_column(Float, nullable=True)
    skills: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    interests: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    avatar_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    role: Mapped[UserRole] = mapped_column(SAEnum(UserRole), default=UserRole.user)
    visible_in_network: Mapped[bool] = mapped_column(Boolean, default=True)
    locale: Mapped[str | None] = mapped_column(String(10), nullable=True, default=None)

    # Account type & entity fields
    account_type: Mapped[str] = mapped_column(String(20), default="individual")
    # Organization sub-kind (ipss/cooperative/...). Renamed from `entity_type`
    # to `organization_kind` (Phase 0 decision (f)) — see `OrganizationKind`
    # above. The DB column itself was also renamed (main.py lifespan
    # migration); the external `/api/auth/register` and `/api/users/entities`
    # field name `entity_type` is kept unchanged at the API boundary.
    organization_kind: Mapped[str | None] = mapped_column(String(50), nullable=True)
    registration_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    # Roles/permissions redesign Phase 4 (docs/roles-permissions/ROLES_PERMISSIONS.md §2 "Verified
    # professional": NIF/tax ID + activity registration number + verified
    # email). `registration_number` above already exists and is reused as the
    # tax/business registration ID; there was no existing column for the
    # *second*, distinct "activity registration number" the definition also
    # requires, so this is a new, additive field — surfaced while building
    # the individual->professional entity-conversion endpoint (Phase 4 item
    # 3). See docs/roles-permissions/phase0-decisions.md addendum for why this wasn't just folded
    # into `registration_number` (two distinct real-world IDs, not one).
    activity_registration_number: Mapped[str | None] = mapped_column(String(50), nullable=True)
    services: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    service_area: Mapped[str | None] = mapped_column(String(255), nullable=True)
    certifications: Mapped[list[str] | None] = mapped_column(JSON, nullable=True)
    modality: Mapped[str | None] = mapped_column(String(255), nullable=True)
    is_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    verified_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Roles/permissions redesign — Phase 2, per Phase 0 decision (g)
    # (docs/roles-permissions/phase0-decisions.md): "Verified user"
    # (docs/roles-permissions/ROLES_PERMISSIONS.md §2: email OR referral OR org-created) is distinct from
    # the existing `is_verified` (repurposed for "Verified professional"/
    # "Verified organization" per the same decision) — a single boolean
    # couldn't represent all three concepts. This is the first of the three
    # to get its own field; referral/org-created paths aren't modeled yet.
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    email_verified_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Roles/permissions redesign — Phase 1 first slice (additive only; no
    # existing rows are migrated onto these yet, see
    # docs/roles-permissions/phase0-decisions.md (b)).
    # `entity_id` is null for `individual`/`professional`/`platform` users
    # (those don't get an `entities` row, docs/roles-permissions/ROLES_PERMISSIONS.md §3) and set for
    # `organization`/`partners`/`suppliers` users. `rank` is the new 0-5
    # per-entity rank (docs/roles-permissions/ROLES_PERMISSIONS.md §5), replacing `role`'s job going
    # forward — `role` itself is untouched and still authoritative until a
    # later phase cuts enforcement over.
    entity_id: Mapped[int | None] = mapped_column(ForeignKey("entities.id"), nullable=True)
    rank: Mapped[int | None] = mapped_column(Integer, nullable=True)
    # Which of the 6 docs/roles-permissions/ROLES_PERMISSIONS.md §3 entities this user's `rank` is scoped
    # to (`UserEntity` in app.models.entity) — added during the Phase 1 data
    # migration slice to disambiguate individual/professional/platform users,
    # none of whom get an `entities` row (so `entity_id` alone can't tell
    # them apart). Null until the migration in `app.services.roles_migration`
    # runs (idempotent, guarded — see main.py's lifespan).
    entity_kind: Mapped[str | None] = mapped_column(String(20), nullable=True)

    website_url: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    feed_url: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    feed_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    feed_verification_token: Mapped[str | None] = mapped_column(String(255), nullable=True)
    feed_last_crawled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    feed_priority: Mapped[int] = mapped_column(Integer, default=3)

    boost_active: Mapped[bool] = mapped_column(Boolean, default=False)
    boost_expires_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)

    # Content platform: trusted-author self-publish (see docs/content-platform/CONTENT_PLATFORM.md §3).
    # Still the live, unchanged mechanism — the roles/permissions redesign
    # backfills a mirror row into `delegation_grants` for this flag (Phase 1,
    # see `app.services.roles_migration.migrate_legacy_delegations`) but does
    # not yet read from there for enforcement, so this boolean is still
    # authoritative; docs/roles-permissions/ROLES_PERMISSIONS.md §2's
    # "Trusted user"/"Trusted publisher" concepts describe the same idea in
    # the new spec's terms, for whenever a future phase cuts this over.
    can_self_publish: Mapped[bool] = mapped_column(Boolean, default=False)
    self_publish_agreed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    # Content platform: editable site copy permission (§12) — the site-copy
    # feature itself is still CONTENT_PLATFORM.md §12's domain, unaffected by
    # the roles/permissions redesign. The *permission model* for granting
    # this specifically now also has a spot in
    # docs/roles-permissions/ROLES_PERMISSIONS.md §10 ("Edit Platform UI
    # content", a platform-wide delegable action) — not yet wired up as the
    # enforcement path; this boolean remains authoritative for now.
    can_edit_copy: Mapped[bool] = mapped_column(Boolean, default=False)

    # Content platform: account enforcement ladder (§4.4) — superseded by the
    # roles/permissions redesign's 4-rung ladder (Active / Restriction /
    # Suspended / Banned), see docs/roles-permissions/ROLES_PERMISSIONS.md §4.
    # This field is the same one both specs share: Phase 4 added the
    # `restricted` value onto this exact column (see `AccountStatus` above),
    # it was not a new field.
    account_status: Mapped[str] = mapped_column(String(20), default=AccountStatus.active)
    suspended_until: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    banned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    ban_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    banned_by: Mapped[int | None] = mapped_column(Integer, nullable=True)

    @property
    def entity_type(self) -> str | None:
        """Read-only backward-compat alias for `organization_kind`.

        Kept only so external API responses that still use the field name
        `entity_type` (e.g. `UserResponse.entity_type`, pydantic
        `from_attributes` serialization) don't need every call site changed —
        see docs/roles-permissions/phase0-decisions.md (f). New code
        should read/write `organization_kind` directly; this is not a
        SQLAlchemy-queryable attribute (use `User.organization_kind` in
        `select()`/`where()` clauses, not `User.entity_type`).
        """
        return self.organization_kind

    @property
    def is_banned(self) -> bool:
        return self.account_status == AccountStatus.banned

    @property
    def is_restricted(self) -> bool:
        """Phase 4 restriction rung (docs/roles-permissions/ROLES_PERMISSIONS.md §4). Full read/write access
        is retained (see `can_author` below, deliberately unaffected) — this
        only gates *authoring trust* (self-publish bypass) at call sites like
        `app/api/articles.py`'s publish/update-published trust checks, which
        must force `in_review` regardless of rank or the `can_self_publish`
        badge while this is true."""
        return self.account_status == AccountStatus.restricted

    @property
    def is_suspended(self) -> bool:
        """True only while a suspension is active (auto-expires at suspended_until)."""
        if self.account_status != AccountStatus.suspended:
            return False
        if self.suspended_until is None:
            return True
        until = self.suspended_until
        if until.tzinfo is None:
            until = until.replace(tzinfo=UTC)
        return until > datetime.now(UTC)

    @property
    def can_author(self) -> bool:
        """Whether the user may currently create/edit content or comment."""
        return not self.is_banned and not self.is_suspended
