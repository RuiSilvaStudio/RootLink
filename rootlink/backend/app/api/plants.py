from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.core.database import get_db
from app.core.permissions import rank_at_least
from app.core.permissions_registry import Rank
from app.core.security import get_current_user, get_optional_user
from app.models.plant import Plant
from app.models.user import User
from app.schemas.plant import (
    CalendarPlantItem,
    PlantCreate,
    PlantIrrigationRequest,
    PlantIrrigationResponse,
    PlantResponse,
    PlantUpdate,
)
from app.services.gbif import get_portugal_occurrences, search_species
from app.services.inaturalist import get_portugal_observations, search_taxa
from app.services.plant_crawler import crawl_utad_species, merge_plant_data, normalize_name

ZONE_OFFSETS = {"cool": 1, "moderate": 0, "warm": -1, "hot": -2}


def _shift_month(base: int | None, offset: int) -> int | None:
    if base is None:
        return None
    shifted = base + offset
    if shifted < 1:
        shifted = 1
    if shifted > 12:
        shifted = 12
    return shifted


def _month_range_active(start: int | None, end: int | None, month: int, offset: int) -> bool:
    if start is None or end is None:
        return False
    s = _shift_month(start, offset) or 0
    e = _shift_month(end, offset) or 0
    if s <= e:
        return s <= month <= e
    return month >= s or month <= e  # wraps around year

router = APIRouter(prefix="/api/plants", tags=["plants"])


@router.get("/search", response_model=list[PlantResponse])
async def search_plants(
    q: str = Query(""),
    plant_type: str | None = Query(None),
    genus: str | None = Query(None),
    family: str | None = Query(None),
    has_kc: bool = Query(False),
    limit: int = Query(200, le=500),
    offset: int = Query(0, ge=0),
    db: AsyncSession = Depends(get_db),
):
    stmt = select(Plant)
    conditions = []
    if q:
        like = f"%{q}%"
        conditions.append(
            or_(
                Plant.scientific_name.ilike(like),
                Plant.scientific_name_full.ilike(like),
                Plant.family.ilike(like),
                Plant.genus.ilike(like),
            )
        )
    if plant_type:
        conditions.append(Plant.plant_type == plant_type)
    if genus:
        conditions.append(Plant.genus == genus)
    if family:
        conditions.append(Plant.family == family)
    if has_kc:
        conditions.append(Plant.kc_mid.is_not(None))
    for c in conditions:
        stmt = stmt.where(c)
    stmt = stmt.offset(offset).limit(limit).order_by(Plant.scientific_name)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.get("/calendar", response_model=list[CalendarPlantItem])
async def get_plant_calendar(
    zone: str = Query("moderate"),
    plant_type: str | None = Query(None),
    month: int | None = Query(None, ge=1, le=12),
    db: AsyncSession = Depends(get_db),
):
    offset = ZONE_OFFSETS.get(zone, 0)
    stmt = select(Plant).order_by(Plant.scientific_name)
    if plant_type:
        stmt = stmt.where(Plant.plant_type == plant_type)
    result = await db.execute(stmt)
    plants = result.scalars().all()

    items = []
    for p in plants:
        item = CalendarPlantItem(
            id=p.id,
            scientific_name=p.scientific_name,
            common_names_pt=p.common_names_pt,
            common_names_en=p.common_names_en,
            plant_type=p.plant_type,
            image_url=p.image_url,
            row_spacing_cm=p.row_spacing_cm,
            plant_spacing_cm=p.plant_spacing_cm,
            sowing_depth_cm=p.sowing_depth_cm,
            sowing_method=p.sowing_method,
            sun_requirement=p.sun_requirement,
            days_to_maturity_min=p.days_to_maturity_min,
            days_to_maturity_max=p.days_to_maturity_max,
            genus=p.genus,
            family=p.family,
            notes=p.notes,
            sow_month_start=_shift_month(p.sow_month_start, offset),
            sow_month_end=_shift_month(p.sow_month_end, offset),
            transplant_month_start=_shift_month(p.transplant_month_start, offset),
            transplant_month_end=_shift_month(p.transplant_month_end, offset),
            harvest_month_start=_shift_month(p.harvest_month_start, offset),
            harvest_month_end=_shift_month(p.harvest_month_end, offset),
        )
        if month is not None:
            active = (
                _month_range_active(p.sow_month_start, p.sow_month_end, month, offset)
                or _month_range_active(p.transplant_month_start, p.transplant_month_end, month, offset)
                or _month_range_active(p.harvest_month_start, p.harvest_month_end, month, offset)
            )
            if active:
                items.append(item)
        else:
            items.append(item)
    return items


@router.get("/{plant_id}", response_model=PlantResponse)
async def get_plant(plant_id: int, db: AsyncSession = Depends(get_db)):
    plant = await db.get(Plant, plant_id)
    if not plant:
        raise HTTPException(404, "Plant not found")
    return plant


@router.get("/{plant_id}/detail")
async def get_plant_detail(plant_id: int, db: AsyncSession = Depends(get_db)):
    """Get plant with enriched external data (iNaturalist + GBIF)."""
    plant = await db.get(Plant, plant_id)
    if not plant:
        raise HTTPException(404, "Plant not found")

    # Fetch external data concurrently
    inat_results = await search_taxa(plant.scientific_name, limit=3)
    gbif_results = await search_species(plant.scientific_name, limit=3)

    # Get GBIF occurrences if we have a taxon key
    gbif_occurrences = {"total": 0, "occurrences": []}
    if gbif_results:
        gbif_occurrences = await get_portugal_occurrences(gbif_results[0]["key"], limit=10)

    # Get iNaturalist observations
    inat_observations = await get_portugal_observations(plant.scientific_name, limit=5)

    return {
        "plant": PlantResponse.model_validate(plant),
        "external": {
            "inaturalist": {
                "taxa": inat_results,
                "observations_pt": inat_observations,
            },
            "gbif": {
                "species": gbif_results,
                "occurrences_pt": gbif_occurrences,
            },
        },
    }


@router.post("", response_model=PlantResponse)
async def create_plant(
    body: PlantCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # TECH_DEBT.md §0 (was missing super_admin) — Phase 3 cutover.
    if not rank_at_least(current_user, Rank.contributor):
        raise HTTPException(403, "Not authorized")
    existing = await db.execute(
        select(Plant).where(Plant.scientific_name == normalize_name(body.scientific_name))
    )
    if existing.scalar_one_or_none():
        raise HTTPException(409, "Plant with this scientific name already exists")
    plant = Plant(**body.model_dump())
    plant.scientific_name = normalize_name(plant.scientific_name)
    db.add(plant)
    await db.commit()
    await db.refresh(plant)
    return plant


@router.patch("/{plant_id}", response_model=PlantResponse)
async def update_plant(
    plant_id: int,
    body: PlantUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # TECH_DEBT.md §0 (was missing super_admin) — Phase 3 cutover.
    if not rank_at_least(current_user, Rank.contributor):
        raise HTTPException(403, "Not authorized")
    plant = await db.get(Plant, plant_id)
    if not plant:
        raise HTTPException(404, "Plant not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(plant, field, value)
    if body.scientific_name:
        plant.scientific_name = normalize_name(plant.scientific_name)
    await db.commit()
    await db.refresh(plant)
    return plant


@router.delete("/{plant_id}")
async def delete_plant(
    plant_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # TECH_DEBT.md §0 (was missing super_admin; was also a bare exact-match
    # on the string "admin", the worst-case pattern per TECH_DEBT.md §0) — Phase 3 cutover.
    if not rank_at_least(current_user, Rank.admin):
        raise HTTPException(403, "Not authorized")
    plant = await db.get(Plant, plant_id)
    if not plant:
        raise HTTPException(404, "Plant not found")
    await db.delete(plant)
    await db.commit()
    return {"ok": True}


@router.post("/crawl-utad", response_model=PlantResponse | dict)
async def crawl_utad(
    scientific_name: str = Query(...),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # TECH_DEBT.md §0 (was missing super_admin) — Phase 3 cutover.
    if not rank_at_least(current_user, Rank.contributor):
        raise HTTPException(403, "Not authorized")
    normalized = normalize_name(scientific_name)
    url_name = scientific_name.strip().replace(" ", "_")
    data = await crawl_utad_species(url_name)
    if not data:
        raise HTTPException(404, "Species not found on UTAD")

    existing = await db.execute(
        select(Plant).where(Plant.scientific_name == normalized)
    )
    plant = existing.scalar_one_or_none()
    if plant:
        merged = merge_plant_data(
            {c.name: getattr(plant, c.name) for c in plant.__table__.columns},
            data,
        )
        for field, value in merged.items():
            if hasattr(plant, field):
                setattr(plant, field, value)
        plant.scientific_name = normalized
    else:
        data["scientific_name"] = normalized
        plant = Plant(**{k: v for k, v in data.items() if hasattr(Plant, k)})
        db.add(plant)
    await db.commit()
    await db.refresh(plant)
    return plant


def _name_to_url(name: str) -> str:
    return name.strip().replace(" ", "_").replace("-", "-")


@router.post("/crawl-utad-all")
async def crawl_utad_all(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    # TECH_DEBT.md §0 (was missing super_admin) — Phase 3 cutover.
    if not rank_at_least(current_user, Rank.moderator):
        raise HTTPException(403, "Not authorized")
    stmt = select(Plant).order_by(Plant.scientific_name)
    result = await db.execute(stmt)
    all_plants = result.scalars().all()

    results: list[dict] = []
    for plant in all_plants:
        sources = plant.sources or {}
        if "utad" in sources and plant.image_url:
            continue
        url_name = _name_to_url(plant.scientific_name)
        try:
            data = await crawl_utad_species(url_name)
            if not data:
                results.append({"id": plant.id, "name": plant.scientific_name, "status": "not_found"})
                continue
            merged = merge_plant_data(
                {c.name: getattr(plant, c.name) for c in plant.__table__.columns},
                data,
            )
            for field, value in merged.items():
                if hasattr(plant, field):
                    setattr(plant, field, value)
            await db.commit()
            await db.refresh(plant)
            results.append({"id": plant.id, "name": plant.scientific_name, "status": "updated"})
        except Exception as e:
            results.append({"id": plant.id, "name": plant.scientific_name, "status": f"error: {e}"})
    return {"total": len(all_plants), "results": results}


@router.post("/irrigation", response_model=PlantIrrigationResponse)
async def calculate_irrigation(
    body: PlantIrrigationRequest,
    db: AsyncSession = Depends(get_db),
    _current_user: User | None = Depends(get_optional_user),
):
    plant = await db.get(Plant, body.plant_id)
    if not plant:
        raise HTTPException(404, "Plant not found")

    kc_map = {"initial": plant.kc_initial, "mid": plant.kc_mid, "late": plant.kc_late}
    kc = kc_map.get(body.growth_stage, plant.kc_mid)
    if kc is None:
        kc = plant.kc_mid or plant.kc_initial or 1.0

    etc_mm = round(body.eto_mm * kc, 2)
    water_per_plant = None
    total_water = None

    if plant.row_spacing_cm and plant.plant_spacing_cm:
        area_per_plant_sqm = (plant.row_spacing_cm / 100) * (plant.plant_spacing_cm / 100)
        water_per_plant = round(etc_mm * area_per_plant_sqm, 2)

    if body.area_sqm is not None:
        total_water = round(etc_mm * body.area_sqm, 2)
    elif body.plants_count is not None and water_per_plant is not None:
        total_water = round(water_per_plant * body.plants_count, 2)

    return PlantIrrigationResponse(
        plant=plant,
        etc_mm=etc_mm,
        water_per_plant_liters=water_per_plant,
        total_water_liters=total_water,
        kc_used=round(kc, 2),
        growth_stage=body.growth_stage,
        root_depth_cm=plant.root_depth_cm,
    )
