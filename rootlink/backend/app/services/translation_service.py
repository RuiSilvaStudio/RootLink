"""Machine translation service built on Argos Translate.

Full translation pipeline (docs/content-platform/):
  Phase 1: Argos MT (machine translation)
  Phase 2: Translation Memory check before MT (exact/fuzzy match)
  Phase 3: Glossary protection (brand/domain terms applied before/after MT)

Resolution order in translate():
  1. Translation Memory (exact match → tm_exact, fuzzy → tm_fuzzy)
  2. Glossary protection (swap terms for tokens before MT)
  3. Argos MT translates the rest
  4. Glossary restore (put chosen translations back)
  5. Placeholder restore ({variable} tokens back to {variable})

Argos is synchronous and CPU-bound, so all translate calls are wrapped in
asyncio.to_thread(). Model loading is guarded by a threading.Lock so
concurrent requests don't double-load.
"""

import asyncio
import logging
import os
import re
import threading
from difflib import SequenceMatcher

logger = logging.getLogger(__name__)

# Argos reads this env var to decide CPU vs CUDA. Default to CPU — the
# prod server has no GPU. Setting it explicitly here (rather than relying
# on the env var being present) makes the behavior deterministic.
os.environ.setdefault("ARGOS_DEVICE_TYPE", "cpu")

# The language pairs we support. Argos package codes follow the pattern
# translate-{from}_{to}. We install both directions for each pair so
# pivoting works in either direction.
SUPPORTED_LOCALES = {"pt", "en"}

# Pivot language: when no direct model exists between source and target
# (e.g. PT→FR once FR is added), Argos pivots through this language
# automatically. We just need to make sure both legs are installed.
PIVOT_LOCALE = "en"

_models_lock = threading.Lock()
_installed_pairs: set[tuple[str, str]] | None = None


def _ensure_packages_installed(source: str, target: str) -> None:
    """Download and install the Argos language pair(s) if not already present.

    Idempotent — checks the installed set first (cached in-process after the
    first successful check). On a fresh container, the first translate call
    for a pair triggers a ~50MB download (one-time; persisted to the Argos
    package directory, which is volume-mounted in prod).
    """
    global _installed_pairs

    import argostranslate.package as pkg

    if _installed_pairs is None:
        installed = pkg.get_installed_packages()
        _installed_pairs = {(p.from_code, p.to_code) for p in installed}

    needed: list[tuple[str, str]] = []
    pair = (source, target)
    if pair not in _installed_pairs:
        needed.append(pair)
    # If pivoting is required (no direct model), install both legs through
    # the pivot. Argos handles the pivot automatically at translate time,
    # but both legs must be installed.
    if pair not in _installed_pairs and source != PIVOT_LOCALE and target != PIVOT_LOCALE:
        needed.append((source, PIVOT_LOCALE))
        needed.append((PIVOT_LOCALE, target))

    if not needed:
        return

    logger.info("Installing Argos packages for pairs: %s", needed)
    pkg.update_package_index()
    available = pkg.get_available_packages()
    for src, tgt in needed:
        match = next(
            (p for p in available if p.from_code == src and p.to_code == tgt),
            None,
        )
        if match is None:
            logger.warning("No Argos package available for %s→%s", src, tgt)
            continue
        pkg.install_from_path(match.download())
        _installed_pairs.add((src, tgt))
        logger.info("Installed Argos package: %s→%s", src, tgt)


def _protect_placeholders(text: str) -> tuple[str, dict[str, str]]:
    """Swap out variable placeholders ({...}) for stable opaque tokens before
    sending text to Argos. MT engines routinely mangle or translate the word
    inside curly brackets (e.g. "{category}" → "{categoria}" or "{cate gory}"),
    which breaks runtime interpolation (locale-context.tsx interpolate()).

    Returns (protected_text, mapping) where mapping = {token: original}.
    Tokens are all-caps alphanumeric strings (RLPHVAR0, RLPHVAR1, ...) — a
    format Argos treats as an unrecognized proper noun and passes through
    unchanged. Punctuation around tokens (pipes, brackets, quotes) gets
    stripped or converted by the MT engine, so we use bare uppercase words.
    """
    mapping: dict[str, str] = {}

    def _replace(match: re.Match) -> str:
        original = match.group(0)
        token = f"RLPHVAR{len(mapping)}"
        mapping[token] = original
        return token

    protected = re.sub(r"\{[^}]+\}", _replace, text)
    return protected, mapping


def _restore_placeholders(text: str, mapping: dict[str, str]) -> str:
    """Reverse _protect_placeholders — put the original {variable} back."""
    for token, original in mapping.items():
        text = text.replace(token, original)
    return text


# ── Glossary (Phase 3) ──────────────────────────────────────────────

# In-process cache of glossary terms, keyed by (source_locale, target_locale).
# Populated lazily on first use, invalidated by _invalidate_glossary_cache()
# when a glossary term is added/updated/deleted via the API.
_glossary_cache: dict[tuple[str, str], list[dict]] = {}
_glossary_lock = threading.Lock()


def _invalidate_glossary_cache() -> None:
    """Clear the glossary cache — call after any glossary mutation."""
    with _glossary_lock:
        _glossary_cache.clear()


def _load_glossary_sync(source: str, target: str) -> list[dict]:
    """Load glossary terms for a (source, target) pair from the DB (sync).

    Returns a list of ``{term_source, term_target, is_brand}`` dicts,
    sorted by term_source length descending (longer terms matched first
    so "RootLink Content Studio" is matched before "RootLink").
    Cached in-process; invalidated on glossary mutations.
    """
    cache_key = (source, target)
    with _glossary_lock:
        if cache_key in _glossary_cache:
            return _glossary_cache[cache_key]

    # Run sync query in a thread-safe manner — this is called from within
    # _translate_sync which already runs in a thread (asyncio.to_thread).
    import asyncio

    from sqlalchemy import select

    from app.core.database import async_session_factory
    from app.models.glossary_term import GlossaryTerm

    async def _fetch():
        async with async_session_factory() as db:
            rows = (await db.execute(
                select(GlossaryTerm).where(
                    GlossaryTerm.source_locale == source,
                    GlossaryTerm.target_locale == target,
                )
            )).scalars().all()
            return [
                {"term_source": r.term_source, "term_target": r.term_target, "is_brand": r.is_brand}
                for r in rows
            ]

    loop = asyncio.new_event_loop()
    try:
        terms = loop.run_until_complete(_fetch())
    finally:
        loop.close()

    # Sort by source term length descending — match longer terms first.
    terms.sort(key=lambda t: len(t["term_source"]), reverse=True)

    with _glossary_lock:
        _glossary_cache[cache_key] = terms
    return terms


def _protect_glossary(text: str, terms: list[dict]) -> tuple[str, dict[str, str]]:
    """Swap glossary terms for opaque tokens before MT (same pattern as
    _protect_placeholders). Returns (protected_text, mapping).

    For brand terms (is_brand=True), the token maps back to the SOURCE term
    (so "RootLink" comes back as "RootLink" in every language).
    For domain terms, the token maps to the TARGET term (your chosen
    rendering replaces whatever Argos produced).
    """
    mapping: dict[str, str] = {}

    def _replace(match: re.Match, term: dict) -> str:
        token = f"RLGLOS{len(mapping)}"
        if term["is_brand"]:
            mapping[token] = term["term_source"]
        else:
            mapping[token] = term["term_target"]
        return token

    for term in terms:
        source = term["term_source"]
        # Case-insensitive whole-word matching.
        pattern = re.compile(re.escape(source), re.IGNORECASE)
        text, count = pattern.subn(
            lambda m, t=term: _replace(m, t),
            text,
        )
    return text, mapping


def _restore_glossary(text: str, mapping: dict[str, str]) -> str:
    """Reverse _protect_glossary — put brand terms / chosen translations back."""
    for token, replacement in mapping.items():
        text = text.replace(token, replacement)
    return text


def _translate_sync(source_text: str, source: str, target: str) -> str:
    """Synchronous Argos translate call. Runs in a thread via to_thread.

    Pipeline (Phase 3):
      1. Protect {variable} placeholders
      2. Protect glossary terms (brand + domain)
      3. Argos MT translates the rest
      4. Restore glossary (brand names pass through, domain terms replaced)
      5. Restore placeholders
    """
    with _models_lock:
        _ensure_packages_installed(source, target)

    import argostranslate.translate as argos_translate

    # 1. Protect {variable} placeholders
    text, ph_mapping = _protect_placeholders(source_text)

    # 2. Protect glossary terms
    glossary = _load_glossary_sync(source, target)
    text, gl_mapping = _protect_glossary(text, glossary)

    # 3. MT
    translated = argos_translate.translate(text, source, target)

    # 4. Restore glossary
    translated = _restore_glossary(translated, gl_mapping)

    # 5. Restore placeholders
    translated = _restore_placeholders(translated, ph_mapping)

    return translated


async def _check_translation_memory(
    source_text: str,
    source_locale: str,
    target_locale: str,
) -> dict | None:
    """Check Translation Memory for a match before falling back to MT.

    Returns ``{"value": str, "origin": "tm_exact" | "tm_fuzzy"}`` on match,
    or ``None`` if no match (caller should fall back to MT).

    Exact match: same source_text (case-sensitive). Fuzzy match: Levenshtein
    ratio ≥ 0.85 via SequenceMatcher. Fuzzy matches are returned so the user
    can review — they're not as reliable as exact matches but still better
    than MT for near-identical source text.
    """
    from sqlalchemy import select

    from app.core.database import async_session_factory
    from app.models.translation_memory import TranslationMemory

    async with async_session_factory() as db:
        # Exact match first
        exact = await db.scalar(
            select(TranslationMemory).where(
                TranslationMemory.source_text == source_text,
                TranslationMemory.source_locale == source_locale,
                TranslationMemory.target_locale == target_locale,
            )
        )
        if exact:
            return {"value": exact.accepted_value, "origin": "tm_exact"}

        # Fuzzy match: fetch all TM rows for this (source, target) pair and
        # find the best ratio. This is O(n) per call — fine for the expected
        # TM size (hundreds to low thousands of entries). If the TM grows large,
        # this should be replaced with a proper similarity index (pg_trgm on
        # Postgres, or a pre-computed embedding).
        rows = (await db.execute(
            select(TranslationMemory).where(
                TranslationMemory.source_locale == source_locale,
                TranslationMemory.target_locale == target_locale,
            )
        )).scalars().all()

        best_ratio = 0.0
        best_value = None
        for row in rows:
            ratio = SequenceMatcher(None, source_text, row.source_text).ratio()
            if ratio > best_ratio:
                best_ratio = ratio
                best_value = row.accepted_value

        if best_ratio >= 0.85 and best_value:
            return {"value": best_value, "origin": "tm_fuzzy"}

    return None


async def translate(
    source_text: str,
    source_locale: str,
    target_locale: str,
) -> dict:
    """Translate a single string from source_locale to target_locale.

    Returns ``{"value": str, "origin": str}`` where origin indicates how the
    result was produced:

    - ``"tm_exact"`` — Translation Memory has an exact match (a human
      previously accepted this translation for the same source text).
    - ``"tm_fuzzy"`` — TM has a near-match (≥0.85 similarity). Better than MT
      but should be reviewed.
    - ``"mt"`` — Machine translation via Argos (no TM match found).
    - ``"identity"`` — source and target locales are the same.

    Raises ``ValueError`` for unsupported locale pairs or empty input.
    """
    if not source_text or not source_text.strip():
        raise ValueError("source_text must not be empty")
    if source_locale == target_locale:
        return {"value": source_text, "origin": "identity"}
    if source_locale not in SUPPORTED_LOCALES or target_locale not in SUPPORTED_LOCALES:
        raise ValueError(
            f"Unsupported locale pair: {source_locale}→{target_locale}. "
            f"Supported: {SUPPORTED_LOCALES}"
        )

    # Phase 2: check Translation Memory before MT.
    tm_result = await _check_translation_memory(source_text, source_locale, target_locale)
    if tm_result:
        return tm_result

    # Fall back to MT.
    try:
        result = await asyncio.to_thread(_translate_sync, source_text, source_locale, target_locale)
        return {"value": result, "origin": "mt"}
    except Exception as e:
        logger.exception("Argos translation failed for %s→%s", source_locale, target_locale)
        raise RuntimeError(f"Translation failed: {e}") from e


async def translate_bulk(
    items: list[dict],
    source_locale: str,
    target_locale: str,
) -> list[dict]:
    """Translate multiple strings in one batch.

    Each item in ``items`` is ``{"key": str, "source_text": str}``. Returns a
    list of ``{"key": str, "value": str, "origin": str, "error": str | null}``.

    Translates sequentially (Argos is CPU-bound and the model is loaded once).
    A failure on one key doesn't abort the batch — the error is captured per-key.
    """
    results: list[dict] = []
    for item in items:
        key = item.get("key", "")
        text = item.get("source_text", "")
        if not text or not text.strip():
            results.append({"key": key, "value": "", "origin": "skipped", "error": None})
            continue
        try:
            res = await translate(text, source_locale, target_locale)
            results.append({"key": key, "value": res["value"], "origin": res["origin"], "error": None})
        except Exception as e:
            results.append({"key": key, "value": "", "origin": "error", "error": str(e)})
    return results
