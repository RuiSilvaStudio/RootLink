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

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.admin import require_role
from app.core.database import get_db
from app.models.element_schema import ElementSchema
from app.models.font import Font
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


class FontCreate(BaseModel):
    name: str
    family: str
    url: str | None = None


class FontUpdate(BaseModel):
    name: str | None = None
    family: str | None = None
    url: str | None = None
    is_active: bool | None = None


def _serialize_font(f: Font) -> dict:
    return {
        "id": f.id,
        "name": f.name,
        "family": f.family,
        "url": f.url,
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
    return [{"id": r.id, "name": r.name, "family": r.family, "url": r.url} for r in rows]


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
    font = Font(name=body.name, family=body.family, url=body.url, is_active=True)
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
    data = body.model_dump(exclude_unset=True)
    for field in ("name", "family", "url", "is_active"):
        if field in data:
            setattr(font, field, data[field])
    await db.commit()
    await db.refresh(font)
    return _serialize_font(font)


@router.delete("/fonts/{font_id}")
async def delete_font(
    font_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.super_admin])),
):
    """super_admin: delete a font. Audit-logged."""
    font = await db.scalar(select(Font).where(Font.id == font_id))
    if font is None:
        raise HTTPException(status_code=404, detail="Font not found")
    name = font.name
    await db.delete(font)
    await log_moderation(
        db, action="delete_font", target_type="font", target_id=font_id,
        actor_id=current_user.id, meta={"name": name},
    )
    await db.commit()
    return {"ok": True, "deleted": font_id}
