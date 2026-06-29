"""Phase 0 — enforcement ladder & super_admin role gate.

Validates CONTENT_PLATFORM.md §4.1 (super_admin) and §4.4 (ban/suspend).
"""

from datetime import UTC, datetime, timedelta

import pytest
from fastapi import HTTPException

from app.core.security import get_writable_user
from app.models.user import AccountStatus, UserRole

# ── Login enforcement ──

async def test_active_user_can_login(client, make_user):
    await make_user(email="active@example.com", password="secret123")
    r = await client.post("/api/auth/login", json={"email": "active@example.com", "password": "secret123"})
    assert r.status_code == 200
    assert "access_token" in r.json()


async def test_banned_user_cannot_login(client, make_user):
    await make_user(email="banned@example.com", password="secret123", account_status=AccountStatus.banned)
    r = await client.post("/api/auth/login", json={"email": "banned@example.com", "password": "secret123"})
    assert r.status_code == 403


# ── Authenticated request enforcement (get_current_user) ──

async def test_banned_token_is_rejected(client, make_user):
    _, headers = await make_user(email="b2@example.com", account_status=AccountStatus.banned)
    r = await client.get("/api/auth/me", headers=headers)
    assert r.status_code == 403


async def test_suspended_user_keeps_read_access(client, make_user):
    _, headers = await make_user(
        email="susp@example.com",
        account_status=AccountStatus.suspended,
        suspended_until=datetime.now(UTC) + timedelta(days=1),
    )
    r = await client.get("/api/auth/me", headers=headers)
    assert r.status_code == 200, "suspended users must still be able to read (§4.4)"


# ── get_writable_user blocks authoring while suspended ──

async def test_writable_user_blocks_suspended(make_user):
    user, _ = await make_user(
        email="susp2@example.com",
        account_status=AccountStatus.suspended,
        suspended_until=datetime.now(UTC) + timedelta(days=1),
    )
    with pytest.raises(HTTPException) as exc:
        await get_writable_user(current_user=user)
    assert exc.value.status_code == 403


async def test_writable_user_allows_active(make_user):
    user, _ = await make_user(email="ok@example.com")
    assert await get_writable_user(current_user=user) is user


async def test_expired_suspension_can_author(make_user):
    user, _ = await make_user(
        email="expired@example.com",
        account_status=AccountStatus.suspended,
        suspended_until=datetime.now(UTC) - timedelta(days=1),
    )
    # suspension lapsed → may author again
    assert await get_writable_user(current_user=user) is user


# ── super_admin satisfies every role gate ──

async def test_super_admin_passes_admin_gate(client, make_user):
    _, headers = await make_user(email="super@example.com", role=UserRole.super_admin)
    r = await client.get("/api/admin/dashboard", headers=headers)
    assert r.status_code == 200


async def test_plain_user_blocked_from_admin(client, make_user):
    _, headers = await make_user(email="plain@example.com", role=UserRole.user)
    r = await client.get("/api/admin/dashboard", headers=headers)
    assert r.status_code == 403


async def test_admin_passes_admin_gate(client, make_user):
    _, headers = await make_user(email="admin@example.com", role=UserRole.admin)
    r = await client.get("/api/admin/dashboard", headers=headers)
    assert r.status_code == 200
