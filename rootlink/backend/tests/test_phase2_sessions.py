"""Tests for the Phase 2 session allowlist (Phase 0 decision (e)).

Covers: register/login issue a tracked session; revoking a user's sessions
immediately invalidates their token (without waiting for JWT expiry); and
tokens without a `jti` claim (e.g. existing test fixtures using
`create_access_token` directly) are unaffected — additive, not breaking.
"""

from sqlalchemy import select

from app.core.security import create_access_token
from app.models.session import Session
from app.services.sessions import revoke_all_user_sessions


async def test_register_creates_a_tracked_session(client, session_factory):
    r = await client.post("/api/auth/register", json={
        "email": "sess1@example.com", "name": "Sess One", "password": "secret123",
    })
    assert r.status_code == 201
    token = r.json()["access_token"]

    async with session_factory() as session:
        rows = (await session.execute(select(Session))).scalars().all()
    assert len(rows) == 1
    assert rows[0].revoked_at is None

    # The token works normally right after issuance.
    me = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["email"] == "sess1@example.com"


async def test_login_creates_a_new_session_each_time(client, session_factory):
    await client.post("/api/auth/register", json={
        "email": "sess2@example.com", "name": "Sess Two", "password": "secret123",
    })
    r1 = await client.post("/api/auth/login", json={"email": "sess2@example.com", "password": "secret123"})
    r2 = await client.post("/api/auth/login", json={"email": "sess2@example.com", "password": "secret123"})
    assert r1.status_code == 200 and r2.status_code == 200

    async with session_factory() as session:
        rows = (await session.execute(select(Session))).scalars().all()
    # 1 from register + 2 from login = 3 distinct sessions.
    assert len(rows) == 3
    jtis = {row.token_jti for row in rows}
    assert len(jtis) == 3  # all distinct


async def test_revoking_all_sessions_immediately_invalidates_the_token(client, session_factory):
    r = await client.post("/api/auth/register", json={
        "email": "sess3@example.com", "name": "Sess Three", "password": "secret123",
    })
    token = r.json()["access_token"]
    headers = {"Authorization": f"Bearer {token}"}

    # Works before revocation.
    assert (await client.get("/api/auth/me", headers=headers)).status_code == 200

    async with session_factory() as session:
        result = await session.execute(select(Session).where(Session.token_jti != None))  # noqa: E711
        user_id = result.scalars().first().user_id
        revoked_count = await revoke_all_user_sessions(session, user_id, reason="test force-logout")
    assert revoked_count == 1

    # Same still-unexpired JWT is now rejected — revocation took effect
    # immediately, without waiting for the token's own `exp` claim.
    r2 = await client.get("/api/auth/me", headers=headers)
    assert r2.status_code == 401


async def test_token_without_jti_is_unaffected_by_session_table(client, make_user):
    """Backward compatibility: a token minted directly via `create_access_token`
    (no `jti`, e.g. the `make_user` test fixture) must keep working exactly
    as before — the allowlist check only applies to jti-bearing tokens.
    """
    user, _headers = await make_user(email="legacy-token@example.com")
    legacy_token = create_access_token({"sub": str(user.id)})  # no jti, no session row
    r = await client.get("/api/auth/me", headers={"Authorization": f"Bearer {legacy_token}"})
    assert r.status_code == 200
