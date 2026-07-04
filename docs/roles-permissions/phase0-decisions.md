---
type: Note
_width: wide
---

# User Roles & Permissions — Phase 0 Decision Record

> **Status:** Decided — signed off for Phase 1 (first slice) implementation.
> **Scope:** Answers roadmap.md's Phase 0 items (a)–(i). Each decision is
> concrete and final for this implementation pass. Where an item's actual
> *build* is out of scope for the Phase 1 first slice (this session), that is
> stated explicitly — the decision itself is still recorded now so later
> sessions don't re-litigate it.
> **Written:** 2026-07-03, ahead of the Phase 1 first-slice implementation
> (entities table, entity_id + rank on User, delegation_grants table).

---

## (a) DB migration strategy

**Decision: continue the existing idempotent-guarded-`ALTER TABLE`/`create_all`
pattern in `rootlink/backend/app/main.py`'s lifespan. Do not touch Alembic.**

Rationale: Alembic's head is stale/no-op (`docs/LESSONS.md` #10) and
reconciling it is a separate, standalone workstream with its own risk profile
(backfilling revisions against an already-evolved schema). The lifespan
pattern is the *real*, currently-used, currently-tested migration mechanism —
every existing table/column in this codebase got there through it, including
tables at least as complex as what Phase 1 needs (e.g. the `groups` category
NOT NULL → nullable rebuild). There's no reason this migration is
categorically different from those. Alembic reconciliation stays a tracked
TODO (already is, per `docs/LESSONS.md` #10) but is not a prerequisite for
this work.

All new Phase 1 schema (this session): guarded `ALTER TABLE ... ADD COLUMN`,
one guarded `ALTER TABLE users RENAME COLUMN` (see (f)), and `CREATE TABLE IF
NOT EXISTS` / `Base.metadata.create_all` for the two new tables, added to the
existing lifespan block in `main.py`, following the same
try/except-per-statement idiom already used throughout that file.

---

## (b) Exact old → new mapping table

**Decision, recorded now for whenever the actual data migration happens
(explicitly a *later* phase — this session does not migrate any existing user
row onto the new fields, per the kickoff briefing's scope limit):**

| Old value | New value | Rule |
|---|---|---|
| `account_type = "individual"` | `entity = individual` (no `entities` row) | 1:1, no ambiguity. |
| `account_type = "organization"` | `entity = organization`, gets an `entities` row | Backfill rule for the org's first `super admin`: among all `User` rows that currently share the same `account_type="organization"` **and** the same non-null `service_area`/`name` combination (today's closest thing to "same org" — there is no real linkable org identity yet), pick the one with the highest existing `role` (`super_admin` > `admin` > `moderator` > `contributor` > `user`); ties broken by lowest `id` (earliest-created). That user becomes the new `entities` row's implicit super admin via `entity_id` + `rank=5`. If no such group can be confidently identified (e.g. a single isolated org-type user with no siblings), that user becomes their own org's super admin. |
| `account_type = "practitioner"` | `entity = professional` by default | Default rule: `professional` unless the row's `organization_kind` (renamed `entity_type`, see (f)) is one of the organization-shaped values (`ipss`, `cooperative`, `association`, `cer`, `ministry`, `regulatory`, `adr`, `municipality`, `company`) **and** it has `services`/`certifications` indicating a *platform-relationship* business (accounting/legal/tech-vendor keywords) — in which case map to `partners` instead. `suppliers` is never a default-migration target (no live signal distinguishes "supplier" from "partner" today); any `suppliers` entity is created manually post-migration by platform staff reviewing the ambiguous rows. |
| `role = user/contributor/moderator/admin/super_admin` (global) | `rank = 1..5` within the user's mapped entity | Name mapping: `user`→persona(1), `contributor`→contributor(2), `moderator`→moderator(3), `admin`→admin(4), `super_admin`→super admin(5). **Ceiling-conflict override:** any user whose current `role` is `admin` or `super_admin` is mapped to `entity = platform` regardless of what `account_type` says, because today's flat `role` model only makes sense platform-wide (there is no ceiling below `admin`/`super_admin` in the old model, so any row holding one of those two roles was necessarily acting platform-wide already). This resolves the exact conflict `assessment.md` §3.3 flags (an `admin` with `account_type=individual` has no valid target under the new ceilings table) — the fix is at the entity-assignment step, not the rank step. |
| Rows deliberately held back from `super_admin` to dodge the live bug (`TECH_DEBT.md` §0) | Assign *intended* rank, not literal current `role` | No separate field tracks "intended role" today. Decision: this must be identified manually (a short list, confirmed with the product owner) before the real migration script runs — it cannot be inferred purely from existing columns. Flagged as a manual pre-migration step, not something the mapping *rule* can automate. |

This table is the Phase 0(b) sign-off. **Not executed in this session** — Step
B below is purely additive schema (empty/null new columns/tables); populating
them from existing rows is explicitly out of scope per the kickoff briefing.

---

## (c) Enforcement-ladder ratification

**Decision: ratified as-is.** `ROLES_PERMISSIONS.md` §4's 4-rung ladder (Active /
Restriction / Suspended / Banned) stands; the `assessment.md` §6.1 gap
(Restriction rung, ban anonymization) is resolved in the spec itself, not
reopened here.

**Remaining implementation decision (per roadmap.md's framing of this item):
Restriction becomes a 4th value on the existing `account_status` field**
(`active` / `restricted` / `suspended` / `banned`), not a separate boolean
flag layered on top. Rationale: `account_status` is already a bare,
un-enum-enforced `String(20)` (assessment.md §3.1) — adding a 4th string value
requires no schema change at all (just an application-layer enum extension
whenever `AccountStatus` gets its 4th member), and the four rungs are mutually
exclusive states in practice (a user is in exactly one rung at a time), which
maps cleanly onto a single-value field rather than an orthogonal flag. A
separate boolean would raise "can a user be both restricted and suspended at
once?" — a question ROLES_PERMISSIONS.md's ladder framing implies "no" to (it's a
ladder, not independent switches).

**Not built this session** — no code changes for this item; Phase 1's first
slice (this session) does not touch `account_status` or the `AccountStatus`
enum at all, per the guardrail to leave existing enforcement fields
untouched. This is a decision for whichever future session ships Phase 4.

---

## (d) Permissions-registry design

**Decision: a single Python module (new file, e.g.
`app/core/permissions_registry.py`), not a DB table.**

Shape:
```python
action: str -> {
    "min_rank": int,               # 0-5
    "entity_scope": "platform" | "entity" | "both",
    "delegable": bool,
    "notes": str,
}
```

Rationale: this needs to be reviewable in a PR, versioned in git, and
unit-testable by the table-driven test generator `assessment.md` §8 calls
for — a DB table would need its own admin UI, its own migration, and would
make "is this permission change reviewed" a runtime data question instead of
a code-review question, which reintroduces exactly the kind of
un-auditable-drift risk this whole effort exists to close. It can be
converted to a DB table later if a genuine need for runtime (non-deploy)
editability emerges — not needed for v1.

Consumption: backend imports the module directly for a single
`can(user, action, entity_id=None) -> bool` helper (Phase 2). Frontend
consumes it via a generated JSON/TS artifact exported from the same Python
source at build time (not hand-reimplemented in TypeScript), or a fetched
`/api/permissions/registry` endpoint if build-time codegen proves awkward —
final choice deferred to Phase 2/3 implementation, since it doesn't affect
Phase 1's schema.

**Not built this session** — Phase 2 scope, explicitly out of bounds here.

---

## (e) Session/token revocation mechanism

**Decision: a `sessions` allowlist table** (new table, Phase 2 — not built
this session), not short-lived-token-plus-refresh.

Shape (for Phase 2 to build): `id`, `user_id`, `token_jti` (JWT ID claim,
new), `issued_at`, `expires_at`, `revoked_at` (nullable), `revoked_reason`
(nullable). `get_current_user` checks the token's `jti` against this table
(not-revoked, not-expired) on every request, in addition to today's existing
banned/suspended check.

Rationale: short-lived-access + refresh-token is a bigger auth architecture
change (new refresh endpoint, new client-side token-refresh logic touching
every frontend API call) for a problem this codebase can solve additively —
an allowlist table only adds one more query to the existing
`get_current_user` dependency and needs zero frontend changes (revocation
becomes a server-side, database-driven action platform staff or
demotion/ban/dissolution logic can trigger directly). This matches the
"additive, don't touch the frontend" discipline of this whole engagement
better than a refresh-token redesign would.

**Not built this session** — Phase 2 scope.

---

## (f) `entity_type` column rename — resolved this session

**Decision: rename the existing organization-sub-kind column from
`entity_type` to `organization_kind`** (both the DB column and the Python
model attribute/enum class), while **keeping the external API contract
unchanged** (the `entity_type` field name stays as-is in `RegisterRequest`,
`UserResponse`, and the `/api/users/entities` query param/response, mapped to
the renamed `User.organization_kind` attribute at the API boundary).

Rationale: this is exactly the collision `assessment.md` §3.1/§9(f) flags —
the existing column means "organization sub-kind" (ipss/cooperative/...) while
ROLES_PERMISSIONS.md's "entity" means the 6-value organization/professional/etc.
concept backing the new `entities` table and `User.entity_id`. Having both
`User.entity_type` (old meaning) and a new `User.entity_id`/`entities` table
(new meaning) in the same model under confusingly similar names is exactly
the ambiguity flagged as worth fixing "now, cheaply" (§9(f)'s own framing).
Renaming only the internal column/attribute — not the external API field
name — means this is a true no-op from the frontend's perspective (nothing to
coordinate, no contract change, satisfies "do not touch the frontend") while
still resolving the internal naming collision before `entity_id`/`rank` are
introduced onto the same model in this same change.

**This IS built this session** — see Step B below.

---

## (g) Verification-badge modeling

**Decision:** ROLES_PERMISSIONS.md §2's three verification concepts map onto fields
as follows:

| Concept | Field(s) | Status |
|---|---|---|
| **Verified user** (email OR referral OR org-created) | new `User.email_verified` (bool) + `email_verified_at` (datetime, nullable) | **Not built this session** — Phase 2 (email verification flow doesn't exist yet, per `assessment.md` §4.2). |
| **Verified professional** (NIF + activity reg. number + verified email) | existing `User.is_verified` + `verified_at` **repurposed** to mean this specifically once `User.entity_id` resolves to `entity=professional`; keyed off existing `registration_number` (renamed to `tax_registration_id` + a scheme column in a later phase, per `assessment.md` §3.1 — not this session) | Field reuse decided now; renaming `registration_number` and building the actual verification check is Phase 2+. Not touched this session (guardrail: leave `is_verified`/`registration_number` untouched). |
| **Verified organization/practitioner** (badge, manual-then-document-upload review) | **new** `entities.verification_status` (`pending`/`verified`/`rejected`) + `entities.verified_at`/`verified_by` — replaces `User.is_verified` as the source of truth for `organization`/`partners`/`suppliers` entities specifically (individual-user `is_verified` keeps meaning "Verified professional" per the row above, once that entity type is in play) | **Built this session** — part of the new `entities` table (Step B). |

This resolves the "single boolean can't represent three concepts" gap
(`assessment.md` §3.1) by giving each concept its own field/table, without
touching the existing `is_verified` column's current behavior for any
existing row (it stays a working boolean; its *meaning* for `professional`
users is clarified for future phases, not changed in code this session).

---

## (h) Periodic audit-sampling process

**Decision:** monthly cadence, 10% random sample of self-approved
promotions/demotions at a capped entity's top rank (e.g. `professional`'s
`admin` self-approving), reviewed by the platform's own `super admin` team
(not a separate compliance role — this platform doesn't have one and
inventing one is out of scope). "Flagged for sampling" means: every
self-approved promote/demote action (per §6's exemption) writes an audit-log
row exactly like any other promotion, with no extra flag needed at write
time — the monthly job *queries* the audit log for
`actor_id == approver_id` (or the equivalent self-approval signature) among
promotion/demotion actions in the last 30 days, and pulls a 10% random sample
of those rows for manual review. This means no schema change is needed
beyond the existing audit log recording actor/target/reason (already true).

**Not built this session** — this is a process decision + a future
reporting job (Phase 4), not a schema requirement, so it has no bearing on
Step B's additive tables.

---

## (i) Primary-contact and delegation UI ownership

**Decision:** given this is a single-engineering-track project (no separate
frontend/backend teams to divide ownership between), the entity-scoped
"manage my team" surfaces (primary-contact roster management, entity super
admin's member/rank management) and the platform-wide `/admin/*` panel are
owned by the same workstream but kept **architecturally separate by route
namespace**: platform-wide stays under `/admin/*`; entity-scoped surfaces
live under a distinct `/entity/[entityId]/team`-style namespace (exact route
TBD at Phase 5 build time), never nested inside `/admin/*`. This preserves
the entity-precedence rule's spirit (§3 of ROLES_PERMISSIONS.md: platform always
overrides, but the two contexts must never be visually/architecturally
confusable) without needing a real team-split decision that doesn't apply
here.

**Not built this session** — Phase 5 (frontend) scope, explicitly excluded
from this session ("Do NOT touch the frontend").

---

## Summary: what this session (Phase 1 first slice) actually builds

Only (a)'s mechanism, (f)'s rename, and (g)'s `entities.verification_status`
shape are load-bearing for this session's code changes. (b), (c), (d), (e),
(h), (i) are recorded decisions for future phases and involve **no code
changes** in this pass. See the repo's working tree diff for the concrete
Step B implementation (new `entities` table, `organization_kind` rename,
`entity_id` + `rank` on `User`, new `delegation_grants` table).

---

## Addendum (follow-up session): `User.entity_kind` column + (b) executed

Discovered while actually executing (b)'s mapping rules (this was the next
session's Part A): `entity_id` alone cannot disambiguate a user's entity.
`entity_id IS NULL` is true for **three** different entities —
`individual`, `professional`, and `platform` — each with a different rank
ceiling (ROLES_PERMISSIONS.md §3), and none of them ever gets an `entities` row.
Without a discriminator, "is this null-`entity_id`, rank-4 user a
`professional` admin (valid, professional's ceiling is 4) or an
`individual` who should have been caught by the ceiling-conflict rule
(invalid, individual's ceiling is 2)?" is unanswerable from `entity_id`
alone.

**Resolution:** added `User.entity_kind` (nullable `String(20)`, values from
new `UserEntity` enum in `app/models/entity.py`: `individual` / `professional`
/ `organization` / `platform` / `partners` / `suppliers`) — purely additive,
same idempotent-guarded-`ALTER TABLE` pattern as everything else. This is the
field the `can()` permissions helper (Phase 2, see below) actually reads to
determine a user's entity; `entity_id` is only meaningful (non-null) when
`entity_kind` is `organization`/`partners`/`suppliers`.

**(b) mapping executed** (previously recorded-but-not-run): implemented in
`app/services/roles_migration.py`, called idempotently from `main.py`'s
lifespan. One generalization beyond (b)'s literal text, applying (b)'s own
stated reasoning symmetrically: (b) only named `admin`/`super_admin` as
needing the platform-override (no valid ceiling below platform in the old
flat-role model) — but the same reasoning applies to any role whose mapped
rank exceeds its target entity's ceiling (e.g. `moderator`, rank 3, on an
`individual`, ceiling 2). Implemented as an explicit, logged "Pass 4"
post-migration validation step (not silent rank-clamping), matching
`assessment.md` §8 / `roadmap.md` Phase 1's own requirement to verify no
user lands in an invalid (entity, rank) combination post-migration. See the
session report for what today's actual (test/seed) data exercised.

Legacy `can_self_publish`/`can_edit_copy` → `delegation_grants` backfill
(`app/services/roles_migration.migrate_legacy_delegations`): since no real
grantor was ever recorded for these one-off booleans, the migration defaults
`grantor_id = grantee_id` (self) as a documented assumption — the existing
booleans are left untouched and still authoritative; this only records the
equivalent grant in the new table for Phase 3's eventual cutover to read.

---

## Addendum 2 (same follow-up session): Phase 2 built — registry, `can()`, sessions, baseline auth endpoints

Per (d): `app/core/permissions_registry.py` now encodes all 61 actions from
`ROLES_PERMISSIONS.md` §7 (40, including the §10-delegable "manage any X" entity-wide
tier modeled as its own action key) and §8 (21). `app/core/permissions.py`'s
`can(user, action, entity_id=None)` reads `User.entity_kind`/`rank`/`entity_id`
against it, with entity precedence (`platform` overrides unconditionally) as
its own explicit branch — proven by a dedicated test
(`test_entity_precedence_platform_overrides_other_entities` /
`test_entity_precedence_is_not_just_comparing_rank_numbers`,
`tests/test_permissions_registry.py`). **Not wired into any existing
endpoint** — proven only by its own 11 tests, per this session's scope.

Per (e): `sessions` table built (`app/models/session.py`), `token_jti`
wired into `create_access_token` via a new `issue_token_for_user(db, user)`
helper (`app/core/security.py`) called from `/api/auth/register` and
`/api/auth/login`; `get_current_user`/`get_optional_user` now check the
allowlist for any token carrying a `jti` (tokens without one — e.g. existing
test fixtures calling `create_access_token` directly — are unaffected,
preserving backward compatibility).

Per (g): `User.email_verified`/`email_verified_at` added (the "Verified
user" email path); `email_verification_tokens`/`password_reset_tokens`
tables added. Three new endpoint groups shipped in
`app/api/auth_security.py`: email verification (request/confirm),
self-service password reset (request/confirm — confirm also revokes all of
the user's existing sessions, per ROLES_PERMISSIONS.md §1), and force-logout
(`/api/auth/sessions/revoke-mine` for anyone, `/api/auth/sessions/{id}/revoke`
gated by the existing `require_role([admin])` pattern from `app/api/admin.py`
— deliberately **not** the new `can()` helper, to keep it out of any real
request-handling path this session). No email-sending infrastructure exists
in this codebase yet (confirmed: no SMTP/provider integration anywhere), so
the request endpoints return the raw token directly in the response body —
explicitly flagged as a dev-only stand-in in the code and schema docstrings.

See the session report for the full file list, test counts, and what was
deliberately left out of `can()` this pass (delegation-grant lookups,
ownership-tier (✅/☑️/🔑) modeling).

---

## Addendum 3 (Phase 4 session): enforcement ladder, conversion, dissolution,
## cascade, promote/demote workflow, audit sampling — real gaps found & resolved

Per (c): `AccountStatus` gained its 4th value, `restricted`, exactly as
ratified — no schema change needed (bare `String(20)` column), just the enum
member + `User.is_restricted`. Wired into `app/api/articles.py`'s two trust
checks (`can_publish_live`, and the edit-of-published-content check) as a
hard override on the whole boolean, not just the `can_self_publish` half —
ROLES_PERMISSIONS.md §4's closing line ("account status always overrides badges")
reads as applying regardless of rank too, so a restricted moderator's own
edits are also forced back to `in_review`, not just a restricted
persona/contributor's.

Per ban anonymization: `app/api/admin.py::ban_user` now also sets
`created_by = NULL` (reusing the exact tombstone mechanism
`app/api/account.py`'s self-service GDPR erasure already used) on the same
published-content update it already ran. Deliberately **not** reversed on
`unban` — anonymization is a one-way GDPR erasure action; the existing GDPR
test file (`tests/test_phase6_account.py`) was left untouched, new coverage
added in `tests/test_roles_phase4_ban_anonymization.py`.

**Real gap found — `professional` entities have no shared "team" concept in
this codebase.** Only `organization`/`partners`/`suppliers` get a real
`entities` row (per `app/models/entity.py`'s own docstring, unchanged this
phase); a `professional` account is a fully standalone `User` row with no
FK linking it to any other "same professional business" user. This directly
affects two of this phase's items:
- **Entity conversion**: `individual` -> `professional` therefore cannot be
  a "bootstrap a new entity's top rank" case (there's no entity row to
  bootstrap) — it resets to persona (rank 1), matching ROLES_PERMISSIONS.md §3's
  general conversion rule literally, and is NOT treated as parallel to
  `professional` -> `organization` (which IS a real bootstrap, since a new
  `entities` row is created). See `app/services/entity_conversion.py`'s
  module docstring for the full reasoning.
- **Promote/demote requests**: a `professional`'s `admin` attempting to
  submit a role-change request about another `professional`-kind user has
  no way to verify "is this the same professional business" — there is no
  schema signal. Rather than silently allow it (a real privilege-escalation
  bug: any professional admin could then submit requests about *any* other
  professional user on the platform), `app/services/role_requests.py`
  blocks all `individual`/`professional`-scoped requests outright with a
  clear error. `individual` never actually reaches the required rank floor
  in practice (ceiling is contributor(2), floor to submit is
  moderator(3)+), so this only really constrains `professional`. Flagged
  here, not silently built around — a future phase should decide whether
  "professional teams" need a real schema (e.g. their own lightweight
  grouping table) or whether this stays a structural non-goal like
  multi-entity membership (ROLES_PERMISSIONS.md §3's own "Not in v1" framing).

**Real gap found — ROLES_PERMISSIONS.md §3's "Cross-entity ban cascade" section
presupposes an entity itself can be banned, but no such mechanism existed.**
Only `User`-level ban existed before this phase. Added a minimal,
deliberately narrow entity-level ban (`Entity.banned_at`/`ban_reason`/
`banned_by`/`ban_cascade_grace_expires_at`, `POST /api/entities/{id}/ban`
+`/unban`, both platform-super-admin-only): it does **not** auto-ban the
entity's member users (a separate, existing per-user action) and does
**not** run the dissolution lifecycle (no member conversion, no content
archival) — its only two effects are the audit record and triggering the
cross-entity footprint cascade-hide. This keeps the new surface area to
exactly what ROLES_PERMISSIONS.md §3 actually requires for the cascade to be real,
without inventing an undocumented parallel enforcement ladder for entities.

**Real gap found — checked what "an entity's footprint on another entity's
content" actually looks like in the schema, per this session's own
instruction not to speculate.** `EventSponsor`/`EventVendor` had no link to
a real `Entity` row at all (free-text name/contact fields only) —
`contributing_entity_id` (nullable FK) was added to both this phase,
non-null only when a sponsor/vendor entry is actually a registered
`organization`/`partners`/`suppliers` entity. `GroupMember` was deliberately
**excluded** from the cascade: it only links a `user_id`, never an entity,
and hiding a person's own group membership because their employer entity
got banned would conflate this cascade with ordinary per-user ban handling
(a different, already-existing mechanism) — see
`app/services/entity_cascade.py`'s module docstring. The cascade-hide is
implemented as an independent overlay (`cascade_hidden_at`, checked
unconditionally alongside — never instead of — the existing
`is_active`/`visible_to_attendees` admin-controlled flags), so reversal is a
plain "set back to NULL," with no snapshot/restore ambiguity and no risk of
clobbering an admin's own visibility setting.

**Real gap found — entity dissolution's "reversible within a 30-day grace
period" (ROLES_PERMISSIONS.md §3) needs something concrete to reverse *to*.** Added
`Entity.dissolution_snapshot` (JSON: `{"members": {user_id: {entity_kind,
rank}}, "content_ids": [...]}`), captured at the moment dissolution executes
and consumed by `reverse_dissolution`. Also added `dissolution_requested_at`/
`_by` as the pending-approval state distinct from `dissolved_at`
(execution) — ROLES_PERMISSIONS.md §3 says dissolution "requires platform super
admin approval, regardless of who triggered it," which only makes sense as
two states: an entity's own super admin can *request*
(`entity.request_dissolution`, a new entity-scoped registry action), the
platform super admin *approves/executes* (`entity.dissolve`, already
platform-scoped in the existing registry) or triggers directly (skipping
the pending state, since it's already the only approval authority).

**Judgment call — the self-approval exemption generalized to a single rule**
rather than two special-cased entity/rank pairs: an actor is self-exempt
whenever their rank equals their own entity's ceiling
(`app.core.entity_resolution.ENTITY_CEILING`) — proven by
`test_is_self_approval_exempt_generic_rule` to produce exactly
ROLES_PERMISSIONS.md §6's two documented cases (professional's admin, any entity's
super admin) and no others. Implemented in
`app/services/role_requests.is_self_approval_exempt`.

**Judgment call — entity conversion implemented as immediate/self-service,
not a separate pending-request record.** ROLES_PERMISSIONS.md §3 calls conversion
"request-based," which elsewhere (§6) means submit+approve — but §3's own
"Bootstrapping a new entity" rule says the person completing a new entity's
registration/verification gets its top rank "with no approval step" (there's
nobody local to approve the very first assignment). Both conversion paths
this phase builds are exactly that kind of "first assignment" case, so both
execute immediately once their stated eligibility criteria are met. See
`app/services/entity_conversion.py`'s module docstring for the full
reasoning.

**New field — `User.activity_registration_number`.** ROLES_PERMISSIONS.md §2's
"Verified professional" needs *two* distinct IDs (a tax/business
registration ID and a separate activity registration number); only the
former had an existing column (`registration_number`, reused as-is). Added
the second as a new, additive nullable column rather than overloading
`registration_number` with both concepts.

**Periodic audit-sampling (h): shipped as a plain callable query helper,**
`app/services/audit_sampling.py` (`find_self_approved_role_changes`,
`sample_for_review`, `monthly_self_approval_sample`) — no scheduled-job
framework (celery/cron/etc.) exists anywhere in this codebase today
(confirmed), so per (h)'s own framing ("no schema change is needed... a
future reporting job") and this session's instruction not to over-build a
scheduler where none exists elsewhere, this stays a manual/callable query
rather than a standing service. The self-approval signature it queries for
(`meta.requested_by == actor_id` on `promote`/`demote` audit rows) requires
no schema change — exactly as (h) predicted.

See the session report for the full file list and test counts.

---

## Addendum 4 (Phase 5 session): new UI surfaces + their small additive backend endpoints

Per roadmap.md's Phase 5: entity self-registration/verification (assessment.md
§5.2/§10a), delegation-grant CRUD, entity-scoped "manage my team" (roster +
role-change requests + delegations), entity conversion/dissolution UI, and a
staff verification review queue. Full detail in each new module's own
docstring (`app/services/entity_registration.py`,
`app/services/entity_documents.py`, `app/services/delegations.py`,
`app/services/entity_team.py`) — this addendum records the cross-cutting
judgment calls and real gaps, same standard as Addendum 3.

**Registration vs. conversion: two different paths can both end with "a
professional becomes an organization's founder," with different behavior,
and this session did NOT unify them.** `app.services.entity_conversion`
(Phase 4) lets a `professional` immediately, self-service convert to
`organization` — no review step at all, per Phase 4's own bootstrap
reasoning. `app.services.entity_registration` (this session) lets *any*
user without an existing `entity_id` — including a `professional` — submit
a brand-new org/partners/suppliers registration that sits `pending` until a
platform admin reviews it. A `professional` user today can reach
"organization founder" through either door, with genuinely different UX
(one instant, one review-gated) and no rule preventing them from using
whichever they prefer. This wasn't blocked because ROLES_PERMISSIONS.md §3 doesn't
say these must be the same flow, and blocking the general self-service
registration path for professionals specifically would be inventing a
restriction the spec never stated — but it's a real, flagged product
ambiguity a future session (or the product owner) should resolve
explicitly: are these meant to be one flow, or is offering both
intentional (e.g. "convert" for a solo professional formalizing themselves,
"register" for anyone bringing a genuinely new, separate organization into
being)?

**Bootstrap timing for registration is deliberately NOT immediate**, unlike
conversion. ROLES_PERMISSIONS.md §3 says a "registered-but-unverified entity...
cannot create users under it yet; its owner is treated as a plain persona
until verification succeeds" — read literally as requiring the pending
window conversion doesn't have (conversion's own bootstrap-immediately
reasoning is Addendum 3's judgment call, specific to *that* flow). The
registrant's `entity_id`/`rank` are only set once a platform admin approves
verification (`entity_registration.approve_verification`), not at
registration time — see that module's docstring for the full reasoning,
including why `Entity.primary_contact_user_id` (a field whose *documented*
long-term meaning is partners/suppliers-only, per `models/entity.py`'s own
docstring) is repurposed during the pending window to mean "the
registrant/founder to bootstrap on verification" for organizations too —
this is a real, deliberate field-reuse call, not an oversight; introducing
a second column for what's structurally the same "who do we bootstrap"
question was judged not worth it for a value that's only meaningful before
verification succeeds.

**Document storage is a new, separate pipeline from
`app.services.image_storage`, not a reuse of it** — see
`app.models.entity.EntityDocument`'s docstring. The existing image pipeline
forces every upload through Pillow and re-encodes to WebP, which actively
cannot handle a PDF (the realistic case for a business registration
certificate) and would be a correctness bug, not an optimization, if
forced to try. `app.services.document_storage` copies the *architectural
pattern* (content-addressed sha256, local filesystem, one DB row per file)
without the image-specific resize/re-encode step — this is the "reuse the
existing pattern, don't invent an unrelated one" instruction applied at the
pattern level, not the code level, since a literal reuse would have been
wrong.

**`partner_team.manage_roster`'s registry entry (Phase 4, `min_rank:
super_admin`) is confirmed — by actually building the roster endpoints this
session — to be a nominal placeholder, not a real rank check.**
`app.services.entity_team._is_roster_authority` never consults `can()`/the
registry for this action at all; authority is `entity.primary_contact_user_id
== actor.id` (a designation) or platform super admin (entity precedence).
This matches Phase 4's own registry note ("modeled at rank 5 here as the
nominal base authority since the registry shape has no 'designation, not
rank' axis") — recorded here as confirmed-by-implementation, not a new
finding.

**Delegation auto-void-on-departure is wired into the two places a
departure concretely happens today (`entity_team.remove_team_member`,
`entity_dissolution.approve_dissolution`'s member-conversion loop) but
NOT into demotion** (`role_requests._decide`). ROLES_PERMISSIONS.md §10 says
grants are voided "on any demotion... of the grantee" too — not done this
session because it needs a real design decision this session chose not to
guess at: should a grant survive a *partial* demotion that still leaves the
grantee above the delegated action's own `min_rank`, or does ANY demotion
void it regardless? Flagged here rather than picking one silently — see
`app.services.delegations`'s own module docstring for the same note in
context.

**`UserResponse` now exposes `entity_kind`/`rank`/`entity_id` directly**
(`app/schemas/auth.py`) — closing a gap Phase 3's own `use-permission.ts`
docstring flagged explicitly (point 1: the frontend hook had no real stored
values to read, only a re-derivation from `role`/`account_type` that could
in principle diverge from the backend's authoritative values). This was
necessary, not optional, for this phase's UI: the entity-scoped "manage my
team" panel needs the current user's real `entity_id` to render correctly
(e.g. deciding whether the logged-in user IS the entity's own super admin),
which no derivation from `role`/`account_type` could ever produce (that FK
isn't a function of anything else on the row). `lib/use-permission.ts`'s
`resolveEntityAndRank` now prefers the real stored values when present,
falling back to the old derivation only when `entity_kind` is genuinely
absent (pre-migration/pre-fallback rows) — the entity-id matching gap
`evaluate()`'s docstring point 2 used to describe is now closed the same
way for real `organization`/`partners`/`suppliers` users.

**New UI surfaces deliberately use hardcoded English copy, not the
`t()`/`messages/{locale}.json` i18n pattern** every other page in this
codebase follows. This is a real, scoped-down simplification for this
session (not silently under-built) — translating ~7 new pages' full copy
into both `en.json`/`pt.json` in the same pass as building the backend +
UI + tests was judged lower priority than shipping correct, tested
functionality first. `t()`'s own fallback behavior (`locale-context.tsx`:
returns the raw key if a translation is missing) means nothing is
literally broken by this — the pages just aren't localized yet. Flagged as
follow-up work, not a Phase 6 blocker (Phase 6 is doc reconciliation, not
UI polish).

**Page-visibility table (ROLES_PERMISSIONS.md §9) extended for the new surfaces
shipped this session** — see the table added directly below §9 in
`ROLES_PERMISSIONS.md` (a new "Phase 5 surfaces" sub-table, not a rewrite of the
existing top-level-surfaces table, per this session's own scoped-pass
instruction).

See the session report for the full file list and test counts.
