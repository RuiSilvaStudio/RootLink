"""Content Studio — Block model: composed pages of block instances (sections).

Sibling of `app/api/theme.py` (CSS token overrides), `app/api/content_ui.py`
(image/icon slots), and `app/api/copy.py` (text keys). This router covers the
block composition model described in docs/content-studio/CONTENT_STUDIO.md §6:
a Page is a composed surface addressed by `slug`, made of ordered `BlockSection`
rows that each reference a frontend block-type registry entry ("hero",
"text-block", "card-grid") and carry a `props` blob consumed by the registry
entry's `render(props)`.

Read endpoints are public (the platform renders pages for everyone, gated by
`is_published`); writes are strictly `super_admin` (via the shared `require_role`
helper from `app/api/admin.py`) and audit-logged via `log_moderation` — same
pattern as the theme/content-ui/copy siblings.
"""

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.admin import require_role
from app.core.database import get_db
from app.models.block_page import BlockPage, BlockSection
from app.models.user import User, UserRole
from app.services.audit import log_moderation

router = APIRouter(prefix="/api/blocks", tags=["blocks"])


class PageCreate(BaseModel):
    slug: str
    label: str


class PageUpdate(BaseModel):
    slug: str | None = None
    label: str | None = None
    is_published: bool | None = None


class SectionCreate(BaseModel):
    block_type: str
    props: dict
    order: int = 0


class SectionUpdate(BaseModel):
    block_type: str | None = None
    props: dict | None = None
    order: int | None = None


def _section_out(s: BlockSection) -> dict:
    return {"id": s.id, "block_type": s.block_type, "props": s.props, "order": s.order}


@router.get("/pages")
async def list_published_pages(db: AsyncSession = Depends(get_db)):
    """Public: list published pages `[{id, slug, label}]`.

    Safe to cache aggressively at the edge — auth-free and idempotent.
    """
    rows = (
        await db.execute(
            select(BlockPage).where(BlockPage.is_published.is_(True)).order_by(BlockPage.slug)
        )
    ).scalars().all()
    return [{"id": r.id, "slug": r.slug, "label": r.label} for r in rows]


@router.get("/pages/{slug}")
async def get_page(slug: str, db: AsyncSession = Depends(get_db)):
    """Public: a published page + its ordered sections."""
    page = await db.scalar(
        select(BlockPage).where(BlockPage.slug == slug, BlockPage.is_published.is_(True))
    )
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    sections = (
        await db.execute(
            select(BlockSection)
            .where(BlockSection.page_id == page.id)
            .order_by(BlockSection.order, BlockSection.id)
        )
    ).scalars().all()
    return {
        "id": page.id,
        "slug": page.slug,
        "label": page.label,
        "sections": [_section_out(s) for s in sections],
    }


@router.post("/pages")
async def create_page(
    body: PageCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.super_admin])),
):
    """super_admin: create a new page. Audit-logged."""
    page = BlockPage(slug=body.slug, label=body.label, created_by=current_user.id)
    db.add(page)
    await db.flush()
    await log_moderation(
        db, action="create_block_page", target_type="block_page", target_id=page.id,
        actor_id=current_user.id, meta={"slug": body.slug, "label": body.label},
    )
    await db.commit()
    return {"id": page.id, "slug": page.slug, "label": page.label, "is_published": page.is_published}


@router.put("/pages/{page_id}")
async def update_page(
    page_id: int,
    body: PageUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.super_admin])),
):
    """super_admin: update page metadata (slug/label/is_published)."""
    page = await db.get(BlockPage, page_id)
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    if body.slug is not None:
        page.slug = body.slug
    if body.label is not None:
        page.label = body.label
    if body.is_published is not None:
        page.is_published = body.is_published
    await db.commit()
    return {"id": page.id, "slug": page.slug, "label": page.label, "is_published": page.is_published}


@router.post("/pages/{page_id}/sections")
async def create_section(
    page_id: int,
    body: SectionCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.super_admin])),
):
    """super_admin: add a section to a page. Audit-logged."""
    page = await db.get(BlockPage, page_id)
    if not page:
        raise HTTPException(status_code=404, detail="Page not found")
    section = BlockSection(
        page_id=page_id, block_type=body.block_type, props=body.props, order=body.order,
    )
    db.add(section)
    await db.flush()
    await log_moderation(
        db, action="create_block_section", target_type="block_section", target_id=section.id,
        actor_id=current_user.id,
        meta={"page_id": page_id, "block_type": body.block_type, "order": body.order},
    )
    await db.commit()
    return {
        "id": section.id, "page_id": section.page_id,
        "block_type": section.block_type, "props": section.props, "order": section.order,
    }


@router.put("/sections/{section_id}")
async def update_section(
    section_id: int,
    body: SectionUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.super_admin])),
):
    """super_admin: update a section (block_type/props/order)."""
    section = await db.get(BlockSection, section_id)
    if not section:
        raise HTTPException(status_code=404, detail="Section not found")
    if body.block_type is not None:
        section.block_type = body.block_type
    if body.props is not None:
        section.props = body.props
    if body.order is not None:
        section.order = body.order
    await db.commit()
    return {
        "id": section.id, "page_id": section.page_id,
        "block_type": section.block_type, "props": section.props, "order": section.order,
    }


@router.delete("/sections/{section_id}", status_code=200)
async def delete_section(
    section_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.super_admin])),
):
    """super_admin: delete a section. Audit-logged."""
    section = await db.get(BlockSection, section_id)
    if section:
        page_id = section.page_id
        block_type = section.block_type
        await db.delete(section)
        await log_moderation(
            db, action="delete_block_section", target_type="block_section", target_id=section_id,
            actor_id=current_user.id, meta={"page_id": page_id, "block_type": block_type},
        )
        await db.commit()
    return {"ok": True, "deleted": section_id}


@router.get("/admin/pages")
async def admin_list_pages(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_role([UserRole.super_admin])),
):
    """super_admin: ALL pages (including unpublished) with their sections — studio admin view."""
    pages = (await db.execute(select(BlockPage).order_by(BlockPage.slug))).scalars().all()
    page_ids = [p.id for p in pages]
    sections_by_page: dict[int, list[BlockSection]] = {}
    if page_ids:
        sections = (
            await db.execute(
                select(BlockSection)
                .where(BlockSection.page_id.in_(page_ids))
                .order_by(BlockSection.page_id, BlockSection.order, BlockSection.id)
            )
        ).scalars().all()
        for s in sections:
            sections_by_page.setdefault(s.page_id, []).append(s)
    return [
        {
            "id": p.id,
            "slug": p.slug,
            "label": p.label,
            "is_published": p.is_published,
            "created_by": p.created_by,
            "created_at": p.created_at.isoformat() if p.created_at else None,
            "updated_at": p.updated_at.isoformat() if p.updated_at else None,
            "sections": [_section_out(s) for s in sections_by_page.get(p.id, [])],
        }
        for p in pages
    ]
