"""Daily feed digest task.

For each user with at least one FeedSubscription, counts new articles from
their subscribed feeds since last_digest_at (or last 24h if null). If count
> 0, creates a single feed_digest notification with the count and a link to
/feed. Updates last_digest_at.

Runs daily at 17:00 UTC (~18:00 Portugal) via celery-beat.
"""
import logging
from datetime import UTC, datetime, timedelta

from sqlalchemy import func, select

from app.core.database import async_session_factory
from app.models.content import Content, ContentStatus
from app.models.feed import FeedSubscription
from app.models.notification import Notification, NotificationType
from app.models.user import User
from app.tasks.celery_app import celery_app

logger = logging.getLogger("app.tasks.feed_digest")


@celery_app.task(name="app.tasks.feed_digest.send_daily_digest")
def send_daily_digest():
    import asyncio
    asyncio.run(_send_digest_async())


async def _send_digest_async():
    async with async_session_factory() as db:
        # Find all users with at least one feed subscription
        rows = await db.execute(
            select(FeedSubscription.user_id)
            .distinct()
        )
        user_ids = [r[0] for r in rows.fetchall()]
        logger.info("Feed digest: %d users with subscriptions", len(user_ids))

        total_notifications = 0
        for uid in user_ids:
            user = await db.get(User, uid)
            if not user:
                continue

            # Determine the cutoff time
            cutoff = user.last_digest_at or (datetime.now(UTC) - timedelta(hours=24))

            # Count new published articles from this user's subscribed feeds
            count = await db.scalar(
                select(func.count(Content.id)).where(
                    Content.feed_source_id.in_(
                        select(FeedSubscription.feed_source_id)
                        .where(FeedSubscription.user_id == uid)
                    ),
                    Content.status == ContentStatus.published,
                    Content.created_at > cutoff,
                )
            ) or 0

            if count > 0:
                # Create a single digest notification
                db.add(Notification(
                    user_id=uid,
                    actor_id=None,  # No human actor — system-generated
                    type=NotificationType.feed_digest,
                    message=f"{count} new article{'s' if count != 1 else ''} from your subscribed feeds",
                    link="/feed",
                    read=False,
                ))
                total_notifications += 1

            # Update last_digest_at
            user.last_digest_at = datetime.now(UTC)

        await db.commit()
        logger.info(
            "Feed digest complete: %d users processed, %d notifications sent",
            len(user_ids), total_notifications,
        )
