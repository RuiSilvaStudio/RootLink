"""Launch seed for the RootLink article library.

Reads a curated JSON list of article URLs (with family/category/language) and
ingests each via the existing `crawl_url` service, creating a `Content` row with
all fields correct (family, category, language, source_url) — fields the public
`/api/crawl` endpoint doesn't accept. Also seeds ~15 authored anchor articles
(defined in `anchor_articles.py`) in RootLink's own voice.

All seeded rows land as `status=in_review` so a moderator can bulk-approve them
via `POST /api/admin/content/bulk-approve` (the second admin account — the
script's own creator account is blocked from approving its own submissions).

Idempotent: re-running skips URLs that already exist in `content.source_url`.
Resumable: failures are logged and the script continues.

Usage (from backend/):
    python scripts/seed_articles.py                    # default URLs file
    python scripts/seed_articles.py path/to/urls.json  # custom URLs file
    python scripts/seed_articles.py --dry-run           # fetch + log, don't write
    python scripts/seed_articles.py --skip-crawl       # only seed anchor articles
    python scripts/seed_articles.py --skip-anchors      # only crawl URLs
"""
import argparse
import asyncio
import html as html_module
import json
import sys
import traceback
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select

from app.core.database import async_session_factory as AsyncSessionLocal
from app.models.content import Content, ContentSource, ContentStatus, ContentType, VerificationStatus
from app.services.crawler import crawl_url
from app.services.embeddings import embed_text
from app.services.html_to_editorjs import editorjs_to_plain_text, html_to_editorjs

# Creator accounts (must match the dev DB; re-check before running on prod).
CRAWL_CREATED_BY_EMAIL = "super@rootlink.app"
ANCHOR_CREATED_BY_EMAIL = "admin@rootlink.app"

DEFAULT_URLS_FILE = Path(__file__).parent / "seed_urls.json"


async def _resolve_user_id(db, email: str) -> int | None:
    """Resolve a user by email. Returns None if not found."""
    from app.models.user import User
    row = await db.execute(select(User).where(User.email == email))
    user = row.scalar_one_or_none()
    return user.id if user else None


async def _content_exists_by_source_url(db, url: str) -> bool:
    row = await db.execute(select(Content).where(Content.source_url == url))
    return row.scalar_one_or_none() is not None


async def _crawl_one(db, entry: dict, created_by: int, dry_run: bool = False) -> dict:
    """Crawl one URL and create a Content row. Returns a result dict."""
    url = entry["url"]
    family = entry.get("family")
    category = entry.get("category")
    language = entry.get("language")

    if await _content_exists_by_source_url(db, url):
        return {"url": url, "status": "skipped", "reason": "already_exists"}

    try:
        extracted = await crawl_url(url)
    except Exception as e:
        return {"url": url, "status": "failed", "reason": f"fetch_failed: {e}"}

    title = extracted.get("title") or entry.get("title") or "Untitled"
    body_html = extracted.get("body_html") or ""
    body_json = html_to_editorjs(body_html) if body_html else None
    full_text = editorjs_to_plain_text(body_json) if body_json else (extracted.get("text") or "")
    summary = html_module.unescape(extracted.get("description") or (full_text[:500] if full_text else ""))
    image_url = extracted.get("image_url")

    if dry_run:
        print(f"  [dry-run] would create: {title[:80]} ({language or '?'})")
        return {"url": url, "status": "dry_run", "title": title}

    embedding = None
    try:
        embedding = await embed_text(full_text or title)
    except Exception as e:
        print(f"  WARN embedding failed for {url}: {e}")

    content = Content(
        title=title,
        url=url,
        content_type=ContentType.article,
        category=category,
        family=family,
        language=language,
        full_text=full_text,
        body=body_json,
        summary=summary,
        embedding=embedding,
        image_url=image_url,
        source=ContentSource.crawled,
        source_url=url,
        created_by=created_by,
        status=ContentStatus.in_review,
        verification_status=VerificationStatus.unreviewed,
    )
    db.add(content)
    await db.commit()
    await db.refresh(content)
    return {"url": url, "status": "created", "id": content.id, "title": title}


async def _seed_anchors(db, created_by: int, dry_run: bool = False) -> list[dict]:
    """Seed the authored anchor articles from anchor_articles.py."""
    from scripts.anchor_articles import ANCHOR_ARTICLES

    results = []
    for art in ANCHOR_ARTICLES:
        # Idempotency: skip by exact title match (anchor titles are stable).
        existing = await db.execute(
            select(Content).where(Content.title == art["title"])
        )
        if existing.scalar_one_or_none():
            results.append({"title": art["title"], "status": "skipped"})
            continue

        if dry_run:
            results.append({"title": art["title"], "status": "dry_run"})
            continue

        embedding = None
        try:
            body_text = json.dumps(art["body"], ensure_ascii=False)
            embedding = await embed_text(art["title"] + " " + body_text[:2000])
        except Exception as e:
            print(f"  WARN embedding failed for anchor '{art['title']}': {e}")

        content = Content(
            title=art["title"],
            summary=art.get("summary"),
            body=art["body"],
            category=art.get("category"),
            family=art.get("family"),
            language=art.get("language", "pt"),
            content_type=ContentType.article,
            source=ContentSource.user,
            created_by=created_by,
            status=ContentStatus.in_review,
            verification_status=VerificationStatus.unreviewed,
            embedding=embedding,
        )
        db.add(content)
        await db.commit()
        await db.refresh(content)
        results.append({"title": art["title"], "status": "created", "id": content.id})
    return results


async def main():
    parser = argparse.ArgumentParser(description="Seed the RootLink article library.")
    parser.add_argument("urls_file", nargs="?", default=str(DEFAULT_URLS_FILE),
                        help="JSON file with the URL list")
    parser.add_argument("--dry-run", action="store_true",
                        help="Fetch + log, don't write to DB")
    parser.add_argument("--skip-crawl", action="store_true",
                        help="Skip crawled URLs, only seed anchor articles")
    parser.add_argument("--skip-anchors", action="store_true",
                        help="Skip anchor articles, only crawl URLs")
    args = parser.parse_args()

    urls_path = Path(args.urls_file)

    async with AsyncSessionLocal() as db:
        crawl_uid = await _resolve_user_id(db, CRAWL_CREATED_BY_EMAIL)
        anchor_uid = await _resolve_user_id(db, ANCHOR_CREATED_BY_EMAIL)
        if not crawl_uid:
            print(f"ERROR: creator account not found: {CRAWL_CREATED_BY_EMAIL}")
            print("Edit CRAWL_CREATED_BY_EMAIL in this script to match your DB.")
            return
        if not anchor_uid:
            print(f"ERROR: anchor author account not found: {ANCHOR_CREATED_BY_EMAIL}")
            print("Edit ANCHOR_CREATED_BY_EMAIL in this script to match your DB.")
            return

        summary = {"created": 0, "skipped": 0, "failed": 0, "dry_run": 0, "ids": []}

        # 1. Crawled URLs
        if not args.skip_crawl:
            if not urls_path.exists():
                print(f"ERROR: URLs file not found: {urls_path}")
                print("Curate it first (see scripts/seed_urls.example.json).")
                return
            with urls_path.open() as f:
                url_entries = json.load(f)
            print(f"\n== Crawling {len(url_entries)} URLs ==")
            for i, entry in enumerate(url_entries, 1):
                print(f"[{i}/{len(url_entries)}] {entry['url']}")
                result = await _crawl_one(db, entry, crawl_uid, dry_run=args.dry_run)
                if result["status"] == "created":
                    summary["created"] += 1
                    summary["ids"].append(result["id"])
                elif result["status"] == "skipped":
                    summary["skipped"] += 1
                elif result["status"] == "failed":
                    summary["failed"] += 1
                    print(f"  FAIL: {result['reason']}")
                elif result["status"] == "dry_run":
                    summary["dry_run"] += 1

        # 2. Authored anchor articles
        if not args.skip_anchors:
            print("\n== Seeding anchor articles ==")
            anchor_results = await _seed_anchors(db, anchor_uid, dry_run=args.dry_run)
            for r in anchor_results:
                print(f"  {r['status']}: {r['title']}")
                if r["status"] == "created":
                    summary["created"] += 1
                    summary["ids"].append(r["id"])
                elif r["status"] == "skipped":
                    summary["skipped"] += 1
                elif r["status"] == "dry_run":
                    summary["dry_run"] += 1

        print("\n== Summary ==")
        print(json.dumps(summary, indent=2, ensure_ascii=False))
        if summary["ids"] and not args.dry_run:
            ids_json = json.dumps(summary["ids"])
            print("\nTo bulk-approve these (use a DIFFERENT admin account):")
            print("  curl -X POST http://localhost:8001/api/admin/content/bulk-approve \\")
            print("    -H 'Content-Type: application/json' \\")
            print("    -H 'Authorization: Bearer <TOKEN>' \\")
            print(f"    -d '{ids_json}'")


if __name__ == "__main__":
    try:
        asyncio.run(main())
    except KeyboardInterrupt:
        print("\nInterrupted.")
    except Exception:
        traceback.print_exc()
        sys.exit(1)
