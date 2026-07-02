from sqlalchemy import JSON, DateTime, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class LegalDocument(TimestampMixin, Base):
    """A super_admin-editable legal document (Privacidade / Termos / Legal).

    Draft/publish model: the plain columns (title, description, intro,
    sections, version, effective_date) are the *draft* — what's shown and
    edited in the admin panel. `published_snapshot` is a frozen copy of those
    same fields taken the last time someone hit "Publish" — that's what the
    public `/api/legal/{slug}` endpoint (and therefore the public page)
    serves. Editing the draft never affects the live page until published.

    `changelog` accumulates one entry per publish: {date, version, summary}.
    """

    __tablename__ = "legal_documents"

    id: Mapped[int] = mapped_column(primary_key=True)
    slug: Mapped[str] = mapped_column(String(30), unique=True, index=True)

    # Draft fields — edited freely in the admin panel.
    title: Mapped[str] = mapped_column(String(200))
    description: Mapped[str] = mapped_column(Text)
    intro: Mapped[list] = mapped_column(JSON, default=list)  # list[str] paragraphs
    sections: Mapped[list] = mapped_column(JSON, default=list)  # list[{id, heading, blocks}]
    version: Mapped[str] = mapped_column(String(20), default="0.1")
    effective_date: Mapped[str] = mapped_column(String(10), default="")

    # Published state — a frozen snapshot of the fields above at last publish.
    published_snapshot: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    published_at: Mapped[str | None] = mapped_column(DateTime(timezone=True), nullable=True)

    changelog: Mapped[list] = mapped_column(JSON, default=list)  # list[{date, version, summary}]
    updated_by: Mapped[int | None] = mapped_column(Integer, nullable=True)
