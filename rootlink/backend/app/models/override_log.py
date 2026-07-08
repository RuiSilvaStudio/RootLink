from sqlalchemy import Boolean, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class OverrideLog(TimestampMixin, Base):
    """Logged deviation of an element's CSS property from its theme default.

    Content Studio Phase 3 override guardrail
    (docs/content-studio/CONTENT_STUDIO.md §6): when an editor changes a
    property away from its default value, the deviation is confirmed inline
    and logged here — `element_path` + `property` + old→new value + who +
    when. A badge on the element links back to this row; reverting deletes
    it. `is_stale` flips True when the theme's default for this property
    later changes (§6 "Stale-override warning") — the override stays, but
    the studio warns it may no longer be intentional. Re-confirming the
    override resets `is_stale` (the editor re-asserted intent).

    Overrides attach to structural position (e.g. "3rd card in the grid"),
    not data identity, and persist across theme changes (§6 "Override
    persistence") — a new theme repoints the token, the override row keeps
    its token reference.

    Sibling of `ThemeOverride` (token-level) / `BlockPage` (composed
    surfaces) — same audit-logged `super_admin` authoring pattern
    (see `app/api/overrides.py`). Public reads are auth-free (the frontend
    needs them to render badges); writes are strictly `super_admin`, no
    `can_edit_copy` delegation.
    """

    __tablename__ = "override_logs"

    id: Mapped[int] = mapped_column(primary_key=True)
    page_slug: Mapped[str] = mapped_column(String(120), index=True)
    element_path: Mapped[str] = mapped_column(String(1000))
    property: Mapped[str] = mapped_column(String(120))
    old_value: Mapped[str | None] = mapped_column(String(500), nullable=True)
    new_value: Mapped[str] = mapped_column(String(500))
    user_id: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    is_stale: Mapped[bool] = mapped_column(Boolean, default=False)
