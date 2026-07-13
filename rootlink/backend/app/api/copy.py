"""Editable site copy (CONTENT_PLATFORM.md §12).

Public reads return the override map for a locale (merged over the static JSON on
the frontend). Writes require `can_edit_copy` (super_admin holds it inherently).

Phase 2: saving a non-PT override also upserts a Translation Memory row from
the PT source → accepted value, so future auto-translations with the same
source text return the human-accepted version instead of MT.
"""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.copy_override import CopyOverride
from app.models.translation_memory import TranslationMemory
from app.models.user import User, UserRole
from app.services.audit import log_moderation

router = APIRouter(prefix="/api/copy", tags=["copy"])

# The source-of-truth locale — all translations flow from PT outward.
SOURCE_LOCALE = "pt"


def require_copy_editor(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role == UserRole.super_admin or current_user.can_edit_copy:
        return current_user
    raise HTTPException(status_code=403, detail="Not allowed to edit site copy")


class CopyValue(BaseModel):
    value: str
    # Optional: the PT source text for this key. When saving a non-PT locale,
    # the frontend sends this so the backend can upsert a TM row (source → value).
    source_text: str | None = None


@router.get("")
async def get_overrides(locale: str = Query("pt"), db: AsyncSession = Depends(get_db)):
    """Public: { key: value } overrides for a locale. Frontend merges over static JSON."""
    rows = (await db.execute(select(CopyOverride).where(CopyOverride.locale == locale))).scalars().all()
    return {r.key: r.value for r in rows}


@router.get("/all")
async def list_all(db: AsyncSession = Depends(get_db), _: User = Depends(require_copy_editor)):
    rows = (await db.execute(select(CopyOverride))).scalars().all()
    return [{"key": r.key, "locale": r.locale, "value": r.value} for r in rows]


@router.put("/{key:path}")
async def set_override(
    key: str,
    body: CopyValue,
    locale: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_copy_editor),
):
    existing = await db.scalar(
        select(CopyOverride).where(CopyOverride.key == key, CopyOverride.locale == locale)
    )
    if existing:
        existing.value = body.value
        existing.updated_by = current_user.id
    else:
        db.add(CopyOverride(key=key, locale=locale, value=body.value, updated_by=current_user.id))
    await log_moderation(
        db, action="edit_copy", target_type="copy", target_id=None,
        actor_id=current_user.id, meta={"key": key, "locale": locale},
    )

    # Phase 2: upsert Translation Memory for non-PT saves.
    # The PT source text comes from the request body (frontend sends it
    # from its static messages/pt.json + PT overrides). This keeps the
    # backend decoupled from the frontend's JSON files.
    if locale != SOURCE_LOCALE and body.source_text and body.source_text.strip():
        tm_existing = await db.scalar(
            select(TranslationMemory).where(
                TranslationMemory.source_text == body.source_text,
                TranslationMemory.source_locale == SOURCE_LOCALE,
                TranslationMemory.target_locale == locale,
            )
        )
        if tm_existing:
            tm_existing.accepted_value = body.value
            tm_existing.copy_key = key
            tm_existing.updated_by = current_user.id
        else:
            db.add(TranslationMemory(
                source_text=body.source_text,
                source_locale=SOURCE_LOCALE,
                target_locale=locale,
                accepted_value=body.value,
                copy_key=key,
                updated_by=current_user.id,
            ))

    await db.commit()
    return {"ok": True, "key": key, "locale": locale, "value": body.value}


@router.delete("/{key:path}", status_code=200)
async def revert_override(
    key: str,
    locale: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_copy_editor),
):
    existing = await db.scalar(
        select(CopyOverride).where(CopyOverride.key == key, CopyOverride.locale == locale)
    )
    if existing:
        await db.delete(existing)
        await db.commit()
    return {"ok": True, "reverted": key, "locale": locale, "at": datetime.now(UTC).isoformat()}
