from sqlalchemy import String, Boolean, JSON, Text, Float, Integer
from sqlalchemy.orm import Mapped, mapped_column

from app.models.base import Base, TimestampMixin


class Plant(TimestampMixin, Base):
    __tablename__ = "plants"

    id: Mapped[int] = mapped_column(primary_key=True)
    scientific_name: Mapped[str] = mapped_column(String(255), unique=True, index=True)
    scientific_name_full: Mapped[str | None] = mapped_column(String(255), nullable=True)

    common_names_pt: Mapped[str | None] = mapped_column(JSON, nullable=True)
    common_names_en: Mapped[str | None] = mapped_column(JSON, nullable=True)
    genus: Mapped[str | None] = mapped_column(String(255), nullable=True)
    family: Mapped[str | None] = mapped_column(String(255), nullable=True)
    order_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    class_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    division: Mapped[str | None] = mapped_column(String(255), nullable=True)

    plant_type: Mapped[str | None] = mapped_column(String(50), nullable=True)
    growth_form: Mapped[str | None] = mapped_column(String(100), nullable=True)
    growth_habit: Mapped[str | None] = mapped_column(Text, nullable=True)
    height_cm: Mapped[int | None] = mapped_column(Integer, nullable=True)

    flowering_start: Mapped[str | None] = mapped_column(String(20), nullable=True)
    flowering_end: Mapped[str | None] = mapped_column(String(20), nullable=True)
    days_to_maturity_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    days_to_maturity_max: Mapped[int | None] = mapped_column(Integer, nullable=True)

    sow_month_start: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sow_month_end: Mapped[int | None] = mapped_column(Integer, nullable=True)
    transplant_month_start: Mapped[int | None] = mapped_column(Integer, nullable=True)
    transplant_month_end: Mapped[int | None] = mapped_column(Integer, nullable=True)
    harvest_month_start: Mapped[int | None] = mapped_column(Integer, nullable=True)
    harvest_month_end: Mapped[int | None] = mapped_column(Integer, nullable=True)

    usda_zone_min: Mapped[int | None] = mapped_column(Integer, nullable=True)
    usda_zone_max: Mapped[int | None] = mapped_column(Integer, nullable=True)
    chill_hours: Mapped[int | None] = mapped_column(Integer, nullable=True)

    sun_requirement: Mapped[str | None] = mapped_column(String(20), nullable=True)

    soil_ph_min: Mapped[float | None] = mapped_column(Float, nullable=True)
    soil_ph_max: Mapped[float | None] = mapped_column(Float, nullable=True)
    soil_texture: Mapped[str | None] = mapped_column(JSON, nullable=True)
    soil_drainage: Mapped[str | None] = mapped_column(String(50), nullable=True)

    kc_initial: Mapped[float | None] = mapped_column(Float, nullable=True)
    kc_mid: Mapped[float | None] = mapped_column(Float, nullable=True)
    kc_late: Mapped[float | None] = mapped_column(Float, nullable=True)
    root_depth_cm: Mapped[int | None] = mapped_column(Integer, nullable=True)
    drought_tolerance: Mapped[str | None] = mapped_column(String(20), nullable=True)
    water_frequency_days: Mapped[int | None] = mapped_column(Integer, nullable=True)

    row_spacing_cm: Mapped[int | None] = mapped_column(Integer, nullable=True)
    plant_spacing_cm: Mapped[int | None] = mapped_column(Integer, nullable=True)
    sowing_depth_cm: Mapped[float | None] = mapped_column(Float, nullable=True)
    sowing_method: Mapped[str | None] = mapped_column(String(20), nullable=True)

    habitat: Mapped[str | None] = mapped_column(Text, nullable=True)
    distribution_portugal: Mapped[str | None] = mapped_column(JSON, nullable=True)
    distribution_general: Mapped[str | None] = mapped_column(Text, nullable=True)

    pests: Mapped[str | None] = mapped_column(JSON, nullable=True)

    sources: Mapped[str | None] = mapped_column(JSON, nullable=True)

    image_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    source_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    notes: Mapped[str | None] = mapped_column(Text, nullable=True)
