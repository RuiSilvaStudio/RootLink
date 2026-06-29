"""Phase 5 — unique/throttled view counting (§9.6)."""

import pytest
import pytest_asyncio

from app.models.content import Content, ContentSource, ContentStatus, ContentType
from app.services import view_tracking
from app.services.view_tracking import should_count_view, viewer_key


@pytest.fixture(autouse=True)
def force_memory_backend():
    # Force the in-memory fallback (no Redis in tests) and start clean.
    view_tracking._redis_failed = True
    view_tracking._memory.clear()
    yield
    view_tracking._memory.clear()


def test_viewer_key_prefers_user():
    assert viewer_key(7, "1.2.3.4") == "u7"
    assert viewer_key(None, "1.2.3.4") == "ip1.2.3.4"
    assert viewer_key(None, None) == "ipunknown"


async def test_first_view_counts_then_throttled():
    assert await should_count_view("u1", 100) is True
    assert await should_count_view("u1", 100) is False  # same viewer+content within window


async def test_different_content_counted_separately():
    assert await should_count_view("u1", 100) is True
    assert await should_count_view("u1", 200) is True


async def test_window_expiry_recounts():
    assert await should_count_view("u1", 100, window=0) is True
    # window=0 means the entry is already expired on next call → counts again
    assert await should_count_view("u1", 100, window=0) is True


@pytest_asyncio.fixture
async def published_article(session_factory):
    async with session_factory() as s:
        c = Content(
            title="Viewable", slug="viewable-article", content_type=ContentType.article,
            source=ContentSource.user, status=ContentStatus.published,
        )
        s.add(c)
        await s.commit()
        await s.refresh(c)
        return c


async def test_repeated_get_counts_one_view(client, published_article):
    r1 = await client.get("/api/articles/viewable-article")
    assert r1.status_code == 200
    assert r1.json()["view_count"] == 1
    r2 = await client.get("/api/articles/viewable-article")
    assert r2.json()["view_count"] == 1, "refresh by same viewer must not inflate views"
