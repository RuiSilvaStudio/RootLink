import logging
import math
from datetime import UTC, datetime, timedelta

from sqlalchemy import select

from app.core.database import async_session_factory
from app.models.content import Content, ContentStatus
from app.models.points import PointBalance
from app.models.user import User
from app.tasks.celery_app import celery_app

logger = logging.getLogger("app.tasks.point_decay")

MONTHLY_DECAY_RATE = 0.10
DAILY_DECAY_FACTOR = 1 - (1 - MONTHLY_DECAY_RATE) ** (1 / 30)


@celery_app.task(name="app.tasks.point_decay.apply_decay")
def apply_decay():
    import asyncio
    asyncio.run(_apply_decay_async())


async def _apply_decay_async():
    async with async_session_factory() as db:
        result = await db.execute(
            select(PointBalance).where(PointBalance.balance > 0)
        )
        balances = result.scalars().all()

        decayed = 0
        for bal in balances:
            has_published = await db.scalar(
                select(Content.id).where(
                    Content.created_by == bal.user_id,
                    Content.status == ContentStatus.published,
                ).limit(1)
            )
            if not has_published:
                continue

            old_balance = bal.balance
            bal.balance = bal.balance * (1 - DAILY_DECAY_FACTOR)
            bal.last_decay_at = datetime.now(UTC)

            if bal.balance < 0.01:
                bal.balance = 0.0

            user = await db.get(User, bal.user_id)
            if user:
                if bal.balance > 0:
                    user.boost_active = True
                    user.boost_expires_at = datetime.now(UTC) + timedelta(days=math.ceil(bal.balance))
                else:
                    user.boost_active = False
                    user.boost_expires_at = None

            if abs(old_balance - bal.balance) > 0.001:
                decayed += 1

        await db.commit()
        logger.info("Point decay complete: %d users decayed out of %d with balance", decayed, len(balances))
