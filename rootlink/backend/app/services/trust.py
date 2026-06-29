"""Trusted-author eligibility (CONTENT_PLATFORM.md §3.2).

A user becomes eligible for instant self-publishing after verifying their account
and having enough items approved. Eligibility is computed; the actual grant is a
deliberate admin action after the user accepts the Publisher Responsibility
agreement.
"""

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.content import Content, VerificationStatus
from app.models.user import User

SELF_PUBLISH_MIN_APPROVED = 3


async def approved_content_count(db: AsyncSession, user_id: int) -> int:
    return await db.scalar(
        select(func.count(Content.id)).where(
            Content.created_by == user_id,
            Content.verification_status == VerificationStatus.community_reviewed,
        )
    ) or 0


async def self_publish_eligibility(db: AsyncSession, user: User) -> dict:
    approved = await approved_content_count(db, user.id)
    return {
        "email_verified": bool(user.is_verified),
        "approved_count": approved,
        "threshold": SELF_PUBLISH_MIN_APPROVED,
        "eligible": bool(user.is_verified) and approved >= SELF_PUBLISH_MIN_APPROVED,
        "agreed": user.self_publish_agreed_at is not None,
        "granted": bool(user.can_self_publish),
    }
