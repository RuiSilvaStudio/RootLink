---
type: Note
---

# Implementation Kickoff Briefing

> **Historical:** written at Phase 0/1 kickoff, when this folder still lived
> at `backlog/user-roles-permissions/` (gitignored). It was promoted to
> `docs/roles-permissions/` (tracked, on GitHub) in Phase 6, once
> implementation was done — see `IMPLEMENTATION_STATUS.md`. Kept as-is below
> for historical accuracy about what was true at kickoff time, except for
> path references, which were updated to the new location so links resolve.

> **Purpose:** everything a fresh session/agent needs to start implementing
> the roles/permissions redesign locally, without re-reading this entire
> folder's design history first. Read this file, then `ROLES_PERMISSIONS.md`,
> `assessment.md`, and `roadmap.md` in that order — that's the full context.

## What's approved and where it lives

All in `docs/roles-permissions/` (originally `backlog/user-roles-permissions/`,
gitignored, internal use only — promoted to this tracked location in Phase 6):

- **`ROLES_PERMISSIONS.md`** — the approved target design. No open items.
- **`assessment.md`** — gap analysis: current live system vs. target.
- **`roadmap.md`** — the 7-phase implementation plan (Phase 0–6), architecture
  through UI. Every finding in the assessment maps to a phase.
- `platform-user-guide.md`, `contributor-guide.md` — help-center / dev docs,
  drafts, not published.
- `user-logic-review.md`, `user-what-who.md`, `user-roles-permissions-spec.md`
  — design history, reference only.

## Critical context that changes how cautious to be

**Confirmed by the product owner: production has no real users, no real
content, no real organizations/entities today — everything live is
test/seed data created for evaluation.** `assessment.md` and `roadmap.md`
were both revised to reflect this (see `assessment.md` §1/§3.3 and
`roadmap.md`'s Phase 1). Practical effect:

- No careful row-by-row production data migration is needed. Old
  `role`/`account_type` values on today's test accounts can be reset or
  reassigned directly.
- No "dual-write"/parallel-run safety net is required — Phase 1 (data model
  + migration) is a single, direct phase, not two cautious ones.
- **But the code and the running app are real and deployed.** Normal
  engineering discipline still applies: don't break the local dev
  environment, don't half-ship a state, restart services after backend
  changes (see Lessons below).

## Local dev environment — current state

Confirmed running right now:
- Backend: `uvicorn` on port **8001** (`rootlink/backend`).
- Frontend: `next dev` on port **3001** (`rootlink/frontend`) — **not**
  3000; port 3000 is bound by an unrelated service on this machine
  (`docs/LESSONS.md` #24). Always verify with `ss -ltnp | grep node`, don't
  assume localhost:3000 is this app.

Standard commands (from `docs/content-platform/IMPLEMENTATION_STATUS.md`):
```
# Backend
cd rootlink/backend && source .venv/bin/activate
python -m pytest -q                      # 70 passing today — must stay green
# after ANY backend code change, restart uvicorn (dev runs without --reload):
#   kill the pid on :8001, relaunch with setsid nohup ... uvicorn app.main:app --port 8001 ...

# Frontend
cd rootlink/frontend && npm run dev      # already running on :3001 — don't start a second copy
```

## Hard rules from `docs/LESSONS.md` — do not violate these

1. **Restart the backend after every backend change.** Dev uvicorn has no
   `--reload`. New model fields/endpoints won't apply until restart.
2. **Never run `npm run build` while `next dev` is live** — they share
   `.next/` and corrupt each other. Not relevant unless you touch frontend.
3. **Schema changes go in the app lifespan** (`rootlink/backend/app/main.py`)
   as idempotent, guarded `ALTER TABLE`/`create_all` statements — this is
   the real, currently-used migration mechanism. Alembic exists but its head
   is stale/no-op; don't rely on it unless Phase 0(a) explicitly decides to
   reconcile it first.
4. **SQLite can't drop `NOT NULL` in place** — needs a rebuild
   (rename→create→copy→drop) inside a `SAVEPOINT`. Only relevant if a
   migration needs to change nullability, not for purely additive columns.
5. A SQLAlchemy `JSON` column stores Python `None` as JSON `null`, not SQL
   `NULL` — don't use `WHERE json_col IS NULL` as migration logic.
6. Multi-worker (`--workers 2` in prod) races on lifespan migrations — the
   existing `flock` pattern in `main.py` already handles this; follow the
   same pattern for any new guarded `ALTER`.
7. Keep `docs/content-platform/IMPLEMENTATION_STATUS.md`-style status
   tracking current as you go, so any session can resume cold — same
   discipline should apply here (consider a matching status doc once real
   implementation starts).

## What to actually do first (scope for this kickoff)

**Do not attempt all 7 roadmap phases in one sitting.** This kickoff covers:

1. **Phase 0 — Decisions & design sign-off** (`roadmap.md` items a–i). Work
   through all 9 and write down a concrete, specific answer for each as a
   real decision record (e.g. `docs/roles-permissions/phase0-decisions.md`)
   — not code yet. Use `assessment.md`'s reasoning for each; most have a
   clearly-implied answer already (e.g. item (c), the enforcement-ladder
   rung, is already ratified — just confirm it in the record). Given there's
   no real production data, items (a) and (b) can be decided cleanly without
   needing to inspect real rows — just make the design decision correctly
   for whenever real users exist.
2. **Phase 1 — Data model & migration, first slice only.** Once Phase 0 is
   recorded, start the additive schema work in `rootlink/backend/app/models/`
   and the guarded-`ALTER`/`create_all` block in `main.py`: the `entities`
   table, the `entity_id` + rank column on `User` (per whatever Phase 0(f)
   decided to rename the existing `entity_type` collision to), and the
   `delegation_grants` table. Stop there — do not proceed to Phase 2+
   (permissions registry, endpoint cutover, new UI) in this kickoff.
3. **Verify nothing broke:** all 70 existing backend tests still pass,
   backend restarts cleanly, frontend still loads. Report status.

Stop after step 3 and report back — don't silently keep going into later
phases. The point of this kickoff is a real, reviewable first slice, not
the whole system in one pass.

## Guardrails

- Follow this repo's existing coding conventions (`CONTRIBUTING.md` →
  Coding Guidelines) and the platform-coherence mindset already established
  in this codebase (check ripple effects, don't break existing endpoints).
- This is local dev only — do not deploy, do not touch `DEPLOY.md`'s
  production process, do not run `scripts/deploy.sh`.
- If you hit a new non-obvious gotcha, add it to `docs/LESSONS.md` in the
  same change, per this repo's own stated convention.
