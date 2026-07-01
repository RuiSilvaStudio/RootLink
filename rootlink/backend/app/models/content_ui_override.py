from sqlalchemy import JSON, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class ContentUIOverride(TimestampMixin, Base):
    """Runtime override for a static site-chrome image or icon slot.

    Sibling of `CopyOverride` (which handles text/`t()` keys) for the Content
    UI Editor feature (discovery/mockups/content-ui-editor/briefing-to-build-local.md).
    Text keeps using `copy_overrides` unchanged; this table covers the two other
    editable element types: `image` and `icon`.

    `value` shape by `kind`:
      - image: {"assetId": int, "url": str, "alt": str}
      - icon:  {"iconId": str}   (must be a member of frontend/lib/icon-library.ts)
    """

    __tablename__ = "content_ui_overrides"

    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(200), unique=True, index=True)
    kind: Mapped[str] = mapped_column(String(10))  # "image" | "icon"
    value: Mapped[dict] = mapped_column(JSON)
    updated_by: Mapped[int | None] = mapped_column(Integer, nullable=True)
