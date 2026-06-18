import time
from collections import OrderedDict
from typing import Any

_cache: OrderedDict[str, tuple[float, Any]] = OrderedDict()
DEFAULT_TTL = 3600  # 1 hour
MAX_CACHE_SIZE = 1000


def cache_get(key: str, ttl: int = DEFAULT_TTL) -> Any | None:
    entry = _cache.get(key)
    if entry and (time.time() - entry[0]) < ttl:
        _cache.move_to_end(key)
        return entry[1]
    _cache.pop(key, None)
    return None


def cache_set(key: str, value: Any) -> None:
    _cache[key] = (time.time(), value)
    _cache.move_to_end(key)
    while len(_cache) > MAX_CACHE_SIZE:
        _cache.popitem(last=False)


def cache_clear() -> None:
    _cache.clear()
