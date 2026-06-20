import time
from collections import defaultdict

from fastapi import Request, Response
from starlette.middleware.base import BaseHTTPMiddleware


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Simple in-memory rate limiter for auth endpoints.
    Limits per-IP request count within a sliding window.
    For multi-process deployments, replace with Redis-based limiter.
    """

    def __init__(self, app, paths: dict[str, tuple[int, int]] | None = None):
        super().__init__(app)
        self.limits = paths or {
            "/api/auth/login": (5, 60),
            "/api/auth/register": (3, 60),
        }
        self._hits: dict[str, list[float]] = defaultdict(list)

    async def dispatch(self, request: Request, call_next):
        path = request.url.path
        if path not in self.limits:
            return await call_next(request)

        max_requests, window = self.limits[path]
        client_ip = request.client.host if request.client else "unknown"
        key = f"{client_ip}:{path}"
        now = time.time()

        self._hits[key] = [t for t in self._hits[key] if now - t < window]
        if len(self._hits[key]) >= max_requests:
            return Response(
                content='{"detail": "Too many requests. Try again later."}',
                status_code=429,
                media_type="application/json",
                headers={"Retry-After": str(window)},
            )

        self._hits[key].append(now)
        return await call_next(request)
