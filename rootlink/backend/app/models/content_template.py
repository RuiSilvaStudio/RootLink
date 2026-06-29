from sqlalchemy import JSON, Boolean, Integer, String
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class ContentTemplate(TimestampMixin, Base):
    """Admin-editable starter documents for long-form Content Kinds.

    A template is simply an Editor.js block document loaded into the editor on
    create (see docs/content-platform/CONTENT_PLATFORM.md §5.4). No plugin needed.
    """

    __tablename__ = "content_templates"

    id: Mapped[int] = mapped_column(primary_key=True)
    kind: Mapped[str] = mapped_column(String(50), default="article")  # Content Kind this applies to
    key: Mapped[str] = mapped_column(String(100))  # machine key, e.g. "how_to"
    label_en: Mapped[str] = mapped_column(String(200))
    label_pt: Mapped[str] = mapped_column(String(200))
    description_en: Mapped[str | None] = mapped_column(String(500), nullable=True)
    description_pt: Mapped[str | None] = mapped_column(String(500), nullable=True)
    icon: Mapped[str | None] = mapped_column(String(50), nullable=True)  # lucide icon name
    body: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # Editor.js starter document
    sort_order: Mapped[int] = mapped_column(Integer, default=0)
    is_active: Mapped[bool] = mapped_column(Boolean, default=True)
