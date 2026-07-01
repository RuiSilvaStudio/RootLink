"""Content UI Editor — image & icon overrides for static site chrome.

Sibling of `app/api/copy.py` (which covers text/`t()` keys via `copy_overrides`).
This router covers the two other editable element types the in-place editor
supports: swapping a static image and swapping a curated icon.

Access is intentionally stricter than the text-copy feature: strictly
`super_admin`, no `can_edit_copy` delegation (discovery/mockups/content-ui-editor/
briefing-to-build-local.md — "Only the super admin can access this").
"""

from datetime import UTC, datetime
from typing import Literal

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.content_ui_override import ContentUIOverride
from app.models.user import User, UserRole
from app.services.audit import log_moderation

router = APIRouter(prefix="/api/content-ui", tags=["content-ui"])


def require_super_admin(current_user: User = Depends(get_current_user)) -> User:
    if current_user.role != UserRole.super_admin:
        raise HTTPException(status_code=403, detail="Only super admins can edit site content")
    return current_user


class ContentUIValue(BaseModel):
    kind: Literal["image", "icon"]
    value: dict


@router.get("")
async def get_overrides(db: AsyncSession = Depends(get_db)):
    """Public: { key: {kind, value} } overrides. Frontend merges over static defaults."""
    rows = (await db.execute(select(ContentUIOverride))).scalars().all()
    return {r.key: {"kind": r.kind, "value": r.value} for r in rows}


@router.put("/{key:path}")
async def set_override(
    key: str,
    body: ContentUIValue,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    existing = await db.scalar(select(ContentUIOverride).where(ContentUIOverride.key == key))
    if existing:
        existing.kind = body.kind
        existing.value = body.value
        existing.updated_by = current_user.id
    else:
        db.add(
            ContentUIOverride(
                key=key, kind=body.kind, value=body.value, updated_by=current_user.id
            )
        )
    await log_moderation(
        db, action="edit_content_ui", target_type="content_ui", target_id=None,
        actor_id=current_user.id, meta={"key": key, "kind": body.kind},
    )
    await db.commit()
    return {"ok": True, "key": key, "kind": body.kind, "value": body.value}


@router.delete("/{key:path}", status_code=200)
async def revert_override(
    key: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_super_admin),
):
    existing = await db.scalar(select(ContentUIOverride).where(ContentUIOverride.key == key))
    if existing:
        await db.delete(existing)
        await log_moderation(
            db, action="revert_content_ui", target_type="content_ui", target_id=None,
            actor_id=current_user.id, meta={"key": key},
        )
        await db.commit()
    return {"ok": True, "reverted": key, "at": datetime.now(UTC).isoformat()}
