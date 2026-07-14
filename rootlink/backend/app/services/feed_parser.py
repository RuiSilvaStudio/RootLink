import logging
from dataclasses import dataclass

import feedparser
import httpx

logger = logging.getLogger("app.feed_parser")


@dataclass
class ParsedFeedItem:
    guid: str
    title: str
    url: str
    summary: str | None
    full_text: str | None
    published_at: str | None


@dataclass
class ParsedFeed:
    title: str | None
    site_url: str | None
    items: list[ParsedFeedItem]


USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)


async def fetch_and_parse(feed_url: str, timeout: float = 30.0) -> ParsedFeed | None:
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=timeout) as client:
            resp = await client.get(feed_url, headers={
                "User-Agent": USER_AGENT,
                "Accept": "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
            })
            resp.raise_for_status()
    except Exception as e:
        logger.warning("Failed to fetch feed %s: %s", feed_url, e)
        return None

    parsed = feedparser.parse(resp.text)
    if not parsed.entries:
        logger.warning("Feed %s has no parseable entries: %s", feed_url, getattr(parsed, "bozo_exception", "unknown"))
        return None
    if parsed.bozo:
        logger.info("Feed %s is malformed but has %d entries — accepting", feed_url, len(parsed.entries))

    items = []
    for entry in parsed.entries:
        guid = entry.get("id") or entry.get("link") or entry.get("title", "")
        title = entry.get("title", "").strip()
        url = entry.get("link", "")
        if not title or not url:
            continue

        summary = entry.get("summary", "")
        full_text = None
        if entry.get("content"):
            full_text = entry.content[0].get("value", "")

        published = entry.get("published") or entry.get("updated")

        items.append(ParsedFeedItem(
            guid=guid,
            title=title,
            url=url,
            summary=summary[:2000] if summary else None,
            full_text=full_text[:50000] if full_text else None,
            published_at=published,
        ))

    return ParsedFeed(
        title=parsed.feed.get("title"),
        site_url=parsed.feed.get("link"),
        items=items,
    )
