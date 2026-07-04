"""Tests for `rank_at_least` (app/core/permissions.py) — the shared helper
used to cut TECH_DEBT.md §0's 23 named sites over from hand-typed
`role in (...)` checks. Proves the exact bug closure: `super_admin` passes
every floor `admin` does, for both already-migrated and freshly-registered
(never-migrated) users.
"""

from app.core.permissions import rank_at_least
from app.core.permissions_registry import Rank
from app.models.user import User


def _user(role="user", account_type="individual", entity_kind=None, rank=None) -> User:
    return User(
        email="x@example.com", name="x", password_hash="x",
        role=role, account_type=account_type, entity_kind=entity_kind, rank=rank,
    )


def test_super_admin_passes_every_floor_admin_does_never_migrated():
    """The exact bug: a fresh (never-migrated) super_admin row must pass
    every floor a fresh admin row passes.
    """
    admin = _user(role="admin")
    super_admin = _user(role="super_admin")
    for floor in (Rank.persona, Rank.contributor, Rank.moderator, Rank.admin):
        assert rank_at_least(admin, floor) is True
        assert rank_at_least(super_admin, floor) is True


def test_super_admin_passes_every_floor_admin_does_already_migrated():
    admin = _user(entity_kind="platform", rank=4)
    super_admin = _user(entity_kind="platform", rank=5)
    for floor in (Rank.persona, Rank.contributor, Rank.moderator, Rank.admin):
        assert rank_at_least(admin, floor) is True
        assert rank_at_least(super_admin, floor) is True


def test_contributor_fails_moderator_floor():
    contributor = _user(role="contributor")
    assert rank_at_least(contributor, Rank.moderator) is False
    assert rank_at_least(contributor, Rank.contributor) is True


def test_plain_user_fails_contributor_floor():
    plain = _user(role="user")
    assert rank_at_least(plain, Rank.contributor) is False
    assert rank_at_least(plain, Rank.persona) is True
