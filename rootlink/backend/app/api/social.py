from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, delete, or_
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.group import Follow, Group, GroupMember
from app.models.content import Content, Bookmark
from app.models.event import Event
from app.models.notification import Notification, NotificationType
from app.schemas.auth import UserResponse

router = APIRouter(prefix="/api/social", tags=["social"])


# --- Follow / Unfollow ---

@router.post("/follow/{user_id}", status_code=204)
async def follow_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if user_id == current_user.id:
        raise HTTPException(status_code=400, detail="Cannot follow yourself")

    target = await db.get(User, user_id)
    if not target:
        raise HTTPException(status_code=404, detail="User not found")

    existing = await db.execute(
        select(Follow).where(
            Follow.follower_id == current_user.id,
            Follow.following_id == user_id,
        )
    )
    if existing.scalar_one_or_none():
        raise HTTPException(status_code=400, detail="Already following")

    follow = Follow(follower_id=current_user.id, following_id=user_id)
    db.add(follow)

    notif = Notification(
        user_id=user_id,
        actor_id=current_user.id,
        type=NotificationType.follow,
        message=f"{current_user.name} started following you",
        link=f"/profile/{current_user.id}",
    )
    db.add(notif)
    await db.commit()


@router.delete("/follow/{user_id}", status_code=204)
async def unfollow_user(
    user_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    await db.execute(
        delete(Follow).where(
            Follow.follower_id == current_user.id,
            Follow.following_id == user_id,
        )
    )
    await db.commit()


@router.get("/followers", response_model=list[UserResponse])
async def get_followers(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User).join(Follow, Follow.follower_id == User.id).where(
            Follow.following_id == current_user.id
        )
    )
    return result.scalars().all()


@router.get("/following", response_model=list[UserResponse])
async def get_following(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(User).join(Follow, Follow.following_id == User.id).where(
            Follow.follower_id == current_user.id
        )
    )
    return result.scalars().all()


# --- Activity Feed ---

@router.get("/feed")
async def activity_feed(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
    limit: int = 20,
    offset: int = 0,
):
    followed_ids = await db.execute(
        select(Follow.following_id).where(Follow.follower_id == current_user.id)
    )
    followed = [row[0] for row in followed_ids.all()] + [current_user.id]

    groups_result = await db.execute(
        select(GroupMember.group_id).where(GroupMember.user_id == current_user.id)
    )
    group_ids = [row[0] for row in groups_result.all()]

    feed: list[dict] = []

    new_content = await db.execute(
        select(Content)
        .where(Content.source == "user", Content.created_by.in_(followed))
        .order_by(Content.created_at.desc())
        .limit(limit)
    )
    for c in new_content.scalars().all():
        feed.append({
            "type": "content",
            "action": "published",
            "actor_id": c.created_by,
            "target": {"id": c.id, "title": c.title, "content_type": c.content_type},
            "created_at": c.created_at.isoformat() if c.created_at else None,
        })

    if group_ids:
        group_events = await db.execute(
            select(Event)
            .where(Event.group_id.in_(group_ids))
            .order_by(Event.created_at.desc())
            .limit(limit)
        )
        for e in group_events.scalars().all():
            feed.append({
                "type": "event",
                "action": "created",
                "actor_id": e.created_by,
                "target": {"id": e.id, "title": e.title, "date": e.date.isoformat() if e.date else None},
                "created_at": e.created_at.isoformat() if e.created_at else None,
            })

    feed.sort(key=lambda x: x["created_at"] or "", reverse=True)
    return feed[offset:offset + limit]
