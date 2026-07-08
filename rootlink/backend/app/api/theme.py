"""Content Studio — Theming module: CSS custom-property token overrides.

Sibling of `app/api/content_ui.py` (image/icon slots) and `app/api/copy.py`
(text keys). This router covers the theming substrate described in
docs/content-studio/CONTENT_STUDIO.md §4: the studio writes overrides to CSS
custom properties (`--color-primary-600`, `--font-display`, `--radius-xl2`)
that the frontend resolves at runtime via `var(--token)` — live theming with
real-time preview, no rebuild.

Access mirrors the content-ui editor: strictly `super_admin` (via the shared
`require_role` helper from `app/api/admin.py`) — no `can_edit_copy` delegation.
"""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.admin import require_role
from app.core.database import get_db
from app.models.theme_override import ThemeOverride
from app.models.user import User, UserRole
from app.services.audit import log_moderation

router = APIRouter(prefix="/api/theme", tags=["theme"])


class ThemeValue(BaseModel):
    value: str
    scope: str | None = None


@router.get("")
async def get_overrides(db: AsyncSession = Depends(get_db)):
    """Public: { token: value } override map for `:root`.

    Frontend merges these over the static CSS defaults in `globals.css`
    (docs/content-studio/CONTENT_STUDIO.md §4). GET-only, auth-free, and
    idempotent — safe to cache aggressively at the edge.
    """
    rows = (await db.execute(select(ThemeOverride))).scalars().all()
    return {r.token: r.value for r in rows}


@router.get("/all")
async def list_all_overrides(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.super_admin])),
):
    """super_admin: full override list with metadata (studio admin view)."""
    rows = (
        await db.execute(select(ThemeOverride).order_by(ThemeOverride.token))
    ).scalars().all()
    return [
        {
            "id": r.id,
            "token": r.token,
            "value": r.value,
            "scope": r.scope,
            "updated_by": r.updated_by,
            "updated_at": r.updated_at.isoformat() if r.updated_at else None,
        }
        for r in rows
    ]


@router.put("/{token:path}")
async def set_override(
    token: str,
    body: ThemeValue,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.super_admin])),
):
    scope = body.scope or "global"
    existing = await db.scalar(select(ThemeOverride).where(ThemeOverride.token == token))
    if existing:
        existing.value = body.value
        existing.scope = scope
        existing.updated_by = current_user.id
    else:
        db.add(
            ThemeOverride(
                token=token, value=body.value, scope=scope, updated_by=current_user.id
            )
        )
    await log_moderation(
        db, action="edit_theme", target_type="theme", target_id=None,
        actor_id=current_user.id, meta={"token": token, "scope": scope},
    )
    await db.commit()
    return {"ok": True, "token": token, "value": body.value, "scope": scope}


@router.delete("/{token:path}", status_code=200)
async def revert_override(
    token: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.super_admin])),
):
    existing = await db.scalar(select(ThemeOverride).where(ThemeOverride.token == token))
    if existing:
        await db.delete(existing)
        await log_moderation(
            db, action="revert_theme", target_type="theme", target_id=None,
            actor_id=current_user.id, meta={"token": token},
        )
        await db.commit()
    return {"ok": True, "reverted": token, "at": datetime.now(UTC).isoformat()}
