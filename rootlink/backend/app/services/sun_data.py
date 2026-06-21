from datetime import date

import httpx

from app.services.external_cache import cache_get, cache_set

SUN_API = "https://api.sunrise-sunset.org/json"
SUN_TTL = 43200  # 12 hours


async def get_sun_data(lat: float, lng: float, target_date: date | None = None) -> dict:
    """Get sunrise/sunset data for a location."""
    d = target_date or date.today()
    cache_key = f"sun_{lat}_{lng}_{d.isoformat()}"
    cached = cache_get(cache_key, ttl=SUN_TTL)
    if cached:
        return cached

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                SUN_API,
                params={
                    "lat": lat,
                    "lng": lng,
                    "date": d.strftime("%Y-%m-%d"),
                    "formatted": 1,
                },
            )
            resp.raise_for_status()
            data = resp.json()

        results = data.get("results", {})

        # Calculate golden hour (roughly first/last hour of sunlight)
        golden_morning = results.get("civil_twilight_begin", "")
        golden_evening = results.get("civil_twilight_end", "")

        result = {
            "sunrise": results.get("sunrise", ""),
            "sunset": results.get("sunset", ""),
            "solar_noon": results.get("solar_noon", ""),
            "day_length_hours": round(results.get("day_length", 0) / 3600, 1),
            "golden_hour_morning": golden_morning,
            "golden_hour_evening": golden_evening,
            "civil_twilight_begin": results.get("civil_twilight_begin", ""),
            "civil_twilight_end": results.get("civil_twilight_end", ""),
            "date": d.isoformat(),
            "lat": lat,
            "lng": lng,
        }
        cache_set(cache_key, result)
        return result

    except Exception:
        return {
            "sunrise": "",
            "sunset": "",
            "solar_noon": "",
            "day_length_hours": 0,
            "golden_hour_morning": "",
            "golden_hour_evening": "",
            "civil_twilight_begin": "",
            "civil_twilight_end": "",
            "date": d.isoformat(),
            "lat": lat,
            "lng": lng,
        }
