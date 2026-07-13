from sqlalchemy import Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class TranslationMemory(TimestampMixin, Base):
    """Translation Memory — stores accepted (source → target) translation pairs.

    Populated automatically when a copy override is saved: the PT source text
    and the accepted target-locale value are stored as a pair. Future translate
    calls check TM before falling back to MT (Argos), so corrections compound
    over time — the "improves as you review" mechanism.

    See docs/content-platform/ (Phase 2 — Translation Memory).
    """

    __tablename__ = "translation_memory"
    __table_args__ = (
        UniqueConstraint("source_text", "source_locale", "target_locale", name="uq_tm_source_target"),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    source_text: Mapped[str] = mapped_column(Text, index=True)
    source_locale: Mapped[str] = mapped_column(String(10))
    target_locale: Mapped[str] = mapped_column(String(10))
    accepted_value: Mapped[str] = mapped_column(Text)
    copy_key: Mapped[str | None] = mapped_column(String(200), nullable=True, index=True)
    updated_by: Mapped[int | None] = mapped_column(Integer, nullable=True)
