import httpx

from app.services.external_cache import cache_get, cache_set

INATURALIST_API = "https://api.inaturalist.org/v1"
INAT_TTL = 3600  # 1 hour
# Portugal place_id on iNaturalist
PORTUGAL_PLACE_ID = 7122


async def search_taxa(query: str, limit: int = 5) -> list[dict]:
    """Search iNaturalist taxa by name."""
    cache_key = f"inat_taxa_{query.lower()}_{limit}"
    cached = cache_get(cache_key, ttl=INAT_TTL)
    if cached is not None:
        return cached

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{INATURALIST_API}/taxa",
                params={
                    "q": query,
                    "per_page": limit,
                    "rank": "species",
                },
            )
            resp.raise_for_status()
            data = resp.json()

        results = []
        for taxon in data.get("results", []):
            results.append({
                "id": taxon.get("id"),
                "name": taxon.get("name", ""),
                "common_name": taxon.get("preferred_common_name", ""),
                "rank": taxon.get("rank", ""),
                "iconic_taxon": taxon.get("iconic_taxon_name", ""),
                "image_url": taxon.get("default_photo", {}).get("square_url", ""),
                "wikipedia_url": taxon.get("wikipedia_url", ""),
                "observations_count": taxon.get("observations_count", 0),
            })

        cache_set(cache_key, results)
        return results

    except Exception:
        return []


async def autocomplete_taxa(query: str, limit: int = 5) -> list[dict]:
    """Autocomplete taxa names."""
    cache_key = f"inat_autocomplete_{query.lower()}_{limit}"
    cached = cache_get(cache_key, ttl=INAT_TTL)
    if cached is not None:
        return cached

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{INATURALIST_API}/taxa/autocomplete",
                params={
                    "q": query,
                    "per_page": limit,
                },
            )
            resp.raise_for_status()
            data = resp.json()

        results = []
        for taxon in data.get("results", []):
            results.append({
                "id": taxon.get("id"),
                "name": taxon.get("name", ""),
                "common_name": taxon.get("preferred_common_name", ""),
                "rank": taxon.get("rank", ""),
            })

        cache_set(cache_key, results)
        return results

    except Exception:
        return []


async def get_portugal_observations(taxon_name: str, limit: int = 10) -> list[dict]:
    """Get recent observations of a species in Portugal."""
    cache_key = f"inat_obs_pt_{taxon_name.lower()}_{limit}"
    cached = cache_get(cache_key, ttl=INAT_TTL)
    if cached is not None:
        return cached

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{INATURALIST_API}/observations",
                params={
                    "taxon_name": taxon_name,
                    "place_id": PORTUGAL_PLACE_ID,
                    "per_page": limit,
                    "order": "desc",
                    "order_by": "created_at",
                },
            )
            resp.raise_for_status()
            data = resp.json()

        results = []
        for obs in data.get("results", []):
            taxon = obs.get("taxon", {})
            results.append({
                "id": obs.get("id"),
                "species_name": taxon.get("name", ""),
                "common_name": taxon.get("preferred_common_name", ""),
                "observed_on": obs.get("observed_on", ""),
                "place_guess": obs.get("place_guess", ""),
                "image_url": (obs.get("photos", [{}])[0].get("url", "") if obs.get("photos") else ""),
                "uri": obs.get("uri", ""),
            })

        cache_set(cache_key, results)
        return results

    except Exception:
        return []
