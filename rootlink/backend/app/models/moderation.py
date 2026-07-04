import enum

from sqlalchemy import JSON, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class ModerationAction(enum.StrEnum):
    # Content lifecycle transitions
    submit = "submit"
    approve = "approve"
    reject = "reject"
    needs_changes = "needs_changes"
    appeal = "appeal"
    edit_any = "edit_any"  # super_admin editing content in any state
    # Automated scan outcomes (§7)
    auto_allow = "auto_allow"
    auto_review = "auto_review"
    auto_block = "auto_block"
    # Trust (CONTENT_PLATFORM.md §3 — self_publish/edit_copy grants are still
    # that legacy, unchanged mechanism, see models/user.py's field comments)
    # / enforcement ladder (originally CONTENT_PLATFORM.md §4.4; the ladder
    # itself is now superseded by docs/roles-permissions/ROLES_PERMISSIONS.md
    # §4's 4-rung ladder — restrict/lift_restriction, demote/promote, and
    # suspend/ban all now flow through that spec's rules, sharing this same
    # audit action set).
    grant_self_publish = "grant_self_publish"
    revoke_self_publish = "revoke_self_publish"
    grant_edit_copy = "grant_edit_copy"
    revoke_edit_copy = "revoke_edit_copy"
    demote = "demote"
    promote = "promote"
    restrict = "restrict"
    lift_restriction = "lift_restriction"
    suspend = "suspend"
    lift_suspension = "lift_suspension"
    ban = "ban"
    unban = "unban"
    # Roles/permissions redesign — Phase 1 data migration
    # (docs/roles-permissions/phase0-decisions.md (b)): one-time,
    # idempotent backfill of `entity_id`/`rank`/`entity_kind` and of the
    # legacy `can_self_publish`/`can_edit_copy` booleans into
    # `delegation_grants`. Logged as system actions (actor_id=None) so the
    # backfill itself has an audit trail, per docs/roles-permissions/ROLES_PERMISSIONS.md §1's
    # log-everything baseline rule.
    migrate_entity_rank = "migrate_entity_rank"
    migrate_legacy_delegation = "migrate_legacy_delegation"
    # Phase 2 baseline auth endpoints (docs/roles-permissions/ROLES_PERMISSIONS.md §1/§7 force-logout rows).
    revoke_own_sessions = "revoke_own_sessions"
    revoke_user_sessions = "revoke_user_sessions"
    # Phase 4 — entity conversion/dissolution/cascade + promote-demote
    # request workflow (docs/roles-permissions/ROLES_PERMISSIONS.md §3, §6; docs/roles-permissions/phase0-decisions.md (c)/(h)).
    convert_entity = "convert_entity"
    request_dissolution = "request_dissolution"
    approve_dissolution = "approve_dissolution"
    reject_dissolution = "reject_dissolution"
    dissolve_entity = "dissolve_entity"
    reverse_dissolution = "reverse_dissolution"
    ban_entity = "ban_entity"
    unban_entity = "unban_entity"
    cascade_hide = "cascade_hide"
    cascade_restore = "cascade_restore"
    request_role_change = "request_role_change"
    approve_role_change = "approve_role_change"
    reject_role_change = "reject_role_change"
    # Phase 5 — new UI surfaces + their small additive backend endpoints
    # (docs/roles-permissions/roadmap.md Phase 5): entity
    # self-registration/verification (docs/roles-permissions/assessment.md §5.2, §10a), delegation
    # grant CRUD (docs/roles-permissions/ROLES_PERMISSIONS.md §10), partners/suppliers primary-contact
    # roster management (docs/roles-permissions/ROLES_PERMISSIONS.md §3).
    register_entity = "register_entity"
    verify_entity = "verify_entity"
    reject_entity_verification = "reject_entity_verification"
    request_entity_more_info = "request_entity_more_info"
    upload_entity_document = "upload_entity_document"
    grant_delegation = "grant_delegation"
    revoke_delegation = "revoke_delegation"
    add_team_member = "add_team_member"
    remove_team_member = "remove_team_member"


class ModerationAuditLog(TimestampMixin, Base):
    """Append-only record of every automated + human moderation/enforcement decision.

    Required for GDPR Art. 22 appeals and DSA transparency
    (see docs/content-platform/CONTENT_PLATFORM.md §8).
    """

    __tablename__ = "moderation_audit_log"

    id: Mapped[int] = mapped_column(primary_key=True)
    # actor_id null = system/automation; actor_label carries the model version etc.
    actor_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    actor_label: Mapped[str | None] = mapped_column(String(255), nullable=True)
    action: Mapped[str] = mapped_column(String(50))
    target_type: Mapped[str] = mapped_column(String(50))  # "content" | "user" | ...
    target_id: Mapped[int | None] = mapped_column(Integer, nullable=True)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    reason_category: Mapped[str | None] = mapped_column(String(100), nullable=True)
    meta: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # scores, model version, prev/next state
