from sqlalchemy import Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class ThemeOverride(TimestampMixin, Base):
    """Runtime override for a CSS custom-property theme token.

    The theming substrate for the Content Studio
    (docs/content-studio/CONTENT_STUDIO.md §4): colors, fonts, and radii live
    as CSS custom properties (`--color-primary-600`, `--font-display`,
    `--radius-xl2`) in `globals.css`, repointed from `tailwind.config.ts` via
    `var(--token)`. Rows here override a token's value at runtime so the studio
    can theme the platform live, with real-time preview and no rebuild.

    Sibling of `ContentUIOverride` (image/icon slots) and `CopyOverride` (i18n
    text keys) — same upsert/revert/audit pattern (see `app/api/theme.py`),
    stricter `super_admin` gate (no `can_edit_copy` delegation).

    `value` shape by token family:
      - colors:  bare RGB channels, e.g. "99 77 51", consumed by the frontend
        as `rgb(var(--color-primary-600) / <alpha-value>)`.
      - fonts:   a CSS font-family string, e.g. "Fraunces, serif".
      - radius:  a px/rem value, e.g. "1rem".
    `scope` is "global" for `:root` overrides; a scoped selector reserves the
    row for per-element overrides (future — see CONTENT_STUDIO.md §4 "Override
    resolution").
    """

    __tablename__ = "theme_overrides"

    id: Mapped[int] = mapped_column(primary_key=True)
    token: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    value: Mapped[str] = mapped_column(String(500))
    scope: Mapped[str] = mapped_column(String(100), server_default="global")
    updated_by: Mapped[int | None] = mapped_column(Integer, nullable=True)
