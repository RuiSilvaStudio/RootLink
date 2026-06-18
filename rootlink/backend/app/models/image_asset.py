
import enum

from sqlalchemy import Enum as SAEnum
from sqlalchemy import ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class ImageSource(enum.StrEnum):
    upload = "upload"
    crawl = "crawl"
    api_inaturalist = "api_inaturalist"
    api_utad = "api_utad"
    manual_url = "manual_url"


class ImageAsset(TimestampMixin, Base):
    __tablename__ = "image_assets"

    id: Mapped[int] = mapped_column(primary_key=True)

    # Storage
    hash: Mapped[str] = mapped_column(String(64), unique=True, index=True)
    original_format: Mapped[str] = mapped_column(String(10))
    normalized_format: Mapped[str] = mapped_column(String(10), default="webp")
    width: Mapped[int] = mapped_column(Integer)
    height: Mapped[int] = mapped_column(Integer)
    file_size_bytes: Mapped[int] = mapped_column(Integer)

    # Provenance
    source_type: Mapped[ImageSource] = mapped_column(SAEnum(ImageSource))
    source_url: Mapped[str | None] = mapped_column(String(2000), nullable=True)
    source_domain: Mapped[str | None] = mapped_column(String(255), nullable=True)

    # Attribution
    author: Mapped[str | None] = mapped_column(String(255), nullable=True)
    license: Mapped[str | None] = mapped_column(String(100), nullable=True)
    attribution_text: Mapped[str | None] = mapped_column(Text, nullable=True)

    # Lifecycle
    uploaded_by: Mapped[int | None] = mapped_column(ForeignKey("users.id"), nullable=True)
    status: Mapped[str] = mapped_column(String(20), default="active")
    removed_reason: Mapped[str | None] = mapped_column(Text, nullable=True)

    # File paths (relative to media dir)
    path_original: Mapped[str] = mapped_column(String(500))
    path_large: Mapped[str] = mapped_column(String(500))
    path_medium: Mapped[str] = mapped_column(String(500))
    path_thumb: Mapped[str] = mapped_column(String(500))
