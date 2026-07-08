from sqlalchemy import Boolean, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class Font(TimestampMixin, Base):
    """A font in the Content Studio dashboard's font library (CONTENT_STUDIO.md §3.1).

    `family` is the CSS font-family value consumed directly by the frontend
    (e.g. `"Fraunces", Georgia, serif`, internal quotes and fallbacks
    included); `url` is the Google Fonts CSS URL (or an uploaded file path) the
    frontend injects to load the faces. The dashboard's font manager
    imports/curates these, and the overlay's font-family button group picks
    FROM the library — you can't invent a font not registered here.

    Sibling of `Theme`/`ElementSchema` — same audit-logged `super_admin`
    authoring pattern (public reads of active fonts, no `can_edit_copy`
    delegation). `name` is unique; `is_active` lets the dashboard retire a font
    without deleting it (so existing overrides referencing its family keep
    resolving) — public reads filter to `is_active=True`.
    """

    __tablename__ = "fonts"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    family: Mapped[str] = mapped_column(String(300))
    url: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1")
