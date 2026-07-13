"""Translation API — machine translation + Translation Memory for site copy.

Built on Argos Translate (MIT). See docs/content-platform/ for the full
pipeline spec. Source-of-truth locale is PT; all translations flow outward.

Endpoints:
  POST /api/translate         — single string (checks TM first, then MT)
  POST /api/translate/bulk    — batch (used by "Auto-translate all empty")
  GET  /api/translate/tm      — list/search Translation Memory entries
  DELETE /api/translate/tm/{id} — delete a TM entry

All endpoints are super_admin only — the TM/MT corpus should not be
pollutable by non-admins.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.content_ui import require_super_admin
from app.core.database import get_db
from app.models.translation_memory import TranslationMemory
from app.models.user import User
from app.services.translation_service import translate, translate_bulk

router = APIRouter(prefix="/api/translate", tags=["translate"])


class TranslateRequest(BaseModel):
    source_text: str
    source_locale: str
    target_locale: str


class TranslateResponse(BaseModel):
    value: str
    origin: str


class BulkTranslateItem(BaseModel):
    key: str
    source_text: str


class BulkTranslateRequest(BaseModel):
    items: list[BulkTranslateItem]
    source_locale: str
    target_locale: str


class BulkTranslateResultItem(BaseModel):
    key: str
    value: str
    origin: str
    error: str | None = None


class BulkTranslateResponse(BaseModel):
    results: list[BulkTranslateResultItem]


@router.post("", response_model=TranslateResponse)
async def translate_single(
    body: TranslateRequest,
    _: User = Depends(require_super_admin),
) -> TranslateResponse:
    res = await translate(body.source_text, body.source_locale, body.target_locale)
    return TranslateResponse(value=res["value"], origin=res["origin"])


@router.post("/bulk", response_model=BulkTranslateResponse)
async def translate_many(
    body: BulkTranslateRequest,
    _: User = Depends(require_super_admin),
) -> BulkTranslateResponse:
    items = [{"key": i.key, "source_text": i.source_text} for i in body.items]
    results = await translate_bulk(items, body.source_locale, body.target_locale)
    return BulkTranslateResponse(
        results=[BulkTranslateResultItem(**r) for r in results]
    )


class TMEntry(BaseModel):
    id: int
    source_text: str
    source_locale: str
    target_locale: str
    accepted_value: str
    copy_key: str | None = None
    updated_by: int | None = None
    updated_at: str


@router.get("/tm", response_model=list[TMEntry])
async def list_tm(
    q: str = Query("", description="Search source text or accepted value"),
    target_locale: str = Query("", description="Filter by target locale"),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_super_admin),
) -> list[TMEntry]:
    """List Translation Memory entries, optionally filtered by search text."""
    stmt = select(TranslationMemory)
    if q.strip():
        like = f"%{q.strip()}%"
        stmt = stmt.where(
            TranslationMemory.source_text.like(like)
            | TranslationMemory.accepted_value.like(like)
        )
    if target_locale.strip():
        stmt = stmt.where(TranslationMemory.target_locale == target_locale)
    stmt = stmt.order_by(TranslationMemory.updated_at.desc())
    rows = (await db.execute(stmt)).scalars().all()
    return [
        TMEntry(
            id=r.id,
            source_text=r.source_text,
            source_locale=r.source_locale,
            target_locale=r.target_locale,
            accepted_value=r.accepted_value,
            copy_key=r.copy_key,
            updated_by=r.updated_by,
            updated_at=r.updated_at.isoformat() if r.updated_at else "",
        )
        for r in rows
    ]


@router.delete("/tm/{tm_id}", status_code=200)
async def delete_tm(
    tm_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    """Delete a Translation Memory entry (e.g. a stale one)."""
    entry = await db.get(TranslationMemory, tm_id)
    if not entry:
        raise HTTPException(status_code=404, detail="TM entry not found")
    await db.delete(entry)
    await db.commit()
    return {"ok": True, "deleted": tm_id}
