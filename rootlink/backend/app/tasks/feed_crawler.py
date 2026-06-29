import logging
from datetime import UTC, datetime

from sqlalchemy import select

from app.core.database import async_session_factory
from app.models.content import Content, ContentSource, ContentType, VerificationStatus
from app.models.feed import FeedItem, FeedSource
from app.services.embeddings import embed_text
from app.services.feed_parser import fetch_and_parse
from app.tasks.celery_app import celery_app

logger = logging.getLogger("app.tasks.feed_crawler")


@celery_app.task(name="app.tasks.feed_crawler.crawl_feeds_by_priority")
def crawl_feeds_by_priority(priority: int):
    import asyncio
    asyncio.run(_crawl_feeds_async(priority))


async def _crawl_feeds_async(priority: int):
    async with async_session_factory() as db:
        result = await db.execute(
            select(FeedSource).where(
                FeedSource.priority == priority,
                FeedSource.is_active.is_(True),
                FeedSource.verified.is_(True),
            )
        )
        feeds = result.scalars().all()

        total_new = 0
        for feed in feeds:
            try:
                parsed = await fetch_and_parse(feed.feed_url)
                if not parsed:
                    feed.last_error = "Failed to fetch or parse feed"
                    continue

                new_items = 0
                for item in parsed.items:
                    existing = await db.scalar(
                        select(FeedItem.id).where(
                            FeedItem.feed_source_id == feed.id,
                            FeedItem.guid == item.guid,
                        )
                    )
                    if existing:
                        continue

                    feed_item = FeedItem(
                        feed_source_id=feed.id,
                        guid=item.guid,
                        url=item.url,
                        title=item.title,
                    )
                    db.add(feed_item)

                    text_for_embedding = item.full_text or item.summary or item.title
                    embedding = await embed_text(text_for_embedding)

                    content = Content(
                        title=item.title,
                        url=item.url,
                        content_type=ContentType.article,
                        source=ContentSource.crawled,
                        source_url=feed.feed_url,
                        summary=item.summary,
                        full_text=item.full_text,
                        embedding=embedding,
                        created_by=feed.user_id,
                        feed_source_id=feed.id,
                        canonical_url=item.url,
                        verification_status=VerificationStatus.unreviewed,
                        # Crawled feed items stay hidden until corroborated by
                        # cross-reference, which then sets status=published.
                        # status is now the single visibility gate (§2.1).
                        status="draft",
                        crawled_at=datetime.now(UTC),
                    )
                    db.add(content)
                    await db.flush()

                    feed_item.content_id = content.id
                    feed_item.ingested = True
                    new_items += 1

                feed.last_crawled_at = datetime.now(UTC)
                feed.last_error = None
                total_new += new_items

            except Exception as e:
                feed.last_error = str(e)[:500]
                logger.error("Error crawling feed %s: %s", feed.feed_url, e)

        await db.commit()
        logger.info(
            "Feed crawl (priority %d) complete: %d feeds, %d new items",
            priority, len(feeds), total_new,
        )
