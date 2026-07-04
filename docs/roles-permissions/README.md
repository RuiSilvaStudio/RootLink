---
type: Note
---

# User Roles & Permissions — folder index

Everything related to the RootLink roles/permissions redesign lives here,
in the order it was produced. **If you're resuming implementation work,
start with `IMPLEMENTATION_STATUS.md`, not `ROLES_PERMISSIONS.md`.**

This folder was promoted from the gitignored `backlog/user-roles-permissions/`
to this tracked location once implementation was complete (Phase 6) — see
`IMPLEMENTATION_STATUS.md`'s Phase 6 entry. It mirrors the
`docs/content-platform/` spec+status precedent.

## Read this order

0. **[IMPLEMENTATION_STATUS.md](./IMPLEMENTATION_STATUS.md)** — ✅ **current
   build status.** All 7 phases (0–6) done and verified (schema, permissions
   registry, backend + frontend endpoint cutover, enforcement ladder, entity
   lifecycle, new UI surfaces, doc reconciliation). `TECH_DEBT.md` §0
   resolved. Read this first if picking up cold.
1. **[ROLES_PERMISSIONS.md](./ROLES_PERMISSIONS.md)** — ✅ **the approved target design.**
   Single source of truth for entities, roles/ranks, account status and
   the enforcement ladder, promote/demote rules, permission tables,
   delegation.
2. **[ACTION_UI_MAP.md](./ACTION_UI_MAP.md)** — manual QA cross-reference:
   every one of the 67 `permissions_registry.py` actions mapped to the exact
   production page/button/form that exercises it (or flagged as "no UI yet"
   where none exists). Use this to click-test the live site.
3. **[UI_BUILD_BACKLOG.md](./UI_BUILD_BACKLOG.md)** — forward-looking build
   backlog derived from `ACTION_UI_MAP.md`'s gaps: every UI touchpoint that's
   genuinely needed but doesn't exist yet (or exists in a degraded form),
   with why-it-matters, suggested UI location, rough complexity, and
   dependencies — for the product owner to prioritize what gets built next.
4. **[assessment.md](./assessment.md)** — gap analysis: what has to change
   in the data model, backend, frontend, and docs to go from the live
   system to ROLES_PERMISSIONS.md, plus a "before you write any code" decision
   checklist.
5. **[roadmap.md](./roadmap.md)** — phased implementation plan (Phase 0
   decisions → Phase 6 doc reconciliation), sequenced from assessment.md,
   architecture through UI. Nothing in assessment.md is left unmapped.
6. **[phase0-decisions.md](./phase0-decisions.md)** — concrete answers to
   all 9 Phase 0 decision items, including judgment calls made mid-build
   (e.g. why `rank_at_least` was used instead of the full registry for the
   Phase 3 bug-fix cutover) — read this to understand *why*, not just *what*.
7. **[platform-user-guide.md](./platform-user-guide.md)** — plain-language
   help-center draft for end users (not developers). Not live yet.
8. **[contributor-guide.md](./contributor-guide.md)** — for developers
   building against or extending this system. Linked from the repo's
   `CONTRIBUTING.md`.
9. **[IMPLEMENTATION_KICKOFF.md](./IMPLEMENTATION_KICKOFF.md)** — the original
   Phase 0/1 kickoff briefing. Historical — kept for context on how the
   implementation work started; superseded by `IMPLEMENTATION_STATUS.md` for
   current state.

## Design history (reference only, not authoritative)

These are kept for context on *why* the spec ended up the way it did —
ROLES_PERMISSIONS.md is what matters going forward, not these:

- **[user-logic-review.md](./user-logic-review.md)** — technical audit of
  the current, live permission system (the starting point for this whole
  effort), including the known `super_admin`-not-a-superset-of-`admin` bug.
- **[user-what-who.md](./user-what-who.md)** — the original working notes
  (entities, roles, first draft matrices), co-written with the user.
- **[user-roles-permissions-spec.md](./user-roles-permissions-spec.md)** —
  the cleaned-up v1 draft, including the best-practices/stress-test review
  and decisions log that ROLES_PERMISSIONS.md resolves.

## Status

Design approved, **implementation complete** (Phases 0–6 of 6 done, verified
— see `IMPLEMENTATION_STATUS.md`). All application-code changes are local,
uncommitted working-tree changes in `rootlink/`; nothing deployed. This
folder itself has been promoted out of `backlog/` and is now tracked in git
as part of Phase 6.
