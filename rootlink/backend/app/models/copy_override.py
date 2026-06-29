from sqlalchemy import Integer, String, Text, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class CopyOverride(TimestampMixin, Base):
    """Runtime override for a static i18n copy key (CONTENT_PLATFORM.md §12).

    Defaults still live in messages/{locale}.json; rows here override a given
    (key, locale) at runtime so non-developers can edit copy without a redeploy.
    """

    __tablename__ = "copy_overrides"
    __table_args__ = (UniqueConstraint("key", "locale", name="uq_copy_key_locale"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    key: Mapped[str] = mapped_column(String(200), index=True)
    locale: Mapped[str] = mapped_column(String(10))
    value: Mapped[str] = mapped_column(Text)
    updated_by: Mapped[int | None] = mapped_column(Integer, nullable=True)
