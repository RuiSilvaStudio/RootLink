"""User data export & account erasure (GDPR Art. 15/17/20 — CONTENT_PLATFORM.md §8).

Export gives the user a copy of their data. Erasure deletes the account and
removes/anonymises personal data: authored content is kept but de-authored
(created_by → NULL tombstone) under legitimate interest, while personal
engagement rows are deleted.
"""

from fastapi import APIRouter, Depends
from sqlalchemy import delete, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.comment import Comment
from app.models.content import Bookmark, Content
from app.models.group import GroupMember
from app.models.notification import Notification
from app.models.rating import ContentRating
from app.models.user import User
from app.services.audit import log_moderation

router = APIRouter(prefix="/api/me", tags=["account"])


@router.get("/export")
async def export_my_data(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Return a portable copy of the user's own data (GDPR Art. 15/20)."""
    content = (await db.execute(select(Content).where(Content.created_by == current_user.id))).scalars().all()
    comments = (await db.execute(select(Comment).where(Comment.user_id == current_user.id))).scalars().all()
    ratings = (await db.execute(select(ContentRating).where(ContentRating.user_id == current_user.id))).scalars().all()

    return {
        "profile": {
            "id": current_user.id,
            "email": current_user.email,
            "name": current_user.name,
            "bio": current_user.bio,
            "location": current_user.location,
            "locale": current_user.locale,
            "account_type": current_user.account_type,
            "role": current_user.role,
            "created_at": current_user.created_at,
        },
        "content": [
            {"id": c.id, "title": c.title, "status": c.status, "created_at": c.created_at}
            for c in content
        ],
        "comments": [
            {"id": c.id, "body": c.body, "entity_type": c.entity_type, "entity_id": c.entity_id, "created_at": c.created_at}
            for c in comments
        ],
        "ratings": [
            {"content_id": r.content_id, "reaction": r.reaction, "created_at": r.created_at}
            for r in ratings
        ],
    }


@router.delete("", status_code=204)
async def delete_my_account(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Erase the account (GDPR Art. 17). Authored content is de-authored
    (anonymised) rather than deleted; personal engagement data is removed."""
    uid = current_user.id

    # Anonymise authorship of content (kept under legitimate interest).
    await db.execute(update(Content).where(Content.created_by == uid).values(created_by=None))
    # Remove personal engagement rows.
    await db.execute(delete(Comment).where(Comment.user_id == uid))
    await db.execute(delete(Bookmark).where(Bookmark.user_id == uid))
    await db.execute(delete(ContentRating).where(ContentRating.user_id == uid))
    await db.execute(delete(Notification).where(Notification.user_id == uid))
    await db.execute(delete(GroupMember).where(GroupMember.user_id == uid))

    await log_moderation(
        db, action="erase_account", target_type="user", target_id=uid, actor_id=uid,
        reason="user-requested erasure",
    )
    # Delete the user row last.
    await db.execute(delete(User).where(User.id == uid))
    await db.commit()
