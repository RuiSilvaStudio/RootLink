"""Content Studio Phase 3 — override guardrail + draft/publish.

Two sibling surfaces in one router (docs/content-studio/CONTENT_STUDIO.md
§6 override guardrail, §7 draft→publish):

- `/api/overrides` — the deviation log. When an editor changes a property
  away from its theme default, the (element_path, property, old→new) tuple
  is confirmed inline and logged here; a badge on the element links back
  to the row; revert deletes it. `is_stale` flags overrides whose default
  later changed (§6 "Stale-override warning"). Public reads are auth-free
  (the frontend needs them to render badges); writes are strictly
  `super_admin` — no `can_edit_copy` delegation, same gate as `theme.py`.

- `/api/drafts` — per-page draft overlays. All in-flight edits to a page
  accumulate as one draft; `publish` flips it live, `discard` deletes it.

Mirrors `app/api/theme.py`'s auth + audit pattern: the shared `require_role`
helper from `app/api/admin.py` for the `super_admin` gate, and
`log_moderation` for the append-only audit trail
(docs/content-platform/CONTENT_PLATFORM.md §8).
"""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.admin import require_role
from app.core.database import get_db
from app.models.override_log import OverrideLog
from app.models.page_draft import PageDraft
from app.models.user import User, UserRole
from app.services.audit import log_moderation

router = APIRouter(prefix="/api", tags=["overrides"])


class OverrideBody(BaseModel):
    page_slug: str
    element_path: str
    property: str
    old_value: str | None = None
    new_value: str


class DraftChange(BaseModel):
    """A single change in a page draft. kind="style" for element property
    overrides; kind="text" for inline copy edits (via the overlay's text
    editing). Accepts camelCase from the frontend overlay-provider via
    pydantic aliases (elementPath → element_path etc.)."""
    model_config = {"populate_by_name": True}

    kind: str = "style"
    # style-kind fields
    element_path: str = Field(default="", alias="elementPath")
    property: str = ""
    value: str
    old_value: str | None = Field(default=None, alias="oldValue")
    # text-kind fields (only set when kind="text")
    copy_key: str | None = Field(default=None, alias="copyKey")
    locale: str | None = None


class DraftBody(BaseModel):
    page_slug: str
    changes: list[DraftChange]


# ── Override log ───────────────────────────────────────────────────────

@router.get("/overrides")
async def list_page_overrides(
    page: str = Query(...),
    db: AsyncSession = Depends(get_db),
):
    """Public: override log for one page.

    Frontend merges these to render the "has override" badges + revert
    affordances (CONTENT_STUDIO.md §6). GET-only, auth-free, idempotent —
    safe to cache aggressively at the edge.
    """
    rows = (
        await db.execute(
            select(OverrideLog)
            .where(OverrideLog.page_slug == page)
            .order_by(OverrideLog.id)
        )
    ).scalars().all()
    return [
        {
            "id": r.id,
            "element_path": r.element_path,
            "property": r.property,
            "old_value": r.old_value,
            "new_value": r.new_value,
            "is_stale": r.is_stale,
        }
        for r in rows
    ]


@router.get("/overrides/all")
async def list_all_overrides(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.super_admin])),
):
    """super_admin: every override across all pages (studio dashboard report)."""
    rows = (
        await db.execute(
            select(OverrideLog).order_by(OverrideLog.page_slug, OverrideLog.id)
        )
    ).scalars().all()
    return [
        {
            "id": r.id,
            "page_slug": r.page_slug,
            "element_path": r.element_path,
            "property": r.property,
            "old_value": r.old_value,
            "new_value": r.new_value,
            "user_id": r.user_id,
            "is_stale": r.is_stale,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            "updated_at": r.updated_at.isoformat() if r.updated_at else None,
        }
        for r in rows
    ]


@router.post("/overrides")
async def create_override(
    body: OverrideBody,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.super_admin])),
):
    """super_admin: log an override (upsert on page+element+property).

    Mirrors `theme.py`'s PUT upsert: a second confirm on the same
    (page_slug, element_path, property) updates in place rather than
    duplicating. Re-confirming also clears `is_stale` — the editor
    re-asserted intent, so the "default changed" warning no longer applies.
    Audit-logged.
    """
    existing = await db.scalar(
        select(OverrideLog).where(
            OverrideLog.page_slug == body.page_slug,
            OverrideLog.element_path == body.element_path,
            OverrideLog.property == body.property,
        )
    )
    if existing:
        existing.old_value = body.old_value
        existing.new_value = body.new_value
        existing.user_id = current_user.id
        existing.is_stale = False
        override_id = existing.id
    else:
        row = OverrideLog(
            page_slug=body.page_slug,
            element_path=body.element_path,
            property=body.property,
            old_value=body.old_value,
            new_value=body.new_value,
            user_id=current_user.id,
        )
        db.add(row)
        await db.flush()
        override_id = row.id
    await log_moderation(
        db, action="create_override", target_type="override", target_id=override_id,
        actor_id=current_user.id,
        meta={
            "page_slug": body.page_slug,
            "element_path": body.element_path,
            "property": body.property,
        },
    )
    await db.commit()
    return {"ok": True, "id": override_id}


@router.delete("/overrides/{override_id}", status_code=200)
async def revert_override(
    override_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.super_admin])),
):
    """super_admin: revert (delete) an override — the badge's revert action
    (§6 step 4). Audit-logged. Idempotent: a missing row still returns ok
    (a double-click on revert shouldn't 404)."""
    row = await db.get(OverrideLog, override_id)
    if row:
        await db.delete(row)
        await log_moderation(
            db, action="revert_override", target_type="override", target_id=override_id,
            actor_id=current_user.id,
            meta={
                "page_slug": row.page_slug,
                "element_path": row.element_path,
                "property": row.property,
            },
        )
        await db.commit()
    return {"ok": True, "reverted": override_id}


@router.put("/overrides/{override_id}/stale")
async def mark_override_stale(
    override_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.super_admin])),
):
    """super_admin: flag an override as stale — its theme default later
    changed, so the override may no longer be intentional (§6 stale-override
    warning). Audit-logged."""
    row = await db.get(OverrideLog, override_id)
    if not row:
        raise HTTPException(status_code=404, detail="Override not found")
    row.is_stale = True
    await log_moderation(
        db, action="mark_override_stale", target_type="override", target_id=override_id,
        actor_id=current_user.id, meta={"page_slug": row.page_slug},
    )
    await db.commit()
    return {"ok": True, "id": override_id, "is_stale": True}


# ── Drafts ────────────────────────────────────────────────────────────

@router.get("/drafts")
async def get_draft(
    page: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.super_admin])),
):
    """super_admin: the draft for a page (or null if none). Drafts are never
    public — visitors see the published version (CONTENT_STUDIO.md §7)."""
    row = await db.scalar(select(PageDraft).where(PageDraft.page_slug == page))
    if not row:
        return None
    return {
        "id": row.id,
        "page_slug": row.page_slug,
        "status": row.status,
        "changes": row.changes,
        "created_by": row.created_by,
        "created_at": row.created_at.isoformat() if row.created_at else None,
        "updated_at": row.updated_at.isoformat() if row.updated_at else None,
        "published_at": row.published_at.isoformat() if row.published_at else None,
    }


@router.post("/drafts")
async def save_draft(
    body: DraftBody,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.super_admin])),
):
    """super_admin: create or update a page draft (upsert on page_slug).

    A saved draft is not yet visitor-visible — `publish` is the separate,
    explicit step (§7). Audit-logged.
    """
    existing = await db.scalar(select(PageDraft).where(PageDraft.page_slug == body.page_slug))
    if existing:
        existing.changes = [c.model_dump() for c in body.changes]
        existing.created_by = current_user.id
        draft_id = existing.id
    else:
        row = PageDraft(
            page_slug=body.page_slug,
            status="draft",
            changes=[c.model_dump() for c in body.changes],
            created_by=current_user.id,
        )
        db.add(row)
        await db.flush()
        draft_id = row.id
    await log_moderation(
        db, action="save_draft", target_type="page_draft", target_id=draft_id,
        actor_id=current_user.id, meta={"page_slug": body.page_slug},
    )
    await db.commit()
    return {"ok": True, "id": draft_id, "status": "draft"}


@router.post("/drafts/{slug:path}/publish")
async def publish_draft(
    slug: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.super_admin])),
):
    """super_admin: publish a page draft — flips `status` to "published" and
    stamps `published_at`. Visitors now see the changes. Audit-logged."""
    row = await db.scalar(select(PageDraft).where(PageDraft.page_slug == slug))
    if not row:
        raise HTTPException(status_code=404, detail="Draft not found")
    row.status = "published"
    row.published_at = datetime.now(UTC)
    await log_moderation(
        db, action="publish_draft", target_type="page_draft", target_id=row.id,
        actor_id=current_user.id, meta={"page_slug": slug},
    )
    await db.commit()
    return {"ok": True, "id": row.id, "status": "published"}


@router.delete("/drafts/{slug:path}", status_code=200)
async def discard_draft(
    slug: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.super_admin])),
):
    """super_admin: discard a page draft — throw away all uncommitted changes
    on that page (§7). Audit-logged. Idempotent: discarding a draft that
    never existed still returns ok."""
    row = await db.scalar(select(PageDraft).where(PageDraft.page_slug == slug))
    if row:
        await db.delete(row)
        await log_moderation(
            db, action="discard_draft", target_type="page_draft", target_id=row.id,
            actor_id=current_user.id, meta={"page_slug": slug},
        )
        await db.commit()
    return {"ok": True, "discarded": slug}
