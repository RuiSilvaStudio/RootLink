"""Content Studio — Phase 4: Dashboard theme manager (multi-theme + named tokens).

Sibling of `app/api/theme.py` (the v1 single-palette override substrate).
This router covers the multi-theme substrate described in
docs/content-studio/CONTENT_STUDIO.md §8 (dark-mode safety — named tokens with
light+dark pairs) and §9 (multi-theme — full palette swaps): themes are named
palettes of CSS custom-property tokens; activating one swaps the live palette
while element overrides persist (they reference token names, not raw values).

Access mirrors `theme.py`: strictly `super_admin` (via the shared `require_role`
helper from `app/api/admin.py`) for every write — no `can_edit_copy`
delegation. Public reads are gated by `is_published`; the active theme is
always readable (it is published on activate).
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.admin import require_role
from app.core.database import get_db
from app.core.entity_resolution import ROLE_RANK
from app.core.permissions import rank_at_least
from app.core.security import get_optional_user
from app.models.theme import Theme, ThemeToken
from app.models.user import User, UserRole
from app.services.audit import log_moderation

router = APIRouter(prefix="/api/themes", tags=["theme-manager"])


class ThemeCreate(BaseModel):
    name: str
    description: str | None = None


class ThemeUpdate(BaseModel):
    name: str | None = None
    description: str | None = None
    is_published: bool | None = None


class TokenCreate(BaseModel):
    token_name: str
    light_value: str
    dark_value: str | None = None
    category: str


class TokenUpdate(BaseModel):
    light_value: str | None = None
    dark_value: str | None = None
    category: str | None = None


def _serialize_theme(t: Theme) -> dict:
    return {
        "id": t.id,
        "name": t.name,
        "description": t.description,
        "is_active": t.is_active,
        "is_published": t.is_published,
        "created_by": t.created_by,
        "created_at": t.created_at.isoformat() if t.created_at else None,
        "updated_at": t.updated_at.isoformat() if t.updated_at else None,
    }


def _serialize_token(t: ThemeToken) -> dict:
    return {
        "id": t.id,
        "token_name": t.token_name,
        "light_value": t.light_value,
        "dark_value": t.dark_value,
        "category": t.category,
    }


# ── Theme endpoints ──────────────────────────────────────────────────────


@router.get("")
async def list_published_themes(db: AsyncSession = Depends(get_db)):
    """Public: published themes only `[{id, name, description, is_active}]`.

    Auth-free, idempotent — safe to cache at the edge (mirrors the public reads
    of `theme.py` and `blocks.py`).
    """
    rows = (
        await db.execute(
            select(Theme).where(Theme.is_published.is_(True)).order_by(Theme.name)
        )
    ).scalars().all()
    return [
        {"id": r.id, "name": r.name, "description": r.description, "is_active": r.is_active}
        for r in rows
    ]


@router.get("/active")
async def get_active_theme(db: AsyncSession = Depends(get_db)):
    """Public: the active theme + its tokens (the live palette).

    Returns `{id, name, description, tokens: [{token_name, light_value,
    dark_value, category}]}`. The active theme is always published (activate
    also publishes), so this is unconditionally public.
    """
    theme = await db.scalar(select(Theme).where(Theme.is_active.is_(True)))
    if theme is None:
        raise HTTPException(status_code=404, detail="No active theme")
    tokens = (
        await db.execute(
            select(ThemeToken)
            .where(ThemeToken.theme_id == theme.id)
            .order_by(ThemeToken.token_name)
        )
    ).scalars().all()
    return {
        "id": theme.id,
        "name": theme.name,
        "description": theme.description,
        "tokens": [_serialize_token(t) for t in tokens],
    }


@router.get("/admin")
async def list_all_themes(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.super_admin])),
):
    """super_admin: ALL themes, including unpublished drafts."""
    rows = (await db.execute(select(Theme).order_by(Theme.id))).scalars().all()
    return [_serialize_theme(r) for r in rows]


@router.post("")
async def create_theme(
    body: ThemeCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.super_admin])),
):
    """super_admin: create a new unpublished draft theme. Audit-logged."""
    theme = Theme(name=body.name, description=body.description, created_by=current_user.id)
    db.add(theme)
    await db.flush()
    await log_moderation(
        db, action="create_theme", target_type="theme", target_id=theme.id,
        actor_id=current_user.id, meta={"name": body.name},
    )
    await db.commit()
    await db.refresh(theme)
    return _serialize_theme(theme)


@router.put("/{theme_id}")
async def update_theme(
    theme_id: int,
    body: ThemeUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.super_admin])),
):
    """super_admin: update theme metadata (name/description/is_published)."""
    theme = await db.scalar(select(Theme).where(Theme.id == theme_id))
    if theme is None:
        raise HTTPException(status_code=404, detail="Theme not found")
    data = body.model_dump(exclude_unset=True)
    for field in ("name", "description", "is_published"):
        if field in data:
            setattr(theme, field, data[field])
    await db.commit()
    await db.refresh(theme)
    return _serialize_theme(theme)


@router.post("/{theme_id}/activate")
async def activate_theme(
    theme_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.super_admin])),
):
    """super_admin: publish + make this theme live. Audit-logged.

    Sets `is_active=True` on this theme and `is_active=False` on every other
    (the exactly-one-active invariant). Also publishes the theme — activate is
    the "publish and make live" action (CONTENT_STUDIO.md §7, §9).
    """
    theme = await db.scalar(select(Theme).where(Theme.id == theme_id))
    if theme is None:
        raise HTTPException(status_code=404, detail="Theme not found")
    await db.execute(
        update(Theme).where(Theme.id != theme_id).values(is_active=False)
    )
    theme.is_active = True
    theme.is_published = True
    await log_moderation(
        db, action="activate_theme", target_type="theme", target_id=theme.id,
        actor_id=current_user.id, meta={"name": theme.name},
    )
    await db.commit()
    return {"ok": True, "id": theme.id, "name": theme.name, "is_active": True}


@router.delete("/{theme_id}")
async def delete_theme(
    theme_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.super_admin])),
):
    """super_admin: delete a theme (cannot delete the active one). Audit-logged."""
    theme = await db.scalar(select(Theme).where(Theme.id == theme_id))
    if theme is None:
        raise HTTPException(status_code=404, detail="Theme not found")
    if theme.is_active:
        raise HTTPException(status_code=409, detail="Cannot delete the active theme")
    name = theme.name
    await db.delete(theme)
    await log_moderation(
        db, action="delete_theme", target_type="theme", target_id=theme_id,
        actor_id=current_user.id, meta={"name": name},
    )
    await db.commit()
    return {"ok": True, "deleted": theme_id}


# ── Token endpoints ──────────────────────────────────────────────────────


@router.get("/{theme_id}/tokens")
async def get_theme_tokens(
    theme_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    """All tokens for a theme. Public if the theme is published; super_admin only otherwise."""
    theme = await db.scalar(select(Theme).where(Theme.id == theme_id))
    if theme is None:
        raise HTTPException(status_code=404, detail="Theme not found")
    if not theme.is_published:
        if not (
            current_user is not None
            and rank_at_least(current_user, ROLE_RANK[UserRole.super_admin.value])
        ):
            raise HTTPException(status_code=403, detail="Not enough permissions")
    tokens = (
        await db.execute(
            select(ThemeToken)
            .where(ThemeToken.theme_id == theme_id)
            .order_by(ThemeToken.token_name)
        )
    ).scalars().all()
    return [_serialize_token(t) for t in tokens]


@router.post("/{theme_id}/tokens")
async def upsert_theme_token(
    theme_id: int,
    body: TokenCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.super_admin])),
):
    """super_admin: upsert a token (update in place if token_name exists). Audit-logged."""
    theme = await db.scalar(select(Theme).where(Theme.id == theme_id))
    if theme is None:
        raise HTTPException(status_code=404, detail="Theme not found")
    existing = await db.scalar(
        select(ThemeToken).where(
            ThemeToken.theme_id == theme_id,
            ThemeToken.token_name == body.token_name,
        )
    )
    if existing:
        existing.light_value = body.light_value
        existing.dark_value = body.dark_value
        existing.category = body.category
        token = existing
    else:
        token = ThemeToken(
            theme_id=theme_id,
            token_name=body.token_name,
            light_value=body.light_value,
            dark_value=body.dark_value,
            category=body.category,
        )
        db.add(token)
    await db.flush()
    await log_moderation(
        db, action="upsert_theme_token", target_type="theme_token", target_id=theme_id,
        actor_id=current_user.id,
        meta={"theme_id": theme_id, "token_name": body.token_name},
    )
    await db.commit()
    await db.refresh(token)
    return {"ok": True, **_serialize_token(token)}


@router.put("/tokens/{token_id}")
async def update_theme_token(
    token_id: int,
    body: TokenUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.super_admin])),
):
    """super_admin: update a token's light/dark/category values.

    `model_dump(exclude_unset=True)` so an explicitly-sent `dark_value: null`
    clears the dark variant, while an omitted field is left untouched.
    """
    token = await db.scalar(select(ThemeToken).where(ThemeToken.id == token_id))
    if token is None:
        raise HTTPException(status_code=404, detail="Token not found")
    data = body.model_dump(exclude_unset=True)
    for field in ("light_value", "dark_value", "category"):
        if field in data:
            setattr(token, field, data[field])
    await db.commit()
    await db.refresh(token)
    return {"ok": True, **_serialize_token(token)}


@router.delete("/tokens/{token_id}")
async def delete_theme_token(
    token_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.super_admin])),
):
    """super_admin: delete a token. Audit-logged."""
    token = await db.scalar(select(ThemeToken).where(ThemeToken.id == token_id))
    if token is None:
        raise HTTPException(status_code=404, detail="Token not found")
    name = token.token_name
    theme_id = token.theme_id
    await db.delete(token)
    await log_moderation(
        db, action="delete_theme_token", target_type="theme_token", target_id=token_id,
        actor_id=current_user.id, meta={"theme_id": theme_id, "token_name": name},
    )
    await db.commit()
    return {"ok": True, "deleted": token_id}
