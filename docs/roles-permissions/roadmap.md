---
type: Note
_width: wide
---

# User Roles & Permissions — Implementation Roadmap

> **Status:** Proposed roadmap — not started.
> **Based on:** `ROLES_PERMISSIONS.md` (target) + `assessment.md` (gap analysis).
> **Format:** mirrors `docs/content-platform/CONTENT_PLATFORM.md` §11, the precedent for how the last major subsystem here was phased and shipped.

This is a migration against a **live, deployed application**, not a
greenfield build — the code and running system are real, and this work
still has to be done with normal engineering discipline: careful review,
no half-shipped states, and sequencing that doesn't leave the app broken
mid-phase. But the *data* currently in that system is disposable test/seed
data created for evaluation — **confirmed by the product owner: no real
users, content, or organizations exist in production today** (see
`assessment.md` §1, §3.3). That means the historically riskiest part of a
migration like this — protecting real people from being locked out, and
real records from being lost or corrupted mid-migration — simply isn't a
concern here. The phases below still make the underlying design decisions
correctly (mapping rules, schema shape, enforcement logic) because real
users, organizations, and practitioners will exist eventually and this
logic has to be right for them — they just don't need the extra
parallel-run/dual-write scaffolding a live-data migration would otherwise
require.

---

## Phased implementation & migration plan

**Phase 0 — Decisions & design sign-off (no code)**
- **(a) DB migration strategy.** Decide: finally reconcile Alembic (backfill
  revisions), or continue the existing idempotent-`ALTER TABLE`-in-`main.py`
  pattern (`docs/LESSONS.md` #10) for this migration too. Given the scale
  here — new tables, renamed-meaning columns, data backfill — recommend
  settling this explicitly rather than defaulting to habit; it determines how
  every phase below is actually implemented. (No real data is at stake
  either way — this is about picking the right long-term mechanism, not
  de-risking a live cutover.)
- **(b) The exact old→new mapping table** — a design decision to make once,
  cleanly, and validate against test/seed data (`assessment.md` §3.3), not a
  review against real production rows, since none exist. Must still
  explicitly resolve, correctly, because real users will eventually run
  through this same logic: the `practitioner` ambiguity (default rule based
  on `entity_type`/services/certifications for deciding `professional` vs.
  `partners`/`suppliers`); the `organization` backfill (rule for choosing
  each org's first super admin — no "who's in charge" field exists today);
  the admin-with-`individual`-`account_type` conflict (decide whether every
  current staff `admin`/`super_admin` is actually `entity=platform`
  regardless of what `account_type` says); and accounts whose rank was
  deliberately held back to dodge the live `super_admin` bug (`TECH_DEBT.md`
  §0) — identify these and assign their *intended* rank, not their literal
  current `role`.
- **(c) Ratify the enforcement-ladder decision.** `ROLES_PERMISSIONS.md` §4 has
  already restored the Restriction rung and ban-anonymization — the open
  question in `assessment.md` §6.1/§9(c) is resolved in the spec itself.
  This phase's job is sign-off that this is final, plus one remaining
  implementation decision: Restriction as a new `account_status` enum value,
  or a separate flag layered on top of the existing 3-state field.
- **(d) Sign off on the permissions-registry design** — exact shape (Python
  dict vs. DB table), where it lives, and how backend, frontend, and tests
  all consume it, before any endpoint is touched.
- **(e) Session/token revocation mechanism** — allowlist/denylist table vs.
  short-lived-token-plus-refresh vs. another approach.
- **(f) `entity_type` column rename** — resolve the naming collision with
  ROLES_PERMISSIONS.md's "entity" concept (e.g. rename to `organization_kind`)
  before both exist in the same table under confusingly similar names.
- **(g) Verification-badge modeling** — how "Verified user," "Verified
  professional," and "Verified organization/practitioner" map onto fields,
  given today's single `is_verified` boolean can't represent three concepts.
  This gates correct rank assignment in Phase 1, so it must be settled
  before (b)'s mapping table is finalized.
- **(h) Periodic audit-sampling process** for self-approved promotions at a
  capped entity's top rank — cadence, reviewer, and what triggers a sample.
- **(i) Primary-contact and delegation UI ownership** — which team owns the
  entity-scoped "manage my team" surfaces vs. the platform-wide admin panel.
- **Output:** a written decision record (this file, or a companion note in
  this folder) with all nine items signed off. No code changes in this phase.

**Phase 1 — Data model & migration**
- No real users to protect during this migration (`assessment.md` §1/§3.3),
  so the original two-phase split — additive-only schema first, then a
  separate parallel-run/dual-write migration phase once the new fields were
  proven safe — is unnecessary caution here. Schema changes and populating
  them for existing (test/seed) accounts happen together, directly, in one
  phase.
- Schema, using whichever mechanism Phase 0(a) decided:
  - New `entities` table (backs `organization`/`partners`/`suppliers` only —
    `individual`/`professional`/`platform` don't need a row): id, entity
    type, name, verification status, verified_at/by,
    `primary_contact_user_id` (nullable), `tax_registration_id` + scheme,
    created_at, `dissolved_at`, `dissolution_grace_expires_at`.
  - `entity_id` FK + rank column on `User` (per Phase 0(f)'s rename) — the
    FK-on-User approach per `assessment.md` §3.2, not a join table, matching
    the explicit "one entity per user" constraint (no speculative
    multi-entity support).
  - `delegation_grants` table — grantor_id, grantee_id, entity_id (nullable
    = platform-wide), action (references the Phase 2 permissions registry,
    not a free string), granted_at, revoked_at, revoked_reason.
  - Promote/demote request/approval table — requester, target user, entity,
    from-rank, to-rank, status (pending/approved/rejected), approver,
    reason, timestamps.
  - Extend `ModerationAuditLog`/`ModerationAction` rather than building
    bespoke tables for entity lifecycle events: add `convert_entity`,
    `dissolve_entity`, `cascade_hide`/`cascade_restore`,
    `grant_delegation`/`revoke_delegation`,
    `promote_request`/`promote_approve`/`promote_reject` (+ demote
    equivalents, completing today's dead-code `demote` placeholder),
    `assign_primary_contact`. Convert the `action` column from a free
    `String(50)` to a real enum FK in the same pass, closing the existing
    free-text leak into audit logs.
  - Rename `registration_number` → `tax_registration_id` (+ a
    scheme/country indicator column), per ROLES_PERMISSIONS.md's generalization
    beyond NIF.
  - New verification field(s) per Phase 0(g)'s sign-off.
  - New baseline-rule fields/tables: `email_verified`, a password-reset
    token table, and the session allowlist/denylist table (per Phase 0(e)).
- Migration, executed directly against today's test/seed accounts using
  Phase 0(b)'s signed-off mapping table — not a blanket mechanical script,
  since the mapping rules (`practitioner`, `organization` backfill, the
  admin-with-`individual`-`account_type` conflict) still need to be applied
  correctly, per `assessment.md` §3.3:
  - Migrate every existing user onto `entity_id` + rank per the mapping
    table.
  - Migrate `can_self_publish`/`can_edit_copy` data into `delegation_grants`
    as its first two rows, rather than left running as parallel special
    cases.
  - Validate against the (test/seed) DB post-migration — specifically
    checking no user lands in an invalid (entity, rank) combination — and
    run the Phase 2 registry-generated test suite against the migrated
    data as an acceptance gate before proceeding to Phase 3.

**Phase 2 — Backend enforcement core**
- Build the permissions registry as a real code artifact per Phase 0(d):
  `action → { minimum_rank, entity_scope, delegable, notes }`, encoding
  `ROLES_PERMISSIONS.md` §7, §8, and §10's tables.
- Build the single rank/entity-check helper every future check reads from —
  including **entity precedence** (`platform` always overrides, §3) as an
  explicit, separately-implemented and separately-tested rule, not inferred
  from comparing rank numbers across entities. This is the same bug shape
  as the live `super_admin` gap, one level up — it must not be reintroduced
  by accident here.
- Wire the auto-void-on-demotion/suspension/ban/departure rule for
  delegation grants into this same helper — a stale grant must fail at the
  query layer, not rely on remembering to clean it up at the app layer.
- Implement session/token revocation (Phase 0(e)), force-logout, email
  verification, and self-service password reset as new, standalone
  endpoints — prerequisites for the rank-1 "Persona" definition and for
  demotions/suspensions/bans to actually take effect mid-session rather
  than at next token expiry.
- Do **not** touch any existing endpoint's authorization logic yet. This
  phase produces the engine — unused by production traffic, aside from the
  new opt-in email-verification/password-reset/force-logout endpoints,
  which are additive and don't touch any existing check.
- Generate the table-driven/property-based test suite directly from the
  registry's own tuples (one generated loop, not ~360+ hand-written
  per-combination assertions) — including a dedicated entity-precedence
  test category, per `assessment.md` §8.

**Phase 3 — Endpoint cutover**
- Migrate existing endpoints off hand-typed role checks onto the Phase 2
  registry-driven helper, **module by module** (mirroring how
  `CONTENT_PLATFORM.md` §11 phased its own work) — articles, events, groups,
  products, courses, comments, plants, admin user-management, etc., each its
  own reviewable slice.
- Prioritize the cutover order by the 8 files / 23+ sites `TECH_DEBT.md` §0
  already names as having the `super_admin`-not-superset bug — this is
  where that bug actually gets fixed, permanently, because every endpoint
  now derives its answer from one artifact instead of re-typing it. Record
  the bug's closure explicitly once every named site is verified against
  the registry, rather than assuming a rewrite fixed it.
- Frontend mirror of the same cutover: build the single entity-aware
  `usePermission(action, { entityId })` hook (consuming the same registry —
  shared/generated artifact or fetched, not hand-reimplemented in
  TypeScript) and migrate every existing hand-rolled check (`isStaff` in
  `NavBar.tsx`/`MobileNav.tsx`, `/learning` pages, `AdminSidebar.tsx`'s
  `isAdmin`/`isSuperAdmin` derivations, per-page ownership checks) onto it
  in the same pass — not left running in parallel with a new system
  half-adopted.
- A module only counts as "cut over" once both its backend checks and its
  frontend checks are on the registry.

**Phase 4 — New enforcement ladder + audit**
- Ship Restriction as a real, distinct rung (full access retained; future
  content forced back to `in_review` regardless of any trusted-publisher
  badge) — per Phase 0(c)'s ratified decision, not a badge toggle.
- Ship ban anonymization (`created_by` → tombstone, GDPR Art. 17) — verified
  against existing GDPR/erasure regression tests with no coverage reduction.
- Ship entity conversion (`individual`→`professional`,
  `professional`→`organization`) with its audit trail, rank reset to
  `persona`, and non-carry-over of badges.
- Ship entity dissolution with its 30-day reversible-archive grace period,
  its `dissolve_entity` audit action, and the platform-super-admin-approval
  gate — resolving, before shipping, the open compliance questions
  `assessment.md` §7 flags: whether the archive window conflicts with an
  independent erasure request from a former member during those 30 days,
  and applying the same "hidden good enough for erasure" standard used for
  ban/anonymization to cascade-hidden content, for consistency.
- Ship the cross-entity ban cascade (soft-hide of a banned/dissolved
  entity's own contributed footprint only, never the host entity's primary
  content), reversible within the same grace window.
- Ship the promote/demote request/approval workflow: submit/approve/reject
  endpoints; the self-approval exemption (super admin; a capped entity's
  top rank) as a registry flag rather than a scattered `if`; and
  separation-of-duties enforcement at the request-processing layer
  (reject `requester_id == approver_id`) independent of rank checks.
- Stand up the periodic audit-sampling process per Phase 0(h)'s cadence/
  reviewer decision — a real, staffed process, not just a data-model hook.
- Wire delegation-grant logging and the primary-contact team-roster action
  (`assign_primary_contact`) into the audit log, even though the latter
  isn't itself a rank elevation.

**Phase 5 — New UI surfaces**
- Entity registration/verification flow: self-service registration for
  `organization`/`partners`/`suppliers` + the full document-upload +
  human-review verification flow (upload storage, a staff-facing review
  queue with approve/reject/request-more-info) — now in v1 scope rather
  than deferred, since there are no already-verified real organizations to
  grandfather (`assessment.md` §10a). This replaces today's bare
  `is_verified` toggle with actual proof-based verification, not another
  manual admin toggle.
- Entity-scoped "manage my team" panel — an organization's own super admin
  managing members/ranks, and a partners/suppliers primary contact managing
  their team roster — visually and architecturally distinct from
  `/admin/*`, per the entity-precedence rule.
- Promote/demote request + approval UI: submit a request, see pending
  approvals awaiting you, approve/reject with a reason.
- Delegation-grant UI: grant/revoke a specific action to a specific user
  ID, scoped to actions the registry marks `delegable`.
- Entity conversion UI: eligibility check, explicit "what's lost" messaging
  (rank resets, badges don't carry over), confirmation step for a one-way,
  consequential action.
- Entity dissolution UI: confirmation + a visible grace-period/reversibility
  indicator; request+approval shape, plausibly reusing the promote/demote
  UI pattern.
- Extend `ROLES_PERMISSIONS.md` §9's page-visibility table to reflect
  entity-vs-platform scoping for the new surfaces shipped above (an
  organization's own admin panel, the primary-contact panel) — scoped to
  what this roadmap actually ships; exhaustive re-coverage of every
  existing `/admin/*` sub-element is not a blocker for this phase (see
  Deferred, below).

**Phase 6 — Documentation & doc reconciliation**
- Add a formal superseding note at the top of `CONTENT_PLATFORM.md` §3 and
  §4 pointing at `ROLES_PERMISSIONS.md`, mirroring the pointer `ROLES_PERMISSIONS.md`
  already carries back at it. `CONTENT_PLATFORM.md` is **not deleted** — it
  remains the historical record of the shipped Phase 0–6 content-platform
  work (`IMPLEMENTATION_STATUS.md`).
- Audit and update every code comment citing a `CONTENT_PLATFORM.md` section
  number — confirmed present in `user.py` (the `can_self_publish` and
  `account_status` field comments citing §3/§4.4) and `moderation.py`'s
  docstring (citing §8/§12) — so a future reader doesn't chase a reference
  into a section that's since been superseded.
- Once implemented, promote `ROLES_PERMISSIONS.md` out of `backlog/` into a new
  `docs/roles-permissions/` folder, following the existing
  `docs/content-platform/` spec+status(+mockups) pattern: the spec, a new
  `IMPLEMENTATION_STATUS.md`-equivalent tracking this roadmap phase by
  phase, and any mockups produced during Phase 5.
- Publish the end-user help guide (`platform-user-guide.md`) for real — it
  currently exists only as an unpublished draft in this folder.
- Confirm `TECH_DEBT.md` §0's closure is recorded (cross-referenced from
  Phase 3) once every named site has been verified against the registry.

---

## Deferred / not in this roadmap

- **True multi-entity native membership** (a single account holding
  independent rank in more than one entity at once) — explicitly deferred
  by `ROLES_PERMISSIONS.md` §3 pending real usage data; delegation covers the
  common "multiple hats" case without it.
- **Named permission bundles** (e.g. "Content Ops" = manage articles +
  manage events) — `ROLES_PERMISSIONS.md` §10 explicitly defers this past v1;
  one-off action-by-action delegation is fine at current scale, and
  "delegation sprawl" is a tracked future concern, not a v1 requirement.
- ~~Document-upload + human-review verification~~ — promoted into Phase 5,
  see `assessment.md` §10a.
- **Exhaustive completion of the page/UI visibility spec** beyond the
  top-level surfaces and the new surfaces this roadmap ships (every
  existing element inside the Admin Panel, per `ROLES_PERMISSIONS.md` §9's own
  "covers top-level surfaces today" caveat and `assessment.md` §5.3) — real,
  necessary work, but scoped as its own follow-up pass rather than a
  blocker for the core rank/entity/delegation machinery.
- **Automated/legal-grade validation of "national tax/business
  registration ID" formats** beyond Portugal's NIF — the field is
  generalized in the data model (Phase 1) so it isn't hardcoded, but
  building out validation for other countries' schemes waits until the
  platform actually expands beyond Portugal.
- ~~Retroactive re-audit of already-closed/self-approved historical
  actions~~ — no longer applicable: with no real historical user activity
  predating this design, there is nothing to retroactively re-audit
  (`assessment.md` §10).
- **Legal sign-off on the upload liability-shift disclaimer** and other
  open items already tracked in `CONTENT_PLATFORM.md` §13 — unrelated to
  the roles/permissions model itself, left where they already are.

---

## Cross-check against assessment.md

Re-skimming the current `assessment.md` section by section against the
renumbered phases above (six phases total, post-merge):

- **§1 Executive summary** — risk #1 (migration mapping) is now explicitly
  framed as lower-stakes (no real users to protect) but still a real design
  decision → Phase 0(b)/Phase 1. Risk #2 (dual-source-of-truth docs,
  unaffected by the no-real-users fact) → Phase 6.
- **§2 framing table** → no standalone action needed; contextual, addressed
  across Phases 1–5.
- **§3.1 field-level gaps** (`role`, `account_type`, `entity_type`,
  `is_verified`, `registration_number`, `account_status`,
  `can_self_publish`/`can_edit_copy`) → Phase 0(f)/(g)/(c) decisions, Phase 1
  (schema + migration, now combined).
- **§3.2 net-new tables** (`entities`, entity-FK+rank, `delegation_grants`,
  conversion/dissolution audit trail, primary-contact designation,
  promote/demote request queue) → Phase 1 (schema), Phase 4/5
  (behavior/UI).
- **§3.3 migration mapping ambiguities** — rewritten in `assessment.md` as a
  design decision validated against test/seed data, not a real-data risk
  exercise → Phase 0(b), executed directly in Phase 1 (no separate dual-write
  phase needed now; **mapping changed**: previously "Phase 0(b), executed in
  Phase 3," now folded into the single Phase 1).
- **§4.1 permissions registry / root-cause bug** → Phase 2 (build), Phase 3
  (cutover + closure).
- **§4.2 auth/session changes** (token revocation, force-logout, email
  verification, password reset) → Phase 2.
- **§4.3 promote/demote approval workflow** (incl. separation of duties,
  audit-sampling) → Phase 1 (table), Phase 0(h) (process decision), Phase 4
  (workflow + endpoints), Phase 5 (UI).
- **§4.4 audit logging extensions** (new action types, `edit_any` dead code,
  free-text `action` column) → Phase 1 (schema), Phase 4 (emission).
- **§5.1 frontend boolean-pattern bug** → Phase 3 (frontend hook + cutover).
- **§5.2 net-new UI surfaces** → Phase 5.
- **§5.3 page-visibility table incomplete** → Phase 5 (scoped pass), rest
  deferred explicitly (see Deferred, above).
- **§6.1 enforcement-ladder gap** (Restriction, ban anonymization) → Phase
  0(c) (ratify), Phase 4 (ship).
- **§6.2 mechanical doc reconciliation** → Phase 6.
- **§7 security/compliance** (GDPR non-regression, dissolution compliance
  questions, delegation privilege-escalation surface, primary-contact
  logging) → Phase 2 (auto-void enforcement), Phase 4 (GDPR tests,
  dissolution compliance decisions, delegation/primary-contact logging).
- **§8 testing implications** (registry-generated test matrix, migration
  correctness, entity-precedence tests, GDPR regression tests) → Phase 2
  (generated suite), Phase 1 (migration validation — now against test/seed
  fixtures rather than a production-DB copy, per §8's own updated framing),
  Phase 2/4 (entity-precedence and GDPR regression coverage).
- **§9 decision checklist (a–i)** → Phase 0, item for item. Item (b)'s
  language softened in `assessment.md` (validated against test/seed data,
  not reviewed against real data) is reflected in Phase 0(b)'s wording
  above; no mapping change, just softer stakes.
- **§10 non-goals** → Deferred section, item for item, with one change:
  the "retroactive re-audit of historical actions" non-goal was **removed**
  from `assessment.md` §10 as moot (no real pre-migration history exists) —
  the Deferred section above reflects this with a struck-through note
  rather than a live bullet (**mapping changed**: previously a real
  Deferred item, now moot).
- **§10a Promoted into scope: document-upload verification** (new section)
  → **Phase 5** (**mapping changed**: this requirement previously didn't
  exist as scoped work — the old assessment deferred it past v1 entirely.
  It's now a Phase 5 UI/backend deliverable, not a Deferred-section entry;
  the Deferred section's document-upload bullet has been replaced with a
  cross-reference to Phase 5 instead).

**Result: the cross-check passed cleanly.** Every finding in the current
`assessment.md` maps to a phase above or to the Deferred section. Two
mappings changed from the prior version of this roadmap (§3.3/§10's
retroactive-re-audit item, both noted above), and one net-new mapping was
added (§10a → Phase 5) — nothing was found unmapped during this pass.
