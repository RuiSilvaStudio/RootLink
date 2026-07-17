"""Idempotent seed for the Content Studio default theme (CONTENT_STUDIO.md §9).

Creates the "Default" theme — `is_active=True`, `is_published=True` — and seeds
its `ThemeToken` rows from the `@theme` values in `app/globals.css`. Colors are
stored as hex (e.g. "#634d33"), consumed by the frontend as CSS custom
properties. Tailwind v4 handles opacity modifiers natively — no RGB-channel
hack. Each color token carries both light_value and dark_value so the dashboard
theme manager is the source of truth for the full palette in both modes.
"""

from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.theme import Theme, ThemeToken

DEFAULT_THEME_NAME = "Default"

# (token_name, light_value, dark_value, category). Colors are hex (readable,
# matches the @theme directive in globals.css). Sizes/spacing/radii mirror
# Tailwind v4's default theme exactly. Dark values: lighter shades work better
# on dark backgrounds, so the palette roughly reverses (light↔dark) for stone;
# accents shift to lighter shades to preserve contrast on dark surfaces.
_DEFAULT_TOKENS: list[tuple[str, str, str, str]] = [
    # ── Primary (earth-brown) ──
    ("--color-primary-50", "#f3f0eb", "#291f16", "color"),
    ("--color-primary-100", "#e3ddd0", "#3d2f21", "color"),
    ("--color-primary-200", "#cabda6", "#4f3d2a", "color"),
    ("--color-primary-300", "#ad9a7a", "#634d33", "color"),
    ("--color-primary-400", "#917a56", "#7a6040", "color"),
    ("--color-primary-500", "#7a6040", "#917a56", "color"),
    ("--color-primary-600", "#634d33", "#ad9a7a", "color"),
    ("--color-primary-700", "#4f3d2a", "#cabda6", "color"),
    ("--color-primary-800", "#3d2f21", "#e3ddd0", "color"),
    ("--color-primary-900", "#291f16", "#f3f0eb", "color"),
    # ── Brand (logo / wordmark — independently controllable from primary) ──
    ("--color-brand", "#4f3d2a", "#ad9a7a", "color"),
    # ── Earth (warm tan) ──
    ("--color-earth-50", "#f5f0ea", "#2e2218", "color"),
    ("--color-earth-100", "#e8ddd0", "#453324", "color"),
    ("--color-earth-200", "#d4c0a8", "#5a432e", "color"),
    ("--color-earth-300", "#bba080", "#70553a", "color"),
    ("--color-earth-400", "#a6845e", "#8c6b48", "color"),
    ("--color-earth-500", "#8c6b48", "#bba080", "color"),
    ("--color-earth-600", "#70553a", "#d4c0a8", "color"),
    ("--color-earth-700", "#5a432e", "#e8ddd0", "color"),
    ("--color-earth-800", "#453324", "#f5f0ea", "color"),
    ("--color-earth-900", "#2e2218", "#f5f0ea", "color"),
    # ── Cream ──
    ("--color-cream", "#f8f6f2", "#1c1917", "color"),
    # ── Rust (terracotta) ──
    ("--color-rust-50", "#f9f0ec", "#4a2a1c", "color"),
    ("--color-rust-100", "#f0dcd1", "#5c3422", "color"),
    ("--color-rust-200", "#e0bea8", "#714029", "color"),
    ("--color-rust-300", "#cf9b7a", "#8b5032", "color"),
    ("--color-rust-400", "#c07d53", "#a8643d", "color"),
    ("--color-rust-500", "#a8643d", "#cf9b7a", "color"),
    ("--color-rust-600", "#8b5032", "#e0bea8", "color"),
    ("--color-rust-700", "#714029", "#f0dcd1", "color"),
    ("--color-rust-800", "#5c3422", "#f9f0ec", "color"),
    ("--color-rust-900", "#4a2a1c", "#f9f0ec", "color"),
    # ── Stone (override v4 default oklch with hex) ──
    ("--color-stone-50", "#fafaf9", "#292524", "color"),
    ("--color-stone-100", "#f5f5f4", "#1c1917", "color"),
    ("--color-stone-200", "#e7e5e4", "#0c0a09", "color"),
    ("--color-stone-300", "#d6d3d1", "#1c1917", "color"),
    ("--color-stone-400", "#a8a29e", "#44403c", "color"),
    ("--color-stone-500", "#78716c", "#57534e", "color"),
    ("--color-stone-600", "#57534e", "#a8a29e", "color"),
    ("--color-stone-700", "#44403c", "#d6d3d1", "color"),
    ("--color-stone-800", "#292524", "#f5f5f4", "color"),
    ("--color-stone-900", "#1c1917", "#fafaf9", "color"),
    ("--color-stone-950", "#0c0a09", "#e7e5e4", "color"),
    # ── Fonts ──
    ("--font-display", '"Fraunces", Georgia, serif', '"Fraunces", Georgia, serif', "font"),
    ("--font-serif", '"Source Serif 4", Georgia, serif', '"Source Serif 4", Georgia, serif', "font"),
    # ── Font axes (variable-font variation settings, theme-driven) ──
    # These replace the hardcoded font-variation-settings values that were
    # baked into globals.css @layer base. Each controls a specific axis on a
    # specific typographic context — fine-grained so the dashboard can tune
    # headings, blockquotes, drop-caps, accent words, and numbers independently.
    ("--font-soft-heading", "60", "60", "font-axis"),
    ("--font-wonk-heading", "0", "0", "font-axis"),
    ("--font-opsz-heading", "144", "144", "font-axis"),
    ("--font-soft-accent", "100", "100", "font-axis"),
    ("--font-wonk-accent", "1", "1", "font-axis"),
    ("--font-opsz-accent", "144", "144", "font-axis"),
    ("--font-soft-blockquote", "80", "80", "font-axis"),
    ("--font-opsz-blockquote", "144", "144", "font-axis"),
    ("--font-soft-dropcap", "30", "30", "font-axis"),
    ("--font-opsz-dropcap", "144", "144", "font-axis"),
    ("--font-soft-number", "100", "100", "font-axis"),
    ("--font-opsz-number", "144", "144", "font-axis"),
    ("--font-wght-display", "560", "560", "font-axis"),
    ("--font-wght-accent", "520", "520", "font-axis"),
    # ── Radius (px) ──
    ("--radius-sm", "2px", "2px", "radius"),
    ("--radius-md", "6px", "6px", "radius"),
    ("--radius-lg", "8px", "8px", "radius"),
    ("--radius-xl", "12px", "12px", "radius"),
    ("--radius-2xl", "16px", "16px", "radius"),
    ("--radius-3xl", "24px", "24px", "radius"),
    ("--radius-full", "9999px", "9999px", "radius"),
    ("--radius-xl2", "16px", "16px", "radius"),
    # ── Type scale (rem) ──
    ("--text-xs", "0.75rem", "0.75rem", "size"),
    ("--text-sm", "0.875rem", "0.875rem", "size"),
    ("--text-base", "1rem", "1rem", "size"),
    ("--text-lg", "1.125rem", "1.125rem", "size"),
    ("--text-xl", "1.25rem", "1.25rem", "size"),
    ("--text-2xl", "1.5rem", "1.5rem", "size"),
    ("--text-3xl", "1.875rem", "1.875rem", "size"),
    ("--text-4xl", "2.25rem", "2.25rem", "size"),
    ("--text-5xl", "3rem", "3rem", "size"),
    ("--text-6xl", "3.75rem", "3.75rem", "size"),
    ("--text-7xl", "4.5rem", "4.5rem", "size"),
    ("--text-8xl", "6rem", "6rem", "size"),
    ("--text-9xl", "8rem", "8rem", "size"),
    # ── Spacing base ──
    ("--spacing", "0.25rem", "0.25rem", "spacing"),
]


async def seed_default_theme(session: AsyncSession) -> None:
    """Create the Default theme + seed its tokens (idempotent + additive).

    Per-token upsert: a token is added only if (theme_id, token_name) doesn't
    yet exist. For existing tokens whose dark_value is still null (legacy data
    from before dark values were seeded), backfill with the seed's dark values.
    Idempotent across re-runs and a racing second worker.
    """
    theme = await session.scalar(
        select(Theme).where(Theme.name == DEFAULT_THEME_NAME)
    )
    if theme is None:
        any_active = await session.scalar(select(Theme).where(Theme.is_active.is_(True)))
        theme = Theme(
            name=DEFAULT_THEME_NAME,
            description="RootLink's default earth-toned palette.",
            is_active=not any_active,
            is_published=True,
        )
        session.add(theme)
        await session.flush()

    # Safety net: if no theme is active at all, keep the platform live.
    if not theme.is_active:
        any_active = await session.scalar(select(Theme).where(Theme.is_active.is_(True)))
        if not any_active:
            theme.is_active = True
    theme.is_published = True

    for token_name, light_value, dark_value, category in _DEFAULT_TOKENS:
        existing = await session.scalar(
            select(ThemeToken).where(
                ThemeToken.theme_id == theme.id,
                ThemeToken.token_name == token_name,
            )
        )
        if existing is None:
            session.add(
                ThemeToken(
                    theme_id=theme.id,
                    token_name=token_name,
                    light_value=light_value,
                    dark_value=dark_value,
                    category=category,
                )
            )
        elif existing.dark_value is None:
            # Backfill dark_value for tokens seeded before the dark palette
            # was added (legacy DBs with all-null dark values).
            await session.execute(
                update(ThemeToken)
                .where(
                    ThemeToken.id == existing.id,
                    ThemeToken.dark_value.is_(None),
                )
                .values(dark_value=dark_value)
            )

    await session.commit()

    # Backfill new tokens onto the active theme when it differs from Default.
    # The seed only adds tokens to the "Default" theme above; if the active
    # theme is a different one (e.g. renamed, or a custom theme), new tokens
    # like --color-brand would be missing from it. This loop adds any seed
    # tokens that don't yet exist on the active theme (additive only — never
    # overwrites existing values).
    active = await session.scalar(select(Theme).where(Theme.is_active.is_(True)))
    if active and active.id != theme.id:
        for token_name, light_value, dark_value, category in _DEFAULT_TOKENS:
            existing = await session.scalar(
                select(ThemeToken).where(
                    ThemeToken.theme_id == active.id,
                    ThemeToken.token_name == token_name,
                )
            )
            if existing is None:
                session.add(
                    ThemeToken(
                        theme_id=active.id,
                        token_name=token_name,
                        light_value=light_value,
                        dark_value=dark_value,
                        category=category,
                    )
                )
        await session.commit()
