import asyncio

from fastapi import APIRouter, Query

from app.services.gbif import get_portugal_occurrences, search_species
from app.services.inaturalist import autocomplete_taxa, get_portugal_observations, search_taxa
from app.services.moon_phase import get_moon_phase
from app.services.sun_data import get_sun_data

router = APIRouter(prefix="/api/external", tags=["external"])


@router.get("/moon")
async def moon_phase():
    """Get current moon phase with agricultural wisdom."""
    return await get_moon_phase()


@router.get("/sun")
async def sun_data(
    lat: float = Query(..., description="Latitude"),
    lng: float = Query(..., description="Longitude"),
):
    """Get sunrise/sunset data for a location."""
    return await get_sun_data(lat, lng)


@router.get("/species")
async def species_search(
    q: str = Query(..., min_length=1, description="Species name search"),
    limit: int = Query(5, ge=1, le=20),
):
    """Search species across iNaturalist and GBIF."""
    inat_results, gbif_results = await asyncio.gather(
        search_taxa(q, limit),
        search_species(q, limit),
    )
    return {
        "inaturalist": inat_results,
        "gbif": gbif_results,
    }


@router.get("/species/autocomplete")
async def species_autocomplete(
    q: str = Query(..., min_length=1),
    limit: int = Query(5, ge=1, le=10),
):
    """Autocomplete species names via iNaturalist."""
    return await autocomplete_taxa(q, limit)


@router.get("/species/{taxon_name}/observations")
async def species_observations(
    taxon_name: str,
    limit: int = Query(10, ge=1, le=50),
):
    """Get recent iNaturalist observations of a species in Portugal."""
    return await get_portugal_observations(taxon_name, limit)


@router.get("/species/{taxon_key}/occurrences")
async def species_occurrences(
    taxon_key: int,
    limit: int = Query(20, ge=1, le=100),
):
    """Get GBIF Portugal occurrences for a taxon."""
    return await get_portugal_occurrences(taxon_key, limit)
