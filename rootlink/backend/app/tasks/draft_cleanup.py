import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import delete, select

from app.core.database import async_session_factory
from app.models.content import Content, ContentStatus, ContentType
from app.tasks.celery_app import celery_app

logger = logging.getLogger("app.tasks.draft_cleanup")

STALE_DRAFT_DAYS = 30


@celery_app.task(name="app.tasks.draft_cleanup.cleanup_stale_drafts")
def cleanup_stale_drafts():
    import asyncio
    asyncio.run(_cleanup_async())


async def _cleanup_async():
    async with async_session_factory() as db:
        cutoff = datetime.now(UTC) - timedelta(days=STALE_DRAFT_DAYS)

        result = await db.execute(
            select(Content).where(
                Content.content_type == ContentType.article,
                Content.status == ContentStatus.draft,
                Content.updated_at < cutoff,
            )
        )
        drafts = result.scalars().all()

        count = 0
        for draft in drafts:
            await db.delete(draft)
            count += 1

        await db.commit()
        logger.info("Draft cleanup complete: %d stale drafts archived", count)
