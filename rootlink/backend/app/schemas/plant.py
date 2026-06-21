from datetime import datetime

from pydantic import BaseModel


class PlantResponse(BaseModel):
    id: int
    scientific_name: str
    scientific_name_full: str | None = None

    common_names_pt: list[str] | None = None
    common_names_en: list[str] | None = None
    genus: str | None = None
    family: str | None = None
    order_name: str | None = None
    class_name: str | None = None
    division: str | None = None

    plant_type: str | None = None
    growth_form: str | None = None
    growth_habit: str | None = None
    height_cm: int | None = None

    flowering_start: str | None = None
    flowering_end: str | None = None
    days_to_maturity_min: int | None = None
    days_to_maturity_max: int | None = None

    sow_month_start: int | None = None
    sow_month_end: int | None = None
    transplant_month_start: int | None = None
    transplant_month_end: int | None = None
    harvest_month_start: int | None = None
    harvest_month_end: int | None = None

    usda_zone_min: int | None = None
    usda_zone_max: int | None = None
    chill_hours: int | None = None

    sun_requirement: str | None = None

    soil_ph_min: float | None = None
    soil_ph_max: float | None = None
    soil_texture: list[str] | None = None
    soil_drainage: str | None = None

    kc_initial: float | None = None
    kc_mid: float | None = None
    kc_late: float | None = None
    root_depth_cm: int | None = None
    drought_tolerance: str | None = None
    water_frequency_days: int | None = None

    row_spacing_cm: int | None = None
    plant_spacing_cm: int | None = None
    sowing_depth_cm: float | None = None
    sowing_method: str | None = None

    habitat: str | None = None
    distribution_portugal: list[str] | None = None
    distribution_general: str | None = None

    pests: list[dict] | None = None

    sources: dict | None = None

    image_url: str | None = None
    source_url: str | None = None
    notes: str | None = None

    created_at: datetime | None = None
    updated_at: datetime | None = None

    model_config = {"from_attributes": True}


class PlantCreate(BaseModel):
    scientific_name: str
    scientific_name_full: str | None = None
    common_names_pt: list[str] | None = None
    common_names_en: list[str] | None = None
    genus: str | None = None
    family: str | None = None
    order_name: str | None = None
    class_name: str | None = None
    division: str | None = None
    plant_type: str | None = None
    growth_form: str | None = None
    growth_habit: str | None = None
    height_cm: int | None = None
    flowering_start: str | None = None
    flowering_end: str | None = None
    days_to_maturity_min: int | None = None
    days_to_maturity_max: int | None = None
    sow_month_start: int | None = None
    sow_month_end: int | None = None
    transplant_month_start: int | None = None
    transplant_month_end: int | None = None
    harvest_month_start: int | None = None
    harvest_month_end: int | None = None
    usda_zone_min: int | None = None
    usda_zone_max: int | None = None
    chill_hours: int | None = None
    sun_requirement: str | None = None
    soil_ph_min: float | None = None
    soil_ph_max: float | None = None
    soil_texture: list[str] | None = None
    soil_drainage: str | None = None
    kc_initial: float | None = None
    kc_mid: float | None = None
    kc_late: float | None = None
    root_depth_cm: int | None = None
    drought_tolerance: str | None = None
    water_frequency_days: int | None = None
    row_spacing_cm: int | None = None
    plant_spacing_cm: int | None = None
    sowing_depth_cm: float | None = None
    sowing_method: str | None = None
    habitat: str | None = None
    distribution_portugal: list[str] | None = None
    distribution_general: str | None = None
    pests: list[dict] | None = None
    sources: dict | None = None
    image_url: str | None = None
    source_url: str | None = None
    notes: str | None = None


class PlantUpdate(BaseModel):
    scientific_name: str | None = None
    scientific_name_full: str | None = None
    common_names_pt: list[str] | None = None
    common_names_en: list[str] | None = None
    genus: str | None = None
    family: str | None = None
    order_name: str | None = None
    class_name: str | None = None
    division: str | None = None
    plant_type: str | None = None
    growth_form: str | None = None
    growth_habit: str | None = None
    height_cm: int | None = None
    flowering_start: str | None = None
    flowering_end: str | None = None
    days_to_maturity_min: int | None = None
    days_to_maturity_max: int | None = None
    sow_month_start: int | None = None
    sow_month_end: int | None = None
    transplant_month_start: int | None = None
    transplant_month_end: int | None = None
    harvest_month_start: int | None = None
    harvest_month_end: int | None = None
    usda_zone_min: int | None = None
    usda_zone_max: int | None = None
    chill_hours: int | None = None
    sun_requirement: str | None = None
    soil_ph_min: float | None = None
    soil_ph_max: float | None = None
    soil_texture: list[str] | None = None
    soil_drainage: str | None = None
    kc_initial: float | None = None
    kc_mid: float | None = None
    kc_late: float | None = None
    root_depth_cm: int | None = None
    drought_tolerance: str | None = None
    water_frequency_days: int | None = None
    row_spacing_cm: int | None = None
    plant_spacing_cm: int | None = None
    sowing_depth_cm: float | None = None
    sowing_method: str | None = None
    habitat: str | None = None
    distribution_portugal: list[str] | None = None
    distribution_general: str | None = None
    pests: list[dict] | None = None
    sources: dict | None = None
    image_url: str | None = None
    source_url: str | None = None
    notes: str | None = None


class CalendarPlantItem(BaseModel):
    id: int
    scientific_name: str
    common_names_pt: list[str] | None = None
    common_names_en: list[str] | None = None
    plant_type: str | None = None
    image_url: str | None = None
    row_spacing_cm: int | None = None
    plant_spacing_cm: int | None = None
    sowing_depth_cm: float | None = None
    sowing_method: str | None = None
    sun_requirement: str | None = None
    days_to_maturity_min: int | None = None
    days_to_maturity_max: int | None = None
    genus: str | None = None
    family: str | None = None
    notes: str | None = None

    # Adjusted for zone
    sow_month_start: int | None = None
    sow_month_end: int | None = None
    transplant_month_start: int | None = None
    transplant_month_end: int | None = None
    harvest_month_start: int | None = None
    harvest_month_end: int | None = None


class PlantIrrigationRequest(BaseModel):
    plant_id: int
    eto_mm: float
    growth_stage: str = "mid"
    area_sqm: float | None = None
    plants_count: int | None = None


class PlantIrrigationResponse(BaseModel):
    plant: PlantResponse
    etc_mm: float
    water_per_plant_liters: float | None = None
    total_water_liters: float | None = None
    kc_used: float
    growth_stage: str
    root_depth_cm: int | None = None
