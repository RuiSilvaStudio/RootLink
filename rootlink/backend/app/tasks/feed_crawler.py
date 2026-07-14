import html as html_module
import logging
import re
from datetime import UTC, datetime

from sqlalchemy import select

from app.core.database import async_session_factory
from app.models.content import Content, ContentSource, ContentStatus, ContentType, VerificationStatus
from app.models.feed import FeedItem, FeedSource
from app.services.embeddings import embed_text
from app.services.feed_parser import fetch_and_parse
from app.services.html_to_editorjs import editorjs_to_plain_text, html_to_editorjs
from app.tasks.celery_app import celery_app

logger = logging.getLogger("app.tasks.feed_crawler")

_TAG_RE = re.compile(r"<[^>]+>")
_BLOCK_TAGS_RE = re.compile(r"</\s*(p|div|br|h[1-6]|li|tr)\s*>", re.IGNORECASE)
_BR_RE = re.compile(r"<\s*br\s*/?\s*>", re.IGNORECASE)


def _strip_html(text: str | None) -> str | None:
    """Convert HTML to plain text, preserving paragraph breaks and
    unescaping HTML entities (&ccedil; → ç, &amp; → &)."""
    if not text:
        return None
    text = _BR_RE.sub("\n\n", text)
    text = _BLOCK_TAGS_RE.sub("\n\n", text)
    text = _TAG_RE.sub("", text)
    text = html_module.unescape(text)
    lines = text.split("\n")
    lines = [re.sub(r"[ \t]+", " ", ln).strip() for ln in lines]
    text = "\n\n".join(ln for ln in lines if ln)
    return text or None


def _slugify(title: str) -> str:
    slug = title.lower().strip()
    slug = re.sub(r"[^\w\s-]", "", slug)
    slug = re.sub(r"[\s_]+", "-", slug)
    slug = re.sub(r"-+", "-", slug)
    return slug[:480]


async def _unique_slug(db, title: str) -> str:
    from app.models.content import Content as ContentModel
    base = _slugify(title)
    slug = base
    n = 2
    while True:
        existing = await db.scalar(select(ContentModel.id).where(ContentModel.slug == slug))
        if not existing:
            return slug
        slug = f"{base}-{n}"
        n += 1


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

                    # Convert feed HTML to Editor.js JSON for rendering
                    raw_html = item.full_text or item.summary or ""
                    body_json = html_to_editorjs(raw_html) if raw_html else None
                    full_text = editorjs_to_plain_text(body_json) if body_json else (item.title or "")
                    text_for_embedding = full_text or item.title
                    embedding = await embed_text(text_for_embedding)

                    content = Content(
                        title=item.title,
                        url=item.url,
                        content_type=ContentType.article,
                        source=ContentSource.crawled,
                        source_url=feed.feed_url,
                        summary=_strip_html(item.summary),
                        full_text=full_text,
                        body=body_json,
                        embedding=embedding,
                        created_by=feed.user_id,
                        feed_source_id=feed.id,
                        canonical_url=item.url,
                        language=feed.language,
                        verification_status=VerificationStatus.unreviewed,
                        # Admin-managed feeds are trusted sources: auto-publish.
                        # Admins can revert via /api/admin/content/{id}/revert-approval
                        # if quality is poor.
                        status=ContentStatus.published,
                        published_at=datetime.now(UTC),
                        crawled_at=datetime.now(UTC),
                        slug=await _unique_slug(db, item.title),
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
