"""User-facing trusted-author promotion flow (CONTENT_PLATFORM.md §3.2).

Eligibility is computed; the user accepts the Publisher Responsibility agreement
here; a mod/admin makes the final grant via the admin enforcement endpoints.
"""

from datetime import UTC, datetime

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.services.trust import self_publish_eligibility

router = APIRouter(prefix="/api/me/self-publish", tags=["self-publish"])


@router.get("/eligibility")
async def get_eligibility(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    return await self_publish_eligibility(db, current_user)


@router.post("/accept")
async def accept_responsibility(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    """Record the user's acceptance of the Publisher Responsibility agreement.

    This does NOT grant self-publishing — a moderator/admin still approves it.
    """
    status = await self_publish_eligibility(db, current_user)
    if not status["eligible"]:
        raise HTTPException(
            status_code=400,
            detail="Not yet eligible (verify your account and have 3 items approved first)",
        )
    current_user.self_publish_agreed_at = datetime.now(UTC)
    await db.commit()
    return {"ok": True, "agreed_at": current_user.self_publish_agreed_at}
