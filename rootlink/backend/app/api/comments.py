from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select, delete
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.content import Content
from app.models.comment import Comment
from app.models.notification import Notification, NotificationType
from app.schemas.comment import CommentResponse, CommentCreate
from app.services.sse import sse_manager

router = APIRouter(prefix="/api/comments", tags=["comments"])


def _build_tree(comments: list[Comment]) -> list[CommentResponse]:
    comment_map: dict[int, CommentResponse] = {}
    roots: list[CommentResponse] = []

    for c in comments:
        cr = CommentResponse(
            id=c.id,
            content_id=c.content_id,
            user_id=c.user_id,
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


@router.get("/{content_id}", response_model=list[CommentResponse])
async def get_comments(content_id: int, db: AsyncSession = Depends(get_db)):
    result = await db.execute(
        select(Comment)
        .where(Comment.content_id == content_id)
        .order_by(Comment.created_at.asc())
    )
    comments = result.scalars().all()
    return _build_tree(comments)


@router.post("/", response_model=CommentResponse, status_code=201)
async def create_comment(
    body: CommentCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    content = await db.get(Content, body.content_id)
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")

    if body.parent_id:
        parent = await db.get(Comment, body.parent_id)
        if not parent or parent.content_id != body.content_id:
            raise HTTPException(status_code=400, detail="Invalid parent comment")

    comment = Comment(
        content_id=body.content_id,
        user_id=current_user.id,
        parent_id=body.parent_id,
        body=body.body,
    )
    db.add(comment)
    await db.commit()
    await db.refresh(comment)

    if body.parent_id and parent and parent.user_id != current_user.id:
        notif = Notification(
            user_id=parent.user_id,
            actor_id=current_user.id,
            type=NotificationType.reply,
            message=f"{current_user.name} replied to your comment",
            link=f"/content/{body.content_id}",
        )
        db.add(notif)
        await db.commit()
        await sse_manager.notify(notif.user_id, {"count": 0})
    elif not body.parent_id and content.source == "user" and content.created_by and content.created_by != current_user.id:
        notif = Notification(
            user_id=content.created_by,
            actor_id=current_user.id,
            type=NotificationType.comment,
            message=f"{current_user.name} commented on your post",
            link=f"/content/{body.content_id}",
        )
        db.add(notif)
        await db.commit()
        await sse_manager.notify(notif.user_id, {"count": 0})

    return CommentResponse(
        id=comment.id,
        content_id=comment.content_id,
        user_id=comment.user_id,
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
