"""Content Studio — Phase 5: element catalog + font library (dashboard control room).

This router covers the element catalog (docs/content-studio/CONTENT_STUDIO.md
§5 — element property schema: intrinsic vs extrinsic, control type, default,
visibility) and the font library (§3.1 — import/manage fonts, assign to
font-family tokens). The dashboard's control room curates both; the overlay's
inspector renders constrained controls FROM this catalog.

Access mirrors `app/api/theme_manager.py` and `app/api/blocks.py`: strictly
`super_admin` (via the shared `require_role` helper from `app/api/admin.py`)
for every write — no `can_edit_copy` delegation. Reads are public and
auth-free (the platform renders the catalog and the active font list for
everyone, safe to cache at the edge). Audit-logged writes go through
`log_moderation` (POST upsert + DELETE for both resources), matching the
theme/blocks siblings; PUT is not audit-logged (same as the siblings' updates).

Element-schema POST is an upsert keyed on (element_type, property_name):
a second write for the same pair updates in place rather than duplicating,
backed by the model's composite unique constraint. Font POST is a strict
create — a duplicate `name` returns 409 (fonts are referenced by their unique
name); retire a font with PUT `is_active=false` instead of re-creating.
"""

from collections import defaultdict
import json

import httpx
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.admin import require_role
from app.core.database import get_db
from app.models.element_schema import ElementSchema
from app.models.font import Font
from app.models.override_log import OverrideLog
from app.models.user import User, UserRole
from app.services.audit import log_moderation

router = APIRouter(prefix="/api", tags=["element-catalog"])


# ── Schemas ───────────────────────────────────────────────────────────────


class SchemaCreate(BaseModel):
    element_type: str
    property_name: str
    property_type: str
    control_type: str
    default_value: str | None = None
    options: list | None = None
    is_visible: bool | None = None


class SchemaUpdate(BaseModel):
    element_type: str | None = None
    property_name: str | None = None
    property_type: str | None = None
    control_type: str | None = None
    default_value: str | None = None
    options: list | None = None
    is_visible: bool | None = None


def _serialize_schema(s: ElementSchema) -> dict:
    return {
        "id": s.id,
        "element_type": s.element_type,
        "property_name": s.property_name,
        "property_type": s.property_type,
        "control_type": s.control_type,
        "default_value": s.default_value,
        "options": s.options,
        "is_visible": s.is_visible,
        "created_at": s.created_at.isoformat() if s.created_at else None,
        "updated_at": s.updated_at.isoformat() if s.updated_at else None,
    }


@router.get("/element-schemas")
async def list_element_schemas(db: AsyncSession = Depends(get_db)):
    """Public: all element schemas grouped by element_type.

    Returns `{element_type: [{id, property_name, property_type, control_type,
    default_value, options, is_visible, ...}]}`. Auth-free and idempotent —
    safe to cache at the edge (mirrors the public reads of `theme_manager.py`
    and `blocks.py`). Empty catalog → `{}`.
    """
    rows = (
        await db.execute(select(ElementSchema).order_by(ElementSchema.id))
    ).scalars().all()
    grouped: dict[str, list[dict]] = defaultdict(list)
    for r in rows:
        grouped[r.element_type].append(_serialize_schema(r))
    return dict(grouped)


@router.get("/element-schemas/{element_type}")
async def get_element_schema(element_type: str, db: AsyncSession = Depends(get_db)):
    """Public: all properties for a specific element type, as a flat list.

    An element type with no curated properties returns `[]` (it is a filter,
    not an entity, so no 404 — mirrors listing semantics elsewhere).
    """
    rows = (
        await db.execute(
            select(ElementSchema)
            .where(ElementSchema.element_type == element_type)
            .order_by(ElementSchema.id)
        )
    ).scalars().all()
    return [_serialize_schema(r) for r in rows]


@router.post("/element-schemas")
async def upsert_element_schema(
    body: SchemaCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.super_admin])),
):
    """super_admin: upsert a property on an element type. Audit-logged.

    If (element_type, property_name) already exists, update it in place rather
    than duplicating (the model's composite unique constraint backs this).
    """
    existing = await db.scalar(
        select(ElementSchema).where(
            ElementSchema.element_type == body.element_type,
            ElementSchema.property_name == body.property_name,
        )
    )
    if existing:
        existing.property_type = body.property_type
        existing.control_type = body.control_type
        existing.default_value = body.default_value
        existing.options = body.options
        if body.is_visible is not None:
            existing.is_visible = body.is_visible
        schema = existing
    else:
        schema = ElementSchema(
            element_type=body.element_type,
            property_name=body.property_name,
            property_type=body.property_type,
            control_type=body.control_type,
            default_value=body.default_value,
            options=body.options,
            is_visible=body.is_visible if body.is_visible is not None else True,
        )
        db.add(schema)
    await db.flush()
    await log_moderation(
        db, action="upsert_element_schema", target_type="element_schema",
        target_id=schema.id, actor_id=current_user.id,
        meta={
            "element_type": body.element_type,
            "property_name": body.property_name,
            "control_type": body.control_type,
        },
    )
    await db.commit()
    await db.refresh(schema)
    return _serialize_schema(schema)


@router.put("/element-schemas/{schema_id}")
async def update_element_schema(
    schema_id: int,
    body: SchemaUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.super_admin])),
):
    """super_admin: update any field on an element-schema row.

    `model_dump(exclude_unset=True)` so an explicitly-sent `default_value: null`
    or `options: null` clears the value, while an omitted field is left
    untouched (same shape as `theme_manager.update_theme_token`).
    """
    schema = await db.scalar(select(ElementSchema).where(ElementSchema.id == schema_id))
    if schema is None:
        raise HTTPException(status_code=404, detail="Element schema not found")
    data = body.model_dump(exclude_unset=True)
    for field in (
        "element_type", "property_name", "property_type", "control_type",
        "default_value", "options", "is_visible",
    ):
        if field in data:
            setattr(schema, field, data[field])
    await db.commit()
    await db.refresh(schema)
    return _serialize_schema(schema)


@router.delete("/element-schemas/{schema_id}")
async def delete_element_schema(
    schema_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.super_admin])),
):
    """super_admin: remove a property from an element type's schema. Audit-logged."""
    schema = await db.scalar(select(ElementSchema).where(ElementSchema.id == schema_id))
    if schema is None:
        raise HTTPException(status_code=404, detail="Element schema not found")
    meta = {
        "element_type": schema.element_type,
        "property_name": schema.property_name,
    }
    await db.delete(schema)
    await log_moderation(
        db, action="delete_element_schema", target_type="element_schema",
        target_id=schema_id, actor_id=current_user.id, meta=meta,
    )
    await db.commit()
    return {"ok": True, "deleted": schema_id}


# ── Fonts ─────────────────────────────────────────────────────────────────


# Axis sort order for URL generation (Google Fonts CSS2 requires alphabetical
# axis names in the @-tuple). Lowercase axes come before uppercase per CSS2 spec.
_AXIS_ORDER = ["ital", "opsz", "slnt", "wdth", "wght", "SOFT", "WONK"]


def _build_font_url(family: str, axes_json: str | None) -> str | None:
    """Build a Google Fonts CSS2 URL from a family name + axes JSON.

    If `axes_json` is null or invalid, returns a basic URL (family only, no
    axes) so the font still loads with default settings.
    """
    # Extract the family name from the CSS stack
    fam = family.split(",")[0].strip().strip('"').replace(" ", "+")

    if not axes_json:
        return f"https://fonts.googleapis.com/css2?family={fam}&display=swap"

    try:
        axes = json.loads(axes_json)
    except (json.JSONDecodeError, TypeError):
        return f"https://fonts.googleapis.com/css2?family={fam}&display=swap"

    # Extract the family name from the CSS stack (e.g. '"Fraunces", Georgia, serif' → 'Fraunces')
    fam = family.split(",")[0].strip().strip('"').replace(" ", "+")

    # Build the axis declaration string
    axis_parts = []
    italic_axis = axes.get("ital", False)

    # Determine which axes to include and their tuple values
    axis_values = {}
    if italic_axis:
        axis_values["ital"] = [0, 1]  # both upright and italic
    for ax_name in ["wght", "opsz", "slnt", "wdth", "SOFT", "WONK"]:
        val = axes.get(ax_name)
        if val is None:
            continue
        if isinstance(val, list) and len(val) == 2:
            axis_values[ax_name] = val
        elif isinstance(val, bool):
            axis_values[ax_name] = [0, 1] if val else [0]
        elif isinstance(val, (int, float)):
            axis_values[ax_name] = [val, val]

    # Sort axes per CSS2 spec
    sorted_axes = sorted(axis_values.keys(), key=lambda a: _AXIS_ORDER.index(a) if a in _AXIS_ORDER else 99)

    if not sorted_axes:
        return f"https://fonts.googleapis.com/css2?family={fam}&display=swap"

    # Build axis names string (comma-separated)
    axis_names = ",".join(sorted_axes)

    # Build tuples. For italic, we need two tuples: one for upright (ital=0)
    # and one for italic (ital=1), each with the other axes' ranges.
    if italic_axis:
        # CSS2 with italic: axes are listed once, but values are semicolon-separated
        # for upright;italic. The non-italic axes use their range for both.
        other_ranges = []
        for ax in sorted_axes:
            if ax == "ital":
                continue
            vals = axis_values[ax]
            other_ranges.append(f"{vals[0]}..{vals[1]}" if vals[0] != vals[1] else str(vals[0]))

        # upright tuple: 0,<other ranges>
        upright = "0," + ",".join(other_ranges) if other_ranges else "0"
        # italic tuple: 1,<other ranges>
        italic = "1," + ",".join(other_ranges) if other_ranges else "1"
        axis_tuple = f"{upright};{italic}"
    else:
        # No italic — single tuple
        ranges = []
        for ax in sorted_axes:
            vals = axis_values[ax]
            ranges.append(f"{vals[0]}..{vals[1]}" if vals[0] != vals[1] else str(vals[0]))
        axis_tuple = ",".join(ranges)

    return f"https://fonts.googleapis.com/css2?family={fam}:{axis_names}@{axis_tuple}&display=swap"


class FontCreate(BaseModel):
    name: str
    family: str
    url: str | None = None
    axes: str | None = None


class FontUpdate(BaseModel):
    name: str | None = None
    family: str | None = None
    url: str | None = None
    axes: str | None = None
    is_active: bool | None = None


class DetectAxesRequest(BaseModel):
    family: str


def _serialize_font(f: Font) -> dict:
    """Serialize a Font, generating the URL from axes when available."""
    url = f.url
    if f.axes and not url:
        url = _build_font_url(f.family, f.axes)
    return {
        "id": f.id,
        "name": f.name,
        "family": f.family,
        "url": url,
        "axes": f.axes,
        "is_active": f.is_active,
        "created_at": f.created_at.isoformat() if f.created_at else None,
        "updated_at": f.updated_at.isoformat() if f.updated_at else None,
    }


@router.get("/fonts")
async def list_fonts(db: AsyncSession = Depends(get_db)):
    """Public: active fonts only `[{id, name, family, url}]`.

    Auth-free, idempotent — the platform injects these to render the font
    library everywhere. Inactive fonts (retired via PUT `is_active=false`)
    stay in the admin list but disappear here, so existing overrides
    referencing their family keep resolving without the font re-offered.
    """
    rows = (
        await db.execute(
            select(Font).where(Font.is_active.is_(True)).order_by(Font.name)
        )
    ).scalars().all()
    return [_serialize_font(r) for r in rows]


@router.post("/fonts")
async def create_font(
    body: FontCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.super_admin])),
):
    """super_admin: create a font. Audit-logged. Duplicate `name` → 409."""
    existing = await db.scalar(select(Font).where(Font.name == body.name))
    if existing is not None:
        raise HTTPException(status_code=409, detail="Font with this name already exists")
    font = Font(name=body.name, family=body.family, url=body.url, axes=body.axes, is_active=True)
    db.add(font)
    await db.flush()
    await log_moderation(
        db, action="create_font", target_type="font", target_id=font.id,
        actor_id=current_user.id, meta={"name": body.name},
    )
    await db.commit()
    await db.refresh(font)
    return _serialize_font(font)


@router.put("/fonts/{font_id}")
async def update_font(
    font_id: int,
    body: FontUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.super_admin])),
):
    """super_admin: update a font's name/family/url/is_active."""
    font = await db.scalar(select(Font).where(Font.id == font_id))
    if font is None:
        raise HTTPException(status_code=404, detail="Font not found")
    font_name = font.name
    was_active = font.is_active
    data = body.model_dump(exclude_unset=True)
    for field in ("name", "family", "url", "axes", "is_active"):
        if field in data:
            setattr(font, field, data[field])
    if "is_active" in data and was_active and not data["is_active"]:
        result = await db.execute(
            delete(OverrideLog).where(
                OverrideLog.property == "font-family",
                OverrideLog.new_value == font_name,
            )
        )
        cnt = result.rowcount
        if cnt:
            await log_moderation(
                db, action="auto_revert_override_rows", target_type="font", target_id=font_id,
                actor_id=current_user.id, meta={"count": cnt, "reason": "font_deactivated", "font_name": font_name},
            )
    await db.commit()
    await db.refresh(font)
    return _serialize_font(font)


@router.delete("/fonts/{font_id}")
async def delete_font(
    font_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.super_admin])),
):
    """super_admin: delete a font. Deletes referencing OverrideLog rows so
    elements silently fall back to their theme default font. Audit-logged."""
    font = await db.scalar(select(Font).where(Font.id == font_id))
    if font is None:
        raise HTTPException(status_code=404, detail="Font not found")
    name = font.name
    result = await db.execute(
        delete(OverrideLog).where(
            OverrideLog.property == "font-family",
            OverrideLog.new_value == name,
        )
    )
    cnt = result.rowcount
    await db.delete(font)
    await log_moderation(
        db, action="delete_font", target_type="font", target_id=font_id,
        actor_id=current_user.id, meta={"name": name},
    )
    if cnt:
        await log_moderation(
            db, action="auto_revert_override_rows", target_type="font", target_id=font_id,
            actor_id=current_user.id, meta={"count": cnt, "reason": "font_deleted", "font_name": name},
        )
    await db.commit()
    return {"ok": True, "deleted": font_id}


# ── Font axis detection ──────────────────────────────────────────────────


# Maps Google Fonts CSS2 axis tags to human-readable descriptions.
# The admin can override these labels per-font for context (e.g. "Softness"
# instead of "SOFT"). These are the defaults the detect endpoint returns.
_AXIS_LABELS: dict[str, str] = {
    "ital": "Italic",
    "opsz": "Optical size",
    "slnt": "Slant",
    "wdth": "Width",
    "wght": "Weight",
    "SOFT": "Softness",
    "WONK": "Wonky",
}


@router.post("/fonts/detect-axes")
async def detect_font_axes(
    body: DetectAxesRequest,
    current_user: User = Depends(require_role([UserRole.super_admin])),
):
    """super_admin: detect which variable-font axes a Google Font supports.

    Fetches the Google Fonts CSS2 API server-side (avoids CORS, keeps the
    request off the browser) and parses the @font-face declarations to
    determine available axes. Returns a structured description the frontend
    renders as toggle/slider controls in the font form.

    Google Fonts CSS2 always returns the full axis set for a variable font
    when requested without axis constraints — we request with `display=swap`
    and parse the `@font-face` src descriptors for the axis names.
    """
    fam = body.family.split(",")[0].strip().strip('"').replace(" ", "+")
    css_url = f"https://fonts.googleapis.com/css2?family={fam}:ital,opsz,slnt,wdth,wght,SOFT,WONK@0,9..144,0,75..100,300..900,0..100,0..1;1,9..144,0,75..100,300..900,0..100,0..1&display=swap"

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(css_url, headers={"User-Agent": "RootLink/1.0"})
    except Exception:
        raise HTTPException(status_code=502, detail="Could not reach Google Fonts")

    if resp.status_code != 200:
        raise HTTPException(status_code=404, detail=f"Font '{body.family}' not found on Google Fonts")

    css_text = resp.text

    # Google Fonts CSS2 returns @font-face blocks. Variable fonts include
    # font-variation-settings declarations with the axis names. We look for
    # the axis names in the "src: url(...)" unicode-range descriptors AND
    # in the font-variation-settings property.
    #
    # The reliable signal: if the CSS contains "font-variation-settings:",
    # the font is variable and the axis names are in that declaration.
    # For italic, we check if there's a separate @font-face with "font-style: italic".

    axes: dict = {}
    has_italic = "font-style: italic" in css_text

    # Parse font-variation-settings to find axis names
    import re
    variation_matches = re.findall(r'font-variation-settings:\s*([^;]+);', css_text)
    found_axes: set[str] = set()
    for match in variation_matches:
        # Each match looks like: "wght" 400, "opsz" 14, "SOFT" 50, "WONK" 0
        axis_names = re.findall(r'"([^"]+)"', match)
        found_axes.update(axis_names)

    # Build the response with defaults
    for ax in ["ital", "opsz", "slnt", "wdth", "wght", "SOFT", "WONK"]:
        if ax == "ital":
            axes[ax] = has_italic
        elif ax in found_axes:
            # Provide sensible default ranges; the admin adjusts
            default_ranges = {
                "wght": [300, 900],
                "opsz": [9, 144],
                "slnt": [-12, 0],
                "wdth": [75, 100],
                "SOFT": [0, 100],
                "WONK": [0, 1],
            }
            axes[ax] = default_ranges.get(ax, [0, 1])
        else:
            axes[ax] = None

    # Build human-readable labels
    labels = {ax: _AXIS_LABELS.get(ax, ax) for ax, val in axes.items() if val is not None}

    return {
        "family": body.family,
        "axes": axes,
        "labels": labels,
        "is_variable": len(found_axes) > 0,
    }
