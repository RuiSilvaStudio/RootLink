from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.api.admin import require_role
from app.core.database import get_db
from app.models.content_template import ContentTemplate
from app.models.user import User, UserRole
from app.schemas.content_template import (
    ContentTemplateCreate,
    ContentTemplateResponse,
    ContentTemplateUpdate,
)

router = APIRouter(prefix="/api/content-templates", tags=["content-templates"])

require_admin = require_role([UserRole.admin])


@router.get("", response_model=list[ContentTemplateResponse])
async def list_templates(
    kind: str = Query("article"),
    db: AsyncSession = Depends(get_db),
):
    """Public: active templates for a Content Kind, for the create-screen picker."""
    stmt = (
        select(ContentTemplate)
        .where(ContentTemplate.kind == kind, ContentTemplate.is_active.is_(True))
        .order_by(ContentTemplate.sort_order, ContentTemplate.id)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/all", response_model=list[ContentTemplateResponse])
async def list_all_templates(
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    result = await db.execute(select(ContentTemplate).order_by(ContentTemplate.kind, ContentTemplate.sort_order))
    return result.scalars().all()


@router.post("", response_model=ContentTemplateResponse, status_code=201)
async def create_template(
    body: ContentTemplateCreate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    tpl = ContentTemplate(**body.model_dump())
    db.add(tpl)
    await db.commit()
    await db.refresh(tpl)
    return tpl


@router.patch("/{template_id}", response_model=ContentTemplateResponse)
async def update_template(
    template_id: int,
    body: ContentTemplateUpdate,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    tpl = await db.get(ContentTemplate, template_id)
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(tpl, field, value)
    await db.commit()
    await db.refresh(tpl)
    return tpl


@router.delete("/{template_id}", status_code=204)
async def delete_template(
    template_id: int,
    db: AsyncSession = Depends(get_db),
    _: User = Depends(require_admin),
):
    tpl = await db.get(ContentTemplate, template_id)
    if not tpl:
        raise HTTPException(status_code=404, detail="Template not found")
    await db.delete(tpl)
    await db.commit()
