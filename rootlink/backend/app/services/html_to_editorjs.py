"""Convert HTML article body to Editor.js block JSON.

Takes cleaned article HTML (from a feed's content field or a readability
extractor) and produces Editor.js block JSON that the existing ArticleEditor
renders with full RootLink styling — headings, images, paragraphs, lists,
quotes.

All `<a>` tags are rewritten to include `target="_blank" rel="noopener
noreferrer"` so users never leave RootLink when clicking a link inside a
crawled article.
"""
import re

from bs4 import BeautifulSoup, NavigableString, Tag

# Common boilerplate patterns that appear inside article elements on some
# sites (marketing, newsletter signups, donation links, image viewer links).
# These are matched against paragraph/list text content.
_BOILERPLATE_PATTERNS = [
    re.compile(r"subscribe to (our )?newsletter", re.I),
    re.compile(r"support .*(via|through) (paypal|patreon|liberapay)", re.I),
    re.compile(r"support .*(magazine|blog|website)", re.I),
    re.compile(r"read .* offline", re.I),
    re.compile(r"^view (original|dithered) image$", re.I),
    re.compile(r"donate (to|via|through)", re.I),
    re.compile(r"follow (us )?on (twitter|facebook|instagram|mastodon|youtube)", re.I),
    re.compile(r"share (this|this article|this post)", re.I),
    re.compile(r"related articles?$", re.I),
    re.compile(r"^page size:", re.I),
    re.compile(r"^battery (used|charging)$", re.I),
    re.compile(r"^server stats$", re.I),
    # WordPress boilerplate: "The post [title] appeared first on [site]."
    re.compile(r"^the post .*(appeared first on|first appeared on)", re.I),
    re.compile(r"^the post <a ", re.I),
    re.compile(r"appeared first on ", re.I),
]


def _is_boilerplate(text: str) -> bool:
    """Check if a text fragment looks like boilerplate/marketing content."""
    clean = text.strip().lower()
    if not clean or len(clean) < 3:
        return True
    for pattern in _BOILERPLATE_PATTERNS:
        if pattern.search(clean):
            return True
    return False


def _rewrite_links(html: str) -> str:
    """Ensure every <a> tag in the HTML opens in a new tab, and clean up
    inline HTML so it renders properly in Editor.js:
    - <b> → <strong>, <i> → <em> (Editor.js supports these)
    - <span>, <div>, <br> stripped (not supported, show as raw text)
    - HTML entities unescaped (&amp; → &)
    """
    import html as html_module

    soup = BeautifulSoup(html, "lxml")
    for a in soup.find_all("a"):
        a["target"] = "_blank"
        a["rel"] = "noopener noreferrer"
    # Convert <b> → <strong>, <i> → <em>
    for tag in soup.find_all("b"):
        tag.name = "strong"
    for tag in soup.find_all("i"):
        tag.name = "em"
    # Unwrap unsupported inline tags (keep their content, remove the tag)
    for tag in soup.find_all(["span", "div", "font", "mark", "small", "sub", "sup"]):
        tag.unwrap()
    # Replace <br> tags with a space
    for tag in soup.find_all("br"):
        tag.replace_with(" ")
    result = str(soup)
    # Unescape HTML entities that BeautifulSoup double-encoded
    result = html_module.unescape(result)
    return result


def _clean_text(text: str | None) -> str:
    if not text:
        return ""
    return re.sub(r"\s+", " ", text).strip()


def _element_to_inline_html(tag: Tag) -> str:
    """Return the inner HTML of an element, with links rewritten."""
    inner = "".join(str(c) for c in tag.children)
    return inner.strip()


def html_to_editorjs(html: str) -> dict:
    """Convert HTML to Editor.js block JSON.

    Supported elements:
    - <p> → paragraph block
    - <h2>/<h3>/<h4> → header block
    - <img> → image block (hotlinked URL)
    - <ul>/<ol> → list block
    - <blockquote> → quote block
    - <figure> with <img> + <figcaption> → image block with caption
    - Anything else → paragraph block with text content

    Returns: {"blocks": [...]}
    """
    if not html or not html.strip():
        return {"blocks": []}

    html = _rewrite_links(html)
    soup = BeautifulSoup(html, "lxml")

    blocks: list[dict] = []

    for element in soup.descendants:
        if isinstance(element, NavigableString):
            continue
        if not isinstance(element, Tag):
            continue
        # Skip elements that are nested inside elements we already handle
        # (e.g. a <p> inside a <blockquote> — the blockquote handles it).
        parent = element.parent
        if parent and parent.name in ("p", "h2", "h3", "h4", "li", "blockquote", "figure"):
            continue

        name = element.name

        if name in ("p",):
            text = _clean_text(element.get_text())
            if not text or _is_boilerplate(text):
                continue
            inline_html = _element_to_inline_html(element)
            blocks.append({
                "type": "paragraph",
                "data": {"text": inline_html},
            })

        elif name in ("h2", "h3", "h4"):
            text = _clean_text(element.get_text())
            if not text:
                continue
            blocks.append({
                "type": "header",
                "data": {"text": text, "level": int(name[1])},
            })

        elif name == "img":
            src = element.get("src", "")
            if not src:
                continue
            alt = _clean_text(element.get("alt", ""))
            blocks.append({
                "type": "image",
                "data": {
                    "file": {"url": src},
                    "caption": alt or "",
                },
            })

        elif name == "figure":
            img = element.find("img")
            caption_tag = element.find("figcaption")
            if img:
                src = img.get("src", "")
                if src:
                    caption = _clean_text(caption_tag.get_text()) if caption_tag else _clean_text(img.get("alt", ""))
                    blocks.append({
                        "type": "image",
                        "data": {
                            "file": {"url": src},
                            "caption": caption,
                        },
                    })
                    continue
            # No img in figure — treat as paragraph
            text = _clean_text(element.get_text())
            if text:
                blocks.append({"type": "paragraph", "data": {"text": text}})

        elif name in ("ul", "ol"):
            items = []
            for li in element.find_all("li", recursive=False):
                text = _clean_text(li.get_text())
                if text and not _is_boilerplate(text):
                    items.append(text)
            if items:
                blocks.append({
                    "type": "list",
                    "data": {
                        "style": "unordered" if name == "ul" else "ordered",
                        "items": items,
                    },
                })

        elif name == "blockquote":
            text = _clean_text(element.get_text())
            if text:
                blocks.append({
                    "type": "quote",
                    "data": {"text": text},
                })

    # Deduplicate: if a <figure> produced an image block AND its child <img>
    # also produced one, remove the duplicate. We keep only the first
    # occurrence of each image URL.
    seen_images: set[str] = set()
    deduped: list[dict] = []
    for block in blocks:
        if block["type"] == "image":
            url = block["data"]["file"]["url"]
            if url in seen_images:
                continue
            seen_images.add(url)
        deduped.append(block)

    return {"blocks": deduped}


def editorjs_to_plain_text(body: dict) -> str:
    """Extract plain text from Editor.js block JSON for search/embeddings."""
    if not body or not body.get("blocks"):
        return ""
    parts: list[str] = []
    for block in body["blocks"]:
        btype = block.get("type", "")
        data = block.get("data", {})
        if btype == "paragraph":
            raw_text = str(data.get("text", "")) or ""
            if not raw_text.strip():
                continue
            text = _clean_text(BeautifulSoup(raw_text, "lxml").get_text())
            if text:
                parts.append(text)
        elif btype == "header":
            text = _clean_text(data.get("text", ""))
            if text:
                parts.append(text)
        elif btype == "list":
            for item in data.get("items", []):
                text = _clean_text(item)
                if text:
                    parts.append(text)
        elif btype == "quote":
            text = _clean_text(data.get("text", ""))
            if text:
                parts.append(text)
        elif btype == "image":
            caption = _clean_text(data.get("caption", ""))
            if caption:
                parts.append(caption)
    return "\n\n".join(parts)
