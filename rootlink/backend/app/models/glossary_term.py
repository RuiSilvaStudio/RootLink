from sqlalchemy import Boolean, Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class GlossaryTerm(TimestampMixin, Base):
    """Glossary — fixed translations for brand names and domain terms.

    Applied before/after MT (Argos) so that brand names ("RootLink") pass
    through untranslated and domain terms ("composting" → "compostagem") use
    the human-chosen rendering consistently across every key and language.

    See docs/content-platform/ (Phase 3 — Glossary).

    Forward-only: glossary terms apply to new auto-translations, not
    retroactively to already-saved copy overrides.
    """

    __tablename__ = "glossary_terms"
    __table_args__ = (
        UniqueConstraint("term_source", "source_locale", "target_locale", name="uq_glossary_term"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    term_source: Mapped[str] = mapped_column(String(200), index=True)
    source_locale: Mapped[str] = mapped_column(String(10))
    target_locale: Mapped[str] = mapped_column(String(10))
    term_target: Mapped[str] = mapped_column(Text)
    is_brand: Mapped[bool] = mapped_column(Boolean, default=False)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
    updated_by: Mapped[int | None] = mapped_column(Integer, nullable=True)
