"""Single source of truth for whether a Content row is publicly visible.

A piece of content is "live" (publicly listed, searchable, indexed, viewable by
anyone) only once its verification_status reaches one of
PUBLIC_VERIFICATION_STATUSES:

  - user-authored articles  -> community_reviewed (a human approved it)
  - crawled content         -> cross_referenced  (corroborated by >= 3 sources)

Everything else — drafts and published-but-unreviewed articles awaiting review —
must stay hidden from every public surface. Use these helpers everywhere instead
of re-deriving the condition, so the gate can never drift out of sync.
"""

from app.models.content import PUBLIC_VERIFICATION_STATUSES, Content


def public_content_clause():
    """SQLAlchemy WHERE clause selecting only publicly-visible content."""
    return Content.verification_status.in_(PUBLIC_VERIFICATION_STATUSES)


def is_publicly_visible(content: Content) -> bool:
    """True if this content is live (approved/cross-referenced)."""
    return content.verification_status in PUBLIC_VERIFICATION_STATUSES
