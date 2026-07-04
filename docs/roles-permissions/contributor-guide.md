---
type: Note
_width: wide
---

# User Roles & Permissions — Contributor Guide

> **Status:** Design approved and **implemented** (Phases 0–5; see
> `IMPLEMENTATION_STATUS.md` for the full phase-by-phase record). This bug
> is closed: `TECH_DEBT.md` §0 is resolved.
> **Audience:** contributors/developers.
> **See also:** `ROLES_PERMISSIONS.md` (spec), `assessment.md` (gap analysis — historical, describes the pre-implementation state), `roadmap.md` (implementation plan) — all in this folder.

## What this doc is

This is a developer-facing orientation to the roles/permissions redesign — not
an end-user guide, and not the spec itself. If you're about to touch anything
related to roles, ranks, entities, or permission checks in this codebase, read
this first, then go to `ROLES_PERMISSIONS.md` for the actual rules.

**Current reality:** `ROLES_PERMISSIONS.md` describes the design that is now
**live in the codebase** — entities, per-entity rank, the permissions
registry (`app/core/permissions_registry.py`), and the 4-rung enforcement
ladder are all real, tested code today (`rootlink/backend/app/`). The older
flat 5-role system it replaced (`user` → `contributor` → `moderator` →
`admin` → `super_admin`, no entity concept), still described for historical
reference in
[`docs/content-platform/CONTENT_PLATFORM.md`](../content-platform/CONTENT_PLATFORM.md)
§3–§4, is what the live system looked like **before** this work — that
document's §3/§4 carry a superseding note pointing back here. If you're
reading `main` today, `ROLES_PERMISSIONS.md` is what's actually running,
not just a target.

Two sibling docs cover the gap that existed between "today" and "target" at
the time this was planned — both are now historical records of the planning
process, not open questions:

- `assessment.md` — gap analysis between the (then-)live system and the target spec.
- `roadmap.md` — the technical implementation plan, phase by phase.

## Core concepts for developers

Two independent axes, not one:

- **Role rank** (`0`–`5`): `visitor → persona → contributor → moderator → admin → super admin`. Ranks are only ever compared **within the same entity** — never across entities (`ROLES_PERMISSIONS.md` §3, "Entity precedence").
- **Entity type**: `individual`, `professional`, `organization`, `platform`, `partners`, `suppliers`. Each entity has its own rank *ceiling* — e.g. `individual` never goes above `contributor`, `professional` caps at `admin` (`ROLES_PERMISSIONS.md` §3).

The permission tables (`ROLES_PERMISSIONS.md` §7–§8) use a three-symbol legend:

- `✅` — own item only
- `☑️` — items owned by anyone ranked below the actor, same entity
- `🔑` — anyone's item, entity-wide (effectively only that entity's super admin)

**This should compile down to one rank-check helper, not per-endpoint
hand-rolled role lists.** That's the whole point of formalizing rank as a
number instead of a set of role-name strings: a single `has_rank_at_least()`
(or equivalent) comparison replaces every ad-hoc `role in [...]` check.

This was a direct response to a real bug, now closed: `user-logic-review.md`
§8 in this same folder documents that in the **pre-redesign** codebase,
`super_admin` was not a strict superset of `admin` in roughly **23 places** —
enums or allow-lists were extended for `admin`/`moderator` but never updated
to also include `super_admin`, so promoting a real admin to `super_admin`
could silently make them lose access in places nobody remembered to update.
The Phase 3 endpoint cutover fixed every one of those 23 sites onto the
shared `rank_at_least()` helper (see `TECH_DEBT.md` §0's closure record and
`tests/test_tech_debt_0_super_admin_closure.py`) — a rank number plus a
single comparison helper structurally prevents that class of bug, since
there's no list left to forget to update. Do not reintroduce per-endpoint
role lists in any new code; if you find yourself writing `role in [...]`,
that's a signal to use the rank helper (or the full `can()` registry check)
instead.

## Where the source of truth lives

`ROLES_PERMISSIONS.md` in this folder is canonical, **and now describes the
live system**, not just the target. It formally supersedes the
roles/permissions portions of
[`docs/content-platform/CONTENT_PLATFORM.md`](../content-platform/CONTENT_PLATFORM.md)
§3–§4, which now carry a note pointing back here and are kept only as the
historical record of what was originally shipped there.

This folder was promoted from `backlog/user-roles-permissions/` (gitignored)
into this tracked `docs/roles-permissions/` location in Phase 6, following
the existing precedent set by `docs/content-platform/`: a spec
(`ROLES_PERMISSIONS.md`), a status doc (`IMPLEMENTATION_STATUS.md`), and the
supporting design-history docs kept alongside them.

## How to propose a change to this spec

Even though it's implemented, this is still the single canonical design
doc — changes go through the same process as any other doc change in this
repo: open a PR editing `ROLES_PERMISSIONS.md` directly, and follow the
normal [Pull Request Process](../../CONTRIBUTING.md#pull-request-process).
Don't fork the design into a separate doc — amend `ROLES_PERMISSIONS.md` in
place so there's always one canonical version. If the change affects
behavior, plan for a corresponding code change (and test) in the same PR;
this spec is no longer purely aspirational, so drift between it and
`rootlink/backend/app/` is now a real bug, not just a documentation gap.

## If you're extending or modifying this system

Don't duplicate the technical history here — it lives in `roadmap.md`
(the phased implementation plan that was followed) and `assessment.md` (the
gap analysis against the system as it existed before this work). Before
writing code:

- [ ] Read `IMPLEMENTATION_STATUS.md` for what's actually built, phase by phase, and any flagged gaps/judgment calls still open.
- [ ] Read `phase0-decisions.md` for the *why* behind non-obvious design choices.
- [ ] Read `roadmap.md`/`assessment.md` only if you need the historical planning context.
- [ ] Confirm your change maps to a single rank/entity check via `app/core/permissions.py`'s `can()` (or `rank_at_least()` for the still-not-fully-cut-over legacy sites), not a new per-endpoint role list.
