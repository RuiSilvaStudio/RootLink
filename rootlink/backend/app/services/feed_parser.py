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


async def fetch_and_parse(feed_url: str, timeout: float = 30.0) -> ParsedFeed | None:
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=timeout) as client:
            resp = await client.get(feed_url, headers={"User-Agent": "RootLink/1.0 (+https://rootlink.org)"})
            resp.raise_for_status()
    except Exception as e:
        logger.warning("Failed to fetch feed %s: %s", feed_url, e)
        return None

    parsed = feedparser.parse(resp.text)
    if parsed.bozo and not parsed.entries:
        logger.warning("Feed %s is malformed: %s", feed_url, parsed.bozo_exception)
        return None

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


async def verify_feed_ownership(feed_url: str, site_url: str, token: str) -> bool:
    if not site_url:
        return False
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=15.0) as client:
            resp = await client.get(site_url, headers={"User-Agent": "RootLink/1.0"})
            if resp.status_code != 200:
                return False
            return f'content="{token}"' in resp.text or f"content={token}" in resp.text
    except Exception:
        return False
