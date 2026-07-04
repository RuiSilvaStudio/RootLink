"""Tests for `GET /api/permissions/registry` (app/api/permissions.py) —
Phase 3 (frontend half): serializes the same registry the backend `can()`
helper reads, so the frontend `usePermission` hook has one real source of
truth instead of a hand-reimplemented TypeScript copy.
"""

from app.core.permissions_registry import REGISTRY


async def test_registry_endpoint_is_public_no_auth_required(client):
    r = await client.get("/api/permissions/registry")
    assert r.status_code == 200


async def test_registry_endpoint_matches_the_python_registry_exactly(client):
    r = await client.get("/api/permissions/registry")
    body = r.json()
    assert set(body.keys()) == set(REGISTRY.keys())
    # Phase 4 added 6 new registry actions (entity conversion/dissolution) —
    # see test_permissions_registry.py's own updated count and its comment.
    assert len(body) == 68


async def test_registry_endpoint_entry_shape(client):
    r = await client.get("/api/permissions/registry")
    body = r.json()
    entry = body["link.submit"]
    assert entry == {"min_rank": 1, "entity_scope": "entity", "delegable": False, "notes": ""}


async def test_registry_endpoint_reflects_delegable_and_notes(client):
    r = await client.get("/api/permissions/registry")
    body = r.json()
    entry = body["article.approve"]
    assert entry["min_rank"] == 3
    assert entry["entity_scope"] == "entity"
    assert entry["delegable"] is True
    assert "contributor" in entry["notes"]
