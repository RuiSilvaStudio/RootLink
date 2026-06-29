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
    # Trust / enforcement ladder (§3, §4.4)
    grant_self_publish = "grant_self_publish"
    revoke_self_publish = "revoke_self_publish"
    grant_edit_copy = "grant_edit_copy"
    revoke_edit_copy = "revoke_edit_copy"
    demote = "demote"
    restrict = "restrict"
    suspend = "suspend"
    lift_suspension = "lift_suspension"
    ban = "ban"
    unban = "unban"


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
