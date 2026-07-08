import datetime

from sqlalchemy import JSON, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class PageDraft(TimestampMixin, Base):
    """Per-page draft overlay for the Content Studio (CONTENT_STUDIO.md §7).

    All in-flight edits to a page (content, style overrides, property
    changes) accumulate as one page-level draft. In edit mode the editor
    sees their draft live; visitors see the published version until
    `publish` flips `status` to "published" (and stamps `published_at`).
    `discard` deletes the row — the only way back after a save is the
    per-element revert affordance backed by `OverrideLog`.

    `changes` is an array of `{ element_path, property, value, old_value }`
    objects — the same shape the override guardrail logs (§6), so a publish
    can fold draft changes into `override_logs` and the published snapshot.

    Sibling of `BlockPage` (the composed surface this drafts over) — same
    audit-logged `super_admin` authoring pattern (see `app/api/overrides.py`).
    One draft per page (`page_slug` is unique): a second save upserts in
    place rather than spawning a parallel draft.
    """

    __tablename__ = "page_drafts"

    id: Mapped[int] = mapped_column(primary_key=True)
    page_slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    status: Mapped[str] = mapped_column(String(20), default="draft", server_default="draft")
    changes: Mapped[list] = mapped_column(JSON)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    published_at: Mapped[datetime.datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
