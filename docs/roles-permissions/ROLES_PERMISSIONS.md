---
type: Note
_width: wide
---

# User Roles & Permissions — Final Spec (v1)

> **Status:** Approved v1 — **implemented** (Phases 0–5, see `IMPLEMENTATION_STATUS.md`).
> **Supersedes:** the roles/permissions portions of `docs/content-platform/CONTENT_PLATFORM.md` §3–§4 (see `assessment.md` for the reconciliation plan this design was implemented against — see `IMPLEMENTATION_STATUS.md` for current, real, shipped state).
> **Source documents:** `user-logic-review.md` (current-state audit), `user-what-who.md` and `user-roles-permissions-spec.md` (design history) — kept in this same folder for reference.

This is the single source of truth for who can do what across RootLink's
entities, roles, account status, and delegation model. It's the clean output
of the design work in `user-what-who.md` and `user-roles-permissions-spec.md`
— every item that was previously open has a final decision recorded here.
Nothing in this document is provisional.

---

## 1. Baseline rules (apply to every entity and every role)

- Every user is associated with exactly one **entity** (§3).
- Email verification at signup — confirms the email actually belongs to the
  person. Until verified, a registered user is treated as a **visitor**.
- Self-service "forgot password" flow — a user can reset their own password
  without staff involvement, through a secure verification step.
- Force-logout / revoke sessions — a compromised or removed account's login
  can be force-expired (e.g. after a password reset or a ban) so it can't
  keep using an old session.
- Users may opt out of (leave/delete) the platform themselves — **except**
  when their entity is `organization`, `partners`, or `suppliers` (see
  exception below).
- Every grant, suspend, ban, or badge change is logged with who did it and
  why. This is a hard rule for every current and future permission-changing
  action — no exceptions.

### Exception — org-associated users can't self opt-out

Applies when a user's entity is `organization`, `partners`, or `suppliers`
(i.e. not `individual` or `professional`): the individual user does not have
a self-service opt-out. Only that entity's super admin (or the platform
super admin) can process it, as part of the organization managing its own
members.

---

## 2. Definitions

**Verified user** — a registered persona with a verified email, OR a
referral from a trusted user, OR any role created directly by a verified
organization.

**Verified professional** — a registered professional with a **national
tax/business registration ID**, an activity registration number, and a
verified email. `NIF` is the Portugal-specific implementation of this field
and the default at launch — it is not hardcoded as the only-ever field name
in the data model or copy, so this doesn't need reworking if the platform
expands beyond Portugal.

**Verified organization / practitioner** (badge) — a manually-checked "this
is a real registered entity" badge. Should eventually require actual proof
(document upload + human review), not just an admin's word.

**Trusted user** — a verified persona with at least 3 articles and no
negative reviews, **and** who has explicitly signed the "Publisher
Responsibility" agreement. Only once both conditions are met is self-publish
granted. Trust is earned and revocable, and every change is logged — it's an
audit trail, not a toggle. If one of the qualifying articles is later
successfully appealed against, retracted, or otherwise found in violation,
trust status is automatically re-evaluated — not just on manual review if
someone happens to notice.

**Trusted publisher** (badge) — earned after a track record of approved
content; skips the review queue. Revocable, always logged.

**Copy editor** (badge) — can edit site-wide marketing text. A delegation,
not a role.

---

## 3. Entities

The `platform` entity is the umbrella entity: it sits above and can act
across all the others.

| Entity | Description |
|---|---|
| `individual` | Regular community member. Default entity for anyone who isn't a professional and isn't under another entity. |
| `professional` | Provides professional services as part of the community. If you're not offering professional services, register as `individual` instead. |
| `organization` | Private or public, for-profit or non-profit organizations. |
| `platform` | Platform owners/staff who build and run the platform. The umbrella entity for everything else. |
| `partners` | Platform partners (lawyers, accountants, other tech businesses) — a relationship *with* the platform, not the platform itself. |
| `suppliers` | Platform service suppliers (storage, servers, other infra vendors) — same relationship model as partners. |

A **registered-but-unverified** entity (organization/partners/suppliers
pending approval) cannot create users under it yet; its owner is treated as
a plain `persona` until verification succeeds.

### How entities are created

- `individual` and `professional` are default entities — every user who
  isn't under an `organization`/`partners`/`suppliers` falls into one of
  these two automatically.
- `organization`, `partners`, and `suppliers` are created either by the
  platform super admin directly, or via a self-service registration page
  (which then needs verification, per above).

### Entity ceilings — how high a role can go, per entity

| Entity | Highest reachable rank | Has its own super admin? | Notes |
|---|---|---|---|
| `individual` | contributor | No | Never reaches moderator/admin/super admin. Content is moderated by `platform` staff by default (see §7). |
| `professional` | admin | No | The `platform` super admin is the override for anything beyond admin. **Professional entities never get entity-scoped promote/demote at all** — that workflow is organization-only (see §6). A professional's own rank changes go through the platform-wide `/admin/users` role-management page instead. |
| `organization` | **super admin** | **Yes** | An organization's own super admin has full authority *within that organization* (entity-scoped table, §7) — but platform-wide/cross-entity actions (archiving a mixed-membership group, editing legal docs, etc.) are still `platform`-super-admin-only (§8). |
| `platform` | super admin | Yes | The platform's super admin is the ultimate override for every entity. |
| `partners` | persona + specific grants | No | No moderator/admin/super admin tier at all — extra permissions are hand-granted per user ID by the platform super admin (e.g. legal updates access). For entities with more than one associated user, see "Partners/suppliers: primary contact" below. |
| `suppliers` | persona + specific grants | No | Same model as partners (e.g. API/integration access granted per user ID). See "Partners/suppliers: primary contact" below. |

The important correction from earlier drafts: **organizations do have their
own local super admin.** Individual, professional, partners, and suppliers do
not — for those four, "super admin" always means the platform's super admin
stepping in, never a locally-held rank.

### Entity precedence (platform always overrides)

Rank numbers (§5) are only ever comparable **within the same entity**. They
must never be compared *across* entities. `platform` outranks every other
entity unconditionally, regardless of local rank numbers — e.g. an
`organization`'s own `super admin` (rank 5) does **not** outrank the
`platform` entity's `admin` (rank 4); the platform's rank always wins on
anything platform-wide (§8). This is a separate, explicit rule rather than
"just compare the numbers," otherwise it's the same class of bug already
found in the live codebase (`super_admin` failing to act as a superset of
`admin` in ~23 places, see `user-logic-review.md` §8) — one level up, at the
entity layer instead of the role layer.

### Bootstrapping a new entity

The person who completes an entity's registration/verification (§"How
entities are created") is automatically assigned that entity's top
reachable rank (`admin` for `professional`, `super admin` for
`organization`) with **no approval step** — same exemption logic as
`super admin` in §6. Without this, a brand-new entity would have nobody
able to approve its own first promotion.

### One entity per user

Every user belongs to exactly one entity in v1 — this stays the model
going forward. It's simpler to build and matches how the live system's
`account_type` field already works today.

The real-world "multiple hats" case (e.g. a professional who also
volunteers as an organization's admin) is handled through **delegation**
(§10), not through native multi-entity membership: that person can be
delegated a specific permission within a *different* entity than their
home entity, without becoming a full member of it. This covers the common
case — needing to act on a specific thing in another entity — without
taking on the complexity of a person holding independent rank in two
places at once.

> **Not in v1:** True multi-entity native membership (a single account
> holding independent standing/rank in more than one entity at the same
> time) is explicitly out of scope. Revisit only if usage data shows real
> demand for it — this should not be built speculatively.

### Entity conversion (lifecycle)

Entity-type conversion is one-way and **self-service only** — every
conversion endpoint acts on the authenticated caller's own account; there
is no admin-triggered path and no way to target a different user (confirmed
against the actual code, `app/services/entity_conversion.py` /
`app/api/entity_conversion.py` — no function or endpoint takes a `user_id`
parameter anywhere in this module).

Three directions exist:

- **`individual` → `professional`** — requires professional verification
  (§2's "Verified professional" criteria).
- **`professional` → `individual`** — the reverse direction (added
  post-Phase-6, see `phase0-decisions.md` Addendum 5). No eligibility
  criteria beyond currently being `professional` — converting down never
  needs re-verification.
- **`professional` → `organization`** — requires forming a new
  `organization` entity. The converting user becomes that organization's
  first `super admin` via the same bootstrap rule as any new entity (see
  "Bootstrapping a new entity" above). This direction's rank/bootstrap
  behavior is unrelated to the rank rule below and unchanged.

On conversion:

- **Content ownership persists.** Ownership is tracked by user ID, not
  entity, so a user's previously authored content stays theirs regardless
  of which entity they convert into.
- **Rank is preserved-or-capped, for `individual` ↔ `professional` only**
  (decided post-Phase-6, `phase0-decisions.md` Addendum 5 — replaces the
  original "always resets to persona" rule for these two directions
  specifically): rank is preserved as-is if it already fits the
  destination entity's ceiling (§3's ceilings table above), otherwise
  capped DOWN to that ceiling — never reset to persona(1) outright. Since
  `individual`'s ceiling is contributor(2) and `professional`'s ceiling is
  admin(4), `individual` → `professional` always preserves rank unchanged
  (1 or 2 always fits in 1-4). `professional` → `individual` preserves
  rank 1 or 2 unchanged, but caps rank 3 (moderator) or 4 (admin) down to 2
  (contributor). **`professional` → `organization` is unaffected by this
  rule** — that direction keeps its own bootstrap-to-super-admin(5) logic
  exactly as originally shipped (a brand-new entity being founded, not a
  rank comparison between two existing ceilings).
- **Badges are not carried over, in every direction.** `verified` and
  `trusted publisher` must be re-earned or re-verified under the new
  entity's criteria — a professional's trust track record doesn't
  automatically transfer to a brand-new organization or back down to an
  individual account, for example.
- **A mandatory live, computed "before vs. after" comparison + explicit
  consent gate, for the `individual` ↔ `professional` directions.** Before
  either of these two conversions executes for real, the frontend must
  call a read-only preview/dry-run endpoint
  (`GET /api/entity-conversion/preview?to=individual|professional`) that
  computes the caller's REAL current state (rank, entity, and every
  relevant badge/flag — verified, trusted publisher/`can_self_publish`,
  copy editor/`can_edit_copy`, email-verified, etc., not a static/hardcoded
  example) and REAL projected post-conversion state (rank per the cap rule
  above, badges cleared), render it as a comparison, and require the user
  to explicitly confirm before calling the real conversion endpoint. If
  the user does not confirm, nothing changes — they remain in their
  current entity/rank exactly as before. (`professional` → `organization`
  keeps its original static "this is one-way" messaging + checkbox — the
  preview endpoint does not cover that direction, since its underlying
  bootstrap logic is unrelated and untouched.)
- The conversion itself is logged as an audit event, same as any other
  account status change.

### Entity dissolution

Applies when an `organization`, `partners`, or `suppliers` entity closes.
Dissolution can be triggered by that entity's own super admin, or by the
platform super admin.

On dissolution:

1. All members convert to plain `individual` `persona` accounts. Rank and
   badges held under the dissolved entity do not carry over — consistent
   with the conversion rule above.
2. The entity's content is **archived, not deleted** — hidden from public
   view, reversible within a 30-day grace period, after which it becomes
   permanent.
3. Logged as its own distinct audit action (`dissolve_entity`).
4. **Requires platform super admin approval**, regardless of who triggered
   it. This mirrors why "archive group" and "archive event" are
   platform-only in §8 — dissolving an entity is at least as consequential
   as either of those, since it can affect members and content well beyond
   the entity itself.

### Cross-entity ban cascade

An entity can have a footprint inside another entity's content — e.g. Org
B listed as a sponsor/vendor on Org A's event, or Org B's members holding
memberships in groups elsewhere. When an entity is banned or dissolved,
that footprint is automatically hidden — a "soft cascade."

This only ever removes the banned/dissolved entity's **own contributed
sub-listing** — never the host entity's primary content. Org A's event
stays fully intact; only the Org B sponsor entry attached to it disappears.

The cascade is reversible within the same 30-day grace period used for
dissolution, if the ban is reversed within that window. Logged like any
other status change.

### Partners/suppliers: primary contact

`partners` and `suppliers` entities are capped at "persona + specific
grants" with no admin/moderator/super-admin tier (see the ceilings table
above) — that stays true regardless of how many people are associated with
the entity. For entities with more than one associated user (e.g. a law
firm registered as a `partners` entity), a lightweight, non-elevated
**primary contact** designation is available:

- The primary contact can add or remove which user IDs are associated with
  that partner/supplier entity — i.e. manage their own team roster.
- The primary contact **cannot self-grant elevated permissions.** Delegating
  any specific permission (e.g. legal-updates access, API/integration
  access) to a team member still requires the platform super admin, per the
  existing ceiling.

This solves "who manages our own team's access" without inventing a new
rank tier for these intentionally-constrained entity types.

---

## 4. Account status and the enforcement ladder

Independent of role — a Contributor and an Admin can both be restricted,
suspended, or banned the same way. This is a four-rung ladder, carried
forward from the live system's enforcement model so nothing is lost in the
move to entities/ranks:

| Rung | What it is | Access | Effect on content |
|---|---|---|---|
| **Restriction** | Keep full access, remove authoring trust | Full read/write access as normal | Future submissions are forced back to pre-moderation (`in_review`), regardless of any "trusted publisher" badge. Existing published content is untouched. Reversible — lifting it restores normal trusted-publish behavior. |
| **Suspended (temporary, timed)** | Access itself is curtailed | Can still read; can't post, comment, or rate | Lifts automatically at the set expiry. Their content stays up while suspended. |
| **Banned (indefinite)** | Full removal | Fully locked out, including reading | Published content is unpublished and the author is anonymized (tombstoned) — this is a GDPR Art. 17 (erasure) requirement, not just a visibility toggle. A moderator/admin may choose to re-publish a high-value item anonymized (author shown as a tombstone, not deleted) rather than remove it outright. Appeal-only to reverse. |

- **Active** is the default (no rung applied) — normal access, normal
  authoring trust.
- Restriction is functionally "revoke trusted-publisher, but log it as a
  distinct enforcement rung" rather than just quietly flipping the badge —
  it needs its own reason, its own audit entry, and its own reversal action,
  because unlike a routine badge change it's a disciplinary step.
- Every rung is logged: actor, target, reason, timestamp — same
  audit-everything rule as §1.

Account status always overrides badges: a restricted, suspended, or banned
user's badges (trusted publisher, copy editor, verified) are inert for as
long as the rung is in effect — e.g. a suspended trusted publisher's queued
content does not auto-publish, even after they're unsuspended, without a
fresh review.

---

## 5. Roles and ranking

| Rank | Role | Definition |
|---|---|---|
| 0 | Visitor | Not registered, or registered but not yet verified. |
| 1 | Persona | Registered and verified. |
| 2 | Contributor | Registered and verified, with permission to create and edit their own content. |
| 3 | Moderator | Same base permissions as Contributor, plus monitoring contributors/verified users and enforcing entity guidelines. |
| 4 | Admin | Extended permissions over entity accountability. |
| 5 | Super Admin | Same as Admin, plus can edit and archive anything belonging to that entity. |

Rank is always relative to the acting user's **entity** — a professional's
`admin` only outranks other members of that same professional's org/account,
it does not outrank a `moderator` in a different entity.

---

## 6. Promote / demote rules

**This entity-scoped request+approval workflow is `organization`-only**
(decided post-Phase-6, `phase0-decisions.md` Addendum 5). `individual`,
`professional`, `partners`, and `suppliers` never have a real internal
"team" to manage rank within — `individual`/`professional` never get an
`entities` row linking their members together at all, and
`partners`/`suppliers` are capped at "persona + specific grants" with no
rank tier to promote/demote in the first place (§3). **Professional-kind
users' rank changes are handled directly by the platform**, via the
existing `/admin/users` role-management page — never through this
workflow. The old "professional entity's admin is self-exempt from the
approval rule" framing is therefore moot and has been removed: professional
entities don't reach this workflow at all, exempt or otherwise.

- **Promoting**: a rank can only promote someone to a rank *below* their own
  — never to their own rank or above.
- **Demoting**: same rule — only ranks below the actor's own.
- Every promotion/demotion is logged, with a reason.
- Promotions/demotions require sign-off from the rank above the actor —
  **except** the super admin, who needs no further approval. Since this
  workflow only ever applies within `organization` (per the "organization-
  only" note above), the only entity that ever exercises this exemption in
  practice is an organization's own super admin — the ceilings table's
  other capped entities either never reach this workflow (`individual`,
  `professional`) or have no rank tier to exempt in the first place
  (`partners`, `suppliers`).
- Promotion/demotion is not a toggle; it's a request submitted for approval,
  not an instant action.

### Separation of duties

No rank — including the entity's own super admin — may approve, revert, or
self-publish-bypass **their own** submission. Approval must always come
from a different person at or above the required rank. The one exception
is `platform` super admin acting under its "edit any content in any state"
authority (§8), which is itself logged distinctly rather than treated as a
normal approval. Without this rule, an admin or org super admin could
write and approve their own content with no independent review at all.

---

## 7. Actions — entity-scoped

These apply **within each entity only** — an org's admin acts on their own
org's users and content, not the whole platform. Platform-wide actions live
in §8 instead.

**Legend**
- ✅ — can do this to **their own** item
- ☑️ — can do this to items owned by someone **ranked below them**, within the same entity
- 🔑 — can do this to **anyone's** item within the entity (full entity-wide authority; effectively only the entity's super admin)

Where a cell has no symbol, that rank cannot perform the action at all.

| Action | Visitor | Persona | Contributor | Moderator | Admin | Super Admin | Notes |
|---|:---:|:---:|:---:|:---:|:---:|:---:|---|
| Submit a link | | ✅ | ✅ | ✅ | ✅ | ✅ | |
| Crawl articles | | | ✅ | ✅ | ✅ | ✅ | |
| Create / edit / archive article | | ✅ | ✅ | ✅☑️ | ✅☑️ | ✅🔑 | |
| Review article | | | ☑️ | ☑️ | ☑️ | ✅🔑 | |
| Approve article | | | | ☑️ | ☑️ | 🔑 | No ✅ (own) on this row, on purpose — nobody approves their own submission, not even the entity's own super admin. See §6 Separation of duties. |
| Revert article approval | | | | ☑️ | ☑️ | 🔑 | Same self-approval restriction as above. |
| Add / archive own RSS feed | | ✅ | ✅ | ✅ | ✅ | ✅ | |
| Create / edit plants | | | | ✅ | ✅ | ✅🔑 | |
| Import plants | | | | | ✅ | ✅ | Requires admin — a step up from "create/edit," since importing pulls in unreviewed external data. |
| Create / edit group | | | ✅ | ✅ | ✅☑️ | ✅🔑 | |
| Create / edit / archive product | | ✅ | ✅ | ✅☑️ | ✅☑️ | ✅🔑 | |
| Create / edit own compost listing | | | ✅ | ✅ | ✅ | ✅🔑 | No ☑️ tier — moderator/admin can't edit someone else's compost listing, only the entity super admin can. |
| Add / edit / remove own comment | | ✅ | ✅ | ✅☑️ | ✅☑️ | ✅🔑 | Everyone can add/edit/remove their own comment. Moderator+ can also cancel (remove) someone else's — moderator/admin within their rank tier, super admin entity-wide. |
| Create / edit / cancel own event | | | ✅ | ✅ | ✅ | ✅🔑 | Venue, amenities, and schedule sub-items follow the same tier. No ☑️ at moderator/admin — deliberately stricter than articles/products/groups, since one entity's event can have attendees from other entities (see §9, "why events/groups are platform-wide for archiving"). |
| Add / edit / cancel own event sponsor | | | ✅ | ✅ | ✅ | ✅🔑 | |
| Add / edit / cancel own event vendor | | | ✅ | ✅ | ✅ | ✅🔑 | Renamed from "supplier" to avoid confusion with the `suppliers` platform entity — this is a business/vendor listed on one event, unrelated to that entity type. |
| Send notification to entity members | | | | | ✅ | ✅ | |
| Donate | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | |
| Add / revert a like | | ✅ | ✅ | ✅ | ✅ | ✅ | |
| Send a direct message | | ✅ | ✅ | ✅ | ✅ | ✅ | |
| Create / edit / archive own course | | | ✅ | ✅ | ✅ | ✅🔑 | |
| Share / edit / archive upcycle project | | ✅ | ✅ | ✅ | ✅ | ✅🔑 | |
| Follow / unfollow a user | | ✅ | ✅ | ✅ | ✅ | ✅ | |
| Follow / unfollow an organization | | ✅ | ✅ | ✅ | ✅ | ✅ | |
| Follow / unfollow a professional | | ✅ | ✅ | ✅ | ✅ | ✅ | |
| Restrict / suspend / ban / lift a user | | | | | | 🔑 | |
| Join a group / RSVP | | ✅ | ✅ | ✅ | ✅ | ✅ | |
| Browse and read public content | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | |
| Self-service password reset | | ✅ | ✅ | ✅ | ✅ | ✅🔑 | Own reset for everyone; entity super admin can also reset anyone's within the entity. |
| Force-logout / revoke own sessions | | ✅ | ✅ | ✅ | ✅ | ✅ | |
| Force-logout / revoke someone else's sessions | | | | | ☑️ | 🔑 | |
| Grant / revoke "trusted publisher" within entity | | | | | ☑️ | 🔑 | A track-record-based, ongoing, per-entity decision — doesn't scale if every grant needs platform staff. The platform-wide version in §8 remains the default/override for entities with no local admin tier (`individual`, `partners`, `suppliers`). |
| Manage partner/supplier team roster (add/remove associated user IDs) | | | | | | 🔑 | `partners`/`suppliers` only, held by the entity's primary contact — see §3 "Partners/suppliers: primary contact." Does not grant any elevated permission by itself. |
| Demote | | | | | ☑️ | ☑️🔑 | Only ranks below the actor's own — see §6. |
| Promote | | | | ☑️ | ☑️ | ☑️🔑 | Only ranks below the actor's own — see §6. |

---

## 8. Actions — platform-wide (platform entity, applies across all entities)

These aren't scoped to one entity — they affect the whole platform or cross
entity lines, so only the `platform` entity's admin/super admin can act.

| Action | Visitor | Persona | Contributor | Moderator | Admin | Super Admin |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Create / edit / archive learning path | | | | ✅ | ✅ | ✅ |
| Add platform family | | | | | | ✅ |
| Edit platform family | | | | | ✅ | ✅ |
| Archive platform family | | | | | | ✅ |
| Edit / update legal content | | | | | | ✅ |
| Edit legal documents (Terms, Privacy) | | | | | | ✅ |
| Archive compost listing | | | | | | ✅ |
| Archive group | | | | | | ✅ |
| Archive event | | | | | | ✅ |
| Dissolve entity (`organization` / `partners` / `suppliers`) | | | | | | ✅ |
| Remove crawled article | | | | | ✅ | ✅ |
| Remove submitted link | | | | | ✅ | ✅ |
| Archive plants | | | | | | ✅ |
| Edit Platform UI content | | | | | | ✅ |
| Grant / revoke roles for other users | | | | | | ✅ |
| Reset another user's password | | | | | ✅ | ✅ |
| Restrict / suspend / ban / lift (platform-wide) | | | | | | ✅ |
| Grant / revoke "trusted publisher" — default/override | | | | | ✅ | ✅ |
| Verify an organization / practitioner account | | | | | ✅ | ✅ |
| Manage platform settings, taxonomy | | | | | | ✅ |
| Broadcast messages | | | | | ✅ | ✅ |

*"Grant/revoke trusted publisher" also has an entity-scoped version in §7 —
this platform-wide row is the fallback for entities with no local admin tier
(`individual`, `partners`, `suppliers`) and remains the override for
everyone else.*

*"Archive group," "archive event," and "dissolve entity" are here, not in
§7, because their blast radius extends beyond one entity — a group or event
created by one entity can include members/attendees from other entities,
and dissolving an entity affects its members and its cross-entity footprint
(§3) — only the platform can safely process these.*

---

## 9. Page / UI visibility

Covers top-level surfaces today; expansion to every page and element inside
the Admin Panel follows the same entity/platform split used in §7/§8.

| Page | Visitor | Persona | Contributor | Moderator | Admin | Super Admin |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Frontend | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Backend (raw infra access) | | | | | | ✅ |
| Admin Panel — dashboard | | | ✅ | ✅ | ✅ | ✅ |
| Admin Panel — review queue | | | | ✅ | ✅ | ✅ |
| Admin Panel — plants | | | | ✅ | ✅ | ✅ |
| Admin Panel — content | | | | | ✅ | ✅ |
| Admin Panel — comments | | | | | ✅ | ✅ |
| Admin Panel — users | | | | | ✅ | ✅ |
| Admin Panel — groups | | | | | ✅ | ✅ |
| Admin Panel — tickets | | | | | ✅ | ✅ |
| Admin Panel — donations | | | | | ✅ | ✅ |
| Admin Panel — sponsors | | | | | ✅ | ✅ |
| Admin Panel — suppliers/vendors | | | | | ✅ | ✅ |
| Admin Panel — broadcast | | | | | ✅ | ✅ |
| Admin Panel — submit URL | | | | | ✅ | ✅ |
| Admin Panel — site text | | | | | | ✅ |
| Admin Panel — configuration | | | | | | ✅ |
| Admin Panel — legal | | | | | | ✅ |

### Phase 5 surfaces (added when built — scoped pass, not an exhaustive re-audit)

Per `assessment.md` §5.3's own framing, this table only covers the
top-level surfaces that actually shipped in Phase 5 — entity-scoped pages
live under `/entity/[entityId]/*`, architecturally separate from
`/admin/*` per `phase0-decisions.md` (i). Rank column is **within that
entity**, not platform rank, for the entity-scoped rows (an organization's
own super admin is rank 5 in ITS entity, not necessarily platform rank 5).

| Page | Visitor | Persona | Contributor | Moderator | Admin | Super Admin | Notes |
|---|:---:|:---:|:---:|:---:|:---:|:---:|---|
| `/entity/register` (self-service registration) | | ✅ | ✅ | ✅ | ✅ | ✅ | Any authenticated user without an existing `entity_id` — not rank-gated beyond persona(1), same reasoning as the entity-conversion actions in §7. |
| `/entity/convert` (individual→professional, professional→organization) | | ✅¹ | | | | | ¹ Only reachable for `individual`/`professional`-entity users — see `entity.convert_*` rows in §7; not available to `organization`/`partners`/`suppliers` members at all (nothing to convert them into). |
| `/entity/[entityId]` (status, documents, dissolution, ban) | | | | | | | Visibility is entity-membership-gated, not rank-gated at the page level — any member can view; which ACTIONS render (dissolve/ban/verify) still follow §7/§8's per-action rank floors exactly, checked client-side via `usePermission` and re-enforced server-side. |
| `/entity/[entityId]/team` (members, role-requests, delegations, roster) | | | | | ✅ | ✅🔑 | Viewing the roster is open to any entity member (or the partners/suppliers primary contact); roster add/remove and delegation-grant actions still require super-admin(5)/primary-contact per §7. |
| Admin Panel — entity verification queue | | | | | ✅ | ✅ | Platform-wide (matches §8's "Verify an organization/practitioner account" row) — stays under `/admin/*`, not `/entity/*`, since it isn't scoped to any one entity. |

---

## 10. Delegation

The super admin (of an entity, or of the platform) can delegate specific
permissions to a specific user ID, on top of that user's normal role — not
every permission is delegable.

**Roadmap note:** delegating one action to one user ID at a time is fine at
small scale, but becomes hard to audit as the number of entities and
delegations grows ("delegation sprawl"). The plan is to eventually introduce
named **permission bundles** (a set of delegable actions an entity super
admin can assign as a single unit — e.g. "Content Ops" = manage articles +
manage events) rather than growing an ever-larger pile of one-off,
action-by-action grants. Not built in v1; tracked for a future iteration.

### Entity super admin → delegation within their own entity

Built from the 🔑 ("entity-wide") rows in §7 — each row below is otherwise
only reachable by the entity's own super admin. These are the actions
delegable to a specific trusted user ID, plus the two that stay
non-delegable on purpose.

✅ = can be delegated to this rank for this specific action, for a specific
user ID. ⬅️ = where the permission originates and is always retained by the
entity super admin by default.

| Action | Visitor | Persona | Contributor | Moderator | Admin | Super Admin |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Manage (review/approve/reject) any article in the entity | | | ✅ | ✅ | ✅ | ⬅️ |
| Manage any group in the entity | | | | ✅ | ✅ | ⬅️ |
| Manage any product listing in the entity | | | | ✅ | ✅ | ⬅️ |
| Manage any event in the entity | | | | ✅ | ✅ | ⬅️ |
| Manage any course in the entity | | | | ✅ | ✅ | ⬅️ |
| Reset a password for another entity member | | | | ✅ | ✅ | ⬅️ |
| Restrict / suspend / ban / lift a user | | | | | | ⬅️ *(not delegable)* |
| Promote / demote users | | | | | | ⬅️ *(not delegable)* |

Suspend/ban and promote/demote have no ✅ column anywhere on purpose — these
tie directly into the approval-chain rules in §6 and the "log everything"
baseline rule, and delegating them would undercut both, so they stay
exclusively with the entity super admin.

Delegated grants are automatically voided on any demotion, suspension, ban,
or entity departure of the grantee — a stale delegation tied to a user ID
that's no longer in the expected standing is not left to be manually
cleaned up.

### Platform super admin → delegation, platform-wide only

✅ = can be delegated to this rank for this specific action. ⬅️ = where the
permission originates and is always retained by default.

| Action | Visitor | Persona | Contributor | Moderator | Admin | Super Admin |
|---|:---:|:---:|:---:|:---:|:---:|:---:|
| Archive platform family | | | | | | ⬅️ |
| Edit / update legal content | | | | | ✅ | ⬅️ |
| Archive compost listing | | | | | | ⬅️ |
| Archive group | | | | | | ⬅️ |
| Archive plants | | | | | | ⬅️ |
| Edit Platform UI content | | ✅ | ✅ | ✅ | ✅ | ⬅️ |
| Restrict / suspend / ban / lift a user | | | | | ✅ | ⬅️ |
