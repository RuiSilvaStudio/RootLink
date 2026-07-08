"""Idempotent seed for the Content Studio default theme (CONTENT_STUDIO.md §9).

Creates the "Default" theme — `is_active=True`, `is_published=True` — and seeds
its `ThemeToken` rows from the CSS custom-property values in
`discovery/mockups/handoff-to-basecode/styles/tokens.css`. Colors are stored as
bare RGB channels (e.g. "99 77 51"), consumed by the frontend as
`rgb(var(--color-primary-600) / <alpha-value>)`. `dark_value` is left null: dark
mode is handled by the existing `.dark` overrides in `globals.css` initially,
and the dark palette is authored later in the dashboard theme manager.

Called from `app.main.lifespan()` after `Base.metadata.create_all`, the same way
`seed_content_templates` / `seed_legal_documents` are. Idempotent: skips
creating the theme if it already exists, and only seeds tokens when the theme
has none.
"""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.theme import Theme, ThemeToken

DEFAULT_THEME_NAME = "Default"

# (token_name, light_value, category). Colors are RGB channels (hex → "R G B")
# from tokens.css. dark_value is null for all (authored later).
_DEFAULT_TOKENS: list[tuple[str, str, str]] = [
    # ── Primary (earth-brown) ──
    ("--color-primary-50", "243 240 235", "color"),
    ("--color-primary-100", "227 221 208", "color"),
    ("--color-primary-200", "202 189 166", "color"),
    ("--color-primary-300", "173 154 122", "color"),
    ("--color-primary-400", "145 122 86", "color"),
    ("--color-primary-500", "122 96 64", "color"),
    ("--color-primary-600", "99 77 51", "color"),
    ("--color-primary-700", "79 61 42", "color"),
    ("--color-primary-800", "61 47 33", "color"),
    ("--color-primary-900", "41 31 22", "color"),
    # ── Earth (warm tan) ──
    ("--color-earth-50", "245 240 234", "color"),
    ("--color-earth-100", "232 221 208", "color"),
    ("--color-earth-200", "212 192 168", "color"),
    ("--color-earth-300", "187 160 128", "color"),
    ("--color-earth-400", "166 132 94", "color"),
    ("--color-earth-500", "140 107 72", "color"),
    ("--color-earth-600", "112 85 58", "color"),
    ("--color-earth-700", "90 67 46", "color"),
    ("--color-earth-800", "69 51 36", "color"),
    ("--color-earth-900", "46 34 24", "color"),
    # ── Cream ──
    ("--color-cream", "248 246 242", "color"),
    # ── Rust (terracotta) ──
    ("--color-rust-50", "249 240 236", "color"),
    ("--color-rust-100", "240 220 209", "color"),
    ("--color-rust-200", "224 190 168", "color"),
    ("--color-rust-300", "207 155 122", "color"),
    ("--color-rust-400", "192 125 83", "color"),
    ("--color-rust-500", "168 100 61", "color"),
    ("--color-rust-600", "139 80 50", "color"),
    ("--color-rust-700", "113 64 41", "color"),
    ("--color-rust-800", "92 52 34", "color"),
    ("--color-rust-900", "74 42 28", "color"),
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
