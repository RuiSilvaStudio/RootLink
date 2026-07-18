import json
import secrets
from datetime import UTC, datetime, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import delete, or_, select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.permissions import rank_at_least
from app.core.permissions_registry import Rank
from app.core.security import get_current_user, get_optional_user
from app.models.content import Content
from app.models.entity import Entity
from app.models.event import Event
from app.models.group import (
    Group, GroupMember, GroupStatus, MemberRole,
    GroupContact, GroupBoardMember, GroupDocument, GroupProgram,
    GroupProgramSubField, GroupAnnouncement, GroupChatLink,
    GroupInvite, GroupJoinRequest, GroupContent, GroupGalleryItem,
    GroupGraduationRequest,
)
from app.models.learning import Course
from app.models.notification import Notification, NotificationType
from app.models.user import User
from app.models.waste import CompostingHub
from app.schemas.group import (
    GroupCreate, GroupResponse, GroupUpdate,
    GroupMemberResponse,
    GroupContactResponse, GroupContactCreate, GroupContactUpdate,
    GroupBoardMemberResponse, GroupBoardMemberCreate,
    GroupDocumentResponse, GroupDocumentCreate, GroupDocumentUpdate,
    GroupProgramResponse, GroupProgramCreate,
    GroupProgramSubFieldResponse, GroupProgramSubFieldCreate,
    GroupAnnouncementResponse, GroupAnnouncementCreate,
    GroupChatLinkResponse, GroupChatLinkCreate,
    GroupInviteResponse,
    GroupJoinRequestResponse, GroupJoinRequestCreate,
    GroupGalleryItemResponse, GroupGalleryItemCreate,
    GroupGraduationRequestCreate, GroupGraduationRequestResponse,
)
from app.services.default_cover import default_cover_for

router = APIRouter(prefix="/api/groups", tags=["groups"])

OWNER_ROLES = (MemberRole.owner, MemberRole.admin)  # admin = legacy alias
MANAGER_ROLES = (MemberRole.owner, MemberRole.staff, MemberRole.admin, MemberRole.moderator)
VALID_MEMBER_ROLES = ("member", "staff", "owner")
INVITE_METHODS = {
    # method -> expiry
    "link": timedelta(days=7),
    "platform": timedelta(days=30),
    "qrEvent": timedelta(days=1),
    "prospectQR": timedelta(days=30),
}

# Section visibility defaults (spec §9.4): True = public, False = members-only.
DEFAULT_VISIBILITY = {
    "announcements": False,  # §9.4.1 member-only by default
    "chats": False,          # §9.4.2 member-only by default
    "members": False,
    "contacts": True,        # section public; per-item is_public still filters
    "documents": True,       # section public; per-item is_public still filters
    "calendar": True,
    "board": True,
    "programs": True,
    "gallery": True,
    "news": True,
}


def _is_staff(user: User | None) -> bool:
    return bool(user) and rank_at_least(user, Rank.moderator)


def _visibility_config(group: Group) -> dict:
    cfg = dict(DEFAULT_VISIBILITY)
    if group.visibility_config:
        try:
            stored = json.loads(group.visibility_config)
            if isinstance(stored, dict):
                cfg.update({k: bool(v) for k, v in stored.items()})
        except Exception:
            pass
    return cfg


def _membership_config(group: Group) -> dict:
    if group.membership_config:
        try:
            parsed = json.loads(group.membership_config)
            if isinstance(parsed, dict):
                return parsed
        except Exception:
            pass
    return {"linkInvite": False, "platformInvite": False, "qrEvent": False, "prospectQR": False, "orgAuto": False}


async def _membership(db: AsyncSession, group_id: int, user: User | None) -> GroupMember | None:
    if not user:
        return None
    return await db.scalar(
        select(GroupMember).where(GroupMember.group_id == group_id, GroupMember.user_id == user.id)
    )


async def _viewer(db: AsyncSession, group: Group, user: User | None) -> tuple[bool, bool]:
    """Returns (is_manager, is_member) for this viewer."""
    if user and (group.created_by == user.id or _is_staff(user)):
        return True, True
    m = await _membership(db, group.id, user)
    if not m:
        return False, False
    return m.role in MANAGER_ROLES, True


async def _can_manage_group(db: AsyncSession, group: Group, user: User) -> bool:
    is_manager, _ = await _viewer(db, group, user)
    return is_manager


async def _is_group_owner(db: AsyncSession, group: Group, user: User) -> bool:
    """Owner-level rights: group creator, a member with the owner role, or platform staff."""
    if group.created_by == user.id or _is_staff(user):
        return True
    m = await _membership(db, group.id, user)
    return bool(m and m.role in OWNER_ROLES)


async def _owner_count(db: AsyncSession, group_id: int) -> int:
    result = await db.execute(
        select(GroupMember).where(
            GroupMember.group_id == group_id, GroupMember.role.in_([r.value for r in OWNER_ROLES])
        )
    )
    return len(result.scalars().all())


async def _get_group_or_404(db: AsyncSession, group_id: int, user: User | None = None) -> Group:
    group = await db.get(Group, group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group not found")
    if group.status == GroupStatus.archived and not _is_staff(user):
        raise HTTPException(status_code=404, detail="Group not found")
    return group


async def _notify_group_managers(
    db: AsyncSession, group: Group, actor_id: int, message: str, link: str
) -> None:
    """Queue a notification for every owner/staff of the group (and the
    founder), excluding the actor. Caller commits."""
    result = await db.execute(
        select(GroupMember.user_id).where(
            GroupMember.group_id == group.id,
            GroupMember.role.in_([r.value for r in MANAGER_ROLES]),
        )
    )
    targets = set(result.scalars().all())
    targets.add(group.created_by)
    targets.discard(actor_id)
    for uid in targets:
        db.add(Notification(
            user_id=uid, actor_id=actor_id,
            type=NotificationType.group_join, message=message, link=link,
        ))


async def _require_section(
    db: AsyncSession, group: Group, user: User | None, section: str
) -> tuple[bool, bool]:
    """403 unless the section is public or the viewer is a member/manager.

    Returns (is_manager, is_member) so callers can filter per-item flags.
    """
    is_manager, is_member = await _viewer(db, group, user)
    if is_member or is_manager:
        return is_manager, is_member
    if _visibility_config(group).get(section, True):
        return False, False
    raise HTTPException(status_code=403, detail="Members only")


# ── Search & List ─────────────────────────────────────────────────────────

@router.get("/search", response_model=list[GroupResponse])
async def search_groups(
    q: str = Query(min_length=1, max_length=200),
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
    q: str | None = Query(None, max_length=200),
    family: str | None = Query(None),
    category: str | None = Query(None),
    group_type: str | None = Query(None),
    location: str | None = Query(None),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Group).where(Group.status == GroupStatus.active).order_by(Group.created_at.desc())
    if q:
        stmt = stmt.where(or_(Group.name.ilike(f"%{q}%"), Group.description.ilike(f"%{q}%")))
    if family:
        stmt = stmt.where(or_(Group.family == family, Group.categories.ilike(f'%"{family}%')))
    if category:
        stmt = stmt.where(Group.category == category)
    if group_type:
        stmt = stmt.where(Group.group_type == group_type)
    if location:
        stmt = stmt.where(Group.location.ilike(f"%{location}%"))
    result = await db.execute(stmt.offset(offset).limit(limit))
    return result.scalars().all()


@router.get("/by-slug/{slug}", response_model=GroupResponse)
async def get_group_by_slug(
    slug: str,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    group = await db.scalar(select(Group).where(Group.slug == slug))
    if not group or (group.status == GroupStatus.archived and not _is_staff(current_user)):
        raise HTTPException(status_code=404, detail="Group not found")
    return group


# ── Group CRUD ────────────────────────────────────────────────────────────

@router.post("/", response_model=GroupResponse, status_code=201)
async def create_group(
    body: GroupCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    existing = await db.execute(select(Group).where(Group.slug == body.slug))
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=409, detail="Slug already taken")
    if body.entity_id is not None and not await db.get(Entity, body.entity_id):
        raise HTTPException(status_code=400, detail="Entity not found")

    group = Group(
        name=body.name,
        slug=body.slug,
        description=body.description,
        description_long=body.description_long,
        conduct=body.conduct,
        category=body.category,
        family=body.family,
        categories=body.categories,
        image_url=body.image_url or default_cover_for(getattr(body, "family", None), body.category),
        logo_url=body.logo_url,
        location=body.location,
        group_type=body.group_type,
        entity_id=body.entity_id,
        is_open=body.is_open,
        visibility_config=body.visibility_config,
        membership_config=body.membership_config,
        created_by=current_user.id,
    )
    db.add(group)
    try:
        await db.flush()  # assigns group.id; slug unique index enforced here
        db.add(GroupMember(group_id=group.id, user_id=current_user.id, role=MemberRole.owner))
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Slug already taken")
    await db.refresh(group)
    return group


@router.get("/graduation-requests", response_model=list[GroupGraduationRequestResponse])
async def list_graduation_requests(
    status: str = Query("pending", max_length=20),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Super_admin: list graduation requests for review."""
    if not rank_at_least(current_user, Rank.super_admin):
        raise HTTPException(status_code=403, detail="Super admin only")
    result = await db.execute(
        select(GroupGraduationRequest)
        .where(GroupGraduationRequest.status == status)
        .order_by(GroupGraduationRequest.created_at.desc())
        .offset(offset).limit(limit)
    )
    return result.scalars().all()


@router.get("/{group_id}", response_model=GroupResponse)
async def get_group(
    group_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    return await _get_group_or_404(db, group_id, current_user)


@router.patch("/{group_id}", response_model=GroupResponse)
async def update_group(
    group_id: int,
    body: GroupUpdate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    group = await _get_group_or_404(db, group_id, current_user)
    if not await _can_manage_group(db, group, current_user):
        raise HTTPException(status_code=403, detail="Not authorized to edit this group")
    data = body.model_dump(exclude_unset=True)
    if data.get("entity_id") is not None and not await db.get(Entity, data["entity_id"]):
        raise HTTPException(status_code=400, detail="Entity not found")
    for key, val in data.items():
        setattr(group, key, val)
    await db.commit()
    await db.refresh(group)
    return group


# ── Members ───────────────────────────────────────────────────────────────

@router.get("/{group_id}/me")
async def my_membership(
    group_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    """The caller's relationship to this group — drives view modes client-side.

    Safe for anonymous callers (returns the visitor shape).

    NOTE: `is_member` means an ACTUAL membership row — platform staff get
    manager rights (is_manager/is_owner) for moderation, but are NOT
    presented as members of groups they never joined (no Leave button)."""
    group = await _get_group_or_404(db, group_id, current_user)
    is_manager, _ = await _viewer(db, group, current_user)
    m = await _membership(db, group_id, current_user) if current_user else None
    pending_request = None
    if current_user and not m:
        pending_request = await db.scalar(
            select(GroupJoinRequest).where(
                GroupJoinRequest.group_id == group_id,
                GroupJoinRequest.user_id == current_user.id,
                GroupJoinRequest.status == "pending",
            )
        )
    is_founder = bool(current_user and group.created_by == current_user.id)
    return {
        "is_member": m is not None,
        "is_manager": is_manager,
        "is_owner": bool(
            current_user and (
                is_founder
                or (m and m.role in [r.value for r in OWNER_ROLES])
                or _is_staff(current_user)
            )
        ),
        "is_founder": is_founder,
        "role": m.role if m else None,
        "member_id": m.id if m else None,
        "has_pending_request": pending_request is not None,
        "visibility": _visibility_config(group),
    }


@router.get("/{group_id}/members", response_model=list[GroupMemberResponse])
async def list_members(
    group_id: int,
    limit: int = Query(100, ge=1, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    group = await _get_group_or_404(db, group_id, current_user)
    await _require_section(db, group, current_user, "members")
    result = await db.execute(
        select(GroupMember, User.name, User.avatar_url)
        .join(User, User.id == GroupMember.user_id)
        .where(GroupMember.group_id == group_id)
        .order_by(GroupMember.created_at)
    )
    rows = result.all()
    # Sort: owner first, then staff, then members (in Python — SQLite doesn't
    # support CASE in ORDER BY consistently across SQLAlchemy versions)
    role_order = {"owner": 0, "staff": 1, "admin": 0, "moderator": 1, "member": 2}
    rows = sorted(rows, key=lambda r: (role_order.get(r[0].role, 3), r[0].created_at or datetime.min))
    return [
        GroupMemberResponse(
            id=m.id, group_id=m.group_id, user_id=m.user_id, role=m.role,
            created_at=m.created_at, user_name=name, user_avatar=avatar,
        )
        for m, name, avatar in rows[offset : offset + limit]
    ]


@router.patch("/{group_id}/members/{member_id}")
async def update_member_role(
    group_id: int,
    member_id: int,
    role: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    group = await _get_group_or_404(db, group_id, current_user)
    if role not in VALID_MEMBER_ROLES:
        raise HTTPException(status_code=400, detail="Invalid role")
    # Role changes are owner-level (staff cannot promote themselves — §9.1.6)
    if not await _is_group_owner(db, group, current_user):
        raise HTTPException(status_code=403, detail="Only group owners can change roles")
    member = await db.get(GroupMember, member_id)
    if not member or member.group_id != group_id:
        raise HTTPException(status_code=404, detail="Member not found")
    if member.user_id == group.created_by:
        raise HTTPException(status_code=400, detail="Use ownership transfer to change the founder's role")
    if member.role in OWNER_ROLES and role != "owner" and await _owner_count(db, group_id) <= 1:
        raise HTTPException(status_code=400, detail="A group must keep at least one owner")
    member.role = role
    await db.commit()
    return {"ok": True, "role": role}


@router.delete("/{group_id}/members/{member_id}", status_code=204)
async def remove_member(
    group_id: int,
    member_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    group = await _get_group_or_404(db, group_id, current_user)
    if not await _can_manage_group(db, group, current_user):
        raise HTTPException(status_code=403, detail="Not authorized")
    member = await db.get(GroupMember, member_id)
    if not member or member.group_id != group_id:
        raise HTTPException(status_code=404, detail="Member not found")
    if member.user_id == group.created_by:
        raise HTTPException(status_code=400, detail="Cannot remove the group founder")
    if member.role in OWNER_ROLES:
        # Only owners can remove other owners, and never the last one
        if not await _is_group_owner(db, group, current_user):
            raise HTTPException(status_code=403, detail="Only group owners can remove an owner")
        if await _owner_count(db, group_id) <= 1:
            raise HTTPException(status_code=400, detail="A group must keep at least one owner")
    await db.delete(member)
    await db.commit()


@router.post("/{group_id}/transfer-ownership", response_model=GroupMemberResponse)
async def transfer_ownership(
    group_id: int,
    new_owner_user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Hand the group over: target member becomes owner + founder-of-record;
    the previous founder keeps managing as staff (and may then leave)."""
    group = await _get_group_or_404(db, group_id, current_user)
    if not await _is_group_owner(db, group, current_user):
        raise HTTPException(status_code=403, detail="Only group owners can transfer ownership")
    if new_owner_user_id == current_user.id:
        raise HTTPException(status_code=400, detail="You already own this group")
    target = await db.scalar(
        select(GroupMember).where(GroupMember.group_id == group_id, GroupMember.user_id == new_owner_user_id)
    )
    if not target:
        raise HTTPException(status_code=404, detail="The new owner must already be a member of the group")
    target.role = MemberRole.owner
    previous_founder = group.created_by
    group.created_by = new_owner_user_id
    # Demote the previous founder's membership row to staff (they can leave now)
    if previous_founder != new_owner_user_id:
        prev = await db.scalar(
            select(GroupMember).where(GroupMember.group_id == group_id, GroupMember.user_id == previous_founder)
        )
        if prev:
            prev.role = MemberRole.staff
    await db.commit()
    await db.refresh(target)
    return target


# ── Join / Leave ──────────────────────────────────────────────────────────

@router.post("/{group_id}/join", response_model=GroupMemberResponse, status_code=201)
async def join_group(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    group = await _get_group_or_404(db, group_id, current_user)
    if group.status != GroupStatus.active:
        raise HTTPException(status_code=400, detail="This group is archived")
    if not group.is_open:
        raise HTTPException(status_code=403, detail="This group requires an invitation or approval to join")

    existing = await _membership(db, group_id, current_user)
    if existing:
        raise HTTPException(status_code=409, detail="Already a member")

    member = GroupMember(group_id=group_id, user_id=current_user.id, role=MemberRole.member)
    db.add(member)
    await _notify_group_managers(
        db, group, current_user.id,
        f"{current_user.name} juntou-se a «{group.name}»",
        f"/groups/{group.slug}/community",
    )
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Already a member")
    await db.refresh(member)
    return member


@router.delete("/{group_id}/leave", status_code=204)
async def leave_group(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    group = await _get_group_or_404(db, group_id, current_user)
    membership = await _membership(db, group_id, current_user)
    if not membership:
        raise HTTPException(status_code=404, detail="You are not a member of this group")
    if group.created_by == current_user.id:
        raise HTTPException(status_code=400, detail="The founder must transfer ownership before leaving")
    if membership.role in OWNER_ROLES and await _owner_count(db, group_id) <= 1:
        raise HTTPException(status_code=400, detail="A group must keep at least one owner — transfer ownership first")
    await db.delete(membership)
    await db.commit()


# ── Join Requests (prospect QR / closed groups) ───────────────────────────

@router.post("/{group_id}/join-request", response_model=GroupJoinRequestResponse, status_code=201)
async def create_join_request(
    group_id: int,
    body: GroupJoinRequestCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    group = await _get_group_or_404(db, group_id, current_user)
    if group.status != GroupStatus.active:
        raise HTTPException(status_code=400, detail="This group is archived")
    existing_member = await _membership(db, group_id, current_user)
    if existing_member:
        raise HTTPException(status_code=409, detail="Already a member")
    existing_req = await db.scalar(
        select(GroupJoinRequest).where(
            GroupJoinRequest.group_id == group_id,
            GroupJoinRequest.user_id == current_user.id,
            GroupJoinRequest.status == "pending",
        )
    )
    if existing_req:
        raise HTTPException(status_code=409, detail="You already have a pending request")

    req = GroupJoinRequest(group_id=group_id, user_id=current_user.id, note=body.note)
    db.add(req)
    await _notify_group_managers(
        db, group, current_user.id,
        f"{current_user.name} pediu para entrar em «{group.name}»",
        f"/groups/{group.slug}/manage",
    )
    await db.commit()
    await db.refresh(req)
    return req


@router.get("/{group_id}/join-requests/mine", response_model=GroupJoinRequestResponse | None)
async def my_join_request(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """The caller's own pending request (so the UI can show 'request sent')."""
    await _get_group_or_404(db, group_id, current_user)
    return await db.scalar(
        select(GroupJoinRequest).where(
            GroupJoinRequest.group_id == group_id,
            GroupJoinRequest.user_id == current_user.id,
            GroupJoinRequest.status == "pending",
        )
    )


@router.get("/{group_id}/join-requests", response_model=list[GroupJoinRequestResponse])
async def list_join_requests(
    group_id: int,
    status: str = Query("pending", max_length=20),
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    group = await _get_group_or_404(db, group_id, current_user)
    if not await _can_manage_group(db, group, current_user):
        raise HTTPException(status_code=403, detail="Not authorized")
    result = await db.execute(
        select(GroupJoinRequest, User.name, User.avatar_url)
        .join(User, User.id == GroupJoinRequest.user_id)
        .where(GroupJoinRequest.group_id == group_id, GroupJoinRequest.status == status)
        .order_by(GroupJoinRequest.created_at.desc())
        .offset(offset).limit(limit)
    )
    return [
        GroupJoinRequestResponse(
            id=r.id, group_id=r.group_id, user_id=r.user_id, note=r.note,
            status=r.status, created_at=r.created_at, user_name=name, user_avatar=avatar,
        )
        for r, name, avatar in result.all()
    ]


@router.post("/{group_id}/join-requests/{request_id}/approve", response_model=GroupMemberResponse)
async def approve_join_request(
    group_id: int,
    request_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    group = await _get_group_or_404(db, group_id, current_user)
    if not await _can_manage_group(db, group, current_user):
        raise HTTPException(status_code=403, detail="Not authorized")
    req = await db.get(GroupJoinRequest, request_id)
    if not req or req.group_id != group_id or req.status != "pending":
        raise HTTPException(status_code=404, detail="Request not found")

    req.status = "approved"
    db.add(Notification(
        user_id=req.user_id, actor_id=current_user.id,
        type=NotificationType.group_join,
        message=f"O seu pedido para entrar em «{group.name}» foi aprovado — bem-vindo(a)!",
        link=f"/groups/{group.slug}",
    ))
    existing = await db.scalar(
        select(GroupMember).where(GroupMember.group_id == group_id, GroupMember.user_id == req.user_id)
    )
    if existing:
        await db.commit()
        return existing
    member = GroupMember(group_id=group_id, user_id=req.user_id, role=MemberRole.member)
    db.add(member)
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        req.status = "approved"
        await db.commit()
        member = await db.scalar(
            select(GroupMember).where(GroupMember.group_id == group_id, GroupMember.user_id == req.user_id)
        )
        return member
    await db.refresh(member)
    return member


@router.post("/{group_id}/join-requests/{request_id}/decline")
async def decline_join_request(
    group_id: int,
    request_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    group = await _get_group_or_404(db, group_id, current_user)
    if not await _can_manage_group(db, group, current_user):
        raise HTTPException(status_code=403, detail="Not authorized")
    req = await db.get(GroupJoinRequest, request_id)
    if not req or req.group_id != group_id or req.status != "pending":
        raise HTTPException(status_code=404, detail="Request not found")
    req.status = "declined"
    db.add(Notification(
        user_id=req.user_id, actor_id=current_user.id,
        type=NotificationType.group_join,
        message=f"O seu pedido para entrar em «{group.name}» não foi aceite.",
        link=f"/groups/{group.slug}",
    ))
    await db.commit()
    return {"ok": True}


# ── Invites ───────────────────────────────────────────────────────────────

@router.get("/{group_id}/invites", response_model=list[GroupInviteResponse])
async def list_invites(
    group_id: int,
    status: str | None = Query(None, max_length=20),
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    group = await _get_group_or_404(db, group_id, current_user)
    if not await _can_manage_group(db, group, current_user):
        raise HTTPException(status_code=403, detail="Not authorized")
    stmt = select(GroupInvite).where(GroupInvite.group_id == group_id)
    if status:
        stmt = stmt.where(GroupInvite.status == status)
    stmt = stmt.order_by(GroupInvite.created_at.desc()).offset(offset).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("/{group_id}/invites", response_model=GroupInviteResponse, status_code=201)
async def create_invite(
    group_id: int,
    method: str = "link",
    invited_user_id: int | None = None,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    group = await _get_group_or_404(db, group_id, current_user)
    if group.status != GroupStatus.active:
        raise HTTPException(status_code=400, detail="This group is archived")
    if not await _can_manage_group(db, group, current_user):
        raise HTTPException(status_code=403, detail="Not authorized")
    if method not in INVITE_METHODS:
        raise HTTPException(status_code=400, detail="Invalid invite method")
    if invited_user_id is not None and not await db.get(User, invited_user_id):
        raise HTTPException(status_code=404, detail="Invited user not found")
    token = secrets.token_urlsafe(32)
    invite = GroupInvite(
        group_id=group_id,
        invited_by=current_user.id,
        invited_user_id=invited_user_id,
        invite_token=token,
        method=method,
        status="pending",
        expires_at=datetime.now(UTC) + INVITE_METHODS[method],
    )
    db.add(invite)
    # Targeted platform invite → the invited user gets a notification with
    # the accept link (otherwise the invite would be invisible to them).
    if invited_user_id is not None:
        db.add(Notification(
            user_id=invited_user_id, actor_id=current_user.id,
            type=NotificationType.group_join,
            message=f"{current_user.name} convidou-o(a) para o grupo «{group.name}»",
            link=f"/groups/invite/{token}",
        ))
    await db.commit()
    await db.refresh(invite)
    return invite


@router.post("/{group_id}/invites/{invite_id}/cancel")
async def cancel_invite(
    group_id: int,
    invite_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    group = await _get_group_or_404(db, group_id, current_user)
    if not await _can_manage_group(db, group, current_user):
        raise HTTPException(status_code=403, detail="Not authorized")
    invite = await db.get(GroupInvite, invite_id)
    if not invite or invite.group_id != group_id:
        raise HTTPException(status_code=404, detail="Invite not found")
    if invite.status != "pending":
        raise HTTPException(status_code=400, detail="Can only cancel pending invites")
    invite.status = "cancelled"
    await db.commit()
    return {"ok": True}


@router.get("/invite/{token}")
async def get_invite_info(
    token: str,
    db: AsyncSession = Depends(get_db),
):
    """Public invite preview — group name/cover for the invite landing page.

    Does NOT leak the member list or private sections; just enough to render
    'You've been invited to X'."""
    invite = await db.scalar(select(GroupInvite).where(GroupInvite.invite_token == token))
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    group = await db.get(Group, invite.group_id)
    if not group or group.status != GroupStatus.active:
        raise HTTPException(status_code=404, detail="Invite not found")
    expired = bool(invite.expires_at and _as_utc(invite.expires_at) < datetime.now(UTC))
    return {
        "status": "expired" if (expired and invite.status == "pending") else invite.status,
        "method": invite.method,
        "targeted": invite.invited_user_id is not None,
        "group": {
            "name": group.name,
            "slug": group.slug,
            "image_url": group.image_url,
            "logo_url": group.logo_url,
            "description": group.description,
        },
    }


def _as_utc(dt: datetime) -> datetime:
    return dt if dt.tzinfo else dt.replace(tzinfo=UTC)


@router.post("/invite/{token}/accept", response_model=GroupMemberResponse)
async def accept_invite(
    token: str,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    invite = await db.scalar(select(GroupInvite).where(GroupInvite.invite_token == token))
    if not invite:
        raise HTTPException(status_code=404, detail="Invite not found")
    if invite.invited_user_id is not None and invite.invited_user_id != current_user.id:
        raise HTTPException(status_code=403, detail="This invite was sent to a different account")
    if invite.status != "pending":
        raise HTTPException(status_code=400, detail=f"Invite is {invite.status}")
    if invite.expires_at and _as_utc(invite.expires_at) < datetime.now(UTC):
        invite.status = "expired"
        await db.commit()
        raise HTTPException(status_code=400, detail="Invite has expired")
    group = await db.get(Group, invite.group_id)
    if not group or group.status != GroupStatus.active:
        raise HTTPException(status_code=400, detail="This group is no longer active")

    existing = await _membership(db, invite.group_id, current_user)
    if existing:
        raise HTTPException(status_code=409, detail="Already a member")

    invite.status = "accepted"
    member = GroupMember(group_id=invite.group_id, user_id=current_user.id, role=MemberRole.member)
    db.add(member)
    db.add(Notification(
        user_id=invite.invited_by, actor_id=current_user.id,
        type=NotificationType.group_join,
        message=f"{current_user.name} aceitou o convite para «{group.name}»",
        link=f"/groups/{group.slug}/community",
    ))
    try:
        await db.commit()
    except IntegrityError:
        await db.rollback()
        raise HTTPException(status_code=409, detail="Already a member")
    await db.refresh(member)
    return member


# ── Content Linking (multi-group, Q3.1) ───────────────────────────────────

CONTENT_MODELS = {
    "event": Event,
    "article": Content,
    "course": Course,
    "waste_hub": CompostingHub,
}


@router.post("/{group_id}/content/{content_type}/{content_id}", status_code=201)
async def link_content(
    group_id: int,
    content_type: str,
    content_id: int,
    is_public: bool = Query(True),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    group = await _get_group_or_404(db, group_id, current_user)
    if not await _can_manage_group(db, group, current_user):
        raise HTTPException(status_code=403, detail="Not authorized")
    model = CONTENT_MODELS.get(content_type)
    if model is None:
        raise HTTPException(status_code=400, detail="Invalid content type")
    if not await db.get(model, content_id):
        raise HTTPException(status_code=404, detail="Content not found")
    existing = await db.scalar(
        select(GroupContent).where(
            GroupContent.group_id == group_id,
            GroupContent.content_type == content_type,
            GroupContent.content_id == content_id,
        )
    )
    if existing:
        # Update visibility if it changed
        if existing.is_public != is_public:
            existing.is_public = is_public
            await db.commit()
        return {"ok": True, "already_linked": True}
    link = GroupContent(
        group_id=group_id, content_type=content_type, content_id=content_id,
        linked_by=current_user.id, is_public=is_public,
    )
    db.add(link)
    await db.commit()
    return {"ok": True}


@router.patch("/{group_id}/content/{content_type}/{content_id}")
async def update_content_link(
    group_id: int,
    content_type: str,
    content_id: int,
    is_public: bool = Query(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Toggle the per-link visibility (public vs members-only) — used for courses."""
    group = await _get_group_or_404(db, group_id, current_user)
    if not await _can_manage_group(db, group, current_user):
        raise HTTPException(status_code=403, detail="Not authorized")
    link = await db.scalar(
        select(GroupContent).where(
            GroupContent.group_id == group_id,
            GroupContent.content_type == content_type,
            GroupContent.content_id == content_id,
        )
    )
    if not link:
        raise HTTPException(status_code=404, detail="Content link not found")
    link.is_public = is_public
    await db.commit()
    return {"ok": True, "is_public": is_public}


@router.delete("/{group_id}/content/{content_type}/{content_id}", status_code=204)
async def unlink_content(
    group_id: int,
    content_type: str,
    content_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    group = await _get_group_or_404(db, group_id, current_user)
    if not await _can_manage_group(db, group, current_user):
        raise HTTPException(status_code=403, detail="Not authorized")
    await db.execute(
        delete(GroupContent).where(
            GroupContent.group_id == group_id,
            GroupContent.content_type == content_type,
            GroupContent.content_id == content_id,
        )
    )
    await db.commit()


@router.get("/{group_id}/content/{content_type}")
async def list_group_content(
    group_id: int,
    content_type: str,
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    group = await _get_group_or_404(db, group_id, current_user)
    # Courses use per-link is_public, not section visibility config
    if content_type == "course":
        is_manager, is_member = await _viewer(db, group, current_user)
        if not (is_member or is_manager):
            # Non-members only see public courses
            section_filter = GroupContent.is_public == True  # noqa: E712
        else:
            section_filter = None  # members/managers see all
    else:
        # Events → "calendar" section, articles → "news" section
        section = "calendar" if content_type == "event" else "news"
        await _require_section(db, group, current_user, section)
        section_filter = None  # section visibility already enforced above
    stmt = select(GroupContent).where(
        GroupContent.group_id == group_id,
        GroupContent.content_type == content_type,
    )
    if section_filter is not None:
        stmt = stmt.where(section_filter)
    result = await db.execute(
        stmt.order_by(GroupContent.created_at.desc()).offset(offset).limit(limit)
    )
    links = result.scalars().all()
    # Enrich with the target item's title/date/image so the UI never shows
    # bare ids ("Event #12"). Batch fetch, one query.
    details: dict[int, dict] = {}
    model = CONTENT_MODELS.get(content_type)
    if model is not None and links:
        ids = [r.content_id for r in links]
        targets = (await db.execute(select(model).where(model.id.in_(ids)))).scalars().all()
        for t in targets:
            details[t.id] = {
                "title": getattr(t, "title", None) or getattr(t, "name", None),
                "image_url": getattr(t, "image_url", None),
                "date": (getattr(t, "date", None).isoformat() if getattr(t, "date", None) else None),
                "location": getattr(t, "location", None),
            }
    return [
        {
            "content_id": r.content_id,
            "linked_by": r.linked_by,
            "is_public": r.is_public,
            "created_at": r.created_at.isoformat() if r.created_at else None,
            **details.get(r.content_id, {"title": None, "image_url": None, "date": None, "location": None}),
        }
        for r in links
    ]


@router.get("/content/{content_type}/{content_id}/groups")
async def get_groups_for_content(
    content_type: str,
    content_id: int,
    db: AsyncSession = Depends(get_db),
):
    """Returns groups that feature this content item (for the 'Featured in' component)."""
    result = await db.execute(
        select(Group).join(GroupContent, GroupContent.group_id == Group.id).where(
            GroupContent.content_type == content_type,
            GroupContent.content_id == content_id,
            Group.status == GroupStatus.active,
        ).limit(50)
    )
    groups = result.scalars().all()
    return [{"id": g.id, "name": g.name, "slug": g.slug, "logo_url": g.logo_url, "group_type": g.group_type} for g in groups]


# ── Contacts ──

@router.get("/{group_id}/contacts", response_model=list[GroupContactResponse])
async def list_contacts(
    group_id: int,
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    group = await _get_group_or_404(db, group_id, current_user)
    is_manager, is_member = await _require_section(db, group, current_user, "contacts")
    stmt = select(GroupContact).where(GroupContact.group_id == group_id)
    if not (is_member or is_manager):
        stmt = stmt.where(GroupContact.is_public == True)  # noqa: E712
    result = await db.execute(stmt.order_by(GroupContact.display_order).offset(offset).limit(limit))
    return result.scalars().all()

@router.post("/{group_id}/contacts", response_model=GroupContactResponse, status_code=201)
async def create_contact(group_id: int, body: GroupContactCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    group = await _get_group_or_404(db, group_id, current_user)
    if not await _can_manage_group(db, group, current_user):
        raise HTTPException(status_code=403, detail="Not authorized")
    contact = GroupContact(group_id=group_id, **body.model_dump())
    db.add(contact)
    await db.commit()
    await db.refresh(contact)
    return contact

@router.delete("/{group_id}/contacts/{contact_id}", status_code=204)
async def delete_contact(group_id: int, contact_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    group = await _get_group_or_404(db, group_id, current_user)
    if not await _can_manage_group(db, group, current_user):
        raise HTTPException(status_code=403, detail="Not authorized")
    contact = await db.get(GroupContact, contact_id)
    if not contact or contact.group_id != group_id:
        raise HTTPException(status_code=404, detail="Contact not found")
    await db.delete(contact)
    await db.commit()


@router.patch("/{group_id}/contacts/{contact_id}", response_model=GroupContactResponse)
async def update_contact(group_id: int, contact_id: int, body: GroupContactUpdate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Edit an existing contact (address/phone/email/website/hours/label/public)."""
    group = await _get_group_or_404(db, group_id, current_user)
    if not await _can_manage_group(db, group, current_user):
        raise HTTPException(status_code=403, detail="Not authorized")
    contact = await db.get(GroupContact, contact_id)
    if not contact or contact.group_id != group_id:
        raise HTTPException(status_code=404, detail="Contact not found")
    for key, val in body.model_dump(exclude_unset=True).items():
        setattr(contact, key, val)
    await db.commit()
    await db.refresh(contact)
    return contact


# ── Board Members ──

@router.get("/{group_id}/board", response_model=list[GroupBoardMemberResponse])
async def list_board(
    group_id: int,
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    group = await _get_group_or_404(db, group_id, current_user)
    await _require_section(db, group, current_user, "board")
    result = await db.execute(
        select(GroupBoardMember).where(GroupBoardMember.group_id == group_id)
        .order_by(GroupBoardMember.display_order).offset(offset).limit(limit)
    )
    return result.scalars().all()

@router.post("/{group_id}/board", response_model=GroupBoardMemberResponse, status_code=201)
async def create_board_member(group_id: int, body: GroupBoardMemberCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    group = await _get_group_or_404(db, group_id, current_user)
    if not await _can_manage_group(db, group, current_user):
        raise HTTPException(status_code=403, detail="Not authorized")
    member = GroupBoardMember(group_id=group_id, **body.model_dump())
    db.add(member)
    await db.commit()
    await db.refresh(member)
    return member

@router.delete("/{group_id}/board/{member_id}", status_code=204)
async def delete_board_member(group_id: int, member_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    group = await _get_group_or_404(db, group_id, current_user)
    if not await _can_manage_group(db, group, current_user):
        raise HTTPException(status_code=403, detail="Not authorized")
    member = await db.get(GroupBoardMember, member_id)
    if not member or member.group_id != group_id:
        raise HTTPException(status_code=404, detail="Board member not found")
    await db.delete(member)
    await db.commit()


# ── Documents ──

@router.get("/{group_id}/documents", response_model=list[GroupDocumentResponse])
async def list_documents(
    group_id: int,
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    group = await _get_group_or_404(db, group_id, current_user)
    is_manager, is_member = await _require_section(db, group, current_user, "documents")
    stmt = select(GroupDocument).where(GroupDocument.group_id == group_id)
    if not (is_member or is_manager):
        stmt = stmt.where(GroupDocument.is_public == True)  # noqa: E712
    result = await db.execute(stmt.order_by(GroupDocument.display_order).offset(offset).limit(limit))
    return result.scalars().all()

@router.post("/{group_id}/documents", response_model=GroupDocumentResponse, status_code=201)
async def create_document(group_id: int, body: GroupDocumentCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    group = await _get_group_or_404(db, group_id, current_user)
    if not await _can_manage_group(db, group, current_user):
        raise HTTPException(status_code=403, detail="Not authorized")
    doc = GroupDocument(group_id=group_id, **body.model_dump())
    db.add(doc)
    await db.commit()
    await db.refresh(doc)
    return doc

@router.delete("/{group_id}/documents/{doc_id}", status_code=204)
async def delete_document(group_id: int, doc_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    group = await _get_group_or_404(db, group_id, current_user)
    if not await _can_manage_group(db, group, current_user):
        raise HTTPException(status_code=403, detail="Not authorized")
    doc = await db.get(GroupDocument, doc_id)
    if not doc or doc.group_id != group_id:
        raise HTTPException(status_code=404, detail="Document not found")
    await db.delete(doc)
    await db.commit()


@router.patch("/{group_id}/documents/{doc_id}", response_model=GroupDocumentResponse)
async def update_document(group_id: int, doc_id: int, body: GroupDocumentUpdate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    """Edit an existing document — including the per-document is_public toggle."""
    group = await _get_group_or_404(db, group_id, current_user)
    if not await _can_manage_group(db, group, current_user):
        raise HTTPException(status_code=403, detail="Not authorized")
    doc = await db.get(GroupDocument, doc_id)
    if not doc or doc.group_id != group_id:
        raise HTTPException(status_code=404, detail="Document not found")
    for key, val in body.model_dump(exclude_unset=True).items():
        setattr(doc, key, val)
    await db.commit()
    await db.refresh(doc)
    return doc


# ── Programs ──

@router.get("/{group_id}/programs", response_model=list[GroupProgramResponse])
async def list_programs(
    group_id: int,
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    group = await _get_group_or_404(db, group_id, current_user)
    await _require_section(db, group, current_user, "programs")
    result = await db.execute(
        select(GroupProgram).where(GroupProgram.group_id == group_id)
        .order_by(GroupProgram.display_order).offset(offset).limit(limit)
    )
    return result.scalars().all()

@router.post("/{group_id}/programs", response_model=GroupProgramResponse, status_code=201)
async def create_program(group_id: int, body: GroupProgramCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    group = await _get_group_or_404(db, group_id, current_user)
    if not await _can_manage_group(db, group, current_user):
        raise HTTPException(status_code=403, detail="Not authorized")
    program = GroupProgram(group_id=group_id, **body.model_dump())
    db.add(program)
    await db.commit()
    await db.refresh(program)
    return program

@router.delete("/{group_id}/programs/{program_id}", status_code=204)
async def delete_program(group_id: int, program_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    group = await _get_group_or_404(db, group_id, current_user)
    if not await _can_manage_group(db, group, current_user):
        raise HTTPException(status_code=403, detail="Not authorized")
    program = await db.get(GroupProgram, program_id)
    if not program or program.group_id != group_id:
        raise HTTPException(status_code=404, detail="Program not found")
    await db.execute(delete(GroupProgramSubField).where(GroupProgramSubField.program_id == program_id))
    await db.delete(program)
    await db.commit()


# ── Program Sub-fields ──

async def _get_program_in_group(db: AsyncSession, group_id: int, program_id: int) -> GroupProgram:
    program = await db.get(GroupProgram, program_id)
    if not program or program.group_id != group_id:
        raise HTTPException(status_code=404, detail="Program not found")
    return program


@router.get("/{group_id}/programs/{program_id}/subfields", response_model=list[GroupProgramSubFieldResponse])
async def list_subfields(
    group_id: int,
    program_id: int,
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    group = await _get_group_or_404(db, group_id, current_user)
    await _require_section(db, group, current_user, "programs")
    await _get_program_in_group(db, group_id, program_id)
    result = await db.execute(
        select(GroupProgramSubField).where(GroupProgramSubField.program_id == program_id)
        .order_by(GroupProgramSubField.display_order).offset(offset).limit(limit)
    )
    return result.scalars().all()

@router.post("/{group_id}/programs/{program_id}/subfields", response_model=GroupProgramSubFieldResponse, status_code=201)
async def create_subfield(group_id: int, program_id: int, body: GroupProgramSubFieldCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    group = await _get_group_or_404(db, group_id, current_user)
    if not await _can_manage_group(db, group, current_user):
        raise HTTPException(status_code=403, detail="Not authorized")
    await _get_program_in_group(db, group_id, program_id)
    # If a parent is given, it must be a top-level sub-field of the SAME
    # program (no grand-parents — max depth 3: program → category → item).
    if body.parent_id is not None:
        parent = await db.get(GroupProgramSubField, body.parent_id)
        if not parent or parent.program_id != program_id:
            raise HTTPException(status_code=404, detail="Parent sub-field not found")
        if parent.parent_id is not None:
            raise HTTPException(status_code=400, detail="Maximum nesting depth reached")
    subfield = GroupProgramSubField(program_id=program_id, **body.model_dump())
    db.add(subfield)
    await db.commit()
    await db.refresh(subfield)
    return subfield

@router.delete("/{group_id}/programs/{program_id}/subfields/{subfield_id}", status_code=204)
async def delete_subfield(group_id: int, program_id: int, subfield_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    group = await _get_group_or_404(db, group_id, current_user)
    if not await _can_manage_group(db, group, current_user):
        raise HTTPException(status_code=403, detail="Not authorized")
    await _get_program_in_group(db, group_id, program_id)
    subfield = await db.get(GroupProgramSubField, subfield_id)
    if not subfield or subfield.program_id != program_id:
        raise HTTPException(status_code=404, detail="Sub-field not found")
    # Cascade: deleting a category takes its items with it.
    await db.execute(delete(GroupProgramSubField).where(GroupProgramSubField.parent_id == subfield_id))
    await db.delete(subfield)
    await db.commit()


# ── Announcements ──

@router.get("/{group_id}/announcements", response_model=list[GroupAnnouncementResponse])
async def list_announcements(
    group_id: int,
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    group = await _get_group_or_404(db, group_id, current_user)
    await _require_section(db, group, current_user, "announcements")
    result = await db.execute(
        select(GroupAnnouncement).where(GroupAnnouncement.group_id == group_id)
        .order_by(GroupAnnouncement.created_at.desc()).offset(offset).limit(limit)
    )
    return result.scalars().all()

@router.post("/{group_id}/announcements", response_model=GroupAnnouncementResponse, status_code=201)
async def create_announcement(group_id: int, body: GroupAnnouncementCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    group = await _get_group_or_404(db, group_id, current_user)
    if not await _can_manage_group(db, group, current_user):
        raise HTTPException(status_code=403, detail="Not authorized")
    ann = GroupAnnouncement(group_id=group_id, author_id=current_user.id, body=body.body)
    db.add(ann)
    await db.commit()
    await db.refresh(ann)
    return ann

@router.delete("/{group_id}/announcements/{ann_id}", status_code=204)
async def delete_announcement(group_id: int, ann_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    group = await _get_group_or_404(db, group_id, current_user)
    if not await _can_manage_group(db, group, current_user):
        raise HTTPException(status_code=403, detail="Not authorized")
    ann = await db.get(GroupAnnouncement, ann_id)
    if not ann or ann.group_id != group_id:
        raise HTTPException(status_code=404, detail="Announcement not found")
    await db.delete(ann)
    await db.commit()


# ── Chat Links ──

@router.get("/{group_id}/chats", response_model=list[GroupChatLinkResponse])
async def list_chats(
    group_id: int,
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    group = await _get_group_or_404(db, group_id, current_user)
    await _require_section(db, group, current_user, "chats")
    result = await db.execute(
        select(GroupChatLink).where(GroupChatLink.group_id == group_id)
        .order_by(GroupChatLink.display_order).offset(offset).limit(limit)
    )
    return result.scalars().all()

@router.post("/{group_id}/chats", response_model=GroupChatLinkResponse, status_code=201)
async def create_chat(group_id: int, body: GroupChatLinkCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    group = await _get_group_or_404(db, group_id, current_user)
    if not await _can_manage_group(db, group, current_user):
        raise HTTPException(status_code=403, detail="Not authorized")
    chat = GroupChatLink(group_id=group_id, **body.model_dump())
    db.add(chat)
    await db.commit()
    await db.refresh(chat)
    return chat

@router.delete("/{group_id}/chats/{chat_id}", status_code=204)
async def delete_chat(group_id: int, chat_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    group = await _get_group_or_404(db, group_id, current_user)
    if not await _can_manage_group(db, group, current_user):
        raise HTTPException(status_code=403, detail="Not authorized")
    chat = await db.get(GroupChatLink, chat_id)
    if not chat or chat.group_id != group_id:
        raise HTTPException(status_code=404, detail="Chat link not found")
    await db.delete(chat)
    await db.commit()


# ── Gallery ──

@router.get("/{group_id}/gallery", response_model=list[GroupGalleryItemResponse])
async def list_gallery(
    group_id: int,
    limit: int = Query(100, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    current_user: User | None = Depends(get_optional_user),
):
    group = await _get_group_or_404(db, group_id, current_user)
    await _require_section(db, group, current_user, "gallery")
    result = await db.execute(
        select(GroupGalleryItem).where(GroupGalleryItem.group_id == group_id)
        .order_by(GroupGalleryItem.display_order).offset(offset).limit(limit)
    )
    return result.scalars().all()

@router.post("/{group_id}/gallery", response_model=GroupGalleryItemResponse, status_code=201)
async def create_gallery_item(group_id: int, body: GroupGalleryItemCreate, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    group = await _get_group_or_404(db, group_id, current_user)
    if not await _can_manage_group(db, group, current_user):
        raise HTTPException(status_code=403, detail="Not authorized")
    item = GroupGalleryItem(group_id=group_id, uploaded_by=current_user.id, **body.model_dump())
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item

@router.delete("/{group_id}/gallery/{item_id}", status_code=204)
async def delete_gallery_item(group_id: int, item_id: int, current_user: User = Depends(get_current_user), db: AsyncSession = Depends(get_db)):
    group = await _get_group_or_404(db, group_id, current_user)
    if not await _can_manage_group(db, group, current_user):
        raise HTTPException(status_code=403, detail="Not authorized")
    item = await db.get(GroupGalleryItem, item_id)
    if not item or item.group_id != group_id:
        raise HTTPException(status_code=404, detail="Gallery item not found")
    await db.delete(item)
    await db.commit()


# ── Graduation (informal → formal) ──────────────────────────────────────────

@router.post("/{group_id}/graduation", response_model=GroupGraduationRequestResponse, status_code=201)
async def request_graduation(
    group_id: int,
    body: GroupGraduationRequestCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Group owner initiates the informal→formal transition (§9.6).
    Provides the org's legal info (NIPC, legal form, certificate).
    A super_admin reviews and approves/rejects. Irreversible on approval."""
    group = await _get_group_or_404(db, group_id, current_user)
    if not await _is_group_owner(db, group, current_user):
        raise HTTPException(status_code=403, detail="Only the group owner can request graduation")
    if group.group_type != "organic":
        raise HTTPException(status_code=400, detail="This group is already formal (structured)")
    # Check for an existing pending request
    existing = await db.scalar(
        select(GroupGraduationRequest).where(
            GroupGraduationRequest.group_id == group_id,
            GroupGraduationRequest.status == "pending",
        )
    )
    if existing:
        raise HTTPException(status_code=409, detail="A graduation request is already pending for this group")
    req = GroupGraduationRequest(
        group_id=group_id,
        requested_by=current_user.id,
        nipc=body.nipc,
        legal_form=body.legal_form,
        organization_name=body.organization_name,
        certificate_url=body.certificate_url,
        notes=body.notes,
    )
    db.add(req)
    await db.commit()
    await db.refresh(req)
    return req


@router.get("/{group_id}/graduation", response_model=GroupGraduationRequestResponse | None)
async def get_graduation_status(
    group_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Get the latest graduation request for this group (owner + managers only)."""
    group = await _get_group_or_404(db, group_id, current_user)
    if not await _can_manage_group(db, group, current_user):
        raise HTTPException(status_code=403, detail="Not authorized")
    # Return the most recent request (pending or otherwise)
    result = await db.execute(
        select(GroupGraduationRequest)
        .where(GroupGraduationRequest.group_id == group_id)
        .order_by(GroupGraduationRequest.created_at.desc())
        .limit(1)
    )
    return result.scalar_one_or_none()




@router.post("/graduation-requests/{request_id}/approve")
async def approve_graduation(
    request_id: int,
    review_notes: str | None = Query(None, max_length=2000),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Super_admin: approve a graduation request. Flips the group to
    'structured' (irreversible) and notifies the requester."""
    if not rank_at_least(current_user, Rank.super_admin):
        raise HTTPException(status_code=403, detail="Super admin only")
    req = await db.get(GroupGraduationRequest, request_id)
    if not req or req.status != "pending":
        raise HTTPException(status_code=404, detail="Pending request not found")
    group = await db.get(Group, req.group_id)
    if not group:
        raise HTTPException(status_code=404, detail="Group no longer exists")
    # The irreversible transition
    group.group_type = "structured"
    req.status = "approved"
    req.reviewed_by = current_user.id
    req.reviewed_at = datetime.now(UTC)
    if review_notes:
        req.review_notes = review_notes
    # Notify the requester
    db.add(Notification(
        user_id=req.requested_by, actor_id=current_user.id,
        type=NotificationType.group_join,
        message=f"O seu pedido de graduação para «{group.name}» foi aprovado — o grupo é agora formal.",
        link=f"/groups/{group.slug}/manage",
    ))
    await db.commit()
    return {"ok": True, "group_type": "structured"}


@router.post("/graduation-requests/{request_id}/reject")
async def reject_graduation(
    request_id: int,
    review_notes: str | None = Query(None, max_length=2000),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Super_admin: reject a graduation request with optional notes."""
    if not rank_at_least(current_user, Rank.super_admin):
        raise HTTPException(status_code=403, detail="Super admin only")
    req = await db.get(GroupGraduationRequest, request_id)
    if not req or req.status != "pending":
        raise HTTPException(status_code=404, detail="Pending request not found")
    group = await db.get(Group, req.group_id)
    req.status = "rejected"
    req.reviewed_by = current_user.id
    req.reviewed_at = datetime.now(UTC)
    if review_notes:
        req.review_notes = review_notes
    if group:
        db.add(Notification(
            user_id=req.requested_by, actor_id=current_user.id,
            type=NotificationType.group_join,
            message=f"O seu pedido de graduação para «{group.name}» não foi aprovado.",
            link=f"/groups/{group.slug}/manage",
        ))
    await db.commit()
    return {"ok": True}
