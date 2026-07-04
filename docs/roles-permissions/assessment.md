---
type: Note
_width: wide
---

# User Roles & Permissions — Pre-Implementation Assessment

> **Status:** Pre-implementation assessment.
> **Based on:** `ROLES_PERMISSIONS.md` (target) vs. the live, shipped system
> (`user-logic-review.md` Part B + `docs/content-platform/CONTENT_PLATFORM.md` §3–4).
> **Companion doc:** `roadmap.md` (sequencing of everything below) — not yet
> written; this document is the input to it.

---

## 1. Executive summary

This is **not** a greenfield build. RootLink has a live, shipped, production
system with real users, real sessions, and a real (if flawed) permission
model. `ROLES_PERMISSIONS.md` is the target design; the live system is `user.py` +
`moderation.py` + the enforcement logic audited in `user-logic-review.md`
Part B, running under the model `docs/content-platform/CONTENT_PLATFORM.md`
§3–4 formally describes. Implementation is a **migration**, not a rewrite —
every existing user, session, role value, and `account_type` string has to
land somewhere in the new model without an outage or a silent access change.

**Confirmed by the product owner:** production currently has no real users,
content, or entities — this assessment has been updated accordingly; see
§3.3 and §9(b) for what changed.

**The two biggest risks**, stated plainly:

1. **Deciding the mapping from the existing flat `role` (5 values) and
   `account_type` (bare, unenforced string) fields onto the new entity +
   rank model.** There is no clean 1:1 mapping (see §3) — `practitioner`
   doesn't map onto `professional` cleanly, `account_type` has never been
   enum-enforced so it may already contain drift/typos in the current
   rows, and every current `admin`/`super_admin` needs a correct new
   (entity, rank) pair decided as part of the migration logic. **This is
   now a much lower-stakes exercise than it would otherwise be:** since
   production today holds no real users, content, or organizations —
   everything currently in the database is test/seed data created for
   evaluation — the old `role`/`account_type` values can simply be reset
   or reassigned using sensible default rules (or the test DB reseeded
   outright), rather than requiring a carefully reviewed, row-by-row
   production mapping. The design decisions themselves (§3.3) still need
   to be made deliberately and correctly, because real users will exist
   eventually and the migration logic has to handle them right — but there
   is no live data today whose access could be broken by getting it wrong.
2. **Two documents will simultaneously claim to be the source of truth
   during the transition.** `ROLES_PERMISSIONS.md` explicitly supersedes
   `CONTENT_PLATFORM.md` §3–4, but `CONTENT_PLATFORM.md` is still the live,
   shipped spec that the running code's comments point at (e.g.
   `user.py:83` → "see docs/content-platform/CONTENT_PLATFORM.md §3",
   `moderation.py:38` → "§8"). Until every code comment, doc cross-reference,
   and the `CONTENT_PLATFORM.md` file itself are updated with a formal
   superseding note, there is a live window where a reader (human or agent)
   can correctly cite either document for contradictory answers. This is a
   documentation-hygiene risk, not just a cosmetic one — it directly feeds
   the enforcement-ladder reconciliation in §6 below, which depends on both
   documents being read together correctly. This risk is entirely about
   documentation, not user data, and is unaffected by the no-real-users
   fact above.

Everything else in this assessment — data model, backend, frontend,
security, testing — is real work, buildable with normal engineering
discipline, and none of it is softened by the no-real-users fact: the
target backend/frontend architecture, the permissions-registry
requirement, and the security/compliance design all have to be correct
for whenever real users, content, and organizations do show up.

---

## 2. What's actually changing (frame for the rest of this doc)

| Axis | Live system today | ROLES_PERMISSIONS.md target |
|---|---|---|
| Who you act as | 1 global `role` (5 values) | rank (0–5) **scoped to 1 of 6 entities** |
| What "account type" means | bare string, 3 loose values (`individual`/`organization`/`practitioner`), not enum-backed | 6 first-class `entity` types, enum-backed, each potentially with its own super admin |
| Extra permissions | 2 hand-rolled booleans (`can_self_publish`, `can_edit_copy`) | generalized **delegation** — any delegable action, to any specific user ID, revocable, entity- or platform-scoped |
| Account access | 3-state `account_status` (active/suspended/banned) | same 3-state model in ROLES_PERMISSIONS.md §4 — **see §6 below, this is where a real gap was found** |
| Promote/demote | direct `PATCH` on `role`, no approval, causal bug source (§8 of the audit) | a request/approval **workflow**, rank-relative, with a logged periodic-audit-sampling carve-out for capped entities |
| Enforcement checks | ~15 files, 4+ independently-invented styles, 23+ known `super_admin` gaps | single **permissions registry** (§4 below) — code artifact, not tribal knowledge |
| Organizations/partners/suppliers | do not exist as first-class records — `account_type == "organization"` is just a string on `User` | first-class entities with their own table, their own super admin (for `organization`), conversion/dissolution lifecycle, cascade rules |

---

## 3. Data model gap analysis

### 3.1 Current `User` fields relevant to roles/permissions (`models/user.py`)

| Field | Type today | Gap vs. ROLES_PERMISSIONS.md |
|---|---|---|
| `role` | `UserRole` `StrEnum`, 5 values, **SAEnum-backed** (properly constrained) | Needs to become a **rank-per-entity** concept (0–5, §5). A bare global rank column no longer means anything on its own — it must always be read together with the user's entity. Additive in the narrow sense (a new column can sit next to it), but its *meaning* changes: old `role` was the whole answer, new rank is half the answer. |
| `account_type` | bare `String(20)`, default `"individual"`, **not** enum-backed despite an `AccountType` enum existing in the same file (`individual`/`organization`/`practitioner`) — a known inconsistency already flagged in `user-logic-review.md` §10.3 | Becomes the 6-value `entity` (`individual`/`professional`/`organization`/`platform`/`partners`/`suppliers`), and must be properly enum-backed **this time** — carrying forward the existing bug (bare string) into the new column would repeat the exact mistake ROLES_PERMISSIONS.md's whole permissions-registry push (§4) is designed to stop happening again. |
| `entity_type` | `String(50)`, nullable — actually a taxonomy of *organization sub-kinds* (`ipss`/`cooperative`/`association`/`cer`/`ministry`/`regulatory`/`adr`/`municipality`/`company`/`other`, per the separate `EntityType` enum) | Not the same concept as ROLES_PERMISSIONS.md's "entity" (§3) — this is a sub-classification *of* an `organization`-type entity. Naming collision risk: ROLES_PERMISSIONS.md's "entity" and the existing `entity_type` column mean different things. Recommend renaming the existing column (e.g. `organization_kind`) before or during migration to avoid two different "entity" concepts in the same table. |
| `is_verified` / `verified_at` | admin-granted org/practitioner badge | Maps to ROLES_PERMISSIONS.md's "Verified organization/practitioner" badge (§2) conceptually, but ROLES_PERMISSIONS.md also introduces "Verified user" (email or referral or org-created) and "Verified professional" (NIF + activity reg. number + email) as **distinct** verified concepts. A single boolean cannot represent three different verification meanings — needs to become either three booleans/flags or a typed `verification_kind` field. |
| `registration_number` | `String(50)`, nullable, PT-specific naming (`NIF`-adjacent) | ROLES_PERMISSIONS.md §2 explicitly generalizes this to a "national tax/business registration ID," not hardcoded to NIF. Field should be renamed (e.g. `tax_registration_id`) with a separate `tax_registration_country`/scheme indicator, so PT's NIF is the default *implementation*, not the only-ever field name — literally called out as a requirement in the spec text. |
| `account_status`, `suspended_until`, `banned_at`, `ban_reason`, `banned_by` | bare `String(20)` for status (same enum-not-enforced pattern as `account_type`), 3-state | See §6 — largely compatible with ROLES_PERMISSIONS.md §4's 3-state model, **but** the enforcement-ladder reconciliation gap (Restriction rung, ban anonymization) must be resolved before this is "done," and `account_status` should become properly enum-backed in the same pass that fixes `account_type`. |
| `can_self_publish`, `can_edit_copy` | two hand-rolled booleans, each a bespoke one-off delegation | ROLES_PERMISSIONS.md's delegation model (§10) generalizes this to arbitrary action → user ID grants. These two existing booleans become the **first two rows** of the new delegation table, not something to keep as parallel special cases — migrate them in, don't leave them running alongside the new mechanism. |

### 3.2 Net-new tables/fields required (do not exist today)

| New artifact | Why | Notes |
|---|---|---|
| **`entities` table** (or `organizations`/`partners`/`suppliers` — decide singular vs. per-type) | `organization`, `partners`, and `suppliers` are first-class entities with their own identity, verification status, primary contact, and (for `organization`) their own super admin — none of this can live as a string on `User` anymore. `individual`, `professional`, and `platform` do **not** need their own row (they're default/umbrella entities per §3 of ROLES_PERMISSIONS.md), so this table only backs the three entity types that have registration/verification lifecycles. | Needs: id, entity type, name, verification status, verified_at/by, primary_contact_user_id (nullable, partners/suppliers only), tax_registration_id + scheme, created_at, dissolved_at (nullable). |
| **`user_entity_membership`** (or a `entity_id` FK + `rank` pair directly on `User`) | Every user belongs to exactly **one** entity (§3, "One entity per user") — decide whether this is a nullable FK straight on `User` (simpler, matches the "one entity" v1 constraint) or a join table (more future-proof if multi-entity membership is ever revisited, though explicitly **not in v1**). Recommend the FK-on-User approach given the explicit single-entity constraint — a join table would invite exactly the multi-membership complexity the spec says to avoid building speculatively. | Also needs the **rank** (0–5) scoped to that entity — this replaces the flat `role` column's job. |
| **`delegation_grants` table** | No table exists today for "specific permission to specific user ID" — `can_self_publish`/`can_edit_copy` are one-off booleans, not a general mechanism. ROLES_PERMISSIONS.md §10 requires arbitrary action-to-user-ID grants, auto-voided on demotion/suspension/ban/departure. | Needs: id, grantor_id, grantee_id, entity_id (nullable for platform-wide grants), action (references the permissions registry, §4 below — not a free string), granted_at, revoked_at (nullable), revoked_reason. |
| **Entity conversion audit trail** | Conversions (`individual → professional`, `professional → organization`) are one-way, logged events per §3's "Entity conversion (lifecycle)" — no equivalent exists today (the closest thing, direct `role` PATCH, isn't audited as a "conversion," just a role change). | Can likely extend `ModerationAuditLog`/`ModerationAction` (§4 below) rather than a bespoke table — see backend section. |
| **Entity dissolution audit trail + grace-period state** | Dissolution (§3) needs a 30-day reversible-archive window, cascade-hide of cross-entity footprint, and its own `dissolve_entity` audit action — nothing like this exists today (closest precedent: group archival, which is already soft/reversible per `group.py`'s `GroupStatus`/`archived_at`, a good pattern to reuse). | Needs a `dissolved_at` + `dissolution_grace_expires_at` on the entities table, plus a way to track which cross-entity "footprint" rows (sponsor/vendor listings, memberships) were cascade-hidden so they can be un-hidden if the dissolution/ban is reversed within the window. |
| **Primary-contact designation** (`partners`/`suppliers`) | Net-new concept, no analog today — a non-elevated "manage my own team roster" role distinct from admin/moderator/super-admin tiers, which `partners`/`suppliers` explicitly don't have. | Simplest form: a `primary_contact_user_id` field on the entity row (see `entities` table above) rather than a new role/rank value — it's a designation, not a rank, per the spec's own framing. |
| **Promote/demote request queue** | See §4 below (backend) — no request/approval table exists today; only a direct `role` PATCH. | |

### 3.3 Mapping old values onto new ones (design decision, not a data-risk exercise)

**Confirmed by the product owner: production currently has no real users,
content, or entities** — every row in the live database today is test/seed
data created for evaluation. That means the mapping below is no longer a
risky reconciliation against real production rows; it's a **design
decision to make once, cleanly, and validate against test/seed data**. It
still needs to be a deliberate, written decision (not skipped) — a
**written, signed-off mapping table** before any migration script is run
(see the checklist in §9) — because the *code* handling this mapping has
to be correct for whenever real users, organizations, and practitioners do
show up. The ambiguities below are still real *design* questions the
mapping logic must handle correctly; they're just no longer blocked on
inspecting live data:

| Old value | New value(s) it could become | Why it's ambiguous |
|---|---|---|
| `account_type = "individual"` | `entity = individual` | Clean 1:1 — no ambiguity. |
| `account_type = "organization"` | `entity = organization` | Mostly clean, **but** every existing `organization`-type user needs a real `entities` row created for them (backfill), and someone has to be chosen as that organization's first `super admin` — today there's no "who's in charge of this org" field to backfill from. Likely candidate: whoever has the highest existing `role` among users sharing that org's identity, but "sharing an org identity" isn't even a linkable concept today since orgs aren't first-class rows — the backfill *rule* needs to be designed and coded correctly (and validated with test/seed data), since there are no real organizations today whose backfill would need a manual per-row pass. |
| `account_type = "practitioner"` | `entity = professional`? Or a new `partners`/`suppliers` case? | **Flagged explicitly per the task brief: `practitioner` does not map 1:1 onto `professional`.** "Practitioner" in the live system reads as an individual professional-services provider (e.g. a single consultant), which is closer to ROLES_PERMISSIONS.md's `professional` definition ("provides professional services as part of the community"). But some current `practitioner` rows might semantically be closer to what ROLES_PERMISSIONS.md calls `partners` (an external business relationship *with* the platform) depending on how they were actually used in practice — this is a design decision to make and document as a default rule (e.g. based on `entity_type`/`services`/`certifications` fields), validated against test/seed data, rather than a risky inspection of real production rows, since none exist today. |
| `role = user/contributor/moderator/admin/super_admin` (global, 5 values) | rank 1–5 (persona/contributor/moderator/admin/super admin), **scoped to whatever entity that user lands in** | Numerically the rank ladder lines up 1:1 by name (`user`→`persona` is the only rename), which is reassuring, but the *meaning* changes: today `admin` is platform-wide by construction (there's only one entity). After migration, an existing `admin` user's rank must be scoped correctly — if their `account_type` mapped to `individual` or `professional`, their entity ceiling (§3 of ROLES_PERMISSIONS.md) may be **lower** than `admin`/`super_admin` was under the old model (e.g. `individual`'s ceiling is `contributor` — rank 2). **A user who is currently `role=admin` with `account_type=individual` has no valid target rank under the new ceilings table as written** — this is a real conflict, not just a relabeling exercise, and needs a decision (e.g.: is every current staff `admin`/`super_admin` actually `entity=platform`, regardless of what `account_type` says today? That's the most likely correct read). Since today's `admin`/`super_admin` accounts are all test/seed data, this decision can be made and coded cleanly now and validated against test data — the rule still has to be right, because real staff accounts will eventually be created under it. |
| Current known 🔴 bug: some real `admin` accounts were deliberately **not** promoted to `super_admin` to avoid the "loses capabilities" bug (`TECH_DEBT.md` §0) | — | Any user whose *current* rank was artificially held back due to the live bug needs to be identified and considered for their *intended* rank in the new model, not just their literal current `role` value — otherwise the migration faithfully carries forward a workaround for a bug that no longer needs to exist. |

**Bottom line:** `account_type` and `role` shouldn't be bulk-migrated by a
single unreviewed mechanical SQL script — not because real production data
is at risk (it isn't; today's rows are all test/seed data), but because
the mapping logic itself needs to correctly handle the ambiguities above
for whenever real users, organizations, and practitioners exist. A
**written, decided mapping table**, validated against test/seed data, is
required before writing the migration, not just an off-the-cuff
name-to-name lookup.

---

## 4. Backend architecture gap analysis

### 4.1 Do not repeat the root-cause bug at 6x the scale

The live system's core correctness bug — `super_admin` not a strict
superset of `admin` in 23+ hand-written checks across 8 files
(`user-logic-review.md` §8, `TECH_DEBT.md` §0) — happened because
"can this rank do this action" was answered by re-typing a role check in
every file that needed an answer, with no single place to verify
consistency. ROLES_PERMISSIONS.md's model is **6 entities × 6 ranks × 60+ actions**
(§7 lists ~30 entity-scoped actions, §8 lists ~19 platform-wide actions,
§10 lists two delegation matrices) — an order of magnitude more surface
area than today's single 5-role ladder. Reimplementing this the same way
(hand-typed `if rank >= X` checks scattered per endpoint) would not just
repeat the bug, it would make it **combinatorially worse** and far harder
to audit for completeness.

**Required artifact: a permissions registry.** A single, real code artifact
(a Python dict/table, or a small dedicated DB table if it needs to be
admin-editable later) mapping:

```
action → { minimum_rank, entity_scope (which entities it applies in, or "platform"),
           delegable: bool, notes }
```

This registry is the machine-checkable encoding of ROLES_PERMISSIONS.md §7, §8,
and §10's tables. Every enforcement check (backend) and every UI gate
(frontend, §5 below) should be **derived from or validated against** this
one artifact — not hand-typed per endpoint. This also gives §8's table
testing (below) something concrete to generate test cases from, closing
the loop that let the original bug ship unnoticed for as long as it did.

This registry needs to be designed and reviewed **before any endpoint is
touched** — see the checklist in §9.

### 4.2 Auth/session changes

- **Role/entity/rank must be re-checked per request, not cached in a
  long-lived JWT.** Today's JWT (`user-logic-review.md` §3) has no
  revocation mechanism at all — a promotion, demotion, suspension, or ban
  doesn't take effect for an already-issued token until it expires or the
  DB check on `get_current_user` catches banned/suspended status. The new
  model adds **rank-per-entity**, **delegation grants**, and **entity
  conversion/dissolution** — all of which can legitimately change what a
  user is allowed to do *mid-session*, more frequently and with higher
  consequence than today's simple ban/suspend check. This makes the
  existing "no token revocation" gap materially worse, not just an
  existing nice-to-have — it needs to be resolved (session/allowlist table
  or short-lived tokens + refresh) as part of this work, not deferred
  again.
- **Force-logout / revoke sessions** — ROLES_PERMISSIONS.md §1 lists this as a
  baseline rule ("a compromised or removed account's login can be
  force-expired"). This does not exist today in any form and is a
  prerequisite for entity dissolution (members need to be logged out of
  their old entity context) and for ban/demotion to actually take effect
  immediately rather than at next token expiry.
- **Email verification and self-service password reset** — both listed as
  baseline rules in ROLES_PERMISSIONS.md §1, both confirmed entirely absent today
  (`user-logic-review.md` §3, §10.1). These are prerequisites for the
  "Verified user" definition (§2 of ROLES_PERMISSIONS.md explicitly requires
  verified email as one of three qualifying paths) — the rank system's
  rank-1 "Persona" definition ("registered and verified") is not
  implementable at all without email verification existing first.

### 4.3 Promote/demote approval workflow

ROLES_PERMISSIONS.md §6 requires promotions/demotions to be a **request submitted
for approval**, not an instant action — with specific carve-outs (super
admin needs no approval; a capped entity's top rank, e.g. professional's
`admin`, is also self-approving but logged + periodically audit-sampled).
None of this exists today (`user-logic-review.md` §6: "only a blunt
role-PATCH... no demotion/restriction endpoint exists"). This needs:

- A new request/approval table (requester, target user, entity, from-rank,
  to-rank, status: pending/approved/rejected, approver, reason, timestamps).
- Endpoints to submit, approve, and reject a request.
- The self-approval exemption logic (super admin; capped entity's top
  rank) implemented as an explicit rule, not inferred — this is exactly
  the kind of "one more special case scattered in code" pattern that
  caused the original bug, so it belongs in the permissions registry
  (§4.1) as a flag on those specific actions, not a separate one-off `if`.
- The periodic audit-sampling mechanism for self-approved actions at
  capped entities' top rank — this is a new, currently-nonexistent
  reporting/review process, not just a data model change; needs a
  decision on cadence and who reviews the sample.
- **Separation of duties** (§6): no rank, including an entity's own super
  admin, may approve their own submission. This must be enforced at the
  request-processing layer (reject same requester_id == approver_id),
  independent of rank-sufficiency checks.

### 4.4 Audit logging extensions

The existing `ModerationAuditLog`/`ModerationAction` enum
(`models/moderation.py`) is append-only and already the right shape
(actor, action, target, reason, meta) — extend it rather than building a
parallel mechanism. New action types needed, not currently in the enum:

- `convert_entity` (individual→professional, professional→organization)
- `dissolve_entity`
- `cascade_hide` / `cascade_restore` (the cross-entity ban/dissolution
  footprint cascade, §3's "Cross-entity ban cascade")
- `grant_delegation` / `revoke_delegation`
- `promote_request` / `promote_approve` / `promote_reject` (and the demote
  equivalents) — today's enum already has bare `demote` with no code path
  (`user-logic-review.md` §6), so this is completing a placeholder, not
  purely additive
- `assign_primary_contact` (partners/suppliers team-roster changes)

Also carry forward two existing, already-known gaps rather than let this
migration silently inherit them: `edit_any` is declared but never emitted
(no code path for super_admin's "edit any state" today) and the
`action` column is a plain `String(50)` rather than an enum FK, so ad-hoc
string actions already leak into production logs outside the declared
enum. Both should be fixed as part of this work, since the new model adds
several more action types that make an unenforced free-text column
increasingly risky to audit against.

---

## 5. Frontend/UI gap analysis

### 5.1 Stop the per-component boolean pattern

`user-logic-review.md` §9 documents the frontend mirror of the backend bug:
no exported role-typed helper exists from `auth-context.tsx`, so every
consumer re-derives its own boolean — and several (`isStaff` in `NavBar.tsx`,
`MobileNav.tsx`, `/learning` pages, several per-page ownership checks) got it
wrong by omission. The entity+rank+delegation model is strictly more complex
than a flat role, so this pattern **must not** continue. Required:

- A single **entity-aware permission-check hook/utility** (e.g.
  `usePermission(action, { entityId })`) that reads from the same
  permissions registry the backend uses (§4.1) — ideally the registry is
  either shared (e.g. a generated JSON/TS artifact from the single Python
  source) or fetched, not re-implemented in TypeScript by hand.
- Every existing per-component hand-rolled check (`isStaff`, per-page
  ownership checks, `isAdmin`/`isSuperAdmin` derivations in
  `AdminSidebar.tsx`) migrates onto this hook as part of the same effort —
  not left running in parallel with a new system half-adopted.

### 5.2 Net-new UI surfaces (do not exist today)

| Surface | Why it's needed | Notes |
|---|---|---|
| **Entity registration/verification flow** | `organization`/`partners`/`suppliers` are net-new self-service-registerable entities (§3, "How entities are created") — no registration form or verification-review queue exists today (today "verification" is just an admin toggling `is_verified` on a `User` row). | Needs both the applicant-facing registration form and a staff-facing verification review queue (approve/reject, request more info). |
| **"Manage my team" panel (entity-scoped)** | Distinct from the platform's global admin panel — an organization's own super admin managing their own members/ranks, and a partners/suppliers primary contact managing their team roster (§3), are new, entity-scoped surfaces that don't exist because entities themselves don't exist today. | Must be clearly visually/architecturally distinct from `/admin/*` (platform-wide) to avoid the same "which admin panel am I in" confusion the entity-precedence rule (§3 of ROLES_PERMISSIONS.md) exists to prevent architecturally. |
| **Promote/demote request + approval UI** | The backend workflow in §4.3 needs a UI: submit a promotion/demotion request, see pending requests awaiting your approval, approve/reject with a reason. Nothing like this exists — today it's a direct hidden role-PATCH with no UI request/approval step at all. | |
| **Delegation-grant UI** | Grant/revoke a specific action to a specific user ID (§10) — today only two bespoke toggles exist (`can_self_publish`, `can_edit_copy`), each with its own one-off admin UI control. Needs a generalized "grant this delegable action to this user" picker, likely listing only the actions the permissions registry (§4.1) marks `delegable: true`. | |
| **Entity conversion flow** | User-initiated `individual→professional` or `professional→organization` conversion, with the eligibility criteria (§2's "Verified professional" requirements) checked and surfaced, and a clear explanation of what's lost (rank resets, badges don't carry over) before the user confirms — this is a one-way, consequential action and needs confirmation UX, not a silent toggle. | |
| **Entity dissolution flow** | Needs confirmation UX and a visible grace-period/reversibility indicator (30 days), triggerable by an entity's own super admin but gated on platform super admin approval (§3) — this is a two-party workflow (request + approval), similar in shape to §4.3's promote/demote request, and could plausibly reuse the same request/approval UI pattern rather than being built as a bespoke one-off. | |

### 5.3 Page-visibility table (§9) still incomplete

ROLES_PERMISSIONS.md §9 is explicitly flagged in the spec itself as covering only
"top-level surfaces today" — it does not yet reflect entity-vs-platform
scoping (e.g. an organization's own admin panel isn't in this table at all,
only the platform's `/admin/*`). This needs a dedicated pass, listed
explicitly as unfinished rather than assumed-complete, before frontend
route-guarding work starts — otherwise the new "manage my team" panel
(§5.2 above) has no visibility spec to build against.

---

## 6. Reconciliation with `docs/content-platform/CONTENT_PLATFORM.md`

This needs to be treated as its own workstream, not a side effect of
shipping the new model.

### 6.1 The specific gap: enforcement ladder rungs

> **Resolved since this assessment was written:** `ROLES_PERMISSIONS.md` §4 has
> been updated (option 1 below) to explicitly carry the Restriction rung
> and ban-anonymization forward as a 4-rung ladder. The analysis is kept
> below for the record — it's what drove that fix — but this is no longer
> an open question. Phase 0(c) in `roadmap.md` reflects this as "ratify,"
> not "decide from scratch."

`CONTENT_PLATFORM.md` §4.4 defines **four** enforcement rungs — Demotion,
**Restriction**, Suspension, Ban — where Restriction is explicitly distinct
from a role demotion: it keeps the user's full access and rank intact but
forces their **future** content back into the pre-moderation queue (`force
can_self_publish=false` + a "force review" flag), independent of whether
they hold a badge like `trusted publisher`. It is not merely "revoke the
badge" — a user can be restricted without losing rank or being demoted at
all.

`ROLES_PERMISSIONS.md` §4 defines only a **3-state account status** (Active /
Suspended / Banned). Reading ROLES_PERMISSIONS.md closely: badges going "inert"
during suspension/ban (§4's closing paragraph) covers *some* of what
Restriction did, but only for the duration of an active suspension/ban —
it does not cover the live system's actual Restriction case, where a user
keeps **full read/write access** but is deliberately, indefinitely forced
back into pre-moderation for new content without their access being
curtailed at all. **This is a real, unaddressed gap, not a renaming** — as
things stand, ROLES_PERMISSIONS.md has silently dropped a rung that
`CONTENT_PLATFORM.md` treats as load-bearing (it's referenced directly in
§6.2's license-misuse escalation path as a distinct, lower rung than
suspension).

Similarly, `CONTENT_PLATFORM.md` §4.4/§8 requires that a ban **anonymizes**
the author (`created_by` → tombstone, GDPR Art. 17 erasure) in addition to
unpublishing content — ROLES_PERMISSIONS.md §4 says banned content is "pulled
down automatically" but does not mention anonymization at all.

**This must be resolved explicitly, one of two ways, before implementation:**
1. Carry both gaps forward into ROLES_PERMISSIONS.md as an explicit addendum
   (a 4th "Restriction" rung + an anonymization clause on Ban), or
2. Consciously drop them, with a documented reason recorded in
   ROLES_PERMISSIONS.md itself (not just in this assessment) — e.g. if the
   product decision is that Restriction's use case is now fully covered by
   entity-scoped demotion + delegation revocation, that reasoning needs to
   be written down, not just implied by omission.

Silently losing either is not acceptable given both are already-live,
already-relied-upon compliance/moderation behavior — not a
new nice-to-have being considered for the first time.

### 6.2 Mechanical reconciliation work

- `CONTENT_PLATFORM.md` is **not deleted** — it stays as the historical
  record of the shipped Phase 0–6 content-platform work (confirmed shipped
  per `IMPLEMENTATION_STATUS.md`). It needs a formal **superseding note**
  at the top of §3 and §4 pointing at `ROLES_PERMISSIONS.md`, mirroring the note
  `ROLES_PERMISSIONS.md` already carries pointing back at it.
- **Audit every code comment that cites a `CONTENT_PLATFORM.md` section
  number** (confirmed present in `user.py` — e.g. the `can_self_publish`
  and `account_status` field comments cite §3/§4.4 directly — and in
  `moderation.py`'s docstring citing §8) and update or annotate them once
  the new model lands, so a future reader of the source doesn't chase a
  section reference into a document whose relevant portion has since been
  superseded.
- Cross-check `TECH_DEBT.md` §0 (the `super_admin`-not-superset bug) against
  the new permissions registry (§4.1) once built — this bug's root cause
  should be structurally impossible under the new registry-driven model,
  and that should be verified and recorded as the bug's actual closure,
  not just assumed fixed by virtue of a rewrite.

---

## 7. Security / compliance considerations

- **GDPR erasure/anonymization on ban must not regress.** This is already
  a live requirement (`CONTENT_PLATFORM.md` §4.4/§8, Art. 17) — whatever
  the final decision in §6.1 above, the ban rung's anonymization behavior
  needs to keep working at least as well as it does today after the
  migration, and needs explicit test coverage proving it (§8 below).
- **Entity dissolution is net-new surface area with the same compliance
  lens applied to it for the first time.** When an `organization` (or
  `partners`/`suppliers`) dissolves and its members convert to plain
  `individual` personas (§3 of ROLES_PERMISSIONS.md), what happens to:
  - Personal data the dissolved entity held about its members (if any,
    beyond what `User` already stores) — needs an explicit answer, not an
    assumption that "members become individuals" is itself sufficient for
    erasure purposes.
  - The entity's own content, which is archived-not-deleted for 30 days —
    if that content contains personal data of *former* members (e.g.
    named in event listings, comments), does the archive window conflict
    with any erasure request a former member might submit independently
    during those 30 days? This interaction isn't addressed in
    ROLES_PERMISSIONS.md and needs a decision.
  - The cross-entity cascade-hide (soft cascade, §3) — hidden-but-not-
    deleted content re-raises the same "is hidden good enough for
    erasure" question the existing ban/anonymization rule already had to
    answer; the same standard should apply here for consistency, and
    should be stated as such rather than treated as an unrelated new
    question.
- **Delegation grants are a new privilege-escalation surface.** Every
  grant needs to be logged (already required, §4.4 above) **and** the
  auto-void-on-demotion/suspension/ban/departure rule (§10 of
  ROLES_PERMISSIONS.md) needs to be verified as actually enforced at the DB/query
  layer (e.g. a revoked-grant check, not just "we meant to clean these up")
  — a stale delegation surviving past its holder's demotion is exactly the
  kind of silent-drift bug this whole effort is trying to prevent at the
  rank layer.
- **Primary-contact team-roster management (partners/suppliers) is a
  lightweight admin capability with no elevated-permission tier gating
  it** — since it can add/remove which user IDs are associated with an
  entity, it should still be logged (per the "every grant/suspend/ban/badge
  change is logged" baseline rule in ROLES_PERMISSIONS.md §1) even though it
  isn't itself an elevation of rank.

---

## 8. Testing implications

The live system has **70 passing tests** (`IMPLEMENTATION_STATUS.md`),
largely organized per content-platform phase (`test_phase0_enforcement.py`
… `test_phase6_account.py`) plus feature-specific suites (`test_groups_manage.py`,
`test_copy.py`, `test_content_ui.py`). That style — hand-written test cases
per feature/phase — is appropriate for the content-platform work, but is
**not** the right shape for the permissions matrix itself.

**The core risk:** 6 entities × 6 ranks × 60+ actions is far too large a
space to hand-write individual test cases per (entity, rank, action) combo
without the tests themselves silently drifting out of sync with the actual
permissions registry (§4.1) — which is precisely the same root-cause
pattern (documentation/intent vs. scattered, independently-maintained
implementation) that produced the original `super_admin`-not-a-superset
bug in the first place, just one layer up (tests vs. registry, instead of
code vs. spec).

**Required approach:** generate the test matrix **from the same
permissions registry** the backend enforcement and frontend hook consume
(§4.1, §5.1) — i.e., property-based or table-driven tests that iterate the
registry's own (action, minimum_rank, entity_scope, delegable) tuples and
assert the enforcement behavior matches, rather than a human independently
retyping "moderator can approve articles: true" as a separate assertion
that could silently fall out of sync with the registry it's supposed to be
verifying. Concretely: one generated test loop is preferable to ~360+
hand-written individual assertions.

Additional testing call-outs:
- **Migration correctness** needs its own dedicated test pass against
  representative test/seed data — production today has no real users to
  protect, so this isn't about safeguarding live records, but the
  migration logic still needs thorough validation: specifically verifying
  no user ends up in an invalid (entity, rank) combination post-migration
  (the ceilings-table conflict flagged in §3.3), using seeded fixtures that
  cover each of the ambiguous cases identified there.
- **Entity-precedence tests** (§3 of ROLES_PERMISSIONS.md: platform always
  outranks other entities regardless of local rank numbers) are a new,
  easy-to-get-subtly-wrong class of test — this is explicitly the same bug
  shape as the original `super_admin` issue, one level up, and deserves
  its own explicit test category rather than being assumed covered by the
  general registry-driven tests above.
- **GDPR/erasure regression tests** (§7) need to keep passing post-migration
  with no reduction in coverage, plus new tests for the entity-dissolution
  compliance questions raised in §7.

---

## 9. Before you write any code — decision checklist

Ordered; each item should be **signed off in writing** (a note in this
folder, or `roadmap.md` once it exists) before implementation starts.

| # | Decision | Why it must be settled first |
|---|---|---|
| a | **DB migration strategy**, given the idempotent-guarded-`ALTER TABLE`-in-`main.py` reality vs. the stale/no-op Alembic setup (`docs/LESSONS.md` #10). Decide: finally reconcile Alembic (backfill revisions) as a prerequisite, or continue the existing lifespan-`ALTER` pattern for this migration too. | This migration is large enough (new tables, renamed-meaning columns, data backfill) that doing it via ad-hoc idempotent `ALTER`s without any rollback/versioning story is materially riskier than the smaller migrations that pattern has handled so far. This decision changes how every other step below gets implemented, so it has to come first. |
| b | **Exact mapping table** from the old 5 roles + `account_type` to new entities/ranks — a clean design decision, validated against test/seed data (production has no real users today, per the product owner), not a review against real data (§3.3 above spells out the specific ambiguities: `practitioner`, `organization` backfill, the admin-with-individual-account_type conflict). | Without this, the migration script itself can't be written correctly — and since real staff and users will eventually exist under this logic, the mapping rules still need to be right, just without today's added pressure of protecting live accounts. |
| c | ~~Decision on the enforcement-ladder gap~~ **— resolved** (§6.1): `ROLES_PERMISSIONS.md` §4 now carries the Restriction rung + ban-anonymization forward explicitly as a 4-rung ladder. Remaining action here is to **ratify** that design during Phase 0, not decide it from scratch. | Backend work in §4.4 (audit actions) and account-status modeling in §3 both depend on knowing whether a 4th rung exists — this is now answered; sign-off just confirms the team agrees with the resolution before building against it. |
| d | **Sign-off on the permissions-registry design** (§4.1) — its exact shape (dict vs. DB table), where it lives, and how backend/frontend/tests all consume it — before any endpoint is touched. | Every other piece of backend (§4), frontend (§5), and testing (§8) work in this assessment is designed to be *generated from or validated against* this one artifact. Building endpoints first and retrofitting the registry after is how the original 23-site bug happened in the first place. |
| e | **Session/token revocation mechanism** decision (§4.2) — allowlist/denylist table vs. short-lived-token-plus-refresh vs. another approach. | Promotions, demotions, delegation grants/revocations, suspensions, bans, and entity dissolution all need to take effect without waiting for a token to naturally expire; this is a bigger deal under the new model (more frequent, higher-consequence changes) than it was under today's simpler ban/suspend-only check. |
| f | **`entity_type` column rename** (§3.1) — resolve the naming collision between the existing organization-sub-kind column and ROLES_PERMISSIONS.md's "entity" concept before both exist in the same table under confusingly similar names. | Cheap to fix now (a rename), expensive/confusing to fix once code and docs both reference an ambiguous "entity_type" meaning two different things. |
| g | **Verification-badge modeling decision** (§3.1) — how "Verified user," "Verified professional," and "Verified organization/practitioner" (three distinct concepts in ROLES_PERMISSIONS.md §2) map onto data fields, given today's single `is_verified` boolean can't represent all three. | Affects the rank-1 "Persona" definition (registered **and verified**) directly — this needs to be resolvable before any rank can be correctly assigned during migration (item b above depends on this). |
| h | **Periodic audit-sampling process** for self-approved promotions at capped entities' top rank (§4.3) — cadence, reviewer, and what "flagged for sampling" actually triggers. | This is a compensating control for a designed-in reduced-oversight case (§6 of ROLES_PERMISSIONS.md); if it's not a real, staffed process, the compensating control doesn't actually compensate for anything. |
| i | **Primary-contact and delegation UI ownership** — which team (if the work is split) owns the entity-scoped "manage my team" surfaces (§5.2) vs. the platform-wide admin panel, given they must stay visually/architecturally distinct per the entity-precedence rule. | Avoids the two panels organically drifting toward each other's scope during implementation, re-creating the exact "which admin context am I in" ambiguity the entity model is designed to prevent. |

---

## 10. Non-goals / explicitly out of scope for the first implementation

Pulled from ROLES_PERMISSIONS.md's own "Not in v1" callouts, plus additional items
worth deferring explicitly so scope doesn't creep mid-implementation. Each
item below remains deferred for reasons **unrelated** to the
no-real-users-today fact (§1, §3.3) — none of these were overlooked in
light of that news; they're correctly still out of scope for their own,
separate reasons:

- **True multi-entity native membership** — a single account holding
  independent rank in more than one entity simultaneously. Explicitly
  deferred by ROLES_PERMISSIONS.md §3 pending real usage data; the delegation
  model (§10) covers the common "multiple hats" case without it. (Deferred
  due to demand uncertainty — not knowing yet how common the multi-hat
  case is in practice — unrelated to whether today's data is real or
  test.)
- **Named permission bundles** ("Content Ops" = manage articles + manage
  events, etc.) — ROLES_PERMISSIONS.md §10 explicitly defers this past v1, noting
  one-off action-by-action delegation is fine at current scale;
  "delegation sprawl" is a tracked future concern, not a v1 requirement.
  (Deferred due to current scale — not enough delegation volume yet to
  justify bundles — unrelated to whether today's data is real or test.)
- **Full page/UI visibility spec completion** (§9 of ROLES_PERMISSIONS.md,
  flagged in this assessment §5.3) — the entity-vs-platform-scoped
  visibility pass is real, necessary work, but can be scoped as its own
  follow-up pass rather than a blocker for the core rank/entity/delegation
  machinery, provided the top-level surfaces already listed keep working.
  (Deferred purely for effort-scoping/sequencing reasons — it's real work
  that doesn't need to block the core machinery — unrelated to whether
  today's data is real or test.)
- **Automated/legal-grade verification of "national tax/business
  registration ID" formats** beyond Portugal's NIF — the field is
  generalized in the data model (§3.1) so it isn't hardcoded, but building
  out validation logic for other countries' schemes is not required until
  the platform actually expands beyond Portugal. (Deferred due to
  international-expansion timing — there's no non-Portugal use case yet —
  unrelated to whether today's data is real or test.)

**Note:** an earlier draft of this list also included "Retroactive
re-audit of already-closed/self-approved historical actions taken under
the old flat-role system" as a non-goal. That item has been removed
entirely rather than kept-and-deferred: since production has no real
historical user activity predating this design (§1, §3.3), there is
nothing to retroactively re-audit, so the item is moot rather than
out-of-scope.

**Note:** "Document-upload + human-review verification for 'Verified
organization/practitioner'" has been **promoted into v1 scope** rather
than kept as a non-goal here — see the new subsection immediately below.

---

## 10a. Promoted into scope: document-upload verification

Final-spec.md §2 notes that document-upload + human-review verification
for "Verified organization/practitioner" "should eventually" replace an
admin's manual judgment call. This assessment previously deferred that
work past v1 (consistent with ROLES_PERMISSIONS.md's own framing), because
migrating already-verified real organizations onto a stricter proof-based
process would have been awkward for real customers — existing verified
orgs would either need to be grandfathered in without proof, or asked
retroactively for documentation they weren't originally required to
provide.

**That reasoning no longer applies.** Confirmed by the product owner:
there are currently zero real organizations or practitioners in
production, so there is no one to grandfather and no awkward retroactive
ask to make. Building the proper document-upload + human-review
verification flow from day one — rather than shipping the current
admin's-word toggle and having to migrate off it later — is now low-risk
and should be **promoted into v1 scope**. This still needs its own design
pass (upload storage, review queue UI per §5.2, and the "Verified
professional" vs. "Verified organization/practitioner" distinction from
§3.1's verification-badge modeling decision, checklist item g), but it is
no longer blocked on avoiding disruption to real, already-verified
accounts.

