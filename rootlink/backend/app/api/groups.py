from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user, get_optional_user
from app.models.group import Group, GroupMember, GroupStatus, MemberRole
from app.models.user import User
from app.schemas.group import GroupCreate, GroupMemberResponse, GroupResponse, GroupUpdate
from app.services.default_cover import default_cover_for

router = APIRouter(prefix="/api/groups", tags=["groups"])

STAFF_ROLES = ("super_admin", "admin", "moderator")


async def _can_manage_group(db: AsyncSession, group: Group, user: User) -> bool:
    """Group creator, a group admin/moderator, or platform staff may manage it."""
    if group.created_by == user.id or user.role in STAFF_ROLES:
        return True
    membership = await db.scalar(
        select(GroupMember).where(GroupMember.group_id == group.id, GroupMember.user_id == user.id)
    )
    return bool(membership and membership.role in (MemberRole.admin, MemberRole.moderator))


@router.get("/search", response_model=list[GroupResponse])
async def search_groups(
    q: str = Query(min_length=1),
    limit: int = Query(5, ge=1, le=20),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Group)
        .where(
            or_(Group.name.ilike(f"%{q}%"), Group.description.ilike(f"%{q}%")),
            Group.status == GroupStatus.active,
        )
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
    stmt = select(Group).where(Group.status == GroupStatus.active).order_by(Group.created_at.desc())
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
        image_url=body.image_url or default_cover_for(getattr(body, "family", None), body.category),
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
async def get_group(
    group_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    result = await db.execute(select(Group).where(Group.id == group_id))
    group = result.scalar_one_or_none()
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    # Archived groups are hidden from everyone except platform staff.
    if group.status == GroupStatus.archived and not (current_user and current_user.role in STAFF_ROLES):
        raise HTTPException(status_code=404, detail="Group not found")
    return group


@router.patch("/{group_id}", response_model=GroupResponse)
async def update_group(
    group_id: int,
    body: GroupUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    group = await db.get(Group, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    if not await _can_manage_group(db, group, current_user):
        raise HTTPException(status_code=403, detail="Not authorized to edit this group")
    for key, val in body.model_dump(exclude_unset=True).items():
        setattr(group, key, val)
    await db.commit()
    await db.refresh(group)
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
