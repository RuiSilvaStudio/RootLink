from sqlalchemy import JSON, Boolean, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class ElementSchema(TimestampMixin, Base):
    """A single property on an element type in the Content Studio catalog.

    The element property schema for the dashboard's element catalog
    (docs/content-studio/CONTENT_STUDIO.md §5): each row defines one property
    of one element type ("heading", "card", "button", "section", ...) — whether
    it is `intrinsic` (part of the component definition, e.g. a button's
    variant) or `extrinsic` (defaulted from the theme, overridable
    per-instance), which constrained control renders it in the inspector
    (`control_type`: slider/palette/toggle/button-group/type-scale/
    inline-text/image-picker), the theme's default for this property on this
    element type (`default_value`), optional button-group options, and whether
    the dashboard has curated it to show in the overlay inspector (`is_visible`).

    Upsert keyed on (element_type, property_name): a second write for the same
    pair updates in place rather than duplicating (see
    `app/api/element_catalog.py`); a composite unique constraint backs that.

    Sibling of `Theme`/`ThemeToken`/`BlockPage` — same audit-logged
    `super_admin` authoring pattern (public reads, no `can_edit_copy`
    delegation). The dashboard curates this; the overlay's inspector renders
    from it.
    """

    __tablename__ = "element_schemas"
    __table_args__ = (
        UniqueConstraint(
            "element_type", "property_name", name="uq_element_schema_type_property"
        ),
    )

    id: Mapped[int] = mapped_column(primary_key=True)
    element_type: Mapped[str] = mapped_column(String(80), index=True)
    property_name: Mapped[str] = mapped_column(String(120))
    property_type: Mapped[str] = mapped_column(String(20))  # intrinsic | extrinsic
    control_type: Mapped[str] = mapped_column(String(40))
    default_value: Mapped[str | None] = mapped_column(String(500), nullable=True)
    options: Mapped[list | None] = mapped_column(JSON, nullable=True)  # [{value, label}]
    is_visible: Mapped[bool] = mapped_column(Boolean, default=True, server_default="1")
