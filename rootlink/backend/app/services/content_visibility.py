"""Single source of truth for whether a Content row is publicly visible.

`status` is the **single** visibility gate (CONTENT_PLATFORM.md §2.1): a piece of
content is "live" (publicly listed, searchable, indexed, viewable by anyone) only
once its status reaches `published`. Everything else — draft, in_review,
needs_changes, rejected, archived — stays hidden from every public surface and is
visible only to its owner, moderators and super_admin.

The separate `verification_status` (unreviewed / cross_referenced /
community_reviewed) is an orthogonal **quality badge**, NOT a visibility gate.

Use these helpers everywhere instead of re-deriving the condition, so the gate
can never drift out of sync.
"""

from app.models.content import Content, ContentStatus


def public_content_clause():
    """SQLAlchemy WHERE clause selecting only publicly-visible content."""
    return Content.status == ContentStatus.published


def is_publicly_visible(content: Content) -> bool:
    """True if this content is live (published)."""
    return content.status == ContentStatus.published
