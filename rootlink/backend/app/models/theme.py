from sqlalchemy import Boolean, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class Theme(TimestampMixin, Base):
    """A named theme = a full palette of CSS custom-property tokens.

    The multi-theme substrate for the Content Studio dashboard's theme manager
    (docs/content-studio/CONTENT_STUDIO.md §8 dark-mode safety, §9 multi-theme):
    a Theme is a named palette ("Default", "Christmas", "Halloween") whose
    `ThemeToken` rows carry the light + dark values for every named CSS token
    (`--color-primary-600`, `--font-display`, `--radius-xl2`). Activating a
    theme is a full palette swap; element overrides persist across swaps
    because they reference token names, not raw values.

    Sibling of `ThemeOverride` (the v1 single-palette override substrate) —
    same audit-logged `super_admin` authoring pattern (see
    `app/api/theme_manager.py`), with a draft→publish flow (`is_published`)
    and an exactly-one-active invariant enforced on activate (`is_active`).
    """

    __tablename__ = "themes"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    is_active: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")
    is_published: Mapped[bool] = mapped_column(Boolean, default=False, server_default="0")
    created_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)


class ThemeToken(TimestampMixin, Base):
    """A single named CSS token within a theme (CONTENT_STUDIO.md §8).

    `token_name` is the CSS custom property (`--color-primary-600`,
    `--font-display`, `--radius-xl2`). `light_value`/`dark_value` are the
    per-mode values: bare RGB channels for colors ("99 77 51"), a font-family
    string for fonts, a px/rem value for radii — same shape as
    `ThemeOverride.value`. A null `dark_value` means the light value is used
    for both modes (the dark palette is authored later). `category` buckets
    the token for the dashboard's inspector control choice
    ("color" | "font" | "radius" | "spacing").

    Upsert keyed on (theme_id, token_name): a second write for the same token
    name updates in place rather than duplicating (see
    `app/api/theme_manager.py`); a composite unique constraint backs that.
    """

    __tablename__ = "theme_tokens"
    __table_args__ = (
        UniqueConstraint("theme_id", "token_name", name="uq_theme_token_name"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    theme_id: Mapped[int] = mapped_column(
        ForeignKey("themes.id", ondelete="CASCADE"), nullable=False, index=True
    )
    token_name: Mapped[str] = mapped_column(String(120), index=True)
    light_value: Mapped[str] = mapped_column(String(500))
    dark_value: Mapped[str | None] = mapped_column(String(500), nullable=True)
    category: Mapped[str] = mapped_column(String(50))
