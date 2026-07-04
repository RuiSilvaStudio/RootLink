---
type: Note
_width: wide
---
# User Logic & Permissions Review

> **Start here:** Part A below is the plain-language proposal — read this first,
> it's the part to discuss. Part B (further down) is the detailed technical
> audit of how things work *today*, kept for reference/proof, not required
> reading.

---

# Part A — Proposed Redesign (Draft, for discussion)

This is a first draft of "what good could look like," written in plain
language, no code. Nothing here is decided — it's a starting point for us to
argue about when you're back.

## The problem, in one paragraph

Today, "what a user can do" is decided by scattered little checks written
separately in ~15 different files, by different people, at different times.
Most of them agree with each other, but roughly 23 of them quietly disagree —
meaning our *highest* role (`super_admin`) can actually do **less** than a
regular `admin` in several places, because whoever wrote that one check forgot
to include it. There's no single place you could look at to answer "can a
moderator do X?" — you'd have to go check every feature one by one. That's not
a scalable way to run a growing platform with more roles, more content types,
and more community/organization structures coming.

## Proposed principles

1. **One ladder, one source of truth.** Roles are ranked (User < Contributor <
   Moderator < Admin < Super Admin), and every permission check should really
   just be "is this person's rank high enough?" — checked in exactly one
   shared place, not re-typed in every file. Fixes the "super_admin can do
   less than admin" bug at the root instead of patching 23 spots.
2. **Separate "who you are" from "what you're allowed to do right now."**
   Role = your rank. Status = are you allowed in at all right now (active /
   suspended / banned). Special badges = extra, opt-in trust earned over time
   (verified organization, trusted publisher, copy editor). Keep these three
   as independent dials, not tangled together — matches what we already have,
   just needs to be made explicit and consistent.
3. **Ownership always wins for your own stuff.** Regardless of role, you can
   always manage things you created (your own event, your own article, your
   own group) — role only matters for managing *other people's* stuff, or for
   platform-wide settings.
4. **Scoped roles for communities, not just one global ladder.** Groups
   already have their own local admin/moderator, separate from the site-wide
   ladder — that's the right idea, and should become the pattern we reuse for
   any future "community within the platform" feature (e.g. a local chapter,
   a marketplace co-op), rather than inventing a new one-off role system each
   time.
5. **Trust is earned and revocable, and it's an audit trail, not a toggle.**
   Every grant/suspend/ban/badge change is logged with who did it and why —
   we mostly already do this; it should become a hard rule for every future
   permission-changing action, no exceptions.
6. **Baseline account security is not optional.** Before scaling up who can do
   what, the basics need to exist: verifying an email actually belongs to the
   person, letting someone reset their own forgotten password, and being able
   to force-log-out a compromised account. None of these exist today.

## The matrix (proposed)

Plain-language capabilities down the side, roles across the top. This is a
first draft — capabilities and boundaries are very much up for debate.

| Can they... | User | Contributor | Moderator | Admin | Super Admin |
|---|:---:|:---:|:---:|:---:|:---:|
| Browse & read public content | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create/edit/delete **their own** posts, events, listings, comments | ✅ | ✅ | ✅ | ✅ | ✅ |
| Join groups, RSVP, message, follow | ✅ | ✅ | ✅ | ✅ | ✅ |
| Create courses / learning paths | — | ✅ | ✅ | ✅ | ✅ |
| Review submitted content (approve / reject / request changes) | — | — | ✅ | ✅ | ✅ |
| Moderate comments platform-wide (not just their own) | — | — | ✅ | ✅ | ✅ |
| Edit or delete **anyone's** content, event, listing, course | — | — | Own group only | ✅ | ✅ |
| Verify an organization/practitioner account | — | — | — | ✅ | ✅ |
| Grant/revoke "trusted publisher" (skip review queue) | — | — | — | ✅ | ✅ |
| Suspend / ban / unban a user | — | — | — | ✅ | ✅ |
| Manage platform settings, taxonomy, broadcast messages | — | — | — | ✅ | ✅ |
| Reset another user's password | — | — | — | ✅ | ✅ |
| Edit site-wide marketing copy / UI text | — | — | — | Only if separately granted | ✅ (built-in) |
| Edit legal documents (Terms, Privacy) | — | — | — | — | ✅ only |
| Archive or permanently delete a group | — | — | — | — | ✅ only |
| Grant/revoke roles to other users | — | — | — | — | ✅ only |

Notes on the table:
- Every row for Admin should logically also be "yes" for Super Admin — that's
  the whole point of the ladder. Today's biggest bug is that this isn't true.
- "Own group only" for Moderator reflects that group-level moderation should
  probably stay scoped to groups a moderator actually leads, not the whole
  platform — open question, discuss.
- Legal documents and full role-granting stay Super-Admin-only everywhere,
  intentionally the narrowest tier — these are the two things too sensitive
  to delegate even to Admin.

## Special trust badges (separate from role)

These aren't ranks — they're independent flags any eligible account can earn,
regardless of role, and can be revoked without touching the person's role:

- **Verified organization/practitioner** — a manually-checked "this is a real
  registered entity" badge. Should eventually require actual proof (document
  upload + human review), not just an admin's say-so.
- **Trusted publisher** — earned after a track record of approved content;
  skips the review queue. Should stay revocable and always logged.
- **Copy editor** — can edit site-wide marketing text. A delegation, not a
  role — Admins shouldn't get this automatically, and Super Admin always has
  it built in.

## Account status (separate axis again)

- **Active** — normal.
- **Suspended (temporary, timed)** — can still read, can't post/comment/rate;
  lifts automatically.
- **Banned (indefinite)** — fully locked out, including reading; their
  published content gets pulled down automatically.

This should stay completely independent from role — a Contributor and an
Admin can both be suspended the same way.

## Baseline account security to add regardless of the above

- Email verification at signup (we don't have this at all today).
- Self-service "forgot password" flow (today only an Admin can reset a
  password for someone).
- Ability to force-expire a user's login (e.g. after a password reset or a
  ban), so a compromised or removed account can't keep using an old session.

## Open questions for when you're back

1. Do we want a 5-tier ladder like today, or fewer/more tiers? (E.g. is
   "Contributor" pulling its weight as a distinct tier, or could it just be a
   badge on top of "User"?)
2. Should Moderators ever act platform-wide, or always scoped (to a group,
   a content type, a region)?
3. How formal should "verified organization" become — do we want document
   upload + review, or is admin's word good enough for now?
4. Do we want group-level roles (admin/moderator inside a group) to become a
   general pattern reused for other community structures, and if so, which
   ones first?
5. Is "Trusted publisher" (skip review queue) a risk we're comfortable
   scaling up, or should it stay rare/manual?

---

# Part B — Technical Audit (current, as-implemented)

Snapshot of the **current, as-implemented** user model, authentication, and
permission logic in RootLink, for review. Compiled 2026-07-02 by reading the
actual source (not just the spec). File:line references point at the current
`main` branch. Where behavior contradicts the documented design
(`docs/content-platform/CONTENT_PLATFORM.md`), this is called out explicitly —
see §8, which is also tracked in `TECH_DEBT.md` §0.

---

## 1. User model (`rootlink/backend/app/models/user.py`)

Table `users`, key fields:

| Field | Type | Notes |
|---|---|---|
| `id`, `email`, `name`, `password_hash` | — | bcrypt via passlib |
| `role` | `UserRole` enum, default `user` | see §2 |
| `account_status` | str(20), default `active` | `active \| suspended \| banned` |
| `suspended_until` | datetime\|null | auto-expiring suspension |
| `banned_at`, `ban_reason`, `banned_by` | — | permanent ban metadata |
| `is_verified` / `verified_at` | bool / datetime | admin-granted "verified organization/practitioner" badge — **not** email verification (no such thing exists, see §3) |
| `can_self_publish` | bool, default False | trusted-author grant, bypasses pre-moderation queue |
| `self_publish_agreed_at` | datetime\|null | user's acceptance of "Publisher Responsibility" agreement |
| `can_edit_copy` | bool, default False | site-copy editing delegation (Content UI Editor) |
| `account_type` | plain `String(20)`, default `"individual"` | **not** backed by the `AccountType` enum defined in the same file — no DB/Pydantic constraint against typos |
| `visible_in_network`, `locale`, `skills`, `interests`, profile fields | — | not permission-related |

Computed properties:
```python
@property
def is_banned(self) -> bool: return self.account_status == AccountStatus.banned

@property
def is_suspended(self) -> bool:
    # True only while active: auto-expires at suspended_until, no background job needed
    ...

@property
def can_author(self) -> bool:
    return not self.is_banned and not self.is_suspended
```
`can_author` is defined but **never actually called** — the real enforcement is a
hand-rolled, duplicated two-step in `core/security.py` (§3). Functionally equivalent
today, but a maintenance trap if the two drift apart.

**No reputation/points fields live on `User`.** Points are in separate tables
(`PointBalance`, `PointTransaction`), joined by `user_id`. "Boost" (paid content
promotion) requires `PointBalance.balance > 0` and `User.boost_active`.

---

## 2. Role hierarchy (`UserRole` enum)

```python
class UserRole(enum.StrEnum):
    super_admin = "super_admin"
    admin = "admin"
    moderator = "moderator"
    contributor = "contributor"
    user = "user"
```

Documented invariant (`CONTENT_PLATFORM.md` §4.1): `super_admin > admin > moderator >
contributor > user` — each role is supposed to be a strict superset of the one below.
**This invariant is currently broken in ~23 places** — see §8.

- **super_admin** — intended as the only role that can edit any content in any
  state; inherently holds `can_edit_copy`. Reserved for platform operators.
- **admin** — user management (ban/suspend/verify/self-publish grants), content
  moderation, settings, taxonomy, broadcast.
- **moderator** — review queue (approve/reject/needs_changes), comment moderation.
- **contributor** — enhanced content creation (courses, learning paths); eligible
  for `can_self_publish`.
- **user** — CRUD on own entities, follow, RSVP, message, comment.

---

## 3. Authentication & session logic

**Mechanism:** stateless JWT bearer tokens. No server-side sessions, no refresh
tokens, **no token revocation** (no denylist/allowlist, no "log out all devices").

- `create_access_token()` — HS256 JWT, `sub` = user id, expiry from settings.
- `get_current_user` — decodes JWT, loads `User`, **raises 403 if banned**. Used
  on almost every authenticated endpoint. Does *not* check suspension.
- `get_writable_user` — wraps `get_current_user`, additionally raises 403 if
  suspended. Used to gate authoring actions specifically (create/edit article,
  comment, rate) — read access stays available while suspended.
- `get_optional_user` — same decode, returns `None` instead of raising; silently
  treats banned users as anonymous.

**Registration/login** (`api/auth.py`):
- `POST /api/auth/register` — creates user, issues a token immediately.
  **No email verification step exists anywhere in the codebase.**
- `POST /api/auth/login` — rate-limited (5 req/60s, per `docs/LESSONS.md`),
  rejects banned users with 403 before issuing a token.
- `GET/PATCH /api/auth/me` — self profile view/edit.

**Gaps:**
- **No password-reset / forgot-password flow.** The only path to change a
  forgotten password is an admin manually resetting it via
  `PATCH /api/admin/users/{id}/password` — no old-password confirmation, no
  email loop, and since JWTs aren't revocable, the user's other active sessions
  aren't invalidated either.
- Frontend stores the token in `localStorage` (not an httpOnly cookie) —
  readable by any injected script (XSS-exposed). Logout is purely
  `localStorage.removeItem("token")` client-side.

---

## 4. Permission enforcement patterns

At least **four different, independently-implemented styles** of permission
check coexist in the API layer:

**(a) Central role-gate factory** — `admin.py` (`require_role()`):
```python
def require_role(allowed_roles: list[UserRole]):
    def _require_role(current_user: User = Depends(get_current_user)):
        if current_user.role == UserRole.super_admin:   # correct bypass
            return current_user
        if current_user.role not in allowed_roles:
            raise HTTPException(status_code=403, detail="Not enough permissions")
        return current_user
    return _require_role
```
Produces `require_super_admin` / `require_admin` / `require_mod` /
`require_contributor`, reused across ~40 admin endpoints and re-imported by
`content_templates.py`, `legal.py`. **This is the only place that correctly
treats `super_admin` as satisfying every gate.**

**(b) Strict single-purpose gates** — e.g. `content_ui.py` (exact
`role != super_admin`, no delegation), `copy.py` (`role == super_admin OR
can_edit_copy`).

**(c) Ownership-or-staff inline checks scattered per module** — three sub-flavors,
by how strict/consistent they are:
1. Enum-based, correctly including `super_admin`: `articles.py` (trusted-publish
   gate), `groups.py`'s `STAFF_ROLES` tuple.
2. Enum-based, **missing `super_admin`** (the bug, §8): `events.py`
   (`_check_event_owner`), `learning.py` (`_can_manage`, `_staff_only`),
   `content.py`, `articles.py` (other sites), `plants.py`, `marketplace.py`,
   `feeds.py`, `taxonomy.py`.
3. Bare exact-match string/`.value` comparisons (strictest — also excludes
   moderator): `marketplace.py`, `plants.py`, `taxonomy.py`.

**(d) Dedicated ownership helper** — `events.py: _check_event_owner()`:
creator or admin/moderator only; reused by ~15 event sub-resource endpoints
(venue, amenities, schedule, sponsors, vendors, check-in).

**(e) Comment moderation is split in two:** regular users can delete only their
own comment (filtered by `user_id`); staff-wide deletion is a separate
`require_mod`-gated admin endpoint.

**(f) Legal documents are the strictest surface**: all admin routes require
`super_admin` specifically (not delegable via `can_edit_copy`), per the file's
own docstring citing legal/compliance sensitivity.

---

## 5. Special / elevated permission grants

Three request schemas drive user-level enforcement actions, all admin-gated and
audit-logged (§6):

- **`SelfPublishGrant`** — toggles `User.can_self_publish`. Granting requires
  the target be `is_verified` **and** have ≥3 community-reviewed content items
  **and** have accepted the Publisher Responsibility agreement
  (`self_publish_agreed_at` set) — **unless** the granting admin is
  `super_admin`, who can override both eligibility checks. Effect: the user's
  new content publishes directly instead of entering the `in_review` queue.
- **`SuspendRequest`** (`until`, `reason`) — sets `account_status=suspended`,
  `suspended_until`. Cannot target self. Blocks authoring only (via
  `get_writable_user`); read access is retained. Auto-lifts at `suspended_until`
  — computed on read via the `is_suspended` property, no background job.
- **`BanRequest`** (`reason`) — sets `account_status=banned` plus
  `banned_at`/`ban_reason`/`banned_by`, **and bulk-archives all of the user's
  published content**. Cannot target self. Full lockout: `get_current_user`
  rejects every subsequent request (including reads), login also rejects.
- `unban` / `lift-suspension` / `unverify` mirror the above, resetting fields.
- All six actions require `admin` (or `super_admin`) — **not** `moderator`.
- `verify_user` / `unverify_user` toggle the org/practitioner "verified" badge
  (restricted to non-`individual` account types) — unrelated to the ban/suspend
  ladder, and notably **not itself logged** to the moderation audit log.

---

## 6. Moderation actions & audit log (`app/models/moderation.py`)

```python
class ModerationAction(enum.StrEnum):
    submit, approve, reject, needs_changes, appeal, edit_any,
    auto_allow, auto_review, auto_block,
    grant_self_publish, revoke_self_publish,
    grant_edit_copy, revoke_edit_copy,
    demote, restrict, suspend, lift_suspension, ban, unban
```

`ModerationAuditLog` is append-only: `actor_id` (null = system/automation),
`action`, `target_type`, `target_id`, `reason`, `reason_category`, `meta` JSON.

**As actually wired:**
- `approve`/`reject` on content → `require_contributor` / `require_mod`
  respectively, plus self-service `submit`/`appeal` by the content owner.
- `grant_self_publish`/`revoke_self_publish`, `suspend`/`lift_suspension`/
  `ban`/`unban` → `require_admin`.
- **`edit_any` is declared in the enum but never emitted anywhere.** The spec's
  "super_admin edits any content in any state, logged as `edit_any`" behavior
  has no code path — ordinary content-update endpoints don't special-case
  super_admin edits, and (per §8) several of them don't even let super_admin
  through the ownership check in the first place.
- **`demote`, `restrict`, `auto_allow`, `auto_review`, `auto_block` are declared
  but unused.** No demotion/restriction endpoint exists (only a blunt role-PATCH),
  and no automated content-scan pipeline exists yet (confirmed absent from
  `services/`/`tasks/` — matches the planned/future status in the spec).
- The `action` column is a plain `String(50)`, not an enum FK, so several
  ad-hoc string actions outside the enum are also logged in practice
  (`"archive_group"`, `"edit_content_ui"`, `"edit_copy"`,
  `"edit_legal_document"`, `"erase_account"`) — permitted, but undermines the
  enum's intent as a closed vocabulary.

---

## 7. Group-level roles (`app/models/group.py`)

A **separate role layer** exists at the group level, independent of site-wide
`UserRole`:

```python
class MemberRole(enum.StrEnum):
    member = "member"
    moderator = "moderator"
    admin = "admin"
```

`GroupMember(group_id, user_id, role)`. The group creator is auto-assigned
`MemberRole.admin` on creation. `_can_manage_group()` correctly combines both
layers: platform staff (`super_admin`/`admin`/`moderator`) **or** the creator
**or** a `GroupMember` with `role in (admin, moderator)` can edit the group.

**Gap:** there is no endpoint to promote/demote a member's group role after
joining (`join_group` always creates `role=member`) — in practice only the
creator ever holds group-admin. Group archival/hard-delete is
platform-`super_admin`-only, not delegable to group-level admins.

---

## 8. 🔴 Known issue: `super_admin` is not a strict superset of `admin`

**Already tracked as high priority in `TECH_DEBT.md` §0** (found 2026-07-02, while
trying to promote a production admin — worked around with a separate dedicated
`super_admin` account instead of promoting the real one).

The invariant `super_admin > admin > moderator > contributor > user`
(`CONTENT_PLATFORM.md` §4.1) is correctly implemented in `admin.py`'s
`require_role()` and a handful of ad-hoc checks (`copy.py`, `articles.py`,
`groups.py`'s `STAFF_ROLES`). **But 23 other authorization checks across 8
modules were written as `role in ("admin", "moderator")` or `role != "admin"`
and never updated to also include `super_admin`.**

Practical effect: **promoting a real admin to `super_admin` today makes them
lose capabilities** — cross-user edit/delete on articles, events, courses,
plants, marketplace listings, feeds, and taxonomy admin.

Affected files (full list in `TECH_DEBT.md` §0): `articles.py` (3 sites),
`content.py`, `events.py` (4 sites), `learning.py` (4 sites), `plants.py`
(5 sites), `marketplace.py` (2 sites), `feeds.py` (3 sites), `taxonomy.py`
(1 site, gates 7 endpoints).

**This same pattern has also leaked into the frontend** (not yet logged in
`TECH_DEBT.md`): the `isStaff` nav idiom in `NavBar.tsx`, `MobileNav.tsx`, and
the `/learning` pages checks only
`role === "admin" || "moderator" || "contributor"` — a `super_admin` would be
treated as non-staff by these nav/UI gates, on top of the backend 403s.

**Recommended fix** (per `TECH_DEBT.md`): don't patch each site individually.
Introduce a shared `is_staff_or_above(user, *, moderator_ok, contributor_ok)`
helper that always treats `super_admin` as satisfying everything, migrate all
23+ backend sites and the frontend `isStaff` idiom to use it, add test
coverage per resource kind, and only then promote any real admin account to
`super_admin`.

---

## 9. Frontend permission enforcement

`lib/auth-context.tsx` — token in `localStorage`, `user` typed `any`, fetched
from `GET /api/auth/me` on mount. No role-typed helper is exported — every
consumer re-derives its own boolean, which is the root cause of the
inconsistency in §8.

- **Admin shell gate** (`AdminSidebar.tsx`) — correctly includes `super_admin`
  in the allowed-roles list and in `isAdmin`/`isSuperAdmin`/`canEditCopy`
  derivations.
- **Content UI Editor** (`editor-mode-provider.tsx`) — strict
  `role === "super_admin"`, intentionally matching the backend.
- **"Create" menu** (`CreateMenu.tsx`) — correctly includes `super_admin`.
- **`isStaff` idiom** (`NavBar.tsx`, `MobileNav.tsx`, `/learning` pages) —
  **missing `super_admin`**, mirrors the backend bug (§8).
- Per-page ownership checks (`learning/courses/[id]`, `learning/paths/[id]`,
  `groups/[id]`, `events/[id]`) generally also omit `super_admin`.
- Route protection for `/admin/*` is **client-side redirect only** — no
  Next.js middleware; actual security is enforced by the backend rejecting
  unauthorized API calls, so at worst the admin shell flashes briefly before
  redirecting, with no data exposed.

---

## 10. Other gaps worth reviewing

1. **No password-reset flow** and **no email verification** (§3) — both
   commonly expected baseline auth features, currently absent entirely.
2. **`is_verified` is overloaded**: used both as an admin-granted
   org/practitioner trust badge (shown across marketplace/waste/social/users
   APIs) and as an input to self-publish eligibility, where
   `services/trust.py` labels it `"email_verified"` in the eligibility payload
   — misleading, since no email verification exists.
3. **`User.account_type` is a bare string**, not backed by the `AccountType`
   enum defined in the same file — no constraint against typos/drift, unlike
   `role` which does use a proper SQL enum.
4. **Tokens are non-revocable** and stored in `localStorage` — no refresh
   rotation, no server-side session table, no "log out all devices," and
   XSS-exposed by design of the storage choice.
5. **Inconsistent role-comparison idioms** in the same codebase:
   `role == "admin"` (string), `role == UserRole.admin` (enum),
   `role.value != "admin"` (`.value` unwrap), mixed string/enum tuples in
   `role in (...)`. All work today only because `UserRole` is a `StrEnum`, but
   they aren't interchangeable in intent — the `.value` exact-match forms are
   the most bug-prone (see §8's `marketplace.py`/`taxonomy.py`).
6. **`get_current_user` vs. `User.can_author` duplication** — the model
   defines `can_author` (not banned, not suspended) but it's never called; the
   real enforcement is a parallel hand-rolled two-step. Functionally
   equivalent today, but a maintenance trap if the two drift.
7. **`users.py: get_user_activity`** (a user's own tickets/donations/
   bookmarks) has no staff bypass — admins/moderators can't view another
   user's activity for support/moderation purposes, unlike almost every other
   resource in the app, which does grant staff visibility.

---

## Summary for review

- The **role hierarchy design** (`super_admin > admin > moderator > contributor
  > user`) is sound and documented, but **its implementation is inconsistent**:
  23+ backend checks and several frontend checks don't honor `super_admin` as a
  superset (§8) — this is the single biggest correctness risk and is already
  tracked as 🔴 high priority in `TECH_DEBT.md`.
- **Enforcement ladder** (suspend → ban) and **elevated grants**
  (self-publish, edit-copy) are implemented and audit-logged, but a few pieces
  of the spec (`edit_any`, `demote`/`restrict`, automated moderation actions)
  exist only as enum placeholders with no code path yet.
- **Baseline auth hygiene gaps**: no password reset, no email verification, no
  token revocation, `localStorage` token storage — these are more
  fundamental/security-relevant than the role-hierarchy bug and aren't yet
  tracked anywhere.
- **Group-level roles** are a reasonable secondary layer but have no
  promote/demote UI, so they're effectively single-admin (the creator) today.
