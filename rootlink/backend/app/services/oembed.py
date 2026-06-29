"""Video poster/thumbnail derivation for the VideoEmbed block (CONTENT_PLATFORM.md §6.5).

YouTube thumbnails are deterministic (no network needed). Vimeo requires an
oEmbed lookup; failures degrade gracefully to None so a missing poster never
breaks publishing.
"""

import re

import httpx

_YOUTUBE_PATTERNS = [
    re.compile(r"(?:youtube\.com/watch\?v=|youtube\.com/embed/|youtu\.be/)([A-Za-z0-9_-]{11})"),
    re.compile(r"youtube\.com/shorts/([A-Za-z0-9_-]{11})"),
]
_VIMEO_PATTERN = re.compile(r"vimeo\.com/(?:video/)?(\d+)")


def youtube_id(url: str) -> str | None:
    if not url:
        return None
    for pat in _YOUTUBE_PATTERNS:
        m = pat.search(url)
        if m:
            return m.group(1)
    return None


def youtube_thumbnail(url: str) -> str | None:
    vid = youtube_id(url)
    return f"https://img.youtube.com/vi/{vid}/hqdefault.jpg" if vid else None


async def fetch_video_poster(url: str, timeout: float = 8.0) -> str | None:
    """Best-effort poster URL for a video embed. Never raises."""
    yt = youtube_thumbnail(url)
    if yt:
        return yt
    if url and _VIMEO_PATTERN.search(url):
        try:
            async with httpx.AsyncClient(timeout=timeout) as client:
                resp = await client.get(
                    "https://vimeo.com/api/oembed.json", params={"url": url}
                )
                resp.raise_for_status()
                return resp.json().get("thumbnail_url")
        except Exception:
            return None
    return None
