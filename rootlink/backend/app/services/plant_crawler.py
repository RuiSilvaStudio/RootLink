import asyncio
import random
import re
from datetime import datetime
from typing import Any

import httpx
from bs4 import BeautifulSoup

UTAD_BASE = "https://jb.utad.pt"
UTAD_SPECIES_URL = f"{UTAD_BASE}/especie"

_USER_AGENTS = [
    "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36",
    "Mozilla/5.0 (X11; Linux x86_64; rv:127.0) Gecko/20100101 Firefox/127.0",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
]

# Reusable client with polite defaults (one per process)
_client: httpx.AsyncClient | None = None


def _get_client() -> httpx.AsyncClient:
    global _client
    if _client is None:
        _client = httpx.AsyncClient(
            timeout=30,
            follow_redirects=True,
            headers={"Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"},
            limits=httpx.Limits(max_keepalive_connections=2, max_connections=2),
        )
    return _client


async def close_client():
    global _client
    if _client:
        await _client.aclose()
        _client = None


async def crawl_utad_species(scientific_name: str, client: httpx.AsyncClient | None = None) -> dict[str, Any] | None:
    url = f"{UTAD_SPECIES_URL}/{scientific_name}"
    c = client or _get_client()
    headers = {"User-Agent": random.choice(_USER_AGENTS)}
    for attempt in range(3):
        try:
            resp = await c.get(url, headers=headers)
            if resp.status_code == 200:
                return _parse_utad_page(resp.text, url)
            if resp.status_code == 403:
                # Wait longer if we hit a rate limit
                await asyncio.sleep(5 * (attempt + 1))
                continue
            return None
        except (httpx.TimeoutException, httpx.ConnectError):
            if attempt < 2:
                await asyncio.sleep(3 * (attempt + 1))
                continue
            return None
    return None


def _parse_utad_page(html: str, url: str) -> dict[str, Any]:
    soup = BeautifulSoup(html, "html.parser")
    data: dict[str, Any] = {}
    source_url = url

    # Extract species name from h1
    title_tag = soup.find("h1")
    if title_tag:
        name_text = title_tag.get_text(strip=True)
        m = re.match(r"([A-Z][a-zà-ü]+ [a-zà-ü-]+)", name_text)
        if m:
            data["scientific_name"] = m.group(1)
        data["scientific_name_full"] = name_text

    # Parse species info grid: div.parteesq > div.row > div.col-md-4=label + div.col-md-8=value
    parteesq = soup.find("div", class_="parteesq")
    if parteesq:
        for row in parteesq.find_all("div", class_="row"):
            row.find_all("div", recursive=True)
            label_div = row.find("div", class_="col-md-4")
            val_div = row.find("div", class_="col-md-8")
            if not label_div or not val_div:
                continue
            key = label_div.get_text(strip=True).lower()
            # Get value: collect text from each direct child (handles <br/> separators)
            values = [ch.strip() for ch in val_div.get_text("\n", strip=True).split("\n") if ch.strip()]
            val = values[0] if values else ""

            if key == "espécie":
                data["scientific_name"] = val if not data.get("scientific_name") else data["scientific_name"]
            elif key == "descritor":
                base = data.get("scientific_name", "")
                data["scientific_name_full"] = f"{base} {val}".strip()
            elif key == "género":
                data["genus"] = val
            elif key == "família":
                data["family"] = val
            elif key == "ordem":
                data["order_name"] = val
            elif key == "classe":
                data["class_name"] = val
            elif key == "sub-classe":
                data["class_name"] = val
            elif key == "divisão":
                data["division"] = val
            elif key == "tipo fisionómico":
                data["growth_form"] = val
            elif key == "distribuição geral":
                data["distribution_general"] = val
            elif key == "nome(s) comum":
                data["common_names_pt"] = values
            elif key == "habitat/ecologia":
                data["habitat"] = ", ".join(values)
            elif key == "época floração":
                if " - " in val:
                    parts = val.split(" - ", 1)
                    data["flowering_start"] = parts[0].strip()
                    data["flowering_end"] = parts[1].strip()
                else:
                    data["flowering_start"] = val.strip()
            elif key == "sinonimias":
                data["synonyms"] = values
            elif key == "no jbutad":
                pass

    # Extract main image from gallery sidebar
    partedir = soup.find("div", class_="partedir")
    if partedir:
        gal = partedir.find("div", class_="galImagens")
        if gal:
            first_img = gal.find("img")
            if first_img and first_img.get("src"):
                src = first_img["src"]
                if src.startswith("/"):
                    src = f"{UTAD_BASE}{src}"
                data["image_url"] = src

    # Extract distribution regions from the full page (checkmark images)
    found_regions = []
    for img in soup.find_all("img"):
        src = img.get("src", "")
        if "ico_fa-check" in src and "fa-times" not in src:
            # Find the containing element with the region name
            parent = img.find_parent()
            if parent:
                region_text = parent.get_text(strip=True)
                if region_text and len(region_text) > 2 and region_text not in ("", " "):
                    found_regions.append(region_text)
    if found_regions:
        data["distribution_portugal"] = found_regions

    data["sources"] = {
        "utad": {
            "url": source_url,
            "fetched_at": datetime.now().isoformat(),
        }
    }

    return data


def normalize_name(name: str) -> str:
    return name.strip().lower().replace("_", " ").replace("  ", " ")


def merge_plant_data(existing: dict | None, new: dict) -> dict:
    if existing is None:
        return new
    merged = dict(existing)
    for field, value in new.items():
        if field == "sources":
            existing_sources = merged.get("sources") or {}
            existing_sources.update(value or {})
            merged["sources"] = existing_sources
            continue
        if value is not None and merged.get(field) is None:
            merged[field] = value
    return merged
