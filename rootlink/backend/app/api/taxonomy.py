from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.content import Content
from app.models.event import Event
from app.models.group import Group
from app.models.learning import Course
from app.models.taxonomy import TaxonomyCategory, TaxonomyFamily
from app.models.user import User

router = APIRouter(prefix="/api/taxonomy", tags=["taxonomy"])


# ── Schemas ────────────────────────────────────────────────────────────

class CategoryResponse(BaseModel):
    id: int
    family_id: int
    value: str
    label: str
    label_pt: str
    sort_order: int
    is_active: bool

    model_config = {"from_attributes": True}


class FamilyResponse(BaseModel):
    id: int
    value: str
    label: str
    label_pt: str
    icon: str | None = None
    sort_order: int
    is_active: bool
    categories: list[CategoryResponse] = []

    model_config = {"from_attributes": True}


class FamilyCreate(BaseModel):
    value: str
    label: str
    label_pt: str
    icon: str | None = None
    sort_order: int = 0


class FamilyUpdate(BaseModel):
    label: str | None = None
    label_pt: str | None = None
    icon: str | None = None
    sort_order: int | None = None
    is_active: bool | None = None


class CategoryCreate(BaseModel):
    value: str
    label: str
    label_pt: str
    sort_order: int = 0


class CategoryUpdate(BaseModel):
    label: str | None = None
    label_pt: str | None = None
    sort_order: int | None = None
    is_active: bool | None = None


# ── Public endpoints ───────────────────────────────────────────────────

@router.get("/", response_model=list[FamilyResponse])
async def get_taxonomy_tree(db: AsyncSession = Depends(get_db)):
    """Public: returns full taxonomy tree (families with nested categories)."""
    families = await db.execute(
        select(TaxonomyFamily)
        .where(TaxonomyFamily.is_active.is_(True))
        .order_by(TaxonomyFamily.sort_order, TaxonomyFamily.id)
    )
    family_list = families.scalars().all()

    cats = await db.execute(
        select(TaxonomyCategory)
        .where(TaxonomyCategory.is_active.is_(True))
        .order_by(TaxonomyCategory.sort_order, TaxonomyCategory.id)
    )
    cat_list = cats.scalars().all()

    cats_by_family: dict[int, list[CategoryResponse]] = {}
    for c in cat_list:
        cats_by_family.setdefault(c.family_id, []).append(
            CategoryResponse(
                id=c.id, family_id=c.family_id, value=c.value,
                label=c.label, label_pt=c.label_pt,
                sort_order=c.sort_order, is_active=c.is_active,
            )
        )

    return [
        FamilyResponse(
            id=f.id, value=f.value, label=f.label, label_pt=f.label_pt,
            icon=f.icon, sort_order=f.sort_order, is_active=f.is_active,
            categories=cats_by_family.get(f.id, []),
        )
        for f in family_list
    ]


@router.get("/families", response_model=list[FamilyResponse])
async def get_families(db: AsyncSession = Depends(get_db)):
    """Public: returns just families (for home page cards)."""
    result = await db.execute(
        select(TaxonomyFamily)
        .where(TaxonomyFamily.is_active.is_(True))
        .order_by(TaxonomyFamily.sort_order)
    )
    return result.scalars().all()


@router.get("/families/{family_value}/categories", response_model=list[CategoryResponse])
async def get_categories_by_family(family_value: str, db: AsyncSession = Depends(get_db)):
    """Public: returns categories for a specific family."""
    fam = await db.execute(
        select(TaxonomyFamily).where(TaxonomyFamily.value == family_value)
    )
    family = fam.scalar_one_or_none()
    if not family:
        raise HTTPException(status_code=404, detail="Family not found")

    result = await db.execute(
        select(TaxonomyCategory)
        .where(TaxonomyCategory.family_id == family.id, TaxonomyCategory.is_active.is_(True))
        .order_by(TaxonomyCategory.sort_order)
    )
    return result.scalars().all()


# ── Admin CRUD ─────────────────────────────────────────────────────────

def _require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role.value != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return user


# Families

@router.get("/admin/families", response_model=list[FamilyResponse])
async def admin_list_families(
    db: AsyncSession = Depends(get_db),
    _=Depends(_require_admin),
):
    result = await db.execute(
        select(TaxonomyFamily).order_by(TaxonomyFamily.sort_order)
    )
    return result.scalars().all()


@router.post("/admin/families", response_model=FamilyResponse, status_code=201)
async def admin_create_family(
    body: FamilyCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(_require_admin),
):
    existing = await db.execute(
        select(TaxonomyFamily).where(TaxonomyFamily.value == body.value)
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Family value already exists")

    family = TaxonomyFamily(
        value=body.value, label=body.label, label_pt=body.label_pt,
        icon=body.icon, sort_order=body.sort_order,
    )
    db.add(family)
    await db.commit()
    await db.refresh(family)
    return family


@router.put("/admin/families/{family_id}", response_model=FamilyResponse)
async def admin_update_family(
    family_id: int,
    body: FamilyUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(_require_admin),
):
    result = await db.execute(select(TaxonomyFamily).where(TaxonomyFamily.id == family_id))
    family = result.scalar_one_or_none()
    if not family:
        raise HTTPException(status_code=404, detail="Family not found")

    for key, val in body.model_dump(exclude_unset=True).items():
        setattr(family, key, val)
    await db.commit()
    await db.refresh(family)
    return family


@router.delete("/admin/families/{family_id}", status_code=204)
async def admin_delete_family(
    family_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(_require_admin),
):
    result = await db.execute(select(TaxonomyFamily).where(TaxonomyFamily.id == family_id))
    family = result.scalar_one_or_none()
    if not family:
        raise HTTPException(status_code=404, detail="Family not found")

    usage_count = 0
    for model, col in [(Group, Group.family), (Content, Content.family), (Event, Event.family), (Course, Course.family)]:
        count = await db.scalar(
            select(func.count(model.id)).where(col == family.value)
        )
        usage_count += count or 0

    if usage_count > 0:
        raise HTTPException(status_code=400, detail=f"Cannot delete: {usage_count} entities use this family")

    await db.delete(family)
    await db.commit()


# Categories

@router.post("/admin/families/{family_id}/categories", response_model=CategoryResponse, status_code=201)
async def admin_create_category(
    family_id: int,
    body: CategoryCreate,
    db: AsyncSession = Depends(get_db),
    _=Depends(_require_admin),
):
    fam = await db.get(TaxonomyFamily, family_id)
    if not fam:
        raise HTTPException(status_code=404, detail="Family not found")

    category = TaxonomyCategory(
        family_id=family_id, value=body.value, label=body.label,
        label_pt=body.label_pt, sort_order=body.sort_order,
    )
    db.add(category)
    await db.commit()
    await db.refresh(category)
    return category


@router.put("/admin/categories/{category_id}", response_model=CategoryResponse)
async def admin_update_category(
    category_id: int,
    body: CategoryUpdate,
    db: AsyncSession = Depends(get_db),
    _=Depends(_require_admin),
):
    result = await db.execute(select(TaxonomyCategory).where(TaxonomyCategory.id == category_id))
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    for key, val in body.model_dump(exclude_unset=True).items():
        setattr(category, key, val)
    await db.commit()
    await db.refresh(category)
    return category


@router.delete("/admin/categories/{category_id}", status_code=204)
async def admin_delete_category(
    category_id: int,
    db: AsyncSession = Depends(get_db),
    _=Depends(_require_admin),
):
    result = await db.execute(select(TaxonomyCategory).where(TaxonomyCategory.id == category_id))
    category = result.scalar_one_or_none()
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")

    await db.delete(category)
    await db.commit()
