"""Legal documents (Privacidade / Termos / Legal) — super_admin editable.

Public endpoint always serves the last *published* snapshot (or 404 if the
document has never been published — the frontend falls back to its bundled
static copy in that case). Admin endpoints (draft edit + publish) are gated
to super_admin only, stricter than the general `can_edit_copy` bypass used
for ordinary site copy, given the legal/compliance sensitivity of this
content.
"""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.admin import require_super_admin
from app.core.database import get_db
from app.models.legal_document import LegalDocument
from app.models.user import User
from app.schemas.legal import (
    LegalDocumentAdmin,
    LegalDocumentPublic,
    LegalDocumentUpdate,
    LegalPublishRequest,
    LegalSlug,
)
from app.services.audit import log_moderation

router = APIRouter(tags=["legal"])


async def _get_or_404(db: AsyncSession, slug: str) -> LegalDocument:
    doc = await db.scalar(select(LegalDocument).where(LegalDocument.slug == slug))
    if not doc:
        raise HTTPException(status_code=404, detail="Legal document not found")
    return doc


@router.get("/api/legal/{slug}", response_model=LegalDocumentPublic)
async def get_published_document(slug: LegalSlug, db: AsyncSession = Depends(get_db)):
    doc = await db.scalar(select(LegalDocument).where(LegalDocument.slug == slug))
    if not doc or not doc.published_snapshot:
        raise HTTPException(status_code=404, detail="Not published yet")
    snap = doc.published_snapshot
    return LegalDocumentPublic(
        slug=slug,
        title=snap["title"],
        description=snap["description"],
        intro=snap["intro"],
        sections=snap["sections"],
        version=snap["version"],
        effective_date=snap["effective_date"],
        last_updated=(doc.published_at.date().isoformat() if doc.published_at else snap["effective_date"]),
        changelog=doc.changelog or [],
    )


@router.get("/api/admin/legal", response_model=list[LegalDocumentAdmin])
async def list_documents(db: AsyncSession = Depends(get_db), _: User = require_super_admin):
    rows = (await db.execute(select(LegalDocument))).scalars().all()
    return [_to_admin_schema(r) for r in rows]


@router.get("/api/admin/legal/{slug}", response_model=LegalDocumentAdmin)
async def get_document(slug: LegalSlug, db: AsyncSession = Depends(get_db), _: User = require_super_admin):
    doc = await _get_or_404(db, slug)
    return _to_admin_schema(doc)


@router.put("/api/admin/legal/{slug}", response_model=LegalDocumentAdmin)
async def update_document(
    slug: LegalSlug,
    body: LegalDocumentUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = require_super_admin,
):
    doc = await _get_or_404(db, slug)
    doc.title = body.title
    doc.description = body.description
    doc.intro = body.intro
    doc.sections = [s.model_dump() for s in body.sections]
    doc.updated_by = current_user.id
    await log_moderation(
        db, action="edit_legal_document", target_type="legal_document", target_id=doc.id,
        actor_id=current_user.id, meta={"slug": slug},
    )
    await db.commit()
    await db.refresh(doc)
    return _to_admin_schema(doc)


@router.post("/api/admin/legal/{slug}/publish", response_model=LegalDocumentAdmin)
async def publish_document(
    slug: LegalSlug,
    body: LegalPublishRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = require_super_admin,
):
    doc = await _get_or_404(db, slug)
    doc.version = body.version
    doc.effective_date = body.effective_date
    doc.published_snapshot = {
        "title": doc.title,
        "description": doc.description,
        "intro": doc.intro,
        "sections": doc.sections,
        "version": body.version,
        "effective_date": body.effective_date,
    }
    doc.published_at = datetime.now(UTC)
    doc.changelog = [*(doc.changelog or []), {
        "date": body.effective_date,
        "version": body.version,
        "summary": body.summary,
    }]
    doc.updated_by = current_user.id
    await log_moderation(
        db, action="publish_legal_document", target_type="legal_document", target_id=doc.id,
        actor_id=current_user.id, meta={"slug": slug, "version": body.version},
    )
    await db.commit()
    await db.refresh(doc)
    return _to_admin_schema(doc)


def _to_admin_schema(doc: LegalDocument) -> LegalDocumentAdmin:
    snap = doc.published_snapshot or {}
    dirty = (
        doc.title != snap.get("title")
        or doc.description != snap.get("description")
        or doc.intro != snap.get("intro")
        or doc.sections != snap.get("sections")
    )
    return LegalDocumentAdmin(
        slug=doc.slug,
        title=doc.title,
        description=doc.description,
        intro=doc.intro,
        sections=doc.sections,
        version=doc.version,
        effective_date=doc.effective_date,
        changelog=doc.changelog or [],
        published_snapshot=doc.published_snapshot,
        published_at=doc.published_at.isoformat() if doc.published_at else None,
        has_unpublished_changes=dirty,
        updated_at=doc.updated_at.isoformat(),
    )
