"""Tests for the admin-managed RSS feed flow (Phase 1: platform-managed feeds).

The old user-facing connect/verify flow has been removed. Admins create feeds
directly (auto-verified). Feed crawler auto-publishes items.
"""
import pytest
from httpx import AsyncClient

from app.models.feed import FeedSource


@pytest.mark.asyncio
async def test_admin_creates_feed_auto_verified(client: "AsyncClient", make_user):
    _, admin_headers = await make_user(email="feedadmin@example.com", role="admin")
    # Use a real feed that's been verified to exist in our source list.
    # Use a mock-friendly approach: mock fetch_and_parse to avoid network calls.
    from unittest.mock import patch, AsyncMock
    from app.services.feed_parser import ParsedFeed, ParsedFeedItem

    mock_parsed = ParsedFeed(
        title="Test Feed",
        site_url="https://example.com",
        items=[
            ParsedFeedItem(
                guid="test-1",
                title="Test Article",
                url="https://example.com/article-1",
                summary="A test article",
                full_text="Full text of test article",
                published_at=None,
            ),
        ],
    )
    with patch("app.api.admin.fetch_and_parse", new=AsyncMock(return_value=mock_parsed)):
        r = await client.post(
            "/api/admin/feeds",
            json={
                "feed_url": "https://example.com/feed.xml",
                "site_url": "https://example.com",
                "title": "Example Feed",
                "priority": 2,
            },
            headers=admin_headers,
        )
    assert r.status_code == 201, r.text
    body = r.json()
    assert body["verified"] is True
    assert body["is_active"] is True
    assert body["title"] == "Example Feed"
    assert body["priority"] == 2
    assert body["feed_url"] == "https://example.com/feed.xml"


@pytest.mark.asyncio
async def test_admin_feed_duplicate_url_rejected(client: "AsyncClient", make_user, session_factory):
    _, admin_headers = await make_user(email="feeddup@example.com", role="admin")
    from unittest.mock import patch, AsyncMock
    from app.services.feed_parser import ParsedFeed

    mock_parsed = ParsedFeed(title="Test", site_url="https://example.com", items=[])
    with patch("app.api.admin.fetch_and_parse", new=AsyncMock(return_value=mock_parsed)):
        r1 = await client.post(
            "/api/admin/feeds",
            json={"feed_url": "https://example.com/dup.xml", "title": "First"},
            headers=admin_headers,
        )
        assert r1.status_code == 201
        r2 = await client.post(
            "/api/admin/feeds",
            json={"feed_url": "https://example.com/dup.xml", "title": "Second"},
            headers=admin_headers,
        )
        assert r2.status_code == 400
        assert "already exists" in r2.json()["detail"]


@pytest.mark.asyncio
async def test_admin_updates_feed_metadata(client: "AsyncClient", make_user):
    _, admin_headers = await make_user(email="feededit@example.com", role="admin")
    from unittest.mock import patch, AsyncMock
    from app.services.feed_parser import ParsedFeed

    mock_parsed = ParsedFeed(title="Original", site_url="https://example.com", items=[])
    with patch("app.api.admin.fetch_and_parse", new=AsyncMock(return_value=mock_parsed)):
        create = await client.post(
            "/api/admin/feeds",
            json={"feed_url": "https://example.com/edit.xml", "title": "Original", "priority": 2},
            headers=admin_headers,
        )
    feed_id = create.json()["id"]

    r = await client.patch(
        f"/api/admin/feeds/{feed_id}",
        json={"title": "Updated Title", "priority": 1},
        headers=admin_headers,
    )
    assert r.status_code == 200
    assert r.json()["title"] == "Updated Title"
    assert r.json()["priority"] == 1


@pytest.mark.asyncio
async def test_list_platform_feeds_returns_all(client: "AsyncClient", make_user):
    _, admin_headers = await make_user(email="feedlist@example.com", role="admin")
    _, user_headers = await make_user(email="feeduser@example.com", role="user")
    from unittest.mock import patch, AsyncMock
    from app.services.feed_parser import ParsedFeed

    mock_parsed = ParsedFeed(title="Public Feed", site_url="https://example.com", items=[])
    with patch("app.api.admin.fetch_and_parse", new=AsyncMock(return_value=mock_parsed)):
        await client.post(
            "/api/admin/feeds",
            json={"feed_url": "https://example.com/public.xml"},
            headers=admin_headers,
        )

    # Any logged-in user can list feeds (no longer user-scoped).
    r = await client.get("/api/feeds/", headers=user_headers)
    assert r.status_code == 200
    feeds = r.json()
    assert any(f["feed_url"] == "https://example.com/public.xml" for f in feeds)


@pytest.mark.asyncio
async def test_old_connect_endpoint_removed(client: "AsyncClient", make_user):
    """The old user-facing POST /api/feeds/connect should no longer exist."""
    _, user_headers = await make_user(email="oldflow@example.com", role="user")
    r = await client.post(
        "/api/feeds/connect",
        json={"feed_url": "https://example.com/feed.xml"},
        headers=user_headers,
    )
    assert r.status_code == 404 or r.status_code == 405
