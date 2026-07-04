"""Tests for the entity_resolution fallback (app/core/entity_resolution.py),
added during the Phase 3 endpoint cutover: `can()` must work correctly for
users who never went through the one-time Phase 1 batch migration — most
importantly, every user registered from now on, since nothing else ever
populates `entity_kind`/`rank` for them.
"""

from app.core.entity_resolution import resolve_entity_and_rank
from app.core.permissions import can
from app.models.user import User


def _fresh_user(role="user", account_type="individual") -> User:
    """A user that has NEVER been touched by the Phase 1 batch migration —
    entity_kind/rank both left at their column default (None), exactly like
    every real `/api/auth/register` row today.
    """
    return User(email="x@example.com", name="x", password_hash="x", role=role, account_type=account_type)


def test_fresh_individual_user_resolves_to_individual_persona():
    entity_kind, rank = resolve_entity_and_rank(_fresh_user(role="user", account_type="individual"))
    assert (entity_kind, rank) == ("individual", 1)


def test_fresh_individual_contributor_resolves_correctly():
    entity_kind, rank = resolve_entity_and_rank(_fresh_user(role="contributor"))
    assert (entity_kind, rank) == ("individual", 2)


def test_fresh_admin_resolves_to_platform_regardless_of_account_type():
    entity_kind, rank = resolve_entity_and_rank(_fresh_user(role="admin", account_type="individual"))
    assert (entity_kind, rank) == ("platform", 4)


def test_fresh_super_admin_resolves_to_platform_rank5():
    entity_kind, rank = resolve_entity_and_rank(_fresh_user(role="super_admin"))
    assert (entity_kind, rank) == ("platform", 5)


def test_fresh_practitioner_resolves_to_professional():
    entity_kind, rank = resolve_entity_and_rank(_fresh_user(role="moderator", account_type="practitioner"))
    assert (entity_kind, rank) == ("professional", 3)


def test_fresh_moderator_individual_ceiling_safety_net():
    entity_kind, rank = resolve_entity_and_rank(_fresh_user(role="moderator", account_type="individual"))
    assert (entity_kind, rank) == ("platform", 3)


def test_already_migrated_user_uses_stored_columns_unchanged():
    user = _fresh_user(role="admin", account_type="individual")
    user.entity_kind = "organization"
    user.rank = 5
    # Stored columns win even though `role`/`account_type` alone would have
    # suggested a platform override — a real migrated row is authoritative.
    assert resolve_entity_and_rank(user) == ("organization", 5)


async def test_can_works_for_a_freshly_registered_user(make_user):
    """End-to-end proof: a user shaped exactly like a real register-endpoint
    row (entity_kind/rank both unset — Phase 1 only backfilled existing
    rows, see this file's module docstring) can still be evaluated
    correctly by `can()`. Uses `make_user` rather than a live
    `/api/auth/register` call — see docs/LESSONS.md #27 (the register
    rate-limiter's shared-across-the-suite state).
    """
    user, _headers = await make_user(email="freshuser@example.com")
    assert user.entity_kind is None  # confirms it's shaped like an unmigrated row
    assert user.rank is None
    # A brand-new individual/persona-level user can submit a link...
    assert can(user, "link.submit") is True
    # ...but cannot do an admin-only platform action.
    assert can(user, "broadcast.send") is False
