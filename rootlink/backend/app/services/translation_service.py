"""Machine translation service built on Argos Translate.

Phase 1 of the translation pipeline (docs/content-platform/ — site copy only).
Argos is an MIT-licensed OpenNMT-based library; models are downloaded lazily
on first use and persisted to the package data directory so they survive
container restarts.

Resolution order (Phase 1 = MT only):
  1. Machine translation via Argos (this module)

Phase 2 will insert a Translation Memory check before MT — see
translation_service.translate() docstring.

Argos is synchronous and CPU-bound, so all translate calls are wrapped in
asyncio.to_thread(). Model loading is guarded by a threading.Lock so
concurrent requests don't double-load.
"""

import asyncio
import logging
import os
import re
import threading

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


def _translate_sync(source_text: str, source: str, target: str) -> str:
    """Synchronous Argos translate call. Runs in a thread via to_thread.

    Variable placeholders ({category}, {count}, etc.) are protected before
    translation and restored after — see _protect_placeholders.
    """
    with _models_lock:
        _ensure_packages_installed(source, target)

    import argostranslate.translate as argos_translate

    protected, mapping = _protect_placeholders(source_text)
    translated = argos_translate.translate(protected, source, target)
    return _restore_placeholders(translated, mapping)


async def translate(
    source_text: str,
    source_locale: str,
    target_locale: str,
) -> dict:
    """Translate a single string from source_locale to target_locale.

    Returns ``{"value": str, "origin": str}`` where origin indicates how the
    result was produced. Phase 1 only returns ``"mt"`` (machine translation).
    Phase 2 will add ``"tm_exact"`` and ``"tm_fuzzy"`` when a Translation
    Memory match is found before falling back to MT.

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
