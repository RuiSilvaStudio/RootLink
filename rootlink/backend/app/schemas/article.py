from datetime import datetime

from pydantic import BaseModel


class ArticleCreate(BaseModel):
    title: str
    summary: str | None = None
    body: dict | None = None
    category: str | None = None
    family: str | None = None
    language: str | None = None
    image_url: str | None = None
    content_type: str = "article"


class ArticleUpdate(BaseModel):
    title: str | None = None
    summary: str | None = None
    body: dict | None = None
    category: str | None = None
    family: str | None = None
    language: str | None = None
    image_url: str | None = None


class ArticleResponse(BaseModel):
    id: int
    title: str
    slug: str | None = None
    summary: str | None = None
    body: dict | None = None
    full_text: str | None = None
    category: str | None = None
    family: str | None = None
    language: str | None = None
    image_url: str | None = None
    status: str = "draft"
    review_note: str | None = None
    source: str = "user"
    source_url: str | None = None
    canonical_url: str | None = None
    created_by: int | None = None
    author_name: str | None = None
    author_avatar: str | None = None
    published_at: datetime | None = None
    edited_at: datetime | None = None
    created_at: datetime | None = None
    updated_at: datetime | None = None
    verification_status: str = "unreviewed"
    rating_up: int = 0
    rating_down: int = 0
    view_count: int = 0
    comment_count: int = 0
    bookmark_count: int = 0
    is_boosted: bool = False

    model_config = {"from_attributes": True}


class ArticleListResponse(BaseModel):
    articles: list[ArticleResponse]
    total: int
    boosted_count: int
