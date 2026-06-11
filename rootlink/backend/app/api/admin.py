from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, func, delete
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user, hash_password
from app.models.user import User, UserRole
from app.models.content import Content, SearchQueryLog, VerificationStatus
from app.models.group import Group, GroupMember
from app.models.comment import Comment
from app.models.event import Event, EventRSVP
from app.models.learning import Course, Enrollment
from app.models.notification import Notification, NotificationType
from app.schemas.content import ContentResponse
from app.schemas.group import GroupResponse
from app.schemas.comment import CommentResponse
from app.schemas.notification import NotificationResponse

router = APIRouter(prefix="/api/admin", tags=["admin"])


def require_role(allowed_roles: list[UserRole]):
    def _require_role(current_user: User = Depends(get_current_user)):
        if current_user.role not in allowed_roles:
            raise HTTPException(status_code=403, detail="Not enough permissions")
        return current_user
    return _require_role


require_admin = Depends(require_role([UserRole.admin]))
require_mod = Depends(require_role([UserRole.admin, UserRole.moderator]))
require_contributor = Depends(require_role([UserRole.admin, UserRole.moderator, UserRole.contributor]))


@router.get("/dashboard")
async def dashboard(
    db: AsyncSession = Depends(get_db),
    _=require_admin,
):
    users_count = await db.scalar(select(func.count(User.id)))
    content_count = await db.scalar(select(func.count(Content.id)))
    groups_count = await db.scalar(select(func.count(Group.id)))
    comments_count = await db.scalar(select(func.count(Comment.id)))
    events_count = await db.scalar(select(func.count(Event.id)))
    courses_count = await db.scalar(select(func.count(Course.id)))
    enrollments_count = await db.scalar(select(func.count(Enrollment.id)))
    unreviewed = await db.scalar(
        select(func.count(Content.id)).where(Content.verification_status == VerificationStatus.unreviewed)
    )
    cross_ref = await db.scalar(
        select(func.count(Content.id)).where(Content.verification_status == VerificationStatus.cross_referenced)
    )

    return {
        "users": users_count or 0,
        "content": content_count or 0,
        "groups": groups_count or 0,
        "comments": comments_count or 0,
        "events": events_count or 0,
        "courses": courses_count or 0,
        "enrollments": enrollments_count or 0,
        "unreviewed_content": unreviewed or 0,
        "cross_referenced_content": cross_ref or 0,
    }


# ── Users ──

@router.get("/users")
async def list_users(
    q: str | None = Query(None),
    role: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    _=require_admin,
):
    stmt = select(User).order_by(User.created_at.desc())
    if q:
        stmt = stmt.where(
            User.name.ilike(f"%{q}%") | User.email.ilike(f"%{q}%")
        )
    if role:
        stmt = stmt.where(User.role == role)
    stmt = stmt.offset(offset).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.patch("/users/{user_id}/role")
async def update_user_role(
    user_id: int,
    role: UserRole,
    db: AsyncSession = Depends(get_db),
    current_user: User = require_admin,
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot change your own role")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.role = role
    await db.commit()
    return {"ok": True}


@router.patch("/users/{user_id}/password")
async def reset_user_password(
    user_id: int,
    password: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = require_admin,
):
    if len(password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalar_one_or_none()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.password_hash = hash_password(password)
    await db.commit()
    return {"ok": True}


# ── Content ──

@router.get("/content", response_model=list[ContentResponse])
async def list_content(
    q: str | None = Query(None),
    verification_status: str | None = Query(None),
    content_type: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    _=require_mod,
):
    stmt = select(Content).order_by(Content.created_at.desc())
    if q:
        stmt = stmt.where(Content.title.ilike(f"%{q}%"))
    if verification_status:
        stmt = stmt.where(Content.verification_status == verification_status)
    if content_type:
        stmt = stmt.where(Content.content_type == content_type)
    stmt = stmt.offset(offset).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.patch("/content/{content_id}/approve")
async def approve_content(
    content_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = require_contributor,
):
    result = await db.execute(select(Content).where(Content.id == content_id))
    content = result.scalar_one_or_none()
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")
    content.verification_status = VerificationStatus.community_reviewed
    content.validated_by = current_user.id
    await db.commit()
    return {"ok": True, "verification_status": "community_reviewed"}


@router.patch("/content/{content_id}/reject")
async def reject_content(
    content_id: int,
    db: AsyncSession = Depends(get_db),
    _=require_mod,
):
    result = await db.execute(select(Content).where(Content.id == content_id))
    content = result.scalar_one_or_none()
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")
    await db.execute(delete(Content).where(Content.id == content_id))
    await db.commit()
    return {"ok": True}


@router.get("/review-queue", response_model=list[ContentResponse])
async def review_queue(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    _=require_contributor,
):
    stmt = (
        select(Content)
        .where(Content.verification_status == VerificationStatus.unreviewed)
        .order_by(Content.created_at.desc())
        .offset(offset)
        .limit(limit)
    )
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/trending-searches")
async def trending_searches(
    limit: int = Query(10, ge=1, le=50),
    db: AsyncSession = Depends(get_db),
    _=require_mod,
):
    result = await db.execute(
        select(SearchQueryLog.query, func.count(SearchQueryLog.id).label("cnt"))
        .group_by(SearchQueryLog.query)
        .order_by(func.count(SearchQueryLog.id).desc())
        .limit(limit)
    )
    return [{"query": row[0], "count": row[1]} for row in result.all()]


@router.patch("/content/{content_id}/image")
async def update_content_image(
    content_id: int,
    image_url: str,
    db: AsyncSession = Depends(get_db),
    _=require_mod,
):
    result = await db.execute(select(Content).where(Content.id == content_id))
    content = result.scalar_one_or_none()
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")
    content.image_url = image_url
    await db.commit()
    return {"ok": True}


@router.delete("/content/{content_id}", status_code=204)
async def delete_content(
    content_id: int,
    db: AsyncSession = Depends(get_db),
    _=require_mod,
):
    await db.execute(delete(Content).where(Content.id == content_id))
    await db.commit()


@router.patch("/content/{content_id}")
async def update_content(
    content_id: int,
    title: str | None = None,
    summary: str | None = None,
    category: str | None = None,
    content_type: str | None = None,
    db: AsyncSession = Depends(get_db),
    _=require_mod,
):
    result = await db.execute(select(Content).where(Content.id == content_id))
    content = result.scalar_one_or_none()
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")
    if title is not None:
        content.title = title
    if summary is not None:
        content.summary = summary
    if category is not None:
        content.category = category
    if content_type is not None:
        content.content_type = content_type
    await db.commit()
    return content


# ── Groups ──

@router.get("/groups", response_model=list[GroupResponse])
async def list_groups(
    q: str | None = Query(None),
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    _=require_mod,
):
    stmt = select(Group).order_by(Group.created_at.desc())
    if q:
        stmt = stmt.where(Group.name.ilike(f"%{q}%"))
    stmt = stmt.offset(offset).limit(limit)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.delete("/groups/{group_id}", status_code=204)
async def delete_group(
    group_id: int,
    db: AsyncSession = Depends(get_db),
    _=require_admin,
):
    await db.execute(delete(GroupMember).where(GroupMember.group_id == group_id))
    await db.execute(delete(Group).where(Group.id == group_id))
    await db.commit()


# ── Comments ──

@router.get("/comments", response_model=list[CommentResponse])
async def list_comments(
    limit: int = Query(50, ge=1, le=200),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
    _=require_mod,
):
    result = await db.execute(
        select(Comment).order_by(Comment.created_at.desc()).offset(offset).limit(limit)
    )
    return result.scalars().all()


@router.delete("/comments/{comment_id}", status_code=204)
async def delete_comment(
    comment_id: int,
    db: AsyncSession = Depends(get_db),
    _=require_mod,
):
    await db.execute(delete(Comment).where(Comment.id == comment_id))
    await db.commit()


# ── Broadcast ──

@router.post("/broadcast")
async def broadcast_notification(
    message: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = require_admin,
):
    result = await db.execute(select(User.id))
    user_ids = result.scalars().all()
    for uid in user_ids:
        db.add(Notification(
            user_id=uid,
            actor_id=current_user.id,
            type=NotificationType.system,
            message=message,
            link="/",
        ))
    await db.commit()
    return {"sent_to": len(user_ids)}
