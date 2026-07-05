---
type: Note
_width: wide
---

# User Roles & Permissions — Implementation Status

> **Status:** ✅ **COMPLETE** — all 7 phases (0–6) done, verified, plus one
> post-Phase-6 product-decision session (2026-07-04, see its own dated
> section below "Post-implementation fixes"). This status doc is the
> complete record.
> **Spec:** [`ROLES_PERMISSIONS.md`](./ROLES_PERMISSIONS.md) · **Gap analysis:** [`assessment.md`](./assessment.md) · **Plan:** [`roadmap.md`](./roadmap.md)
> **Decisions made so far:** [`phase0-decisions.md`](./phase0-decisions.md)
> **Read this file first if resuming cold** — it's the fastest path to
> current state without re-deriving it from `git diff`.

---

## TL;DR

Phase 6 is **pure documentation and code-comment work — no application logic
changed.** All of this remains **local, uncommitted, working-tree changes
only** — nothing committed to git, nothing deployed. Neither dev server was
touched this session (no code changes to restart for): the backend
(`:8001`) and frontend (`:3001`) were left exactly as Phase 5 left them.

- **Backend tests: 213 passing** (`rootlink/backend/tests/`, run via
  `cd rootlink/backend && source .venv/bin/activate && python -m pytest -q`)
  — **unchanged from Phase 5's final count**, confirming this phase's
  comment/doc edits didn't break anything.
- **Frontend: `tsc --noEmit` and `next lint` both clean** — re-verified after
  this phase's handful of comment-only edits in `.ts`/`.tsx` files.
- `TECH_DEBT.md` §0 (the `super_admin`-not-superset-of-`admin` bug that
  motivated this whole redesign) is marked **✅ RESOLVED** — both backend
  and frontend halves. Its path references to this folder were updated to
  the new `docs/roles-permissions/` location this phase.
- **This folder itself was promoted** from the gitignored
  `backlog/user-roles-permissions/` to this tracked `docs/roles-permissions/`
  location — see the Phase 6 entry below for the full move/rename record.

## Local dev quick reference

- Backend: uvicorn on **:8001** — restart after every backend change (dev
  runs without `--reload`, `docs/LESSONS.md` #5). Confirm the real PID first
  via `ss -ltnp | grep uvicorn`, don't assume.
- Frontend: `next dev` on **:3001** (not 3000 — `docs/LESSONS.md` #24) —
  **do not run `npm run build` or restart it** while it's live
  (`docs/LESSONS.md` #2). Verify frontend changes with `tsc --noEmit` /
  `next lint` only, or read-only Playwright against the already-running
  server (see `docs/LESSONS.md` #28 for a race-condition gotcha in that
  pattern).
- Full local dev commands: `docs/content-platform/IMPLEMENTATION_STATUS.md`
  → "Local dev quick reference" (same commands, this work reuses that
  environment, nothing new to set up).

## What's implemented (by phase)

### Phase 0 — Decisions & design sign-off ✅
- All 9 checklist items decided concretely, recorded in
  `phase0-decisions.md`, including one addendum discovered mid-build (see
  Phase 1 below).

### Phase 1 — Data model & migration ✅
- New tables: `entities` (backs `organization`/`partners`/`suppliers`),
  `delegation_grants`. New file: `app/models/entity.py`.
- `User` gained `entity_id`, `rank` (0–5), and `entity_kind` — the last one
  **not** in the original Phase 0 record; added when it became clear
  `entity_id IS NULL` alone can't disambiguate `individual`/`professional`/
  `platform` (three different ceilings). Documented as an addendum in
  `phase0-decisions.md`.
- Existing `entity_type` column (org sub-kind: ipss/cooperative/...) renamed
  to `organization_kind` to resolve the naming collision with the new
  "entity" concept — external API field name (`entity_type` in
  requests/responses) unchanged, so this is a no-op for any frontend/API
  consumer.
- All 8 existing (test/seed) users migrated onto the new fields —
  `app/services/roles_migration.py`, idempotent, fully audited via
  `ModerationAuditLog`. `can_self_publish`/`can_edit_copy` backfilled into
  `delegation_grants` as its first rows; old booleans untouched.
- Tests: `test_phase1_roles_migration.py` (10 tests).

### Phase 2 — Backend enforcement core ✅
- `app/core/permissions_registry.py` — 61 actions, full coverage of
  `ROLES_PERMISSIONS.md` §7 (entity-scoped) and §8 (platform-wide).
- `app/core/permissions.py` — `can(user, action, entity_id=None)` with
  explicit, separately-tested **entity precedence** (`platform` always
  overrides, never inferred from comparing raw rank numbers). **Not yet
  wired into any existing endpoint** as of Phase 2 — see Phase 3 for that.
- `app/core/entity_resolution.py` — live fallback (`resolve_entity_and_rank`)
  for any user not touched by the Phase 1 batch migration (i.e. every real
  registration from now on) — a necessary addition found while wiring
  Phase 3, not originally in the Phase 0 plan.
- New `sessions` allowlist table (`app/models/session.py`,
  `app/services/sessions.py`) — `token_jti` wired into JWT issuance and
  checked in `get_current_user`/`get_optional_user`.
- Three new baseline auth endpoints (`app/api/auth_security.py`): email
  verification, self-service password reset, force-logout (own + staff-only
  revoke-someone-else's).
- Tests: `test_permissions_registry.py` (11), `test_phase2_sessions.py` (4),
  `test_phase2_auth_security.py` (10).

### Phase 3 — Endpoint cutover ✅ (backend + frontend)
- **Backend:** all 23 sites named in `TECH_DEBT.md` §0 (across `articles.py`,
  `content.py`, `events.py`, `learning.py`, `plants.py`, `marketplace.py`,
  `feeds.py`, `taxonomy.py`) plus `admin.py`'s `require_role` and `groups.py`'s
  `STAFF_ROLES`/`_can_manage_group` migrated to a shared `rank_at_least()`
  helper (`app/core/permissions.py`). **Deliberately not routed through
  `can()`/the registry directly** — several sites' historical thresholds
  don't match `ROLES_PERMISSIONS.md`'s redesigned floors for the same action (e.g.
  plants creation is `contributor`+ today, registry says `moderator`+), and
  using the registry there would have silently changed who's allowed, not
  just closed the named bug. Ownership checks (`created_by == user.id`)
  preserved exactly everywhere — only the staff-check half was replaced.
  Bug-closure proof: `test_tech_debt_0_super_admin_closure.py` (7 tests,
  including 4 real-endpoint integration tests). `TECH_DEBT.md` §0 marked
  resolved.
- **Frontend:** 12 sites fixed (`NavBar.tsx`, `MobileNav.tsx`, the 4
  `/learning` pages, `events/[id]/page.tsx`) — same missing-`super_admin`
  bug, client-side. New `GET /api/permissions/registry` endpoint (public,
  serializes the Python registry) + `lib/use-permission.ts` hook, wired into
  the `/learning` pages as real first consumers (not a blanket rewrite of
  every frontend check). Live-verified via read-only Playwright against the
  already-running dev server (screenshots, no build/restart) — stronger
  verification than originally planned for this phase.
- `groups/[id]/page.tsx` deliberately **not** touched — its `MANAGE_ROLES`
  already includes `super_admin`; a nearby `mine.role` check is a per-group
  `MemberRole` (member/moderator/admin), which legitimately has no
  super-admin tier at this layer.

### Phase 4 — New enforcement ladder + audit ✅
- **Restriction rung** — `AccountStatus.restricted` (4th value, no DB
  migration needed — bare `String(20)` column), `User.is_restricted`.
  `POST /api/admin/users/{id}/restrict` / `/lift-restriction`
  (`app/api/admin.py`, same `require_admin` pattern as suspend/ban). Wired
  into `app/api/articles.py`'s two trust-bypass checks (publish,
  edit-of-published) as a hard override on the whole "can this go live
  instantly" boolean — restriction beats rank AND the `can_self_publish`
  badge, per ROLES_PERMISSIONS.md §4's "account status always overrides badges."
- **Ban anonymization** — `app/api/admin.py::ban_user` now also sets
  `created_by = NULL` on the same published-content rows it already
  archives (reusing the exact tombstone mechanism `app/api/account.py`'s
  self-service GDPR erasure uses), one-way (not restored on unban). Existing
  GDPR tests (`tests/test_phase6_account.py`) untouched; new coverage in
  `tests/test_roles_phase4_ban_anonymization.py`.
- **Entity conversion** — `app/services/entity_conversion.py` +
  `app/api/entity_conversion.py`
  (`POST /api/entity-conversion/to-professional`, `/to-organization`).
  Content ownership persists (untouched), rank resets to persona (1) for
  individual→professional, bootstraps to super admin (5) + a new `entities`
  row for professional→organization, badges never carried over. One-way,
  self-service, immediate (see phase0-decisions.md Addendum 3 for why this
  isn't a separate pending-request record).
- **Entity dissolution** — `app/services/entity_dissolution.py` +
  `app/api/entities.py`. Entity's own super admin can only *request*
  (`Entity.dissolution_requested_at`/`_by`); platform super admin
  approves/executes (`dissolved_at` + 30-day
  `dissolution_grace_expires_at`) or triggers directly. Members convert to
  `individual`/persona(1), published content archived — both snapshotted
  onto `Entity.dissolution_snapshot` (JSON) so `reverse_dissolution` can
  restore exactly what changed, within the grace window only.
- **Cross-entity ban cascade** — `app/services/entity_cascade.py`. New
  `contributing_entity_id` FK + `cascade_hidden_at` overlay added to
  `EventSponsor`/`EventVendor` (the only *real* footprint mechanism found in
  this schema — `GroupMember` has no entity linkage and was deliberately
  excluded, see phase0-decisions.md Addendum 3). Triggered by both entity
  ban (`app/services/entity_dissolution.ban_entity`/`unban_entity` — a
  **new**, minimal entity-level ban concept this phase invented, since only
  `User`-level ban existed before) and dissolution, each with its own grace
  window (`ban_cascade_grace_expires_at` vs `dissolution_grace_expires_at`).
  `app/api/events.py`'s sponsor/vendor listing queries now check
  `cascade_hidden_at IS NULL` unconditionally, alongside (never instead of)
  the existing admin-controlled `is_active`/`visible_to_attendees` flags.
- **Promote/demote request+approval workflow** — new `role_change_requests`
  table (`app/models/role_request.py`), `app/services/role_requests.py` +
  `app/api/role_requests.py` (`POST /api/role-requests`, `/{id}/approve`,
  `/{id}/reject`). Enforces: target rank strictly below actor's own;
  approval from a rank strictly above the *original requester's* rank
  (snapshotted at submit time); separation of duties
  (`requester_id != approver_id`) independent of rank; the capped-entity/
  super-admin self-approval exemption implemented as a single generic rule
  (`rank == entity's ceiling`, `is_self_approval_exempt`) rather than two
  special-cased pairs — proven to produce exactly ROLES_PERMISSIONS.md §6's two
  documented cases. `professional`/`individual`-scoped requests are blocked
  outright (real, flagged gap — no shared "team" schema exists for
  `professional` today; see phase0-decisions.md Addendum 3).
- **Periodic audit-sampling** — `app/services/audit_sampling.py`, a plain
  callable query helper (`find_self_approved_role_changes`,
  `sample_for_review`, `monthly_self_approval_sample`) — no schema change
  (per phase0-decisions.md (h)), no scheduler invented (none exists
  elsewhere in this codebase).
- New model file: `app/models/role_request.py`. Modified models:
  `app/models/user.py` (`AccountStatus.restricted`, `is_restricted`,
  `activity_registration_number`), `app/models/moderation.py` (13 new
  `ModerationAction` values), `app/models/entity.py` (7 new `Entity`
  columns: dissolution request/snapshot + entity-level ban fields),
  `app/models/event.py` (`contributing_entity_id`/`cascade_hidden_at` on
  `EventSponsor`/`EventVendor`).
- `app/core/permissions_registry.py`: 6 new actions (3 entity-scoped, 3
  platform-wide) for conversion/dissolution/ban — not in the original §7/§8
  tables, which predate this phase. `entity_scoped_actions()` 40→43,
  `platform_wide_actions()` 21→24, `REGISTRY` 61→67 (the two hardcoded-count
  tests in `test_permissions_registry.py`/`test_permissions_registry_endpoint.py`
  were updated to match, not weakened).
- Tests: `test_roles_phase4_restriction.py` (9), `test_roles_phase4_ban_anonymization.py`
  (3), `test_roles_phase4_entity_conversion.py` (6),
  `test_roles_phase4_entity_dissolution.py` (8), `test_roles_phase4_cascade.py`
  (3), `test_roles_phase4_role_requests.py` (14),
  `test_roles_phase4_audit_sampling.py` (6) — 49 total.
- Real gaps found & resolved this phase (flagged, not silently built
  around) — full reasoning in `phase0-decisions.md` Addendum 3:
  `professional` entities have no shared team schema (blocks
  `professional`-scoped role-change requests and shapes the conversion
  design); entity-level ban didn't exist before (invented minimally, scoped
  to audit + cascade only); `EventSponsor`/`EventVendor` had no entity
  linkage at all (added `contributing_entity_id`); dissolution's
  "reversible within 30 days" needed a concrete snapshot to restore to
  (added `dissolution_snapshot`); `User.activity_registration_number` is a
  new field (ROLES_PERMISSIONS.md §2's "Verified professional" needs 2 distinct
  IDs, only 1 existed).

### Phase 5 — New UI surfaces ✅
- **Small additive backend endpoints** (checked what genuinely didn't exist
  first, per the kickoff briefing):
  - Entity self-registration + verification review —
    `app/services/entity_registration.py` + new routes on
    `app/api/entities.py`: `POST /api/entities/register`,
    `GET /api/entities/verification-queue`, `GET /api/entities/mine`,
    `POST /api/entities/{id}/verification/{approve,reject,request-more-info}`.
    **Distinct from `entity_conversion.py`** (an existing user switching
    their own kind) — this is registering a brand-new entity from scratch;
    both can independently lead to "professional becomes an organization's
    founder," a real flagged product ambiguity, see
    `phase0-decisions.md` Addendum 4.
  - Verification documents — new `EntityDocument` model +
    `app/services/document_storage.py` (a deliberately separate,
    non-image-processing sibling of `app/services/image_storage.py` — see
    that model's docstring for why reusing the image pipeline literally
    would have been wrong for PDFs) + `app/services/entity_documents.py` +
    `POST/GET /api/entities/{id}/documents`,
    `GET /api/entities/{id}/documents/{doc_id}/serve`.
  - Delegation-grant CRUD — `app/services/delegations.py` (new file) +
    new `app/api/delegations.py` router: `POST /api/delegations`,
    `GET /api/delegations?entity_id=&mine=`, `POST /api/delegations/{id}/revoke`.
    Only actions the registry marks `delegable: True` may be granted; no
    self-delegation; entity super admin or platform super admin only.
  - Entity-scoped team/roster — `app/services/entity_team.py` (new file) +
    new routes on `entities.py`: `GET /api/entities/{id}/members`,
    `POST /api/entities/{id}/roster`, `DELETE /api/entities/{id}/roster/{user_id}`.
    Roster add/remove is `partners`/`suppliers`-only (primary-contact
    designation, not rank — organizations manage rank via the existing
    promote/demote request workflow instead, per ROLES_PERMISSIONS.md §3's own
    split).
  - Role-change request listing — the only gap in an otherwise-complete
    Phase 4 surface: `GET /api/role-requests?scope=mine|pending-approval`
    added to `app/api/role_requests.py` (a new non-raising
    `can_approve()` in `role_requests.py` powers the `pending-approval`
    filter).
  - Auto-void-on-departure for delegation grants (ROLES_PERMISSIONS.md §10) wired
    into the two places a departure concretely happens today: roster
    removal (`entity_team.remove_team_member`) and entity dissolution's
    member-conversion loop (`entity_dissolution.approve_dissolution`) —
    **not** wired into demotion, a real flagged gap (see
    `phase0-decisions.md` Addendum 4).
  - `UserResponse` (`app/schemas/auth.py`) now exposes
    `entity_kind`/`rank`/`entity_id` directly — closing a gap Phase 3's own
    `use-permission.ts` docstring flagged (the frontend previously had no
    real stored values to read, only a re-derivation that could in
    principle diverge from the backend's authoritative ones). Necessary for
    the team panel to know which entity the logged-in user actually
    belongs to.
- **Frontend routes shipped:**
  - `/entity/register` — self-service registration form (organization/
    partners/suppliers).
  - `/entity/[entityId]` — status dashboard: verification-status badge,
    document upload/list, staff verification decisions (if authorized),
    dissolution request/approve/reject/reverse, entity ban/unban — each
    action gated client-side via `usePermission()`'s new `my()` accessor
    and re-enforced server-side regardless.
  - `/entity/[entityId]/team` — members/ranks list, promote/demote
    request submit + "my submitted requests" + "awaiting my approval" +
    approve/reject, delegation grant/revoke, partners/suppliers roster
    add/remove.
  - `/entity/convert` — entity conversion UI (individual→professional,
    professional→organization) with explicit "this is one-way, rank
    resets, badges don't carry over" messaging and a confirmation
    checkbox before either action is enabled.
  - `/admin/entity-verification` — staff-facing review queue
    (pending/more-info-requested/rejected/verified tabs), linking out to
    each entity's `/entity/[entityId]` page for the actual
    approve/reject/request-more-info decision (kept the decision UI in one
    place rather than duplicating it inside the admin panel).
  - `AdminSidebar.tsx` gained one new nav link ("Entity Verification",
    admin+ only) — the only `/admin/*` page touched, per the guardrail to
    not modify existing admin pages beyond linking out.
  - `profile/page.tsx`'s settings tab gained two new link-out cards
    ("Manage my entity" / "Register an organization…" depending on
    `profile.entity_id`, and "Convert account type") — the only other
    existing page touched.
- **`lib/use-permission.ts` upgraded**, not just consumed: now prefers the
  real `entity_kind`/`rank`/`entity_id` from the user object (Phase 5's
  `UserResponse` extension) over the old client-side re-derivation, and
  gained a `my()` accessor Phase 5's entity-scoped pages use directly.
  Closes two of the three "known simplifications" that module's own
  docstring flagged since Phase 3 (real entity_kind/rank source, real
  entity_id matching) — the third (no delegation-grant lookups in `can()`
  itself) remains open, matching the backend `can()`'s own same limitation.
- **Deliberately NOT built** (flagged, not silently skipped):
  - Delegation auto-void-on-demotion (see above).
  - Full i18n coverage for the ~7 new pages (hardcoded English copy for
    now — `t()`'s own fallback-to-raw-key behavior means nothing is
    broken, just not localized yet).
  - Unifying the entity-conversion and entity-registration paths for
    `professional`→`organization` (both work independently; flagged as a
    product question, not a bug).
  - "Named permission bundles" (ROLES_PERMISSIONS.md §10's own explicit v1
    non-goal — unaffected by anything this phase touched).
- Tests: `test_roles_phase5_entity_registration.py` (9),
  `test_roles_phase5_entity_documents.py` (4),
  `test_roles_phase5_delegations.py` (7), `test_roles_phase5_team_roster.py`
  (7), `test_roles_phase5_role_requests_listing.py` (3) — 30 total, all
  passing alongside the untouched 183 from Phases 0–4 (213 total).
- Live-verified via read-only-against-the-running-server Playwright
  (screenshots, no build/restart of the frontend): registered a brand-new
  organization → uploaded a document → a seeded platform-admin account
  approved it via the verification queue → the registrant was correctly
  bootstrapped to that organization's rank-5 super admin → the team page
  correctly showed them as the sole member/primary contact → a fresh
  individual account correctly saw the real `individual→professional`
  conversion form, while the now-`organization` founder correctly saw
  "conversion not available for your current account type" → a platform
  super admin correctly saw "Dissolve now"/"Ban entity" (immediate-execute
  wording, since they're the approval authority) on the same entity page a
  non-platform actor would instead see "Request dissolution" on. Caught a
  real Playwright-script bug in the process (see `docs/LESSONS.md` #32:
  `networkidle` hangs indefinitely against this app's persistently-polling
  pages) — fixed the script, not the app.
- New `docs/LESSONS.md` entries: #31 (FastAPI literal-path-vs-catch-all
  route ordering within one router file), #32 (`networkidle` hangs on this
  app's live pages — use `domcontentloaded` + an explicit timeout instead).
- Real gaps/judgment calls found this phase — full reasoning in
  `phase0-decisions.md` Addendum 4: registration vs. conversion overlap for
  professional→organization; registration's bootstrap-on-verification
  timing (vs. conversion's bootstrap-immediately) and the resulting reuse
  of `Entity.primary_contact_user_id` during the pending window;
  `partner_team.manage_roster`'s registry entry confirmed to be a nominal
  placeholder, not a real rank check, now that the roster endpoints
  actually exist; delegation auto-void-on-departure wired into roster
  removal + dissolution but not demotion; the `UserResponse` extension;
  the i18n scope trade-off; the new §9 page-visibility sub-table.

### Phase 6 — Documentation & doc reconciliation ✅
Pure documentation and code-comment work — **no application logic changed**,
per this phase's own guardrail. Everything below is a doc move/rename, a
superseding note, or a comment/citation fix.

- **Folder promotion.** The entire `backlog/user-roles-permissions/` folder
  (gitignored, internal-only) was moved as a unit to `docs/roles-permissions/`
  (tracked, visible on GitHub) — not a cherry-picked subset, since
  `ROLES_PERMISSIONS.md`, `IMPLEMENTATION_STATUS.md`, `phase0-decisions.md`,
  and every other file in the folder cross-reference each other by relative
  path; moving only some of them would have recreated the exact
  "two documents, one of them invisible" risk `assessment.md` itself warns
  about. Two files were renamed to match the `docs/content-platform/`
  precedent: `final-spec.md` → `ROLES_PERMISSIONS.md` (the main spec, same
  naming pattern as `CONTENT_PLATFORM.md`), `IMPLEMENTATION_STATUS.md` kept
  its exact filename. Everything else (`assessment.md`, `roadmap.md`,
  `phase0-decisions.md`, `user-logic-review.md`, `user-what-who.md`,
  `user-roles-permissions-spec.md`, `platform-user-guide.md`,
  `contributor-guide.md`, `README.md`, and `IMPLEMENTATION_KICKOFF.md` — the
  last one wasn't named in the kickoff briefing's file list but existed in
  the folder and was moved too, per "the entire folder as a unit") kept
  their lowercase-kebab names. The old `backlog/user-roles-permissions/`
  location no longer exists (fully emptied by the move, not left as a stale
  duplicate — confirmed via `ls`).
- **Internal cross-references fixed.** Grepped the whole new folder for
  `final-spec.md` and `backlog/user-roles-permissions` and updated every
  hit: bare `final-spec.md` mentions → `ROLES_PERMISSIONS.md` (same-folder
  relative references); `backlog/user-roles-permissions/...` path prefixes →
  `docs/roles-permissions/...`. Two relative markdown links in
  `contributor-guide.md` (`../../docs/content-platform/CONTENT_PLATFORM.md`)
  were double-checked for a depth-mismatch bug, since the folder moved —
  turned out **not** to be broken (`backlog/user-roles-permissions/` and
  `docs/roles-permissions/` are both exactly 2 segments deep from repo root,
  so the old `../../docs/content-platform/...` path still resolves
  correctly from the new location); simplified to the shorter,
  equally-correct `../content-platform/...` anyway, since it no longer needs
  to round-trip through the repo root. The `IMPLEMENTATION_KICKOFF.md`/
  `README.md` historical status lines (e.g. "All in
  `backlog/user-roles-permissions/` (gitignored...)") were also corrected or
  annotated as historical so they don't read as currently false.
- **`ROLES_PERMISSIONS.md`'s own header** updated ("Status: Approved v1 —
  ready for implementation planning" → "implemented"; "not yet implemented"
  language in its Supersedes line removed).
- **Formal superseding note added to `docs/content-platform/CONTENT_PLATFORM.md`**
  at the top of §3 ("Trust tiers...") and §4 ("Roles, permissions & the
  enforcement ladder...") — both point at
  `docs/roles-permissions/ROLES_PERMISSIONS.md` as the current, implemented
  source of truth, and explicitly state §3/§4's own content is **not**
  deleted (kept as the historical record of what was originally shipped
  there, per this phase's own instruction).
- **Code-comment audit** (`rootlink/backend/app/`, real grep, not assumed):
  every comment citing `CONTENT_PLATFORM.md` §3/§4.x for a roles/permissions
  concept was updated to point at the superseding spec where the concept
  itself moved (`models/user.py`'s `can_self_publish`/`can_edit_copy`/
  `account_status` field comments, `models/moderation.py`'s
  `ModerationAction` ladder-related entries, `core/security.py`'s
  ban/suspend checks, `main.py`'s original field-add block, `api/articles.py`'s
  publish/edit-of-published trust checks, `api/admin.py`'s section header,
  `api/auth.py`'s login ban check, `schemas/auth.py`'s `UserResponse` field
  comment) — each edit explains which half of the concept is genuinely
  superseded (the enforcement-ladder/rank-check half) versus which half is
  still the original, unchanged mechanism (the `can_self_publish`/
  `can_edit_copy` booleans themselves, not yet cut over to read from
  `delegation_grants` by any phase). Two references were deliberately **left
  unchanged** as still-accurate, per this phase's own instruction to leave
  concepts the new spec doesn't touch: `services/trust.py` and
  `api/self_publish.py`'s `CONTENT_PLATFORM.md §3.2` citations (self-publish
  eligibility calculation, untouched by any phase), and
  `models/moderation.py`'s `§8` docstring citation and `models/copy_override.py`/
  `api/copy.py`'s `§12` citations (GDPR/DSA audit-log purpose and the
  editable-site-copy feature itself — both genuinely unrelated to the
  roles/entities/rank model).
- **Stale `backlog/`-path / bare `final-spec.md` citations in Phases 1–5's
  own new code** (a real, separately-flagged risk this phase's kickoff
  named) — fixed repo-wide across `rootlink/backend/app/`,
  `rootlink/backend/tests/`, and `rootlink/frontend/` (`lib/`, `components/`,
  `app/`, excluding `.next/`): every comment/docstring citing
  `backlog/user-roles-permissions/...` or bare `final-spec.md`/`assessment.md`/
  `roadmap.md`/`phase0-decisions.md` now points at
  `docs/roles-permissions/...`. Two near-misses caught and corrected before
  finalizing: (1) `app/services/roles_migration.py`'s `reason=` string passed
  to `log_moderation(...)` is **runtime audit-log data**, not a comment —
  reverted to its original text (`"phase0-decisions.md (b) mapping rule"`)
  rather than rewritten, since this phase's guardrail is comments/docs only;
  (2) `app/entity/convert/page.tsx`'s rendered help text (a `<p>` citing
  `final-spec.md §2`) is **end-user-visible UI copy**, not a code comment —
  also reverted to its original text for the same reason, left as a flagged
  pre-existing rough edge (citing an internal spec filename in user-facing
  copy) rather than something to silently "fix" by changing UI text in a
  docs-only phase.
- **`CONTRIBUTING.md`** — its `backlog/user-roles-permissions/contributor-guide.md`
  link updated to `docs/roles-permissions/contributor-guide.md`, and the
  "(not-yet-implemented)" qualifier removed.
- **`contributor-guide.md` rewritten** where it claimed the target design
  "is not implemented yet" / "the live codebase today still runs the older
  5-role system" — both false now. Reframed to state the design is
  implemented and live, the closed-bug section rewritten in the past tense
  with a pointer to the closure proof test, and the "source of truth" /
  "propose a change" sections updated to reflect a real spec with real code
  behind it (drift between spec and code is now a bug, not just a docs gap)
  rather than a pre-implementation design doc. Structure (core concepts,
  where the source of truth lives, how to propose changes) preserved as
  instructed.
- **`platform-user-guide.md`**'s top-of-file draft note rewritten to
  distinguish two separate facts that were previously conflated: the
  **system** it describes is implemented and live (not the same as
  "not yet live"), while the **document itself** hasn't been published to
  an actual help-center page yet (a separate, non-engineering task — a
  writing/publication decision, not a sign of unfinished engineering work).
- **`TECH_DEBT.md` §0 cross-references confirmed and fixed**: its
  `backlog/user-roles-permissions/roadmap.md` and bare `final-spec.md`
  path references updated to `docs/roles-permissions/...`; its claim that
  the frontend half of the `super_admin` bug was "a separate, not-yet-done
  follow-up" was also corrected — Phase 3's own record (above) shows the
  frontend half (12 sites: `NavBar.tsx`, `MobileNav.tsx`, 4 `/learning`
  pages, `events/[id]/page.tsx`) was fixed in the same phase, not left open.
- **Verification:** repo-wide grep for `final-spec.md` and
  `backlog/user-roles-permissions` after all edits returns exactly one
  remaining hit — the deliberately-reverted `app/entity/convert/page.tsx`
  UI-copy line above (flagged, not silently left; out of scope for a
  docs/comments-only phase since fixing it means editing rendered
  application text). Everything else — this folder's own internal links,
  `CONTRIBUTING.md`, `TECH_DEBT.md`, and every backend/frontend code comment
  — resolves to the new `docs/roles-permissions/` location.
- **Backend tests: 213 passing**, unchanged from Phase 5 (confirms this
  phase's edits are genuinely comment/doc-only). Frontend `tsc --noEmit` and
  `next lint` both re-verified clean.
- Neither dev server was touched this phase (no code changes to restart
  for, per the guardrail) — this file, and this whole phase's guardrail
  compliance, was verified without restarting or rebuilding anything.

## Post-implementation fixes (found via real usage, after Phase 6)

Found by the product owner actually using the app after all 6 phases
shipped — logged in as the migrated `e2e-editor-test@example.com`
super admin, they noticed the admin Users table displayed their own
role as "user" despite having full access (see below), and separately
that logging out while on an admin page didn't actually remove access to
it. Both are real, now-fixed gaps — recorded here since they directly
affect how much the Phase 2/4 work (session revocation, force-logout, ban,
suspend, restrict) actually holds up in practice, not just in tests.

**1. Admin Users table couldn't display/select `super_admin`** —
`app/admin/users/page.tsx`'s `ROLES` array (`["user", "contributor",
"moderator", "admin"]`) predates the `super_admin` role and was never
updated — a `<select value={u.role}>` with no matching `<option>` silently
falls back to displaying the *first* option, so the one real super admin's
row showed "user." Beyond cosmetic: interacting with that dropdown and
saving would have silently demoted them for real. Fixed by adding
`super_admin` to the array, a new `"amber"` badge color, and the missing
`role_super_admin` translation key (also fixed 4 other missing header
translation keys found in the same file: `user_name`, `user_email`, `role`,
`actions`, which were rendering as raw `ADMIN.*` keys). Confirmed
pre-existing (`git diff`/`git log` on this file and `messages/{pt,en}.json`
show zero changes from any of Phases 0–6) — live-verified via Playwright
against the running dev server; the affected row now correctly shows
"super admin."

**2. Logging out (or a session becoming invalid mid-use) didn't force any
navigation, so an already-open admin page kept showing data indefinitely.**
Root cause, three independent, compounding gaps, all pre-existing (same
`git diff` confirmation): `logout()` only cleared state, never navigated;
`AdminSidebar` checked auth once on mount via its own disconnected copy of
`user` (not the shared `useAuth()` context), so it never noticed a logout
happening elsewhere; and `lib/api.ts`'s shared `request()` had no global
401 handling, so individual pages (e.g. `app/admin/plants/page.tsx`, which
does zero auth checking) either kept showing stale data or threw an
"Unhandled Runtime Error" for whichever specific action first tried a new
API call. **Not a localhost-only quirk** — pure client-side architecture,
identical behavior in production. Fixed: `logout()` now does a hard
`window.location.href = "/"`; `request()` dispatches a
`rootlink:session-invalid` window event on any 401 where a token *was*
sent (never on plain login/register attempts, which send none), without
throwing (a real page-unload is imminent, so there's nothing for the
individual caller to do with a rejection — throwing anyway was tried first
and confirmed, via the same Playwright reproduction, to still surface the
"Unhandled Runtime Error" racing against the correct redirect);
`auth-context.tsx` listens for that event and calls the same `logout()`;
`AdminSidebar` now reads `useAuth()` instead of its own copy. Full detail
and the exact reproduction/verification method: `docs/LESSONS.md` #34.
This is also what makes the Phase 2/4 force-logout/ban/suspend/restrict
endpoints actually take effect in real time on an already-open tab, not
just on the next fresh page load — that gap existed silently until this
fix, for all six shipped phases.

Both fixes: local, uncommitted, `tsc --noEmit`/`next lint` clean, 213
backend tests still passing (backend untouched — both are frontend-only),
neither dev server restarted (frontend hot-reloaded; no backend changes).

## Post-Phase-6 product decisions (2026-07-04): professional entities never
## get promote/demote; entity conversion self-service + rank-cap + mandatory
## live preview

Two final product decisions (`phase0-decisions.md` Addendum 5), closing two
previously-flagged open items (Addendum 3's professional-team-schema gap,
`UI_BUILD_BACKLOG.md`'s professional-promote/demote and
entity-registration-vs-conversion rows).

**Decision 1 — verification only, no code fix needed.** Confirmed (not
assumed) that professional entities already had no path to entity-scoped
promote/demote: `role_requests.py` already blocked
professional/individual-scoped requests (Phase 4); professional-kind users
never get an `entity_id`, so `/entity/[entityId]/team` is structurally
unreachable (no URL to build); no dangling UI link exists anywhere in the
frontend that would offer this path and then fail. New tests
(`tests/test_roles_decisions_professional_no_team_workflow.py`, 5 tests)
prove this with real requests, not just code-reading. Doc-only changes:
`ROLES_PERMISSIONS.md` §3/§6 revised to state this outright (workflow is
`organization`-only) instead of describing professional's admin as
"self-exempt" from a rule it never actually reaches; `role_requests.py`'s
own comments updated from "flagged gap, future phase decides" to "decided,
permanent" (comment-only — the enforcement code itself is unchanged).

**Decision 2 — entity conversion is self-service only (confirmed), a new
`professional` → `individual` direction was built, the rank rule changed
for `individual` ↔ `professional`, and a mandatory live preview + consent
gate was added:**

- **Self-service only, confirmed by reading the code + a new test**
  (`test_conversion_ignores_any_user_id_in_payload_acts_on_caller_only`):
  no `user_id` parameter anywhere in `entity_conversion.py`/its schemas —
  every conversion always acts on the authenticated caller.
- **New direction:** `professional` → `individual` — new service function,
  new `POST /api/entity-conversion/to-individual` endpoint, new registry
  action `entity.convert_professional_to_individual`
  (`entity_scoped_actions()` 43→44, `REGISTRY` 67→68).
- **Rank rule changed for `individual` ↔ `professional` only** (replacing
  "always resets to persona(1)"): preserved as-is if it fits the
  destination's ceiling, else capped DOWN to that ceiling.
  `professional` → `organization`'s bootstrap-to-super-admin(5) logic is
  untouched, per instruction — a different case (founding a brand-new
  entity), not a rank comparison.
- **New mandatory live preview endpoint:**
  `GET /api/entity-conversion/preview?to=individual|professional` —
  read-only dry-run computing the caller's REAL current + projected state
  (rank, entity, `is_verified`, `can_self_publish`, `can_edit_copy`,
  `email_verified`, etc.), shared logic with the real conversion so the two
  can't drift apart.
- **Frontend (`app/entity/convert/page.tsx`, rewritten):** the
  individual→professional and new professional→individual sections now
  require loading the live preview, reviewing a real comparison table, and
  checking an explicit confirm checkbox before the convert button enables.
  `professional` → `organization` keeps its original static messaging
  (unchanged, out of scope for the preview endpoint per the briefing).
- **Live-verified via Playwright** against the already-running dev servers
  (`:8001`/`:3001`, backend restarted per `docs/LESSONS.md` #5 since this
  session changed backend code, frontend left running throughout): a real
  rank-4 (admin) professional test user converting to individual correctly
  showed Admin → Contributor in the live comparison (capped, not reset to
  Persona), confirm button disabled until the checkbox was checked, and
  confirming produced rank 2 server-side; a rank-2 individual converting to
  professional correctly showed Contributor → Contributor (preserved).
  Screenshots taken; test users removed afterward.

**Backend tests: 213 → 233** (20 new: 15 in
`tests/test_roles_decisions_entity_conversion_v2.py`, 5 in
`tests/test_roles_decisions_professional_no_team_workflow.py`), all
passing. `tsc --noEmit`/`next lint` both clean.

Files changed: `app/core/permissions_registry.py`,
`app/services/entity_conversion.py`, `app/api/entity_conversion.py`,
`app/schemas/entity.py`, `app/services/role_requests.py` (comments only),
`tests/test_permissions_registry.py`,
`tests/test_permissions_registry_endpoint.py` (hardcoded count updates),
plus the 2 new test files above; `frontend/lib/api.ts`,
`frontend/app/entity/convert/page.tsx` (rewritten),
`frontend/app/profile/page.tsx` (one line of link-out copy). Docs:
`ROLES_PERMISSIONS.md` (§3, §6), `phase0-decisions.md` (Addendum 5),
`UI_BUILD_BACKLOG.md` (two rows closed), this file.

## New files this work has created (not yet committed)

Backend (Phases 1–3): `app/models/entity.py`, `app/models/session.py`,
`app/models/auth_tokens.py`, `app/core/permissions_registry.py`,
`app/core/permissions.py`, `app/core/entity_resolution.py`,
`app/services/roles_migration.py`, `app/services/sessions.py`,
`app/api/auth_security.py`, `app/api/permissions.py`, plus 8 test
files (`test_phase1_roles_migration.py`, `test_permissions_registry.py`,
`test_permissions_registry_endpoint.py`, `test_phase2_sessions.py`,
`test_phase2_auth_security.py`, `test_phase3_entity_resolution.py`,
`test_phase3_rank_at_least.py`, `test_tech_debt_0_super_admin_closure.py`).

Backend (Phase 5, this session): `app/services/entity_registration.py`,
`app/services/entity_documents.py`, `app/services/document_storage.py`,
`app/services/delegations.py`, `app/services/entity_team.py`,
`app/api/delegations.py`, plus 5 test files
(`test_roles_phase5_entity_registration.py`,
`test_roles_phase5_entity_documents.py`, `test_roles_phase5_delegations.py`,
`test_roles_phase5_team_roster.py`,
`test_roles_phase5_role_requests_listing.py`).

Frontend (Phase 5, this session): `app/entity/register/page.tsx`,
`app/entity/convert/page.tsx`, `app/entity/[entityId]/page.tsx`,
`app/entity/[entityId]/team/page.tsx`,
`app/admin/entity-verification/page.tsx`.

Backend (Phase 4, this session): `app/models/role_request.py`,
`app/services/entity_conversion.py`, `app/services/entity_dissolution.py`,
`app/services/entity_cascade.py`, `app/services/role_requests.py`,
`app/services/audit_sampling.py`, `app/api/entity_conversion.py`,
`app/api/entities.py`, `app/api/role_requests.py`, `app/schemas/entity.py`,
plus 7 test files (`test_roles_phase4_restriction.py`,
`test_roles_phase4_ban_anonymization.py`,
`test_roles_phase4_entity_conversion.py`,
`test_roles_phase4_entity_dissolution.py`, `test_roles_phase4_cascade.py`,
`test_roles_phase4_role_requests.py`, `test_roles_phase4_audit_sampling.py`).

Frontend (Phase 3 — untouched Phases 4–5 until now): `lib/use-permission.ts`
(Phase 5 extended it — real entity_kind/rank/entity_id + `my()`, see Phase
5's own entry above).

Modified (existing files, all changes additive or precisely-scoped — see
above): `main.py`, `models/user.py`, `models/__init__.py`,
`models/moderation.py`, `models/entity.py`, `models/event.py`,
`schemas/auth.py`, `schemas/moderation.py`, `schemas/entity.py`, `api/auth.py`,
`api/users.py`, `api/admin.py`, `api/articles.py`, `api/content.py`,
`api/events.py`, `api/feeds.py`, `api/groups.py`, `api/learning.py`,
`api/marketplace.py`, `api/plants.py`, `api/taxonomy.py`, `core/security.py`,
`api/entities.py`, `api/role_requests.py`, `services/role_requests.py`,
`services/entity_dissolution.py` (Phase 5 additions — new routes/functions
alongside Phase 4's, nothing removed),
`test_permissions_registry.py`, `test_permissions_registry_endpoint.py`
(Phase 4 — updated hardcoded registry counts, see Phase 4's own entry
above), `NavBar.tsx`, `MobileNav.tsx`, 4 `/learning` pages,
`events/[id]/page.tsx` (Phase 3), `lib/api.ts` (Phase 5 — new `entities`/
`delegations`/`roleRequests`/`entityConversion` sections appended, nothing
existing changed), `AdminSidebar.tsx` (Phase 5 — one new nav link),
`app/profile/page.tsx` (Phase 5 — two new link-out cards in the settings
tab).

Repo docs updated as part of this work: `TECH_DEBT.md` (§0 resolved),
`docs/LESSONS.md` (+7 entries: #26 rename-with-compat-shim pattern, #27
shared rate-limiter state across the pytest process, #28 the
localStorage-seeding Playwright race, #29 a stray pre-Phase-4 unused DB
column found while verifying migrations, #30 enforcement-hide vs.
admin-visibility-flag as separate axes on the same row, #31 FastAPI
literal-path-vs-catch-all route ordering, #32 `networkidle` hangs on this
app's live pages), `ROLES_PERMISSIONS.md` (§9 gained a "Phase 5 surfaces"
sub-table).

## If you're resuming this cold

**All 7 phases (0–6) are done.** This is the complete record — there is no
"next phase" to pick up from this doc.

**If you're here to continue closing UI gaps** (the product owner is
manually testing and wants full UI coverage before continuing): skip
straight to `UI_BUILD_BACKLOG.md`'s **"Next steps (handoff)"** section at
the bottom — it has the current state and the remaining work.
**P0, P1 and P2 are now built too** ("UI backlog batches 1+2+3",
2026-07-04 — restrict/suspend/ban ladder, session revoke x2, password
reset x2, trusted-publisher grant/revoke x2,
`product.manage_any`/`event.manage_any`, delegation auto-void stopgap
badge, comment edit (`PATCH /api/comments/{id}` + inline edit UI),
`event.archive` (`/admin/events`), `notification.send_to_entity_members`
(entity-scoped broadcast + team-page card), plus a latent `group.archive`
gate fix (rank-only `require_super_admin` → registry `can()`, see
`docs/LESSONS.md` #38); backend suite now 295 passing), on top of the
earlier `compost_listing.*` and `article.review`/`article.approve`
builds (also 2026-07-04). What remains is P3 plus a deferred
delegation-enforcement session and the entity-scoped
`user.restrict_suspend_ban_lift` roster surface; the
combined-production-deploy-vs-continue decision is pending with the
product owner. Don't re-derive this from chat history; it's already
written down there.

If you're here to extend or modify the system for some other reason, not
resume the UI backlog specifically:

1. Read this file, then `phase0-decisions.md` (for *why* things were built
   the way they were — several real judgment calls are documented there and
   in code docstrings, not just in this status doc, across Addenda 1–5).
2. Confirm current state matches this doc: `python -m pytest -q` in
   `rootlink/backend` should show 295 passed (213 through Phase 6, +20 from
   the post-Phase-6 conversion/rank-cap/preview work — see that dated entry
   above — and +62 from the 2026-07-04 UI backlog batches 1+2+3, recorded
   in `UI_BUILD_BACKLOG.md`); `tsc --noEmit`/`next lint` in
   `rootlink/frontend` should both be clean. This folder itself should be at `docs/roles-permissions/` (tracked
   in git), not `backlog/` — if you find a `backlog/user-roles-permissions/`
   folder with real content in it again, that's a regression of this
   phase's own promotion, not a second copy to trust.
3. Real, flagged gaps/judgment calls that were never fully closed (none of
   them are bugs, all are documented product/scope decisions a future
   session may need to revisit): the registration-vs-conversion **UX
   overlap** for professional→organization (two live entry points, no
   explanatory copy distinguishing them — NOT the same thing as the
   self-service-only question, which Addendum 5 closed); delegation
   auto-void not wired into demotion; the new Phase 5 pages' English-only
   copy (no i18n yet); `can_self_publish`/`can_edit_copy` never actually cut
   over to read from `delegation_grants` (the booleans remain authoritative)
   — see `phase0-decisions.md` Addenda 3–5 for full reasoning on all of
   these. **Closed since Phase 6** (do not re-open without a new product
   decision): `professional` entities having no "team" schema — confirmed
   permanent/by-design, not a pending gap (Addendum 5).
