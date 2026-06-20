from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import select, delete, func
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.content import Content
from app.models.event import Event
from app.models.group import Group
from app.models.plant import Plant
from app.models.learning import Course, Lesson
from app.models.comment import Comment
from app.models.notification import Notification, NotificationType
from app.schemas.comment import CommentResponse, CommentCreate
from app.services.sse import sse_manager

router = APIRouter(prefix="/api/comments", tags=["comments"])


ENTITY_MODELS = {
    "content": Content,
    "event": Event,
    "group": Group,
    "plant": Plant,
    "course": Course,
    "lesson": Lesson,
}


def _entity_link(entity_type: str, entity_id: int) -> str:
    routes = {
        "content": f"/content/{entity_id}",
        "event": f"/events/{entity_id}",
        "group": f"/groups/{entity_id}",
        "plant": f"/plants/{entity_id}",
        "course": f"/learning/courses/{entity_id}",
        "lesson": "/learning/courses/0",  # lessons don't have standalone pages
    }
    return routes.get(entity_type, f"/{entity_type}/{entity_id}")


async def _validate_entity(entity_type: str, entity_id: int, db: AsyncSession) -> bool:
    model = ENTITY_MODELS.get(entity_type)
    if model is None:
        return False
    result = await db.execute(select(model).where(model.id == entity_id))
    return result.scalar_one_or_none() is not None


async def _get_entity_owner(entity_type: str, entity_id: int, db: AsyncSession) -> int | None:
    model = ENTITY_MODELS.get(entity_type)
    if model is None:
        return None
    result = await db.execute(select(model).where(model.id == entity_id))
    entity = result.scalar_one_or_none()
    if not entity:
        return None
    return getattr(entity, "created_by", None)


def _build_tree(comments: list[Comment], user_names: dict[int, str]) -> list[CommentResponse]:
    comment_map: dict[int, CommentResponse] = {}
    roots: list[CommentResponse] = []

    for c in comments:
        cr = CommentResponse(
            id=c.id,
            entity_type=c.entity_type,
            entity_id=c.entity_id,
            user_id=c.user_id,
            user_name=user_names.get(c.user_id, f"User #{c.user_id}"),
            parent_id=c.parent_id,
            body=c.body,
            created_at=c.created_at,
            replies=[],
        )
        comment_map[c.id] = cr

    for c in comments:
        cr = comment_map[c.id]
        if cr.parent_id and cr.parent_id in comment_map:
            comment_map[cr.parent_id].replies.append(cr)
        else:
            roots.append(cr)

    return roots


@router.get("/", response_model=list[CommentResponse])
async def get_comments(
    entity_type: str = Query(...),
    entity_id: int = Query(...),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Comment)
        .where(Comment.entity_type == entity_type, Comment.entity_id == entity_id)
        .order_by(Comment.created_at.asc())
    )
    comments = result.scalars().all()

    user_ids = {c.user_id for c in comments}
    user_names: dict[int, str] = {}
    if user_ids:
        user_result = await db.execute(
            select(User.id, User.name).where(User.id.in_(user_ids))
        )
        user_names = {uid: name for uid, name in user_result.all()}

    return _build_tree(comments, user_names)


@router.post("/", response_model=CommentResponse, status_code=201)
async def create_comment(
    body: CommentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    if not await _validate_entity(body.entity_type, body.entity_id, db):
        raise HTTPException(status_code=404, detail=f"{body.entity_type} not found")

    if body.parent_id:
        parent = await db.get(Comment, body.parent_id)
        if not parent or parent.entity_type != body.entity_type or parent.entity_id != body.entity_id:
            raise HTTPException(status_code=400, detail="Invalid parent comment")

    comment = Comment(
        entity_type=body.entity_type,
        entity_id=body.entity_id,
        user_id=current_user.id,
        parent_id=body.parent_id,
        body=body.body,
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)

    link = _entity_link(body.entity_type, body.entity_id)

    if body.parent_id and parent and parent.user_id != current_user.id:
        notif = Notification(
            user_id=parent.user_id,
            actor_id=current_user.id,
            type=NotificationType.reply,
            message=f"{current_user.name} replied to your comment",
            link=link,
        )
        db.add(notif)
        await db.commit()
        await sse_manager.notify(notif.user_id, {"count": 0})
    elif not body.parent_id:
        owner_id = await _get_entity_owner(body.entity_type, body.entity_id, db)
        if owner_id and owner_id != current_user.id:
            entity_label = body.entity_type.capitalize()
            notif = Notification(
                user_id=owner_id,
                actor_id=current_user.id,
                type=NotificationType.comment,
                message=f"{current_user.name} commented on your {entity_label.lower()}",
                link=link,
            )
            db.add(notif)
            await db.commit()
            await sse_manager.notify(notif.user_id, {"count": 0})

    return CommentResponse(
        id=comment.id,
        entity_type=comment.entity_type,
        entity_id=comment.entity_id,
        user_id=comment.user_id,
        user_name=current_user.name,
        parent_id=comment.parent_id,
        body=comment.body,
        created_at=comment.created_at,
        replies=[],
    )


@router.delete("/{comment_id}", status_code=204)
async def delete_comment(
    comment_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(Comment).where(Comment.id == comment_id, Comment.user_id == current_user.id)
    )
    comment = result.scalar_one_or_none()
    if not comment:
        raise HTTPException(status_code=404, detail="Comment not found or not yours")

    await db.execute(delete(Comment).where(Comment.parent_id == comment_id))
    await db.delete(comment)
    await db.commit()


async def get_comment_count(entity_type: str, entity_id: int, db: AsyncSession) -> int:
    count = await db.scalar(
        select(func.count(Comment.id)).where(
            Comment.entity_type == entity_type,
            Comment.entity_id == entity_id,
        )
    )
    return count or 0
