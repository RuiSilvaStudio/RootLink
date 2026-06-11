import re
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup

USER_AGENT = (
    "Mozilla/5.0 (compatible; RootLinkBot/1.0; "
    "+https://rootlink.app/bot)"
)


async def crawl_url(url: str) -> dict:
    """Fetch a URL and extract title, description, text, and image."""
    parsed = urlparse(url)
    if not parsed.scheme:
        url = "https://" + url
        parsed = urlparse(url)

    headers = {"User-Agent": USER_AGENT}
    async with httpx.AsyncClient(follow_redirects=True, timeout=30) as client:
        resp = await client.get(url, headers=headers)
        resp.raise_for_status()

    html = resp.text
    soup = BeautifulSoup(html, "lxml")

    title = _extract_title(soup)
    description = _extract_description(soup)
    text = _extract_text(soup)
    image_url = _extract_image(soup, url)

    return {
        "title": title,
        "description": description,
        "text": text,
        "image_url": image_url,
        "source_url": url,
    }


def _extract_title(soup: BeautifulSoup) -> str:
    og_title = soup.find("meta", property="og:title")
    if og_title and og_title.get("content"):
        return og_title["content"].strip()
    if soup.title and soup.title.string:
        return soup.title.string.strip()
    h1 = soup.find("h1")
    if h1:
        return h1.get_text(strip=True)
    return ""


def _extract_description(soup: BeautifulSoup) -> str:
    og_desc = soup.find("meta", property="og:description")
    if og_desc and og_desc.get("content"):
        return og_desc["content"].strip()
    meta_desc = soup.find("meta", attrs={"name": "description"})
    if meta_desc and meta_desc.get("content"):
        return meta_desc["content"].strip()
    return ""


def _extract_text(soup: BeautifulSoup) -> str:
    for tag in soup(["script", "style", "nav", "footer", "header", "aside"]):
        tag.decompose()
    text = soup.get_text(separator="\n")
    text = re.sub(r"\n{3,}", "\n\n", text)
    text = re.sub(r"[ \t]{2,}", " ", text)
    return text.strip()[:100_000]


async def search_web(query: str, num_results: int = 5) -> list[dict]:
    """Search DuckDuckGo and return top result URLs with snippets."""
    import asyncio
    from concurrent.futures import ThreadPoolExecutor

    loop = asyncio.get_event_loop()
    with ThreadPoolExecutor() as pool:
        results = await loop.run_in_executor(pool, _search_sync, query, num_results)
    return results


def _search_sync(query: str, num_results: int) -> list[dict]:
    from ddgs import DDGS

    results = []
    with DDGS() as ddgs:
        for r in ddgs.text(query, max_results=num_results):
            results.append({
                "url": r.get("href", ""),
                "title": r.get("title", ""),
                "snippet": r.get("body", ""),
            })
    return results


def _extract_image(soup: BeautifulSoup, base_url: str) -> str | None:
    og_image = soup.find("meta", property="og:image")
    if og_image and og_image.get("content"):
        img = og_image["content"]
        if img.startswith("/"):
            parsed = urlparse(base_url)
            img = f"{parsed.scheme}://{parsed.netloc}{img}"
        return img
    img_tag = soup.find("img")
    if img_tag and img_tag.get("src"):
        img = img_tag["src"]
        if img.startswith("/"):
            parsed = urlparse(base_url)
            img = f"{parsed.scheme}://{parsed.netloc}{img}"
        return img
    return None
