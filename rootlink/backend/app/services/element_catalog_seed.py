"""Idempotent seed for the Content Studio element catalog + font library.

Seeds the default element property schemas (heading/card/button/section) and
the default fonts (Fraunces, Source Serif 4) the dashboard's element catalog
(CONTENT_STUDIO.md §5) and font library (§3.1) ship with.

Called from `app.main.lifespan()` after `Base.metadata.create_all`, the same
way `seed_default_theme` is. Idempotent: skips a schema row if
(element_type, property_name) already exists, and skips a font if its name
already exists — so re-runs and a racing second uvicorn worker (Dockerfile.prod
runs `--workers 2`; the lifespan is flock-serialized, see `app/main.py`) no-op.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.element_schema import ElementSchema
from app.models.font import Font

# (element_type, property_name, property_type, control_type, default_value, options)
# control_type is one of: slider, palette, toggle, button-group, type-scale,
# inline-text, image-picker (CONTENT_STUDIO.md §4). property_type is
# "intrinsic" (part of the component definition) or "extrinsic" (defaulted
# from the theme, overridable per-instance) — §5.
_DEFAULT_SCHEMAS: list[tuple[str, str, str, str, str | None, list | None]] = [
    # ── heading (h1–h6) ──
    ("heading", "color", "extrinsic", "palette", "stone-800", None),
    ("heading", "font-size", "extrinsic", "type-scale", None, None),
    ("heading", "font-weight", "extrinsic", "button-group", None,
     [{"value": "300", "label": "Light"}, {"value": "400", "label": "Regular"},
      {"value": "600", "label": "Semi"}, {"value": "700", "label": "Bold"}]),
    ("heading", "font-family", "extrinsic", "button-group", None, None),
    ("heading", "letter-spacing", "extrinsic", "slider", None, None),
    ("heading", "text-align", "extrinsic", "button-group", None,
     [{"value": "left", "label": "Left"}, {"value": "center", "label": "Center"},
      {"value": "right", "label": "Right"}, {"value": "justify", "label": "Justify"}]),
    # ── card ──
    ("card", "background-color", "extrinsic", "palette", "white", None),
    ("card", "border-radius", "extrinsic", "slider", None, None),
    ("card", "padding", "extrinsic", "slider", None, None),
    ("card", "border-width", "extrinsic", "slider", None, None),
    ("card", "border-color", "extrinsic", "palette", None, None),
    # ── button ──
    ("button", "background-color", "intrinsic", "palette", None, None),
    ("button", "color", "intrinsic", "palette", None, None),
    ("button", "font-size", "extrinsic", "type-scale", None, None),
    ("button", "font-family", "extrinsic", "button-group", None, None),
    ("button", "border-radius", "extrinsic", "slider", None, None),
    ("button", "padding", "extrinsic", "slider", None, None),
    # ── section ──
    ("section", "background-color", "extrinsic", "palette", None, None),
    ("section", "padding", "extrinsic", "slider", None, None),
    ("section", "gap", "extrinsic", "slider", None, None),
]

# (name, family, url). `family` is the CSS font-family value (internal quotes
# + fallbacks included); `url` is the Google Fonts CSS URL the frontend injects.
_DEFAULT_FONTS: list[tuple[str, str, str]] = [
    ("Fraunces", '"Fraunces", Georgia, serif',
     "https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,300..900&display=swap"),
    ("Source Serif 4", '"Source Serif 4", Georgia, serif',
     "https://fonts.googleapis.com/css2?family=Source+Serif+4:opsz,wght@8..60,300..700&display=swap"),
]


async def seed_default_element_catalog(session: AsyncSession) -> None:
    """Seed default element schemas + fonts (idempotent)."""
    for (element_type, property_name, property_type, control_type,
         default_value, options) in _DEFAULT_SCHEMAS:
        existing = await session.scalar(
            select(ElementSchema).where(
                ElementSchema.element_type == element_type,
                ElementSchema.property_name == property_name,
            )
        )
        if existing is None:
            session.add(
                ElementSchema(
                    element_type=element_type,
                    property_name=property_name,
                    property_type=property_type,
                    control_type=control_type,
                    default_value=default_value,
                    options=options,
                    is_visible=True,
                )
            )
    for name, family, url in _DEFAULT_FONTS:
        existing = await session.scalar(select(Font).where(Font.name == name))
        if existing is None:
            session.add(Font(name=name, family=family, url=url, is_active=True))
    await session.commit()
