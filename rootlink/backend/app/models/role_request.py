import enum
from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin

# Roles/permissions redesign — Phase 4 (docs/roles-permissions/ROLES_PERMISSIONS.md §6 "Promote / demote
# rules", docs/roles-permissions/phase0-decisions.md (h)). Replaces the direct `PATCH
# /api/admin/users/{id}/role` toggle with a real request+approval record —
# see docs/roles-permissions/roadmap.md's Phase 4 section and
# app/services/role_requests.py for the actual rule enforcement.


class RoleChangeDirection(enum.StrEnum):
    promote = "promote"
    demote = "demote"


class RoleChangeStatus(enum.StrEnum):
    pending = "pending"
    approved = "approved"
    rejected = "rejected"


class RoleChangeRequest(TimestampMixin, Base):
    __tablename__ = "role_change_requests"

    id: Mapped[int] = mapped_column(primary_key=True)
    # Which of the 6 docs/roles-permissions/ROLES_PERMISSIONS.md §3 entities this request is scoped to
    # (`UserEntity` values) — mirrors `User.entity_kind`.
    entity_kind: Mapped[str] = mapped_column(String(20))
    # Non-null only for organization/partners/suppliers (the 3 kinds that get
    # a real `entities` row) — see app.models.entity's own docstring.
    entity_id: Mapped[int | None] = mapped_column(ForeignKey("entities.id"), nullable=True)
    target_user_id: Mapped[int] = mapped_column(ForeignKey("users.id"))
    requested_by: Mapped[int] = mapped_column(ForeignKey("users.id"))
    # Snapshot of the requester's own rank *at request time* — approval
    # authority is checked against this, not the requester's rank at approval
    # time, so a requester who is themselves later promoted/demoted between
    # request and decision can't retroactively change who was allowed to
    # approve their request.
    requested_by_rank: Mapped[int] = mapped_column(Integer)
    from_rank: Mapped[int] = mapped_column(Integer)
    to_rank: Mapped[int] = mapped_column(Integer)
    direction: Mapped[str] = mapped_column(String(10))  # RoleChangeDirection
    status: Mapped[str] = mapped_column(String(20), default=RoleChangeStatus.pending)
    reason: Mapped[str | None] = mapped_column(Text, nullable=True)
    # True when this request was auto-approved under the capped-entity/super-
    # admin self-approval exemption (docs/roles-permissions/ROLES_PERMISSIONS.md §6) — recorded explicitly
    # at write time as a convenience/readability flag; the periodic
    # audit-sampling query (docs/roles-permissions/phase0-decisions.md (h)) does NOT rely on this
    # flag alone (it re-derives the same signature from
    # `requested_by == decided_by` on the audit log, per that decision's own
    # wording) — this column just makes the request row itself self-
    # describing without a join.
    self_approved: Mapped[bool] = mapped_column(Boolean, default=False)
    decided_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    decision_reason: Mapped[str | None] = mapped_column(Text, nullable=True)
