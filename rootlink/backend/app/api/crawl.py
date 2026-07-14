import html as html_module

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, HttpUrl
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.content import Content, ContentSource, ContentType, VerificationStatus
from app.models.user import User
from app.schemas.content import ContentResponse
from app.services.crawler import crawl_url, search_web
from app.services.cross_reference import auto_cross_reference
from app.services.embeddings import embed_batch, embed_text
from app.services.html_to_editorjs import editorjs_to_plain_text, html_to_editorjs

router = APIRouter(prefix="/api/crawl", tags=["crawl"])


class CrawlRequest(BaseModel):
    url: HttpUrl
    category: str
    family: str | None = None
    language: str | None = None
    content_type: ContentType = ContentType.article


class SearchCrawlRequest(BaseModel):
    query: str
    category: str
    family: str | None = None
    language: str | None = None
    num_results: int = 5


@router.post("", response_model=ContentResponse, status_code=201)
async def submit_url(
    body: CrawlRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        extracted = await crawl_url(str(body.url))
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to fetch URL: {e}")

    # Convert article HTML to Editor.js JSON for rendering
    body_html = extracted.get("body_html") or ""
    body_json = html_to_editorjs(body_html) if body_html else None
    full_text = editorjs_to_plain_text(body_json) if body_json else extracted["text"]
    summary = html_module.unescape(extracted["description"] or (full_text[:500] if full_text else ""))
    title = extracted["title"] or "Untitled"

    embedding = await embed_text(full_text or title)

    content = Content(
        title=title,
        url=str(body.url),
        content_type=body.content_type,
        category=body.category,
        family=body.family,
        language=body.language,
        full_text=full_text,
        body=body_json,
        summary=summary,
        embedding=embedding,
        image_url=extracted["image_url"],
        source=ContentSource.user,
        source_url=str(body.url),
        created_by=current_user.id,
        verification_status=VerificationStatus.unreviewed,
    )
    db.add(content)
    await db.commit()
    await db.refresh(content)

    await auto_cross_reference(db, content)

    return content


@router.post("/search", response_model=list[ContentResponse], status_code=201)
async def search_and_crawl(
    body: SearchCrawlRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    try:
        search_results = await search_web(body.query, body.num_results)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Web search failed: {e}")

    if not search_results:
        raise HTTPException(status_code=404, detail="No results found for this query.")

    indexed = []
    texts = []
    for sr in search_results:
        try:
            extracted = await crawl_url(sr["url"])
        except Exception:
            continue

        full_text = extracted["text"]
        body_html = extracted.get("body_html") or ""
        body_json = html_to_editorjs(body_html) if body_html else None
        full_text = editorjs_to_plain_text(body_json) if body_json else full_text
        summary = html_module.unescape(extracted["description"] or (full_text[:500] if full_text else ""))
        title = extracted["title"] or sr["title"] or "Untitled"
        texts.append(full_text or title)

        content = Content(
            title=title,
            url=sr["url"],
            content_type=ContentType.article,
            category=body.category,
            full_text=full_text,
            body=body_json,
            summary=summary,
            image_url=extracted["image_url"],
            source=ContentSource.user,
            source_url=sr["url"],
            created_by=current_user.id,
            verification_status=VerificationStatus.unreviewed,
        )
        db.add(content)
        indexed.append(content)

    if not indexed:
        raise HTTPException(status_code=400, detail="Could not fetch any of the search results.")

    await db.flush()

    embeddings = await embed_batch(texts)
    for content, emb in zip(indexed, embeddings, strict=False):
        content.embedding = emb

    await db.commit()

    for content in indexed:
        await db.refresh(content)
        await auto_cross_reference(db, content)

    return indexed
