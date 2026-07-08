from sqlalchemy import JSON, Boolean, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class BlockPage(TimestampMixin, Base):
    """A composed surface made of block instances (sections).

    The block model for the Content Studio
    (docs/content-studio/CONTENT_STUDIO.md §6): a Page is a composed surface
    (e.g. "landing", "about") addressed by `slug`; its ordered `BlockSection`
    rows are positioned block instances referencing a frontend block-type
    registry entry ("hero", "text-block", "card-grid") whose `render(props)`
    the platform consumes to render the page. The studio composes new
    surfaces without a deploy by adding/reordering sections here.

    Sibling of `ThemeOverride` / `ContentUIOverride` / `CopyOverride` — same
    audit-logged `super_admin` authoring pattern (see `app/api/blocks.py`).
    Public reads (`is_published` gate) are auth-free; writes are strictly
    `super_admin`, no `can_edit_copy` delegation.
    """

    __tablename__ = "block_pages"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    label: Mapped[str] = mapped_column(String(200))
    is_published: Mapped[bool] = mapped_column(Boolean, default=False)
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)


class BlockSection(TimestampMixin, Base):
    """A positioned block instance on a page (CONTENT_STUDIO.md §6).

    `block_type` references a block-type id in the frontend registry (e.g.
    "hero", "text-block", "card-grid"); `props` is the block's configurable
    properties (text, images, colors, ...) consumed by the registry entry's
    `render(props)`; `order` is the section's position on its page.
    """

    __tablename__ = "block_sections"

    id: Mapped[int] = mapped_column(primary_key=True)
    page_id: Mapped[int] = mapped_column(
        ForeignKey("block_pages.id", ondelete="CASCADE"), nullable=False, index=True
    )
    block_type: Mapped[str] = mapped_column(String(120), index=True)
    props: Mapped[dict] = mapped_column(JSON)
    order: Mapped[int] = mapped_column(Integer, default=0)
