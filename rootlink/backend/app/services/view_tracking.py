"""Unique / throttled view counting (CONTENT_PLATFORM.md §9.6).

Counts at most one view per (viewer, content) per time window so refreshes and
bots can't inflate counts. Backed by Redis (already deployed); degrades to a
process-local TTL cache if Redis is unavailable, so it never blocks a request.
"""

import os
import time

VIEW_WINDOW_SECONDS = 6 * 60 * 60  # one counted view per viewer per 6h

_memory: dict[str, float] = {}
_redis = None
_redis_failed = False


def viewer_key(user_id: int | None, client_ip: str | None) -> str:
    """A stable-but-coarse identity for de-duplication."""
    if user_id:
        return f"u{user_id}"
    return f"ip{client_ip or 'unknown'}"


async def _get_redis():
    global _redis, _redis_failed
    if _redis_failed:
        return None
    if _redis is None:
        try:
            import redis.asyncio as aioredis

            _redis = aioredis.from_url(os.environ.get("REDIS_URL", "redis://redis:6379/0"))
        except Exception:
            _redis_failed = True
            return None
    return _redis


def _memory_is_new(key: str, window: int) -> bool:
    now = time.time()
    exp = _memory.get(key)
    if exp and exp > now:
        return False
    _memory[key] = now + window
    # opportunistic cleanup to bound memory
    if len(_memory) > 10000:
        for k, e in list(_memory.items()):
            if e <= now:
                _memory.pop(k, None)
    return True


async def should_count_view(vkey: str, content_id: int, window: int = VIEW_WINDOW_SECONDS) -> bool:
    """True if this view should increment the counter (first sighting in window)."""
    global _redis_failed
    key = f"view:{content_id}:{vkey}"
    r = await _get_redis()
    if r is not None:
        try:
            # SET NX EX → returns truthy only if the key did not already exist.
            was_set = await r.set(key, 1, nx=True, ex=window)
            return bool(was_set)
        except Exception:
            _redis_failed = True  # stop trying Redis this process; fall back
    return _memory_is_new(key, window)
