from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user, get_optional_user, get_writable_user
from app.models.content import Content
from app.models.rating import ContentRating
from app.models.user import User
from app.schemas.rating import RatingAggregate, RatingCreate, RatingResponse

router = APIRouter(prefix="/api/content", tags=["ratings"])

RATING_TAGS = [
    "well-researched", "practical", "inspiring",
    "clear-writing", "original", "community-focused",
]


@router.post("/{content_id}/rate", response_model=RatingResponse, status_code=201)
async def rate_content(
    content_id: int,
    body: RatingCreate,
    current_user: User = Depends(get_writable_user),
    db: AsyncSession = Depends(get_db),
):
    if body.reaction not in ("up", "down"):
        raise HTTPException(status_code=400, detail="Reaction must be 'up' or 'down'")

    if body.tags:
        invalid = [t for t in body.tags if t not in RATING_TAGS]
        if invalid:
            raise HTTPException(status_code=400, detail=f"Invalid tags: {invalid}. Allowed: {RATING_TAGS}")

    content = await db.get(Content, content_id)
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")

    if content.created_by == current_user.id:
        raise HTTPException(status_code=403, detail="Cannot rate your own content")

    existing = await db.scalar(
        select(ContentRating).where(
            ContentRating.content_id == content_id,
            ContentRating.user_id == current_user.id,
        )
    )
    if existing:
        old_reaction = existing.reaction
        existing.reaction = body.reaction
        existing.tags = body.tags
        if old_reaction != body.reaction:
            if body.reaction == "up":
                content.rating_up = (content.rating_up or 0) + 1
                content.rating_down = max((content.rating_down or 0) - 1, 0)
            else:
                content.rating_down = (content.rating_down or 0) + 1
                content.rating_up = max((content.rating_up or 0) - 1, 0)
    else:
        rating = ContentRating(
            content_id=content_id,
            user_id=current_user.id,
            reaction=body.reaction,
            tags=body.tags,
        )
        db.add(rating)
        if body.reaction == "up":
            content.rating_up = (content.rating_up or 0) + 1
        else:
            content.rating_down = (content.rating_down or 0) + 1

    await db.commit()

    result = await db.execute(
        select(ContentRating).where(
            ContentRating.content_id == content_id,
            ContentRating.user_id == current_user.id,
        )
    )
    return result.scalar_one()


@router.delete("/{content_id}/rate", status_code=204)
async def remove_rating(
    content_id: int,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    rating = await db.scalar(
        select(ContentRating).where(
            ContentRating.content_id == content_id,
            ContentRating.user_id == current_user.id,
        )
    )
    if not rating:
        raise HTTPException(status_code=404, detail="Rating not found")

    content = await db.get(Content, content_id)
    if content:
        if rating.reaction == "up":
            content.rating_up = max((content.rating_up or 0) - 1, 0)
        else:
            content.rating_down = max((content.rating_down or 0) - 1, 0)

    await db.delete(rating)
    await db.commit()


@router.get("/{content_id}/ratings", response_model=RatingAggregate)
async def get_ratings(
    content_id: int,
    current_user: User | None = Depends(get_optional_user),
    db: AsyncSession = Depends(get_db),
):
    content = await db.get(Content, content_id)
    if not content:
        raise HTTPException(status_code=404, detail="Content not found")

    tag_counts: dict[str, int] = {}
    result = await db.execute(
        select(ContentRating.tags).where(
            ContentRating.content_id == content_id,
            ContentRating.tags.isnot(None),
        )
    )
    for (tags,) in result.all():
        if tags:
            for tag in tags:
                tag_counts[tag] = tag_counts.get(tag, 0) + 1

    top_tags = sorted(
        [{"tag": t, "count": c} for t, c in tag_counts.items()],
        key=lambda x: x["count"],
        reverse=True,
    )[:5]

    user_reaction = None
    if current_user:
        user_rating = await db.scalar(
            select(ContentRating.reaction).where(
                ContentRating.content_id == content_id,
                ContentRating.user_id == current_user.id,
            )
        )
        user_reaction = user_rating

    return RatingAggregate(
        content_id=content_id,
        up_count=content.rating_up or 0,
        down_count=content.rating_down or 0,
        top_tags=top_tags,
        user_reaction=user_reaction,
    )
