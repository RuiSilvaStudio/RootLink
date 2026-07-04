"""The single rank/entity-check helper (Phase 0 decision (d)):
`can(user, action, entity_id=None) -> bool`.

Reads from `app.core.permissions_registry`. **Not wired into any existing
endpoint's authorization logic yet** — Phase 3 scope. This is new, additive
infrastructure, proven by `tests/test_permissions_registry.py`, not yet
consumed by production request handling.

## Entity precedence (docs/roles-permissions/ROLES_PERMISSIONS.md §3)

`platform` always overrides every other entity, unconditionally — "the
platform entity is the umbrella entity: it sits above and can act across
all the others." This is implemented here as an **explicit, separate
branch**, not inferred by comparing rank numbers across entities (rank
numbers are only ever comparable *within* the same entity — an
organization's own `super admin` (rank 5) does not outrank the `platform`
entity's `admin` (rank 4); comparing the bare integers would get this
backwards). `docs/roles-permissions/assessment.md` §3's own framing is explicit that this is "the
same class of bug already found in the live codebase (`super_admin` failing
to act as a superset of `admin` in ~23 places) — one level up, at the
entity layer instead of the role layer," so it gets its own branch and its
own dedicated test (`test_entity_precedence_platform_overrides_other_entities`
in the test file), not a shared code path with the entity-scoped check
below that happens to produce the right answer by coincidence.

## What this does NOT do yet

- **Delegation grants are not consulted.** A user with a `delegation_grants`
  row for an action below their own rank's normal reach is not yet honored
  by `can()` — that's part of the eventual Phase 3 cutover (per
  `docs/roles-permissions/assessment.md` §7's "auto-void-on-demotion/suspension/ban" requirement,
  which needs the grant lookup wired in at the same time so a stale grant
  can't outlive its holder's standing). `can()` today answers strictly from
  rank + entity, matching the registry's own `min_rank`/`entity_scope` axes.
- **Ownership tiers (✅/☑️/🔑) are not modeled.** See
  `permissions_registry`'s module docstring point 1 — `can()` only answers
  "is this rank, in this entity, allowed to attempt this action at all,"
  not "...on this specific target object." Call sites that need the
  finer-grained owner comparison (e.g. "can X edit THIS SPECIFIC article")
  still need their own ownership check layered on top, same as today.
"""

from app.core.entity_resolution import resolve_entity_and_rank
from app.core.permissions_registry import get
from app.models.entity import UserEntity

_ENTITY_ROW_KINDS = {UserEntity.organization, UserEntity.partners, UserEntity.suppliers}


def rank_at_least(user, floor: int) -> bool:
    """Rank-only staff check, ignoring entity/`entity_id` matching entirely
    — for the Phase 3 cutover of TECH_DEBT.md §0's 23 named sites (plants,
    marketplace, feeds, taxonomy, articles, events, learning/courses,
    content), whose live authorization was never entity-scoped to begin
    with: a bare `role in (...)` check, global across the whole app, with
    no notion of "which organization" at all.

    This is TECH_DEBT.md §0's **own recommended fix** (option (b): "a
    single shared helper... that always treats super_admin as satisfying
    everything"), built on the same `resolve_entity_and_rank` foundation
    `can()` uses — so `super_admin` (resolved rank 5) structurally passes
    every floor up to and including `admin` (4), closing the exact named
    bug by construction, not by remembering to add one more string to a
    per-site list.

    Deliberately does **not** go through `can()`/the permissions registry:
    several of these 23 sites' historical rank floors don't exactly match
    `docs/roles-permissions/ROLES_PERMISSIONS.md`'s redesigned per-action floors for the closest-named
    registry action (e.g. plants creation today allows `contributor`+,
    while docs/roles-permissions/ROLES_PERMISSIONS.md §7's "Create/edit plants" row starts at
    `moderator`) — adopting the registry's floor at those sites would
    silently change *who* is allowed, not just fix the named
    `super_admin` gap, which is a real product decision for a later phase
    (docs/roles-permissions/ROLES_PERMISSIONS.md's policy is the *target*, not necessarily an invisible
    drop-in replacement for today's exact thresholds). This session's
    explicit scope is closing the named bug only — see the per-file
    comments at each cutover site for why `rank_at_least` was chosen over
    a literal `can()` registry action there.
    """
    _, rank = resolve_entity_and_rank(user)
    return rank >= floor


def can(user, action: str, entity_id: int | None = None) -> bool:
    """Whether `user` may attempt `action`, optionally scoped to `entity_id`.

    `entity_id` should be the entity the action is being performed *in* —
    e.g. the entity that owns the group/article/event being acted on. Pass
    `None` for individual/professional users acting in their own personal
    (non-organizational) context.
    """
    entry = get(action)
    if entry is None:
        return False

    # Falls back to a live-computed (entity_kind, rank) for any user not yet
    # touched by the Phase 1 batch migration — see entity_resolution's
    # module docstring for why this is necessary, not just defensive.
    entity_kind, user_rank = resolve_entity_and_rank(user)

    # --- Entity precedence: platform overrides everything, unconditionally.
    if entity_kind == UserEntity.platform:
        return user_rank >= entry.min_rank

    # --- Platform-wide actions: only the platform entity may ever do these.
    if entry.entity_scope == "platform":
        return False

    # --- Entity-scoped actions for a non-platform actor.
    if user_rank < entry.min_rank:
        return False

    if entity_kind in _ENTITY_ROW_KINDS:
        # organization/partners/suppliers: must be acting within their OWN
        # entity — an org's super admin never automatically reaches into a
        # different org just because their rank number is high enough.
        user_entity_id = getattr(user, "entity_id", None)
        return user_entity_id is not None and user_entity_id == entity_id

    # individual/professional: no `entities` row exists for these two, so
    # "their own" scope has no entity_id at all. Passing a real entity_id
    # here would mean impersonating a different entity's context, which is
    # never allowed for these two kinds.
    return entity_id is None
