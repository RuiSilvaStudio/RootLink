"""Idempotent seed for the Content Studio default theme (CONTENT_STUDIO.md §9).

Creates the "Default" theme — `is_active=True`, `is_published=True` — and seeds
its `ThemeToken` rows from the `@theme` values in `app/globals.css`. Colors are
stored as hex (e.g. "#634d33"), consumed by the frontend as CSS custom
properties. Tailwind v4 handles opacity modifiers natively — no RGB-channel
hack. `dark_value` is left null: dark mode is handled by the existing `.dark`
overrides in `globals.css` initially, and the dark palette is authored later
in the dashboard theme manager.

Called from `app.main.lifespan()` after `Base.metadata.create_all`, the same way
`seed_content_templates` / `seed_legal_documents` are. Idempotent: skips
creating the theme if it already exists, and only seeds tokens when the theme
has none.
"""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.theme import Theme, ThemeToken

DEFAULT_THEME_NAME = "Default"

# (token_name, light_value, category). Colors are hex (readable, matches
# the @theme directive in globals.css). dark_value is null for all
# (authored later in the dashboard theme manager).
_DEFAULT_TOKENS: list[tuple[str, str, str]] = [
    # ── Primary (earth-brown) ──
    ("--color-primary-50", "#f3f0eb", "color"),
    ("--color-primary-100", "#e3ddd0", "color"),
    ("--color-primary-200", "#cabda6", "color"),
    ("--color-primary-300", "#ad9a7a", "color"),
    ("--color-primary-400", "#917a56", "color"),
    ("--color-primary-500", "#7a6040", "color"),
    ("--color-primary-600", "#634d33", "color"),
    ("--color-primary-700", "#4f3d2a", "color"),
    ("--color-primary-800", "#3d2f21", "color"),
    ("--color-primary-900", "#291f16", "color"),
    # ── Earth (warm tan) ──
    ("--color-earth-50", "#f5f0ea", "color"),
    ("--color-earth-100", "#e8ddd0", "color"),
    ("--color-earth-200", "#d4c0a8", "color"),
    ("--color-earth-300", "#bba080", "color"),
    ("--color-earth-400", "#a6845e", "color"),
    ("--color-earth-500", "#8c6b48", "color"),
    ("--color-earth-600", "#70553a", "color"),
    ("--color-earth-700", "#5a432e", "color"),
    ("--color-earth-800", "#453324", "color"),
    ("--color-earth-900", "#2e2218", "color"),
    # ── Cream ──
    ("--color-cream", "#f8f6f2", "color"),
    # ── Rust (terracotta) ──
    ("--color-rust-50", "#f9f0ec", "color"),
    ("--color-rust-100", "#f0dcd1", "color"),
    ("--color-rust-200", "#e0bea8", "color"),
    ("--color-rust-300", "#cf9b7a", "color"),
    ("--color-rust-400", "#c07d53", "color"),
    ("--color-rust-500", "#a8643d", "color"),
    ("--color-rust-600", "#8b5032", "color"),
    ("--color-rust-700", "#714029", "color"),
    ("--color-rust-800", "#5c3422", "color"),
    ("--color-rust-900", "#4a2a1c", "color"),
    # ── Fonts ──
    ("--font-display", '"Fraunces", Georgia, serif', "font"),
    ("--font-serif", '"Source Serif 4", Georgia, serif', "font"),
    # ── Radius ──
    ("--radius-xl2", "16px", "radius"),
]


async def seed_default_theme(session: AsyncSession) -> None:
    """Create the Default theme + seed its tokens (idempotent)."""
    theme = await session.scalar(
        select(Theme).where(Theme.name == DEFAULT_THEME_NAME)
    )
    if theme is None:
        theme = Theme(
            name=DEFAULT_THEME_NAME,
            description="RootLink's default earth-toned palette.",
            is_active=True,
            is_published=True,
        )
        session.add(theme)
        await session.flush()

    # Safety net: if no theme is active at all (e.g. someone deactivated the
    # default), keep the platform live by re-activating Default.
    if not theme.is_active:
        any_active = await session.scalar(select(Theme).where(Theme.is_active.is_(True)))
        if not any_active:
            theme.is_active = True
    theme.is_published = True

    existing_count = await session.scalar(
        select(func.count())
        .select_from(ThemeToken)
        .where(ThemeToken.theme_id == theme.id)
    )
    if existing_count:
        await session.commit()
        return

    for token_name, light_value, category in _DEFAULT_TOKENS:
        session.add(
            ThemeToken(
                theme_id=theme.id,
                token_name=token_name,
                light_value=light_value,
                dark_value=None,
                category=category,
            )
        )
    await session.commit()
