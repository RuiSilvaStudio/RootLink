from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select

from app.core.database import get_db
from app.core.security import get_current_user
from app.models.user import User
from app.models.plant import Plant
from app.models.checklist import ChecklistItem
from app.schemas.checklist import ChecklistItemResponse, ChecklistItemCreate, ChecklistItemUpdate

router = APIRouter(prefix="/api/checklist", tags=["checklist"])


@router.get("", response_model=list[ChecklistItemResponse])
async def get_checklist(
    month: int | None = Query(None, ge=1, le=12),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    stmt = select(ChecklistItem).where(ChecklistItem.user_id == current_user.id)
    if month is not None:
        stmt = stmt.where(ChecklistItem.month == month)
    stmt = stmt.order_by(ChecklistItem.sort_order, ChecklistItem.id)
    result = await db.execute(stmt)
    return result.scalars().all()


@router.post("", response_model=ChecklistItemResponse, status_code=201)
async def create_checklist_item(
    body: ChecklistItemCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = ChecklistItem(
        user_id=current_user.id,
        month=body.month,
        task=body.task,
        sort_order=body.sort_order,
    )
    db.add(item)
    await db.commit()
    await db.refresh(item)
    return item


@router.patch("/{item_id}", response_model=ChecklistItemResponse)
async def update_checklist_item(
    item_id: int,
    body: ChecklistItemUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = await db.get(ChecklistItem, item_id)
    if not item or item.user_id != current_user.id:
        raise HTTPException(404, "Checklist item not found")
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(item, field, value)
    await db.commit()
    await db.refresh(item)
    return item


@router.delete("/{item_id}", status_code=204)
async def delete_checklist_item(
    item_id: int,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    item = await db.get(ChecklistItem, item_id)
    if not item or item.user_id != current_user.id:
        raise HTTPException(404, "Checklist item not found")
    await db.delete(item)
    await db.commit()


CALENDAR_PRESET_TASKS = {
    "prepare_soil": {
        "pt": "Preparar o solo — lavrar, adubar e arejar",
        "en": "Prepare soil — till, fertilize, and aerate",
    },
    "apply_mulch": {
        "pt": "Aplicar cobertura morta (mulching)",
        "en": "Apply mulch",
    },
    "prune_trees": {
        "pt": "Podar árvores de fruto",
        "en": "Prune fruit trees",
    },
    "irrigation_check": {
        "pt": "Verificar sistema de rega",
        "en": "Check irrigation system",
    },
    "weed_control": {
        "pt": "Fazer controlo de ervas daninhas",
        "en": "Weed control",
    },
    "pest_inspect": {
        "pt": "Inspecionar pragas e doenças",
        "en": "Inspect for pests and diseases",
    },
    "fertilize": {
        "pt": "Adubar as culturas ativas",
        "en": "Fertilize active crops",
    },
    "harvest_tools": {
        "pt": "Preparar ferramentas de colheita",
        "en": "Prepare harvest tools",
    },
    "compost": {
        "pt": "Virar e arejar a compostagem",
        "en": "Turn and aerate compost",
    },
    "seed_start": {
        "pt": "Iniciar sementeiras em viveiro",
        "en": "Start seeds in seedbed",
    },
    "transplant_seedlings": {
        "pt": "Transplantar mudas para a horta",
        "en": "Transplant seedlings to garden",
    },
    "harvest_ready": {
        "pt": "Colher culturas prontas",
        "en": "Harvest ready crops",
    },
    "mulch_herbs": {
        "pt": "Renovar cobertura morta em ervas aromáticas",
        "en": "Refresh mulch around herbs",
    },
    "clean_greenhouse": {
        "pt": "Limpar e desinfetar estufa",
        "en": "Clean and disinfect greenhouse",
    },
    "water_schedule": {
        "pt": "Ajustar calendário de rega",
        "en": "Adjust watering schedule",
    },
}

MONTHLY_BASELINE = {
    1: ["prune_trees", "irrigation_check", "clean_greenhouse"],
    2: ["prune_trees", "seed_start", "prepare_soil"],
    3: ["prepare_soil", "seed_start", "transplant_seedlings", "fertilize"],
    4: ["transplant_seedlings", "weed_control", "pest_inspect", "fertilize"],
    5: ["weed_control", "pest_inspect", "harvest_ready", "water_schedule"],
    6: ["harvest_ready", "weed_control", "irrigation_check", "pest_inspect", "apply_mulch"],
    7: ["harvest_ready", "water_schedule", "apply_mulch", "pest_inspect"],
    8: ["harvest_ready", "seed_start", "prepare_soil", "compost"],
    9: ["transplant_seedlings", "prepare_soil", "compost", "prune_trees"],
    10: ["harvest_ready", "compost", "prune_trees", "prepare_soil", "mulch_herbs"],
    11: ["prune_trees", "prepare_soil", "compost", "clean_greenhouse"],
    12: ["prune_trees", "irrigation_check", "compost", "clean_greenhouse"],
}


@router.post("/presets")
async def generate_checklist_presets(
    month: int = Query(..., ge=1, le=12),
    zone: str = Query("moderate"),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    existing = await db.execute(
        select(ChecklistItem).where(
            ChecklistItem.user_id == current_user.id,
            ChecklistItem.month == month,
        )
    )
    if existing.scalars().first():
        return {"generated": 0, "message": "Items already exist for this month"}

    items = []
    seen: set[str] = set()

    for task_key in MONTHLY_BASELINE.get(month, []):
        if task_key not in seen:
            seen.add(task_key)
            t = CALENDAR_PRESET_TASKS[task_key]
            label = t.get(current_user.locale or "pt") or t["pt"]
            items.append(ChecklistItem(
                user_id=current_user.id,
                month=month,
                task=label,
                sort_order=len(items),
            ))

    ZONE_OFFSETS = {"cool": 1, "moderate": 0, "warm": -1, "hot": -2}
    offset = ZONE_OFFSETS.get(zone, 0)

    stmt = select(Plant).order_by(Plant.scientific_name)
    plant_result = await db.execute(stmt)
    all_plants = plant_result.scalars().all()

    for p in all_plants:
        def shifted(m: int | None) -> int | None:
            if m is None:
                return None
            s = m + offset
            return max(1, min(12, s))

        sow_s, sow_e = shifted(p.sow_month_start), shifted(p.sow_month_end)
        tp_s, tp_e = shifted(p.transplant_month_start), shifted(p.transplant_month_end)
        hv_s, hv_e = shifted(p.harvest_month_start), shifted(p.harvest_month_end)
        name = (p.common_names_pt or [p.scientific_name])[0]

        def in_month(s: int | None, e: int | None) -> bool:
            if s is None or e is None:
                return False
            if s <= e:
                return s <= month <= e
            return month >= s or month <= e

        if in_month(sow_s, sow_e):
            task_label = f"Semeaar {name}" if current_user.locale == "pt" else f"Sow {name}"
            if task_label not in seen:
                seen.add(task_label)
                items.append(ChecklistItem(
                    user_id=current_user.id,
                    month=month,
                    task=task_label,
                    sort_order=len(items),
                ))

        if in_month(tp_s, tp_e):
            task_label = f"Plantar {name}" if current_user.locale == "pt" else f"Plant {name}"
            if task_label not in seen:
                seen.add(task_label)
                items.append(ChecklistItem(
                    user_id=current_user.id,
                    month=month,
                    task=task_label,
                    sort_order=len(items),
                ))

        if in_month(hv_s, hv_e):
            task_label = f"Colher {name}" if current_user.locale == "pt" else f"Harvest {name}"
            if task_label not in seen:
                seen.add(task_label)
                items.append(ChecklistItem(
                    user_id=current_user.id,
                    month=month,
                    task=task_label,
                    sort_order=len(items),
                ))

    for item in items:
        db.add(item)
    await db.commit()

    return {"generated": len(items), "message": f"Generated {len(items)} checklist items"}
