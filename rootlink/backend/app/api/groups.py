from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.group import Group, GroupMember, MemberRole
from app.models.user import User
from app.schemas.group import GroupCreate, GroupMemberResponse, GroupResponse

router = APIRouter(prefix="/api/groups", tags=["groups"])


@router.get("/search", response_model=list[GroupResponse])
async def search_groups(
    q: str = Query(min_length=1),
    limit: int = Query(5, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Group)
        .where(or_(Group.name.ilike(f"%{q}%"), Group.description.ilike(f"%{q}%")))
        .limit(limit)
    )
    return result.scalars().all()


@router.get("/", response_model=list[GroupResponse])
async def list_groups(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    family: str | None = Query(None),
    category: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Group).order_by(Group.created_at.desc())
    if family:
        stmt = stmt.where(Group.family == family)
    if category:
        stmt = stmt.where(Group.category == category)
    result = await db.execute(stmt.offset(offset).limit(limit))
    return result.scalars().all()


@router.post("/", response_model=GroupResponse, status_code=201)
async def create_group(
    body: GroupCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(select(Group).where(Group.slug == body.slug))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Slug already taken")

    group = Group(
        name=body.name,
        slug=body.slug,
        description=body.description,
        category=body.category,
        image_url=body.image_url,
        created_by=current_user.id,
    )
    db.add(group)
    await db.commit()
    await db.refresh(group)

    member = GroupMember(group_id=group.id, user_id=current_user.id, role=MemberRole.admin)
    db.add(member)
    await db.commit()

    return group


@router.get("/{group_id}", response_model=GroupResponse)
async def get_group(group_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Group).where(Group.id == group_id))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    return group


@router.post("/{group_id}/join", response_model=GroupMemberResponse, status_code=201)
async def join_group(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id, GroupMember.user_id == current_user.id
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Already a member")

    member = GroupMember(group_id=group_id, user_id=current_user.id, role=MemberRole.member)
    db.add(member)
    await db.commit()
    await db.refresh(member)
    return member


@router.delete("/{group_id}/leave", status_code=204)
async def leave_group(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        delete(GroupMember).where(
            GroupMember.group_id == group_id, GroupMember.user_id == current_user.id
        )
    )
    await db.commit()


@router.get("/{group_id}/members", response_model=list[GroupMemberResponse])
async def list_members(group_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(GroupMember).where(GroupMember.group_id == group_id)
    )
    return result.scalars().all()
