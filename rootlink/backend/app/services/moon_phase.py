from datetime import date

import httpx

from app.services.external_cache import cache_get, cache_set

MOON_PHASE_API = "https://aa.usno.navy.mil/api/moon/phases/date"
MOON_TTL = 86400  # 24 hours

PHASE_WISDOM = {
    "New Moon": {
        "icon": "🌑",
        "agricultural": "Lua nova — Tempo de descanso e planeamento. Evite semear, prepare o solo e faça manutenção de ferramentas.",
        "en": "New Moon — Rest and planning time. Avoid sowing, prepare soil and maintain tools.",
    },
    "Waxing Crescent": {
        "icon": "🌒",
        "agricultural": "Lua crescente — Energia ascendente, ideal para semear culturas de folha e flores.",
        "en": "Waxing Crescent — Rising energy, ideal for sowing leafy crops and flowers.",
    },
    "First Quarter": {
        "icon": "🌓",
        "agricultural": "Lua primeiro quarto — Boa para semear culturas de fruto que crescem acima do solo.",
        "en": "First Quarter — Good for sowing fruit crops that grow above ground.",
    },
    "Waxing Gibbous": {
        "icon": "🌔",
        "agricultural": "Lua gibosa crescente — Período de crescimento rápido. Regue e adube as plantações.",
        "en": "Waxing Gibbous — Rapid growth period. Water and fertilize plantings.",
    },
    "Full Moon": {
        "icon": "🌕",
        "agricultural": "Lua cheia — Pico de atividade vegetal. Ideal para transplantar e colher raízes.",
        "en": "Full Moon — Peak plant activity. Ideal for transplanting and harvesting roots.",
    },
    "Waning Gibbous": {
        "icon": "🌖",
        "agricultural": "Lua gibosa minguante — Energia descendente, boa para colher e armazenar.",
        "en": "Waning Gibbous — Descending energy, good for harvesting and storing.",
    },
    "Last Quarter": {
        "icon": "🌗",
        "agricultural": "Lua último quarto — Tempo de poda, limpeza e controle de pragas.",
        "en": "Last Quarter — Time for pruning, cleaning and pest control.",
    },
    "Waning Crescent": {
        "icon": "🌘",
        "agricultural": "Lua minguante — Período de repouso. Evite semear, ideal para trabalhos no solo.",
        "en": "Waning Crescent — Rest period. Avoid sowing, ideal for soil work.",
    },
}


def _phase_name_from_angle(angle: float) -> str:
    """Map phase angle (0-360) to phase name."""
    if angle < 11.25 or angle >= 348.75:
        return "New Moon"
    elif angle < 78.75:
        return "Waxing Crescent"
    elif angle < 101.25:
        return "First Quarter"
    elif angle < 168.75:
        return "Waxing Gibbous"
    elif angle < 191.25:
        return "Full Moon"
    elif angle < 258.75:
        return "Waning Gibbous"
    elif angle < 281.25:
        return "Last Quarter"
    else:
        return "Waning Crescent"


async def get_moon_phase(target_date: date | None = None) -> dict:
    """Get current moon phase with agricultural wisdom."""
    d = target_date or date.today()
    cache_key = f"moon_phase_{d.isoformat()}"
    cached = cache_get(cache_key, ttl=MOON_TTL)
    if cached:
        return cached

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                MOON_PHASE_API,
                params={"date": d.strftime("%Y-%m-%d"), "nump": 1},
            )
            resp.raise_for_status()
            data = resp.json()

        phases = data.get("phasedata", [])
        if phases:
            phase = phases[0]
            phase_name = phase.get("phase", "New Moon")
            illumination = phase.get("illumination", 50)
            # US Navy API returns phase as a string like "New Moon", "First Quarter", etc.
            # but sometimes returns angle. Handle both.
            if isinstance(phase_name, (int, float)):
                phase_name = _phase_name_from_angle(phase_name)
        else:
            phase_name = "New Moon"
            illumination = 0

        wisdom = PHASE_WISDOM.get(phase_name, PHASE_WISDOM["New Moon"])

        result = {
            "phase": phase_name,
            "icon": wisdom["icon"],
            "illumination": illumination,
            "agricultural_pt": wisdom["agricultural"],
            "agricultural_en": wisdom["en"],
            "date": d.isoformat(),
        }
        cache_set(cache_key, result)
        return result

    except Exception:
        # Fallback: calculate approximate phase from synodic cycle
        # Known new moon: 2024-01-11
        ref = date(2024, 1, 11)
        days = (d - ref).days
        cycle = 29.53059
        phase_angle = (days % cycle) / cycle * 360
        phase_name = _phase_name_from_angle(phase_angle)
        wisdom = PHASE_WISDOM.get(phase_name, PHASE_WISDOM["New Moon"])

        return {
            "phase": phase_name,
            "icon": wisdom["icon"],
            "illumination": round(50 + 50 * __import__("math").cos(__import__("math").radians(phase_angle)), 1),
            "agricultural_pt": wisdom["agricultural"],
            "agricultural_en": wisdom["en"],
            "date": d.isoformat(),
        }
