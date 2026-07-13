"""Glossary API — brand and domain term management (Phase 3).

Endpoints:
  GET    /api/translate/glossary           — list all glossary terms
  PUT    /api/translate/glossary/{term}    — upsert a glossary term
  DELETE /api/translate/glossary/{term}    — delete a glossary term

Super_admin only. After any mutation, the in-process glossary cache is
invalidated so the next translate call picks up the change.
"""

from fastapi import APIRouter, Depends, HTTPException, Query
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.content_ui import require_super_admin
from app.core.database import get_db
from app.models.glossary_term import GlossaryTerm
from app.models.user import User
from app.services.translation_service import _invalidate_glossary_cache

router = APIRouter(prefix="/api/translate/glossary", tags=["glossary"])


class GlossaryEntry(BaseModel):
    term_source: str
    source_locale: str
    target_locale: str
    term_target: str
    is_brand: bool = False
    notes: str | None = None


class GlossaryEntryResponse(BaseModel):
    id: int
    term_source: str
    source_locale: str
    target_locale: str
    term_target: str
    is_brand: bool
    notes: str | None = None
    updated_by: int | None = None


@router.get("", response_model=list[GlossaryEntryResponse])
async def list_glossary(
    q: str = Query("", description="Search term_source or term_target"),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_super_admin),
) -> list[GlossaryEntryResponse]:
    """List all glossary terms, optionally filtered by search."""
    stmt = select(GlossaryTerm).order_by(GlossaryTerm.term_source)
    if q.strip():
        like = f"%{q.strip()}%"
        stmt = stmt.where(
            GlossaryTerm.term_source.like(like)
            | GlossaryTerm.term_target.like(like)
        )
    rows = (await db.execute(stmt)).scalars().all()
    return [GlossaryEntryResponse(
        id=r.id, term_source=r.term_source, source_locale=r.source_locale,
        target_locale=r.target_locale, term_target=r.term_target,
        is_brand=r.is_brand, notes=r.notes, updated_by=r.updated_by,
    ) for r in rows]


@router.put("/{term:path}", response_model=GlossaryEntryResponse)
async def upsert_glossary_term(
    term: str,
    body: GlossaryEntry,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_super_admin),
) -> GlossaryEntryResponse:
    """Upsert a glossary term. The path param (term_source) must match body.term_source."""
    if term != body.term_source:
        raise HTTPException(status_code=400, detail="Path term must match body.term_source")
    existing = await db.scalar(
        select(GlossaryTerm).where(
            GlossaryTerm.term_source == body.term_source,
            GlossaryTerm.source_locale == body.source_locale,
            GlossaryTerm.target_locale == body.target_locale,
        )
    )
    if existing:
        existing.term_target = body.term_target
        existing.is_brand = body.is_brand
        existing.notes = body.notes
        existing.updated_by = current_user.id
    else:
        existing = GlossaryTerm(
            term_source=body.term_source,
            source_locale=body.source_locale,
            target_locale=body.target_locale,
            term_target=body.term_target,
            is_brand=body.is_brand,
            notes=body.notes,
            updated_by=current_user.id,
        )
        db.add(existing)
    await db.commit()
    _invalidate_glossary_cache()
    return GlossaryEntryResponse(
        id=existing.id, term_source=existing.term_source,
        source_locale=existing.source_locale, target_locale=existing.target_locale,
        term_target=existing.term_target, is_brand=existing.is_brand,
        notes=existing.notes, updated_by=existing.updated_by,
    )


@router.delete("/{term:path}", status_code=200)
async def delete_glossary_term(
    term: str,
    source_locale: str = Query(...),
    target_locale: str = Query(...),
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_super_admin),
):
    """Delete a glossary term by (term_source, source_locale, target_locale)."""
    existing = await db.scalar(
        select(GlossaryTerm).where(
            GlossaryTerm.term_source == term,
            GlossaryTerm.source_locale == source_locale,
            GlossaryTerm.target_locale == target_locale,
        )
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Glossary term not found")
    await db.delete(existing)
    await db.commit()
    _invalidate_glossary_cache()
    return {"ok": True, "deleted": term}
