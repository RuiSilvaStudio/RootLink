from typing import Literal

from pydantic import BaseModel, Field

LegalSlug = Literal["privacidade", "termos", "legal"]


class LegalBlock(BaseModel):
    type: Literal["p", "ul", "ol"]
    text: str | None = None
    items: list[str] | None = None


class LegalSection(BaseModel):
    id: str
    heading: str
    blocks: list[LegalBlock]


class LegalChangelogEntry(BaseModel):
    date: str
    version: str
    summary: str


class LegalDocumentPublic(BaseModel):
    """What `/api/legal/{slug}` returns — always the published snapshot."""

    slug: str
    title: str
    description: str
    intro: list[str]
    sections: list[LegalSection]
    version: str
    effective_date: str
    last_updated: str
    changelog: list[LegalChangelogEntry]


class LegalDocumentAdmin(BaseModel):
    """Full record for the admin editor, draft + published side by side."""

    slug: str
    title: str
    description: str
    intro: list[str]
    sections: list[LegalSection]
    version: str
    effective_date: str
    changelog: list[LegalChangelogEntry]
    published_snapshot: dict | None
    published_at: str | None
    has_unpublished_changes: bool
    updated_at: str


class LegalDocumentUpdate(BaseModel):
    title: str
    description: str
    intro: list[str]
    sections: list[LegalSection]


class LegalPublishRequest(BaseModel):
    version: str
    effective_date: str
    summary: str = Field(min_length=1)
