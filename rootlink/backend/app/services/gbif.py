import httpx

from app.services.external_cache import cache_get, cache_set

GBIF_API = "https://api.gbif.org/v1"
GBIF_TTL = 3600  # 1 hour


async def search_species(query: str, limit: int = 5) -> list[dict]:
    """Search GBIF species by name."""
    cache_key = f"gbif_species_{query.lower()}_{limit}"
    cached = cache_get(cache_key, ttl=GBIF_TTL)
    if cached is not None:
        return cached

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{GBIF_API}/species/search",
                params={"q": query, "limit": limit},
            )
            resp.raise_for_status()
            data = resp.json()

        results = []
        for sp in data.get("results", []):
            results.append({
                "key": sp.get("key"),
                "scientific_name": sp.get("scientificName", ""),
                "common_name": sp.get("vernacularName", ""),
                "status": sp.get("taxonomicStatus", ""),
                "rank": sp.get("rank", ""),
                "kingdom": sp.get("kingdom", ""),
                "phylum": sp.get("phylum", ""),
                "class": sp.get("class", ""),
                "order": sp.get("order", ""),
                "family": sp.get("family", ""),
                "genus": sp.get("genus", ""),
            })

        cache_set(cache_key, results)
        return results

    except Exception:
        return []


async def get_portugal_occurrences(taxon_key: int, limit: int = 20) -> dict:
    """Get GBIF occurrences for a taxon in Portugal."""
    cache_key = f"gbif_occ_pt_{taxon_key}_{limit}"
    cached = cache_get(cache_key, ttl=GBIF_TTL)
    if cached is not None:
        return cached

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{GBIF_API}/occurrence/search",
                params={
                    "taxonKey": taxon_key,
                    "country": "PT",
                    "limit": limit,
                },
            )
            resp.raise_for_status()
            data = resp.json()

        occurrences = []
        for occ in data.get("results", []):
            occurrences.append({
                "key": occ.get("key"),
                "scientific_name": occ.get("scientificName", ""),
                "common_name": occ.get("vernacularName", ""),
                "date": occ.get("eventDate", ""),
                "locality": occ.get("locality", ""),
                "county": occ.get("county", ""),
                "state_province": occ.get("stateProvince", ""),
                "latitude": occ.get("decimalLatitude"),
                "longitude": occ.get("decimalLongitude"),
                "institution": occ.get("institutionCode", ""),
                "basis_of_record": occ.get("basisOfRecord", ""),
            })

        result = {
            "total": data.get("count", 0),
            "occurrences": occurrences,
            "taxon_key": taxon_key,
        }
        cache_set(cache_key, result)
        return result

    except Exception:
        return {"total": 0, "occurrences": [], "taxon_key": taxon_key}
