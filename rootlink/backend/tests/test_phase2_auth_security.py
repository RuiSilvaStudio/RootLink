"""Tests for the Phase 2 baseline auth endpoints (app/api/auth_security.py):
email verification, self-service password reset, and force-logout/session
revocation. New, additive endpoints — existing register/login/me untouched.

Deliberately minimizes real `/api/auth/register`/`/api/auth/login` calls
(see docs/LESSONS.md's rate-limiter gotcha — 5 logins/60s, 3 registers/60s,
**shared across the whole pytest session**, not reset per test/module, since
`main.app`'s middleware stack is built once and reused for every test file).
Where a test needs a *real, tracked* session but isn't specifically testing
register/login itself, it mints one directly via `issue_token_for_user`
against the test DB instead of hitting the live, rate-limited endpoint.
"""

from app.core.security import issue_token_for_user, verify_password
from app.models.user import User


async def _tracked_headers(session_factory, user_id: int) -> dict:
    """A real, session-tracked auth header — without consuming the
    `/api/auth/login` rate-limit quota shared across the whole test session.
    """
    async with session_factory() as session:
        user = await session.get(User, user_id)
        token = await issue_token_for_user(session, user)
    return {"Authorization": f"Bearer {token}"}


async def test_email_verification_flow(client, make_user):
    user, headers = await make_user(email="verify-me@example.com")
    assert user.email_verified is False

    r = await client.post("/api/auth/email/verify/request", headers=headers)
    assert r.status_code == 200
    token = r.json()["token"]

    confirm = await client.post("/api/auth/email/verify/confirm", json={"token": token})
    assert confirm.status_code == 200
    assert confirm.json()["email_verified"] is True

    # UserResponse doesn't expose email_verified yet (Phase 2 schema wasn't
    # asked to change UserResponse) — the confirm response above already
    # proved the flip; just confirm the account itself still works normally.
    assert (await client.get("/api/auth/me", headers=headers)).status_code == 200


async def test_email_verification_token_is_single_use(client, make_user):
    _, headers = await make_user(email="verify-once@example.com")
    token = (await client.post("/api/auth/email/verify/request", headers=headers)).json()["token"]
    first = await client.post("/api/auth/email/verify/confirm", json={"token": token})
    assert first.status_code == 200
    second = await client.post("/api/auth/email/verify/confirm", json={"token": token})
    assert second.status_code == 400


async def test_email_verification_rejects_bogus_token(client):
    r = await client.post("/api/auth/email/verify/confirm", json={"token": "not-a-real-token"})
    assert r.status_code == 400


async def test_already_verified_cannot_re_request(client, make_user):
    _, headers = await make_user(email="already-verified@example.com")
    token = (await client.post("/api/auth/email/verify/request", headers=headers)).json()["token"]
    await client.post("/api/auth/email/verify/confirm", json={"token": token})
    second_request = await client.post("/api/auth/email/verify/request", headers=headers)
    assert second_request.status_code == 400


async def test_password_reset_flow_and_old_sessions_revoked(client, make_user, session_factory):
    user, _ = await make_user(email="resetme@example.com", password="oldpassword123")
    old_headers = await _tracked_headers(session_factory, user.id)
    assert (await client.get("/api/auth/me", headers=old_headers)).status_code == 200

    reset_request = await client.post("/api/auth/password/reset/request", json={"email": "resetme@example.com"})
    assert reset_request.status_code == 200
    reset_token = reset_request.json()["token"]
    assert reset_token is not None

    confirm = await client.post(
        "/api/auth/password/reset/confirm",
        json={"token": reset_token, "new_password": "newpassword456"},
    )
    assert confirm.status_code == 200

    # Old session is now revoked (force-logout on password reset, docs/roles-permissions/ROLES_PERMISSIONS.md §1).
    stale = await client.get("/api/auth/me", headers=old_headers)
    assert stale.status_code == 401

    # New password hash verifies; old password no longer does. (Checked
    # directly against the stored hash rather than via a second live
    # `/api/auth/login` call — see the rate-limiter note at the top of this
    # file; `test_password_reset_token_is_single_use` below already proves
    # the confirm endpoint's own single-use behavior.)
    async with session_factory() as session:
        refreshed = await session.get(User, user.id)
        assert verify_password("newpassword456", refreshed.password_hash) is True
        assert verify_password("oldpassword123", refreshed.password_hash) is False


async def test_password_reset_request_for_unknown_email_is_generic(client):
    r = await client.post("/api/auth/password/reset/request", json={"email": "nobody@example.com"})
    assert r.status_code == 200
    assert r.json()["token"] is None  # no token minted for a non-existent account


async def test_password_reset_token_is_single_use(client, make_user):
    await make_user(email="resetonce@example.com", password="firstpass123")
    token = (await client.post("/api/auth/password/reset/request", json={"email": "resetonce@example.com"})).json()["token"]
    first = await client.post("/api/auth/password/reset/confirm", json={"token": token, "new_password": "secondpass456"})
    assert first.status_code == 200
    second = await client.post("/api/auth/password/reset/confirm", json={"token": token, "new_password": "thirdpass789"})
    assert second.status_code == 400


async def test_revoke_my_sessions(client, make_user, session_factory):
    user, _headers = await make_user(email="revokeme@example.com")
    # `make_user` mints a token directly via create_access_token (no jti,
    # see conftest.py) — issue a REAL tracked session instead (bypassing the
    # rate-limited `/api/auth/login` endpoint, see this file's top-of-file
    # note) so there's something meaningful to revoke.
    tracked_headers = await _tracked_headers(session_factory, user.id)
    assert (await client.get("/api/auth/me", headers=tracked_headers)).status_code == 200

    r = await client.post("/api/auth/sessions/revoke-mine", headers=tracked_headers)
    assert r.status_code == 200
    assert r.json()["revoked_count"] == 1

    assert (await client.get("/api/auth/me", headers=tracked_headers)).status_code == 401


async def test_revoke_someone_elses_sessions_requires_admin(client, make_user, session_factory):
    target, _ = await make_user(email="target@example.com", role="user")
    target_headers = await _tracked_headers(session_factory, target.id)

    _, contributor_headers = await make_user(email="contrib-actor@example.com", role="contributor")
    denied = await client.post(f"/api/auth/sessions/{target.id}/revoke", headers=contributor_headers)
    assert denied.status_code == 403

    _, admin_headers = await make_user(email="admin-actor@example.com", role="admin")
    allowed = await client.post(f"/api/auth/sessions/{target.id}/revoke", headers=admin_headers)
    assert allowed.status_code == 200
    assert allowed.json()["revoked_count"] == 1

    # The target's tracked session is now revoked.
    assert (await client.get("/api/auth/me", headers=target_headers)).status_code == 401


async def test_revoke_someone_elses_sessions_404s_for_unknown_user(client, make_user):
    _, admin_headers = await make_user(email="admin-actor2@example.com", role="admin")
    r = await client.post("/api/auth/sessions/999999/revoke", headers=admin_headers)
    assert r.status_code == 404
