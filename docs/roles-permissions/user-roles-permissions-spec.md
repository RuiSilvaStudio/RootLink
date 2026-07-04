---
type: Note
_width: wide
---

# User Roles & Permissions — Spec (Draft v1)

Clean synthesis of `backlog/user-what-who.md` (the working notes and full
discussion history live there — this file is the polished, typo-free version
for reference and hand-off). Nothing here is final; see the **Decisions
log** and **§11 Best-practices & stress-test review** for what's settled,
adopted-as-default, or still genuinely open.

---

## 1. Baseline rules (apply to every entity and every role)

- Every user must be associated with exactly one **entity** (§3).
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

**Verified professional** — a registered professional with a NIF, an
activity registration number, and a verified email.

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
| `professional` | admin | No | The `platform` super admin is the override for anything beyond admin. |
| `organization` | **super admin** | **Yes** | An organization's own super admin has full authority *within that organization* (entity-scoped table, §7) — but platform-wide/cross-entity actions (archiving a mixed-membership group, editing legal docs, etc.) are still `platform`-super-admin-only (§8). |
| `platform` | super admin | Yes | The platform's super admin is the ultimate override for every entity. |
| `partners` | persona + specific grants | No | No moderator/admin/super admin tier at all — extra permissions are hand-granted per user ID by the platform super admin (e.g. legal updates access). |
| `suppliers` | persona + specific grants | No | Same model as partners (e.g. API/integration access granted per user ID). |

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
anything platform-wide (§8). This has to be a separate, explicit rule
rather than "just compare the numbers," otherwise it's the same class of
bug already found in the live codebase (`super_admin` failing to act as a
superset of `admin` in ~23 places, see `user-logic-review.md` §8) —
one level up, at the entity layer instead of the role layer.

### Bootstrapping a new entity

The person who completes an entity's registration/verification (§"How
entities are created") is automatically assigned that entity's top
reachable rank (`admin` for `professional`, `super admin` for
`organization`) with **no approval step** — same exemption logic as
`super admin` in §6. Without this, a brand-new entity would have nobody
able to approve its own first promotion.

---

## 4. Account status

Independent of role — a Contributor and an Admin can both be suspended the
same way.

- **Active** — normal.
- **Suspended (temporary, timed)** — can still read; can't post, comment, or
  rate. Lifts automatically at the set expiry.
- **Banned (indefinite)** — fully locked out, including reading. Their
  published content is pulled down automatically.

Account status always overrides badges: a suspended or banned user's badges
(trusted publisher, copy editor, verified) are inert for as long as the
status is in effect — e.g. a suspended trusted publisher's queued content
does not auto-publish, even after they're unsuspended, without a fresh
review.

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

- **Promoting**: a rank can only promote someone to a rank *below* their own
  — never to their own rank or above.
- **Demoting**: same rule — only ranks below the actor's own.
- Every promotion/demotion is logged, with a reason.
- Promotions/demotions require sign-off from the rank above the actor —
  **except** the super admin, who needs no further approval.
- **Exception for a capped entity's top rank**: in an entity whose ceiling
  has no rank above it locally — e.g. `professional`, capped at `admin`
  (§3) — that top rank is also exempt from needing approval, the same as
  `super admin`. Otherwise every internal promotion in a professional
  account would have to escalate to the platform super admin, which doesn't
  scale. *(Default adopted from the stress-test review — confirm this is
  what you want; the alternative is that platform approval really is
  intended for these, on the assumption they're rare.)*
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
| Suspend / ban / unban a user | | | | | | 🔑 | |
| Join a group / RSVP | | ✅ | ✅ | ✅ | ✅ | ✅ | |
| Browse and read public content | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | |
| Self-service password reset | | ✅ | ✅ | ✅ | ✅ | ✅🔑 | Own reset for everyone; entity super admin can also reset anyone's within the entity. |
| Force-logout / revoke own sessions | | ✅ | ✅ | ✅ | ✅ | ✅ | |
| Force-logout / revoke someone else's sessions | | | | | ☑️ | 🔑 | |
| Grant / revoke "trusted publisher" within entity | | | | | ☑️ | 🔑 | Moved here from platform-wide (§8) per the stress-test review — a track-record-based, ongoing, per-entity decision doesn't scale if every grant needs platform staff. The platform-wide version in §8 remains as the default/override for entities with no local admin tier (`individual`, `partners`, `suppliers`). |
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
| Remove crawled article | | | | | ✅ | ✅ |
| Remove submitted link | | | | | ✅ | ✅ |
| Archive plants | | | | | | ✅ |
| Edit Platform UI content | | | | | | ✅ |
| Grant / revoke roles for other users | | | | | | ✅ |
| Reset another user's password | | | | | ✅ | ✅ |
| Suspend / ban / unban a user (platform-wide) | | | | | | ✅ |
| Grant / revoke "trusted publisher" — default/override | | | | | ✅ | ✅ |
| Verify an organization / practitioner account | | | | | ✅ | ✅ |
| Manage platform settings, taxonomy | | | | | | ✅ |
| Broadcast messages | | | | | ✅ | ✅ |

*"Grant/revoke trusted publisher" also now has an entity-scoped version in
§7 — this platform-wide row is the fallback for entities with no local
admin tier (`individual`, `partners`, `suppliers`) and remains the override
for everyone else.*

*"Archive group" and "archive event" are here, not in §7, because a group or
event created by one entity can include members/attendees from other
entities — only the platform can safely tear that down.*

---

## 9. Page / UI visibility (WIP — incomplete, needs expansion to every page and element)

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

---

## 10. Delegation

The super admin (of an entity, or of the platform) can delegate specific
permissions to a specific user ID, on top of that user's normal role — not
every permission is delegable.

**Forward-looking note (not designed yet):** delegating one action to one
user ID at a time is fine at small scale, but becomes hard to audit as the
number of entities and delegations grows ("delegation sprawl"). Plan to
eventually introduce named **permission bundles** (a set of delegable
actions an entity super admin can assign as a single unit — e.g. "Content
Ops" = manage articles + manage events) rather than growing an
ever-larger pile of one-off, action-by-action grants.

### Entity super admin → delegation within their own entity

Draft fill-in, built from the 🔑 ("entity-wide") rows already in §7 — each
row below is currently only reachable by the entity's own super admin;
these are the ones that look like reasonable candidates to delegate down to
a specific trusted user ID, plus the two that should probably stay
non-delegable on purpose. **Please review — this is a first pass, not a
final answer.**

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
| Suspend / ban / unban a user | | | | | | ⬅️ *(not delegable)* |
| Promote / demote users | | | | | | ⬅️ *(not delegable)* |

Suspend/ban and promote/demote are shown with no ✅ column anywhere on
purpose — these tie directly into the approval-chain rules in §6 and the
"log everything" baseline rule, and delegating them would undercut both, so
they stay exclusively with the entity super admin.

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
| Suspend / ban / unban a user | | | | | ✅ | ⬅️ |

---

## Decisions log

Status of each judgment call made while cleaning this up, updated with your
feedback:

1. ✅ **Resolved** — Comments: everyone gets add/edit/remove on their own
   comment; moderator and up also get cancel (remove) permission on others'
   comments. Reflected in §7 as a single merged row.
2. ✅ **Confirmed** — "Archive event" added to the platform-wide table
   (§8) next to "archive group," and events deliberately have no ☑️ tier for
   moderator/admin in §7 (cross-entity attendee risk) — agreed as written.
3. ⏳ **Deferred, not decided yet** — Compost's permission tiers (no ☑️,
   only ✅ own + 🔑 super admin) are left as-is for now. You've flagged this
   is likely to change and you're not yet sure how — revisit later, don't
   treat the current shape as final.
4. ✅ **Confirmed** — "Import plants" requires admin+ while "create/edit
   plants" requires moderator+; kept as written.
5. ✅ **Filled in** — Entity-level delegation table (§10) now has a first
   draft, built from the entity-wide (🔑) actions in §7, with suspend/ban
   and promote/demote explicitly marked non-delegable. This is a first
   pass — please review before treating it as settled.
6. ✅ **Adopted from stress-test review** — Separation of duties (§6), entity
   precedence rule (§3), bootstrap rule for new entities (§3), badges
   suspended alongside account status (§4), trusted-user re-evaluation
   trigger (§2), and entity-scoped trusted-publisher grants (§7/§8). All
   have a concrete rule in the spec now — flag if any of these defaults
   aren't what you intended.
7. ⏳ **Adopted as a default, needs your confirmation** — Professional
   entities' top rank (`admin`) is exempt from the "approval from rank
   above" rule, same as super admin, since there's no local rank above it
   to approve (§6). The alternative — routing every professional's internal
   promotion through the platform super admin — is equally valid if you'd
   rather keep it that way.
8. ⏳ **Still open, no default adopted** — One entity per user (real users
   will likely want multiple hats — e.g. professional *and* individual);
   entity conversion/lifecycle (individual → professional → organization);
   entity dissolution cascade (what happens to members' ranks and content
   when an organization closes); cross-entity ban cascade (a banned
   organization's sponsor/vendor listings on another entity's event);
   partners/suppliers entities that outgrow a single person; and NIF as a
   Portugal-specific verification field. None of these have a confident
   single right answer — they need a decision from you, not an assumed
   default. See §11 sections B/C for the full reasoning on each.

---

## 11. Best-practices & stress-test review

Evaluated against standard access-control practice (NIST RBAC, OWASP Access
Control principles, least privilege, separation of duties) and stress-tested
for edge cases and scale. 🔴 = should be resolved before build. 🟡 = should
have an explicit answer, lower urgency. 🟢 = already solid, no action.

### A. What's already solid

- 🟢 **Deny-by-default.** Every table leaves blank = no access, nothing is
  implicitly granted. Correct default posture.
- 🟢 **Audit-everything rule.** Matches best practice (every privilege
  change traceable to an actor and a reason).
- 🟢 **Role separate from account status separate from badges.** Three
  independent dials (rank / active-suspended-banned / verified-trusted-copy
  editor) is exactly how mature systems avoid tangled one-off state.
  Suspending an Admin doesn't require touching their rank, revoking a badge
  doesn't require touching their status — clean.
- 🟢 **Entity scoping (§7 vs §8).** This is a legitimate multi-tenancy
  pattern (same shape as "org roles" in Slack/GitHub/Google Workspace) —
  each entity governs its own, platform governs the cross-cutting/shared
  parts.

### B. Gaps against best practice

**🔴 → ✅ Adopted, see §6 "Separation of duties."** No separation of duties for self-authored content. Right now a
`moderator`/`admin` who writes their own article can also approve/revert
their own article (§7: "create/edit/archive article" own = ✅, "approve
article" own = ✅☑️ at the same rank). Standard practice for any review
workflow (see also: PR approvals, financial sign-off) is that the author of
a thing should never be the one who approves it, regardless of their rank —
only `super admin` (per the existing "edit any state" concept) should be
exempt from this. Recommend an explicit rule: *"no rank may approve, revert,
or self-publish-bypass their own submission — approval must come from a
different person at or above the required rank."*

**🔴 → ✅ Adopted, see §3 "Bootstrapping a new entity."** No bootstrap rule for a brand-new entity. Promotion/demotion (§6)
requires sign-off from "the rank above the actor." A newly created
`organization` has nobody yet — who becomes its first `super admin`?
(Compare: the current codebase auto-assigns a group's creator as that
group's admin on creation — same pattern likely needed here.) Needs an
explicit rule: *the person who completes entity registration/verification
is automatically assigned that entity's top rank, with no approval step
(same exemption logic as super admin in §6).*

**🔴 → ✅ Adopted (as a default, please confirm), see §6 "Exception for a
capped entity's top rank."** The "approval from rank above" rule creates a
dead end for `professional` entities. `professional` caps at `admin` with **no local
super admin** (§3). So when a professional's `admin` wants to promote or
demote someone, §6 says they need sign-off from the rank above — which
doesn't exist locally, so it must escalate to the **platform** super admin.
At scale (thousands of professional accounts), routing every single
internal role change through platform staff doesn't scale. Needs an
explicit decision: either (a) a professional entity's `admin` is
self-exempt from approval the same way `super admin` is, since there's
nowhere higher to go locally, or (b) confirm platform approval really is
intended here (e.g. because professional-entity promotions are expected to
be rare).

**🔴 → ✅ Adopted, see §3 "Entity precedence (platform always overrides)."**
Two independent axes (entity precedence + role rank) must not collapse
into one comparable number. An `organization`'s `super admin` is rank 5.
The `platform`'s `admin` is rank 4. If this is ever implemented as "compare
the numbers," a platform admin (4) would look *lower* than an org's super
admin (5) — which is backwards; the platform entity should always take
precedence regardless of local rank. This is the exact same class of bug
already found in the current codebase (`TECH_DEBT.md` §0 — `super_admin`
not a strict superset of `admin` in ~23 places), just one level up: instead
of "role vs role," it's "entity vs entity." Needs an explicit, separate
"entity precedence" rule stated in the spec (`platform` > every other
entity, always, independent of rank number) so whoever builds this doesn't
reach for a single sortable integer.

**🟡 → ✅ Adopted, see §7 "Grant/revoke trusted publisher within entity"
and §8's updated "default/override" row.** Trust-badge grants are
platform-exclusive, which won't scale.
"Grant/revoke trusted publisher" (§8) is platform-admin-only, even for an
organization's own vetted internal writer. As the platform grows past a
handful of organizations, this means platform staff personally sign off on
every trust grant, everywhere. "Verify an organization" makes sense to keep
platform-only (a neutral, one-time check), but "trusted publisher" is a
track-record-based, ongoing, per-entity decision — it fits the delegation
model in §10 much better than the platform-exclusive table. Recommend
moving it to entity-scoped (each entity's own super admin grants it within
their entity), keeping platform's version only as an override.

**🟡 → 📝 Noted, see §10 "Forward-looking note" (not designed yet, just
flagged for later).** Delegation is per-user-ID with no grouping mechanism. §10 delegates
one action to one user ID at a time. At small scale this is fine; at
hundreds of organizations each delegating several actions to several
people, this becomes a large, hard-to-audit pile of one-off exceptions
("delegation sprawl" — a well-known RBAC anti-pattern). Recommend at least
planning for a "permission bundle" (a named set of delegable actions an
entity super admin can assign as a unit, e.g. "Content Ops" = manage
articles + manage events) rather than granting action-by-action forever.

**🟡 → ✅ Adopted, see §2 "Trusted user" definition.** No stated
re-verification trigger for "trusted user." §2 defines
trust as "3 articles, no negative reviews, agreement signed" — but doesn't
say what happens if one of those 3 articles is later successfully appealed
or found to be in violation *after* trust was granted. Needs a rule: losing
one of the qualifying articles (or a new negative outcome) triggers
automatic re-evaluation, not just a manual admin review if someone happens
to notice.

**🟡 → ✅ Adopted, see §4 "Account status always overrides badges."** If a
`trusted publisher` gets suspended, does their bypass-the-review-queue power
pause too, or could content they queued before suspension still auto-publish
once they're unsuspended? Recommend stating explicitly: account status
(§4) always overrides badges — a suspended/banned account's badges are
inert while the status is in effect, not just their base role permissions.

### C. Edge cases stress-tested

1. **One entity per user (§1: "every user must be associated with exactly
   one entity").** Real usage will break this: a professional who's also
   just an individual community member outside of work, or someone who
   volunteers as an org's admin while also being an independent
   professional on the side. Today's model forces separate accounts for
   each hat. Worth deciding now whether that's acceptable (simpler to build,
   matches the current codebase's single `account_type` field) or whether
   you want a "primary entity + secondary affiliations" model later — much
   harder to retrofit than to decide up front. 🔴 given it directly affects
   the data model.

2. **Entity conversion/lifecycle.** If an `individual` becomes a
   `professional`, or a `professional` later forms an `organization`, is it
   the same account transitioning, or a new one? What happens to their
   existing content, rank, and trust badges? Not specified.

3. **Entity dissolution.** If an `organization` is archived/closes, what
   happens to (a) its members' ranks — do they revert to `individual`? —
   and (b) content they created? Same cascading question already answered
   for a *banned user* (§4: content pulled down) isn't answered for a
   *dissolved entity*.

4. **Cascading revocation of delegated grants.** If an entity's super admin
   delegates "manage any event" to a specific contributor (§10), and that
   contributor is later demoted or leaves, does the delegation auto-revoke,
   or dangle as a stale grant tied to a user ID that's no longer in the
   expected role? Recommend: delegated grants are automatically voided on
   any demotion, suspension, ban, or entity departure of the grantee — not
   just left to be manually cleaned up.

5. **Concurrent/self-conflicting approval requests.** If a promotion request
   is pending and either the proposer or the approver gets suspended/banned
   mid-process, the request should auto-cancel and log why, not sit in
   limbo or get silently approved by whoever's left.

6. **Partners/suppliers entities that grow beyond one person.** §3 caps
   these at "persona + specific per-user grants," with no admin/moderator
   tier at all. That's fine for a single freelance lawyer, but a partner
   entity that's actually a 20-person law firm has no internal way to
   designate "who's in charge of managing our own team's access" without
   going back to the platform super admin every time. Worth a deliberate
   decision on whether partners/suppliers ever need at least a lightweight
   "primary contact" tier.

7. **Cross-entity cascades.** An event created by Org A can have a sponsor
   from Org B (§7 notes). If Org B is banned, what happens to their sponsor
   listing on Org A's event? The spec handles a banned *user's own* content
   (§4) but not a banned *entity's* footprint on other entities' content.

8. **NIF as the verification field for "verified professional" (§2).** NIF
   is Portugal-specific. If the platform ever operates beyond Portugal, this
   field won't generalize. Low urgency today, but worth a note (e.g.
   "national tax/business registration ID") so it isn't baked into the data
   model as Portugal-only later.

### D. Scalability risks

**🔴 Matrix-as-source-of-truth risk (the same bug, one size bigger).** This
whole redesign exists because the current app's permission checks were
hand-written independently in ~15 files and drifted apart (`TECH_DEBT.md`
§0 — 23 places where `super_admin` isn't actually a superset of `admin`).
This spec is a **bigger** matrix than what's live today (6 entities × 6
ranks × 60+ actions × delegation exceptions, vs. 5 flat roles). If it gets
implemented the same way — hand-typed role checks scattered per endpoint —
it will drift even faster and be even harder to keep consistent. This spec
should become a single machine-readable **permissions registry**
(action → minimum rank + scope + delegable Y/N) that both the backend and
this document are generated from or validated against, not two things
maintained by hand in parallel.

**🔴 Moderation bottleneck for `individual`-entity content.** §3 already
notes platform staff moderate all `individual`/`partners`/`suppliers`
content by default, since those entities can never have their own
moderator. At current scale that's fine; at meaningful growth (the
`individual` entity is presumably where most regular community members
sit), 100% of that review load falls on a platform team that doesn't scale
linearly with user count. The existing "trusted publisher" bypass helps,
but the platform should plan now for either much faster human review
tooling or eventually wiring an automated pre-screen (the current codebase
already has unused `auto_allow`/`auto_review`/`auto_block` moderation
actions reserved for exactly this — see `user-logic-review.md` §6).

**🟡 Session/role-change propagation.** Any rank or status change (promote,
demote, suspend, ban) needs to take effect immediately, not whenever a
long-lived token happens to expire. The baseline already requires
force-logout (§1), but the spec should also state that **role/entity are
re-checked against the database on every request**, not cached in a token
for its full lifetime — otherwise a demoted admin keeps admin powers until
their token naturally expires.

**🟡 Page-visibility table doesn't yet reflect entity scoping (§9).** It's
already flagged WIP, but worth folding in the same entity/platform split
used in §7/§8 when it's expanded — e.g. an organization's own "manage our
members" panel is a different surface from the platform's global
"AP-Utilizadores," and today's table doesn't distinguish them.

### Status after this update

All five 🔴 priority items and the 🟡 items with a clear best-practice
default have been folded into the spec (§2–§10), each marked in place with
where the fix lives. What's genuinely still open — because there's no
single right answer without a business decision from you — is tracked
below and in the **Decisions log**:

- One-entity-per-user (C.1) — kept as-is for now (matches the current
  codebase, simpler to build); the limitation is documented, not solved.
- Professional-entity approval exemption (adopted as a default) — please
  confirm, since the alternative (real platform approval, assuming these
  are rare) is equally valid.
- Entity conversion/lifecycle, entity dissolution cascade, cross-entity ban
  cascade, partners/suppliers internal hierarchy, and NIF localization
  (C.2, C.3, C.6, C.7, C.8) — not resolved, no confident default to adopt
  without your input; see Decisions log.
