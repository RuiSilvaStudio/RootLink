from datetime import datetime

from pydantic import BaseModel

from app.models.content import ContentType, ContentSource, Category, VerificationStatus


class ContentResponse(BaseModel):
    id: int
    title: str
    url: str | None = None
    content_type: ContentType
    category: Category
    summary: str | None = None
    full_text: str | None = None
    image_url: str | None = None
    source: ContentSource
    source_url: str | None = None
    created_by: int | None = None
    published_at: datetime | None = None
    crawled_at: datetime | None = None
    created_at: datetime | None = None
    verification_status: VerificationStatus = VerificationStatus.unreviewed
    validated_by: int | None = None
    cross_referenced_sources: list[int] | None = None

    model_config = {"from_attributes": True}


class SearchResult(BaseModel):
    content: ContentResponse
    score: float


class SearchResponse(BaseModel):
    results: list[SearchResult]
    total: int
    query: str


class BookmarkResponse(BaseModel):
    id: int
    user_id: int
    content_id: int
    tags: list[str] | None = None
    created_at: datetime | None = None

    model_config = {"from_attributes": True}


class BookmarkCreate(BaseModel):
    content_id: int
    tags: list[str] | None = None


class IndexRequest(BaseModel):
    title: str
    url: str | None = None
    full_text: str | None = None
    summary: str | None = None
    content_type: ContentType
    category: Category
    source: ContentSource = ContentSource.crawled
    source_url: str | None = None
    image_url: str | None = None
    created_by: int | None = None
