import re
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup

USER_AGENT = (
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) "
    "Chrome/124.0.0.0 Safari/537.36"
)


async def crawl_url(url: str) -> dict:
    """Fetch a URL and extract title, description, text, image, and body
    (Editor.js JSON). The body is extracted from the article's main content
    element (not the full page), so boilerplate like headers, footers,
    navigation, and marketing copy are excluded."""
    parsed = urlparse(url)
    if not parsed.scheme:
        url = "https://" + url
        parsed = urlparse(url)

    headers = {
        "User-Agent": USER_AGENT,
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
        "Accept-Language": "pt-PT,pt;q=0.9,en;q=0.8",
        "Accept-Encoding": "gzip, deflate",
        "Connection": "keep-alive",
        "Upgrade-Insecure-Requests": "1",
    }
    async with httpx.AsyncClient(follow_redirects=True, timeout=30, headers=headers) as client:
        resp = await client.get(url, headers=headers)
        resp.raise_for_status()

    html = resp.text
    soup = BeautifulSoup(html, "lxml")

    title = _extract_title(soup)
    description = _extract_description(soup)
    image_url = _extract_image(soup, url)
    body_html, full_text = _extract_article_body(soup)

    return {
        "title": title,
        "description": description,
        "text": full_text,
        "body_html": body_html,
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


def _extract_article_body(soup: BeautifulSoup) -> tuple[str | None, str]:
    """Extract the article body as clean HTML and plain text.

    Tries to find the main content element (article, main, common content
    selectors) and returns its inner HTML (for Editor.js conversion) and
    plain text (for search/embeddings). Boilerplate (header, footer, nav,
    aside) is removed.

    Returns: (body_html, full_text) — body_html is the article HTML ready
    for the html_to_editorjs converter; full_text is plain text for search.
    """
    # Remove boilerplate elements from the soup entirely
    for tag in soup(["script", "style", "nav", "footer", "header", "aside",
                     "form", "iframe", "noscript"]):
        tag.decompose()

    # Try to find the main content element
    article = (
        soup.find("article")
        or soup.find("main")
        or soup.find(attrs={"role": "main"})
        or soup.find(class_=re.compile(r"post-content|entry-content|article-body|content-body|post-body"))
    )

    if article:
        # Remove nested boilerplate that might be inside the article
        for tag in article.find_all(["nav", "footer", "aside", "form"]):
            tag.decompose()
        body_html = str(article)
        full_text = article.get_text(separator="\n\n")
    else:
        # Fall back: use the whole body (already stripped of boilerplate)
        body_html = str(soup.body) if soup.body else ""
        full_text = soup.get_text(separator="\n\n") if soup.body else ""

    # Clean up the text
    full_text = re.sub(r"\n{3,}", "\n\n", full_text)
    full_text = re.sub(r"[ \t]{2,}", " ", full_text)
    full_text = full_text.strip()[:100_000]

    return body_html or None, full_text


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
