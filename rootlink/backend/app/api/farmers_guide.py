import json
import os

from fastapi import APIRouter, Query

router = APIRouter(prefix="/api/farmers-guide", tags=["farmers_guide"])

_DATA: dict | None = None


def _load_data() -> dict:
    global _DATA
    if _DATA is not None:
        return _DATA
    path = os.path.join(os.path.dirname(__file__), "..", "data", "farmers_guide.json")
    with open(path, encoding="utf-8") as f:
        _DATA = json.load(f)
    return _DATA


CATEGORY_LABELS: dict[str, dict[str, str]] = {
    "soil": {"pt": "Solo", "en": "Soil"},
    "pruning": {"pt": "Poda", "en": "Pruning"},
    "fertilizing": {"pt": "Adubação", "en": "Fertilizing"},
    "irrigation": {"pt": "Rega", "en": "Irrigation"},
    "pest": {"pt": "Pragas e Doenças", "en": "Pests & Diseases"},
    "composting": {"pt": "Compostagem", "en": "Composting"},
    "mulching": {"pt": "Cobertura Morta", "en": "Mulching"},
    "greenhouse": {"pt": "Estufa", "en": "Greenhouse"},
    "tools": {"pt": "Ferramentas", "en": "Tools"},
    "sowing": {"pt": "Sementeiras", "en": "Sowing"},
    "harvesting": {"pt": "Colheitas", "en": "Harvesting"},
}


@router.get("")
async def get_farmers_guide(
    month: int = Query(..., ge=1, le=12, description="Month number (1–12)"),
    locale: str = Query("pt", description="Locale for category labels"),
):
    data = _load_data()
    tasks = data.get(str(month), [])
    enriched = []
    for t in tasks:
        enriched.append({
            "key": t["key"],
            "category": t["category"],
            "category_label": CATEGORY_LABELS.get(t["category"], {}).get(locale, t["category"]),
            "text": t.get(locale, t.get("pt", "")),
        })
    return {"month": month, "tasks": enriched}
