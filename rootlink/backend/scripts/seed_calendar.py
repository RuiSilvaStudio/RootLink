import asyncio
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy import select

from app.core.database import async_session_factory as AsyncSessionLocal
from app.models.plant import Plant

CALENDAR = {
    # Fruit trees: (sow_start, sow_end, plant_start, plant_end, harvest_start, harvest_end)
    # Deciduous: plant Nov-Feb (dormant); Citrus: Mar-May (frost-sensitive)
    "olea europaea": (None, None, 11, 3, 10, 12),
    "citrus sinensis": (None, None, 3, 5, 11, 5),
    "citrus limon": (None, None, 3, 5, 10, 6),
    "ficus carica": (None, None, 11, 3, 8, 10),
    "prunus dulcis": (None, None, 11, 2, 8, 10),
    "malus domestica": (None, None, 11, 2, 8, 10),
    "pyrus communis": (None, None, 11, 2, 8, 10),
    "prunus persica": (None, None, 11, 2, 7, 9),
    "prunus domestica": (None, None, 11, 2, 7, 9),
    "punica granatum": (None, None, 10, 4, 9, 11),
    "vitis vinifera": (None, None, 1, 3, 8, 10),
    "diospyros kaki": (None, None, 11, 3, 10, 11),
    "morus nigra": (None, None, 11, 2, 7, 9),
    "prunus avium": (None, None, 11, 2, 5, 7),
    "corylus avellana": (None, None, 11, 2, 9, 10),
    "solanum lycopersicum": (3, 4, 4, 5, 7, 10),
    "capsicum annuum": (2, 4, 4, 5, 7, 10),
    "cucumis sativus": (3, 5, 4, 6, 6, 9),
    "cucurbita pepo": (3, 5, 4, 5, 6, 9),
    "lactuca sativa": (2, 9, None, None, 4, 11),
    "spinacia oleracea": (9, 3, None, None, 10, 5),
    "brassica oleracea var. capitata": (2, 5, 3, 6, 6, 12),
    "daucus carota": (2, 8, None, None, 5, 11),
    "allium cepa": (2, 4, 3, 5, 6, 9),
    "allium sativum": (10, 11, None, None, 6, 7),
    "solanum tuberosum": (2, 4, None, None, 6, 8),
    "ipomoea batatas": (4, 5, None, None, 9, 10),
    "phaseolus vulgaris": (3, 7, None, None, 5, 9),
    "pisum sativum": (2, 5, None, None, 4, 7),
    "cucumis melo": (3, 4, 4, 5, 8, 9),
    "citrullus lanatus": (3, 4, 4, 5, 8, 9),
    "fragaria × ananassa": (8, 10, None, None, 5, 10),
    "solanum melongena": (2, 4, 4, 5, 7, 10),
    "brassica oleracea var. italica": (3, 5, 4, 6, 7, 11),
    "brassica oleracea var. botrytis": (3, 5, 4, 6, 7, 11),
    "cucurbita maxima": (3, 5, 4, 5, 8, 10),
    "beta vulgaris": (3, 8, None, None, 5, 11),
    "zea mays": (4, 5, None, None, 8, 10),
    "ocimum basilicum": (3, 5, 4, 6, 6, 10),
    "rosmarinus officinalis": (3, 5, None, None, 5, 10),
    "thymus vulgaris": (3, 5, None, None, 5, 10),
    "origanum vulgare": (3, 5, None, None, 6, 9),
    "mentha spicata": (3, 6, None, None, 5, 10),
    "petroselinum crispum": (2, 7, None, None, 5, 11),
    "coriandrum sativum": (3, 7, None, None, 5, 9),
    "salvia officinalis": (3, 5, None, None, 5, 10),
    "lavandula angustifolia": (3, 5, 4, 6, 6, 8),
    "helianthus annuus": (3, 5, None, None, 7, 9),
    "tagetes erecta": (3, 5, None, None, 6, 10),
    "tropaeolum majus": (3, 6, None, None, 5, 10),
    "viola tricolor": (2, 5, None, None, 4, 8),
    "calendula officinalis": (2, 5, None, None, 4, 8),
}

async def main():
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(Plant))
        plants = result.scalars().all()
        updated = 0
        for p in plants:
            key = p.scientific_name.lower().strip()
            if key not in CALENDAR:
                continue
            sow_s, sow_e, tp_s, tp_e, hv_s, hv_e = CALENDAR[key]
            changed = False
            if sow_s is not None:
                p.sow_month_start = sow_s
                changed = True
            if sow_e is not None:
                p.sow_month_end = sow_e
                changed = True
            p.transplant_month_start = tp_s
            p.transplant_month_end = tp_e
            p.harvest_month_start = hv_s
            p.harvest_month_end = hv_e
            changed = True
            if changed:
                updated += 1
        await session.commit()
        print(f"Updated {updated} of {len(plants)} plants with calendar data.")

if __name__ == "__main__":
    asyncio.run(main())
