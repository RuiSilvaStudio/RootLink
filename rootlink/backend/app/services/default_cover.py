"""Per-category default cover images — the no-cover fallback (CONTENT_PLATFORM.md §6.4).

Guarantees a published item is never blank. These point at static frontend assets
(served from the Next.js public/ dir), so the backend only stores the path.
"""

GENERIC_DEFAULT = "/images/placeholder-card.svg"

DEFAULT_COVERS = {
    "gardening": "/images/defaults/gardening.svg",
    "woodworking": "/images/defaults/woodworking.svg",
    "craft_trades": "/images/defaults/craft_trades.svg",
    "homesteading": "/images/defaults/homesteading.svg",
}


def default_cover_for(family: str | None = None, category: str | None = None) -> str:
    """Return a default cover URL, keyed by taxonomy family then category."""
    for key in (family, category):
        if key and key.lower() in DEFAULT_COVERS:
            return DEFAULT_COVERS[key.lower()]
    return GENERIC_DEFAULT
