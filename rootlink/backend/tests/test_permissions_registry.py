"""Table-driven tests for the permissions registry + `can()` helper
(Phase 0 decisions (d), docs/roles-permissions/phase0-decisions.md).

Per docs/roles-permissions/assessment.md §8: one generated test loop iterating the registry's own
(action, min_rank, entity_scope, delegable) tuples, rather than ~360+
hand-written per-combination assertions that could silently drift out of
sync with the registry they're supposed to verify.

No DB/session needed — `can()` is a pure function over plain attributes, so
plain (unpersisted) `User(...)` instances are enough.
"""

from app.core.permissions import can
from app.core.permissions_registry import REGISTRY, Rank, entity_scoped_actions, platform_wide_actions
from app.models.user import User


def _user(rank: int | None, entity_kind: str | None, entity_id: int | None = None) -> User:
    return User(
        email="x@example.com", name="x", password_hash="x",
        rank=rank, entity_kind=entity_kind, entity_id=entity_id,
    )


# ---------------------------------------------------------------------------
# Registry completeness — this is meant to fail loudly if the registry
# shrinks (e.g. an accidental duplicate key overwriting an entry), since a
# partial registry is worse than an obviously-incomplete one.
# ---------------------------------------------------------------------------

def test_registry_covers_final_spec_sections_7_and_8():
    # docs/roles-permissions/ROLES_PERMISSIONS.md §7 has 35 distinct action rows; §10's "manage any X"
    # delegable tier is modeled as its own action key (see
    # permissions_registry's module docstring point 2), adding 5 more
    # (article.review/approve/revert_approval reuse §7's own rows —
    # group/product/event/course each get a manage_any key) for 40 total.
    # Phase 4 adds 3 more entity-scoped actions for entity conversion/
    # dissolution-request (docs/roles-permissions/ROLES_PERMISSIONS.md §3, not in the original §7 table,
    # which predates this phase's build — see docs/roles-permissions/phase0-decisions.md addendum):
    # entity.convert_individual_to_professional,
    # entity.convert_professional_to_organization, entity.request_dissolution.
    assert len(entity_scoped_actions()) == 44
    # docs/roles-permissions/ROLES_PERMISSIONS.md §8 has 21 distinct action rows. Phase 4 adds 3 more
    # platform-wide actions (same addendum): entity.reverse_dissolution,
    # entity.ban, entity.unban.
    assert len(platform_wide_actions()) == 24
    assert len(REGISTRY) == 68


def test_every_entry_has_a_valid_rank_and_scope():
    for action, entry in REGISTRY.items():
        assert 0 <= entry.min_rank <= 5, action
        assert entry.entity_scope in ("platform", "entity"), action


# ---------------------------------------------------------------------------
# Table-driven min_rank boundary check, generated from the registry itself.
# ---------------------------------------------------------------------------

def test_entity_scoped_actions_boundary():
    for action, entry in entity_scoped_actions().items():
        if entry.min_rank > Rank.visitor:
            below = _user(entry.min_rank - 1, "individual", None)
            assert can(below, action, entity_id=None) is False, f"{action}: rank below min_rank should fail"
        at_min = _user(entry.min_rank, "individual", None)
        assert can(at_min, action, entity_id=None) is True, f"{action}: rank at min_rank should succeed"


def test_platform_wide_actions_boundary_for_platform_entity():
    for action, entry in platform_wide_actions().items():
        if entry.min_rank > Rank.visitor:
            below = _user(entry.min_rank - 1, "platform", None)
            assert can(below, action) is False, f"{action}: platform rank below min_rank should fail"
        at_min = _user(entry.min_rank, "platform", None)
        assert can(at_min, action) is True, f"{action}: platform rank at min_rank should succeed"


def test_platform_wide_actions_always_denied_to_non_platform_entities():
    # Even a rank-5 super admin of an organization can never perform a
    # platform-wide action — entity_scope gates this entirely independent
    # of rank. This is the "only platform can do platform-wide things" half
    # of entity precedence.
    for action in platform_wide_actions():
        org_super_admin = _user(5, "organization", entity_id=1)
        assert can(org_super_admin, action, entity_id=1) is False, action
        individual_persona = _user(1, "individual", None)
        assert can(individual_persona, action) is False, action


def test_entity_scoped_actions_denied_below_min_rank_across_entity_kinds():
    for action, entry in entity_scoped_actions().items():
        if entry.min_rank == Rank.visitor:
            continue
        prof_below = _user(entry.min_rank - 1, "professional", None)
        assert can(prof_below, action, entity_id=None) is False, action


# ---------------------------------------------------------------------------
# Entity precedence (docs/roles-permissions/ROLES_PERMISSIONS.md §3) — its own dedicated test category,
# per docs/roles-permissions/assessment.md §8: not assumed covered by the boundary tests above,
# because this is specifically about cross-entity behavior, not rank alone.
# ---------------------------------------------------------------------------

def test_entity_precedence_platform_overrides_other_entities():
    platform_super_admin = _user(5, "platform", None)
    # An entity-scoped action, for an entity the platform user has no
    # membership in whatsoever (entity_id=999, some other org) — the
    # platform entity "sits above and can act across all the others"
    # (docs/roles-permissions/ROLES_PERMISSIONS.md §3), so this must succeed purely on rank, with no
    # entity_id match required at all.
    assert can(platform_super_admin, "group.manage_any", entity_id=999) is True
    assert can(platform_super_admin, "article.approve", entity_id=12345) is True
    # Also true for actions where entity_id is None entirely.
    assert can(platform_super_admin, "content.browse_read_public") is True


def test_entity_precedence_is_not_just_comparing_rank_numbers():
    """The exact bug shape docs/roles-permissions/assessment.md §3 warns about, one layer up:
    an organization's own super admin (rank 5) — numerically the *highest*
    possible rank — must NOT be able to act on a *different* organization's
    entity-scoped content just because 5 >= min_rank. Rank numbers are only
    ever comparable within the same entity.
    """
    org_a_super_admin = _user(5, "organization", entity_id=1)
    # Acting within their OWN org: allowed.
    assert can(org_a_super_admin, "group.manage_any", entity_id=1) is True
    # Acting on a DIFFERENT org's entity-scoped content: denied, despite
    # having the numerically highest possible rank.
    assert can(org_a_super_admin, "group.manage_any", entity_id=2) is False

    # And the reverse shape: an org's admin (rank 4) is not outranked by
    # comparing raw numbers against the platform's own rank-4 admin either
    # — a platform-wide action stays platform-only regardless.
    org_admin = _user(4, "organization", entity_id=1)
    assert can(org_admin, "user.grant_revoke_roles", entity_id=1) is False  # platform-only action


def test_individual_and_professional_cannot_impersonate_an_entity_id():
    individual = _user(5, "individual", None)  # hypothetically high rank, still individual
    assert can(individual, "group.manage_any", entity_id=1) is False
    assert can(individual, "group.manage_any", entity_id=None) is True

    professional_admin = _user(4, "professional", None)
    assert can(professional_admin, "course.manage_any", entity_id=7) is False
    assert can(professional_admin, "course.manage_any", entity_id=None) is True


def test_unknown_action_is_always_denied():
    someone = _user(5, "platform", None)
    assert can(someone, "not_a_real_action") is False


def test_unranked_user_treated_as_visitor():
    unranked = _user(None, "individual", None)
    assert can(unranked, "content.browse_read_public") is True  # visitor-level action
    assert can(unranked, "link.submit") is False  # requires persona (rank 1)
