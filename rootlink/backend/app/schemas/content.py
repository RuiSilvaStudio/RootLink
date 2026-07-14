from datetime import datetime

from pydantic import BaseModel

from app.models.content import Category, ContentSource, ContentType


class ContentResponse(BaseModel):
    id: int
    title: str
    url: str | None = None
    content_type: ContentType
    category: str | None = None
    family: str | None = None
    language: str | None = None
    summary: str | None = None
    full_text: str | None = None
    image_url: str | None = None
    source: ContentSource
    source_url: str | None = None
    created_by: int | None = None
    published_at: datetime | None = None
    crawled_at: datetime | None = None
    created_at: datetime | None = None
    verification_status: str = "unreviewed"
    validated_by: int | None = None
    cross_referenced_sources: list[int] | None = None
    slug: str | None = None
    status: str = "draft"
    review_note: str | None = None
    review_comment: str | None = None
    edited_at: datetime | None = None
    canonical_url: str | None = None
    feed_source_id: int | None = None
    rating_up: int = 0
    rating_down: int = 0
    view_count: int = 0
    comment_count: int = 0
    bookmark_count: int = 0

    model_config = {"from_attributes": True}


class SearchResult(BaseModel):
    content: "SearchContentResponse"
    score: float


class SearchContentResponse(BaseModel):
    """Flexible content response for unified search — uses str instead of enums
    so groups, plants, articles, events, courses, and videos can all be returned."""
    id: int
    title: str
    slug: str | None = None
    url: str | None = None
    content_type: str
    category: str
    language: str | None = None
    summary: str | None = None
    full_text: str | None = None
    image_url: str | None = None
    source: str
    source_url: str | None = None
    created_by: int | None = None
    published_at: datetime | None = None
    crawled_at: datetime | None = None
    created_at: datetime | None = None
    verification_status: str = "unreviewed"
    validated_by: int | None = None
    cross_referenced_sources: list[int] | None = None


SearchResult.model_rebuild()


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
