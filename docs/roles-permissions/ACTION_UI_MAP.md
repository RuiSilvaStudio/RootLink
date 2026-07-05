---
type: Note
_width: wide
---

# Action → UI Map — manual QA cross-reference

> **Production URL:** https://rootlink.ruisilvastudio.com — this reference is
> for clicking through the **live, deployed** site, not local dev.
> **Status:** Built from a fresh read of `permissions_registry.py` (the
> source of truth, 67 actions), `ROLES_PERMISSIONS.md` §7/§8 (human wording),
> and `IMPLEMENTATION_STATUS.md` (what actually shipped, phase by phase),
> cross-referenced against the real `lib/api.ts` client and the frontend
> pages/components that call each method — not guessed from route names.
> **Purpose:** manual QA reference — map every permission-registry action to
> where it's actually exercised in the UI, so the product owner can click
> through and test each one on production.
> **Companion docs:** `ROLES_PERMISSIONS.md` (spec), `IMPLEMENTATION_STATUS.md`
> (build record) — read this file alongside those two, not instead of them.

## How to read this table

- **Action** — the exact key from `permissions_registry.py`.
- **Min rank** — the registry's documented floor (§7/§8's ✅ tier). Several
  endpoints enforce an older, *different* threshold on purpose (Phase 3
  deliberately didn't rewrite historical thresholds to match the redesigned
  registry — see that module's own docstring, point 3, and
  `phase0-decisions.md`). Where the live enforcement differs from the
  registry's number, it's called out in **Notes**.
- **Scope** — `entity` (acts within one organization/professional/etc.) or
  `platform` (platform-wide, cross-entity).
- **UI location** — the real route + the exact button/link/form label a
  tester should click. Where an action has no discoverable click path, it
  says **"No UI — API only"** (confirmed by grepping the frontend for every
  plausible `api.ts` client call and every page that might render it — not
  inferred from the route existing).
- **Notes** — gaps, role-gating caveats, or cross-references to another row
  covering the same page.

---

### Articles & Content Submission

| Action | Min rank | Scope | UI location | Notes |
|---|---|---|---|---|
| `link.submit` | persona | entity | `/submit` and `/admin/submit` — **"Submit URL"** tab of the shared `SubmitForm` component (paste a URL, pick a category, "Submit") | Same form/component rendered on both routes; `/admin/submit` is just the admin-panel-chrome wrapper around it. |
| `article.crawl` | contributor | entity | `/submit` and `/admin/submit` — **"Search & crawl"** tab of the same `SubmitForm` (search a topic, auto-crawl candidate results) | |
| `article.create_edit_archive_own` | persona | entity | `/articles/new` (new article editor, "Publish"/"Save draft"), `/articles/edit/[id]` (same editor for an existing draft/article you own), `/articles/my` (your own list, links into edit) | "Archive" isn't a separate button — deleting your own draft is `DELETE /api/articles/{id}` (`api.articles.delete`); confirmed wired but no visible trash-icon found in a quick pass of `/articles/my` — verify manually if testing deletion specifically. |
| `article.review` | contributor | entity | `/admin/review-queue` — **"Mark reviewed"** button (only shown while status is `in_review`) | **Fixed 2026-07-04** (`UI_BUILD_BACKLOG.md`): now a real, distinct step (`PATCH /api/admin/content/{id}/review`), not collapsed into Approve. Sets status to `reviewed` — an optional waypoint, not a required gate (a moderator can still approve directly from `in_review`, no strict ordering). |
| `article.approve` | moderator | entity | `/admin/review-queue` and `/admin/content` — **"Approve"** button, works from either `in_review` or `reviewed` | **Enforcement mismatch fixed 2026-07-04:** now genuinely requires moderator+ (previously reachable at contributor+, since a contributor-level "review" step is meaningless if any contributor can also approve directly). Also newly enforces the §6 separation-of-duties rule: 403 if the approver is the article's own author (previously ungated). |
| `article.revert_approval` | moderator | entity | `/admin/content` — **"Revert approval"** button (shown once an item's status is `community_reviewed`) | **Fixed 2026-07-04:** now its own endpoint (`PATCH /api/admin/content/{id}/revert-approval`), split from `reject`/"Unreview" — goes back to `in_review` (fresh pass through the two-step flow), not `rejected` (that status is reserved for denying a submission that was never approved, and stays wired to the existing reject/appeal flow, untouched). |
| `article.remove_crawled` *(platform)* | admin | platform | `/admin/content` — **"Delete"** button | See platform table below; repeated here because it's the same page as the entity-scoped review actions. |
| `link.remove_submitted` *(platform)* | admin | platform | `/admin/content` — **"Delete"** button (same button as above) | `Content` rows for crawled articles and submitted links share one table/model and one Delete button — there is no separate UI distinguishing the two action names. Enforced at **moderator+** in the real endpoint (`require_mod`), not admin+ as the registry states. |

### Feeds (RSS)

| Action | Min rank | Scope | UI location | Notes |
|---|---|---|---|---|
| `feed.add_archive_own` | persona | entity | `/settings/feeds` — **"Connect a feed"** form (feed URL + optional site URL), **"Disconnect"** button per connected feed | "Verify" and "Refresh" buttons also live here but aren't separate registry actions. |

### Plants

| Action | Min rank | Scope | UI location | Notes |
|---|---|---|---|---|
| `plants.create_edit` | moderator | entity | `/admin/plants` — **"Add plant"** form / pencil **edit** icon per row | Enforced at **contributor+** in the real endpoint, not moderator+ (documented Phase 3 non-migration). |
| `plants.import` | admin | entity | `/admin/plants` — **"Crawl UTAD"** (single scientific name) and **"Crawl all"** buttons | Enforced at **contributor+** in the real endpoint (same gap as above — not yet migrated to the registry's admin+ floor). |
| `plants.archive` *(platform)* | super_admin | platform | `/admin/plants` — trash-icon **"Delete"** button per row | Hard delete, not a soft archive. Enforced at **admin+** in the real endpoint, not super_admin (documented gap, `TECH_DEBT.md` §0 cutover note in `plants.py`). |

### Groups

| Action | Min rank | Scope | UI location | Notes |
|---|---|---|---|---|
| `group.create_edit` | contributor | entity | `/groups` — **"+ New group"** button/form; `/groups/[id]` — pencil **"Edit"** icon (owner, or `canManage`) | The "+ New group" button has no client-side rank gate — any signed-in user sees it; the backend enforces contributor+. |
| `group.manage_any` | moderator | entity | Same `/groups/[id]` **"Edit"** icon — rendered when `canManage` is true (`created_by === you`, OR your platform role is `super_admin`/`admin`/`moderator`, OR your **per-group** membership role is `admin`/`moderator`) | This is the delegable entity-wide "manage any group" tier, sharing its UI with the "own item" row above — there is no second, separate button. |
| `group.archive` *(platform)* | super_admin | platform | `/admin/groups` — **"Archive"** button per row | Client-side gated strictly to `role === "super_admin"` (a non-super-admin sees "Super admin only" text instead of a button). **Backend gate fixed 2026-07-04:** the endpoint used the rank-only `require_super_admin`, which wrongly passed an organization's *own* rank-5 super admin — spec §8 says platform-only. Now gated by `can(user, "group.archive")` (the registry check, `platform` scope), so an org's super admin correctly 403s. Surfaced while building `event.archive` with the registry gate; regression test `test_org_super_admin_cannot_archive_group` in `tests/test_groups_manage.py`. |
| `group.join_rsvp` | persona | entity | `/groups/[id]` — **"Join"** / **"Leave"** button | |

### Products / Marketplace

| Action | Min rank | Scope | UI location | Notes |
|---|---|---|---|---|
| `product.create_edit_archive` | persona | entity | `/marketplace/create` (new listing form), `/marketplace/edit/[id]` (edit form), `/marketplace/[id]` — **"Edit"** / **"Delete"** buttons (owner only) | |
| `product.manage_any` | moderator | entity | `/marketplace/[id]` — the same **"Edit"** / **"Delete"** buttons, now rendered when `isOwner \|\| can("product.manage_any")`, with a stone **"Moderation"** badge/hint when acting as non-owner | **Built 2026-07-04** (`UI_BUILD_BACKLOG.md`). Also fixed the backend enforcement floor: `PUT`/`DELETE /api/marketplace/listings/{id}` previously required admin(4); lowered to moderator(3) to match the registry (spec is source of truth — same class of fix as the earlier `article.approve` floor). Covered by `tests/test_marketplace_manage_any.py`. |
| `compost_listing.create_edit_own` | contributor | entity | `/composting` — inline **Edit** (pencil icon) on a hub card, own hub or (for org members) your organization's own super admin editing a fellow member's hub | **Built 2026-07-04** (`UI_BUILD_BACKLOG.md`): this action governs the existing `/composting` community hub feature (`CompostingHub`) — not a separate marketplace-style listing. `PATCH /api/waste/hubs/{id}` edits name/description/location/capacity/materials/hours/status(active-full-closed); creation (`POST /hubs`) also newly gated contributor+ (previously ungated for any logged-in user). |
| `compost_listing.archive` *(platform)* | super_admin | platform | `/composting` — **Archive** icon, platform super admin only (`user.role === "super_admin"` client gate) | **Built 2026-07-04:** `POST /api/waste/hubs/{id}/archive` — deliberately unreachable by the hub's own manager or an entity's own super admin (same "blast radius crosses entities" reasoning as `group.archive`/`event.archive`). Archived hubs are excluded from the default `GET /hubs` listing. |

### Courses & Learning

| Action | Min rank | Scope | UI location | Notes |
|---|---|---|---|---|
| `course.create_edit_archive_own` | contributor | entity | `/learning`, `/learning/courses` — **"+ New course"** button (shown when `can("course.create_edit_archive_own")`); `/learning/courses/new`, `/learning/courses/[id]/edit` | Uses the real registry via `usePermission()` — one of the cleanest Phase 3 wire-ups. |
| `course.manage_any` | moderator | entity | `/learning/courses/[id]`, `/learning/page` — **"Edit"** controls shown when `can("course.manage_any") \|\| course.created_by === you` | |
| `learning_path.create_edit_archive` *(platform)* | moderator | platform | `/learning/paths`, `/learning` — **"+ New path"** button; `/learning/paths/new`, `/learning/paths/[id]/edit` | **Registry-key mismatch, documented in the code itself:** the frontend gates this on the entity-scoped `can("course.create_edit_archive_own")` key, *not* a distinct `learning_path.create_edit_archive` check — `app/learning/paths/page.tsx`'s own comment explains the backend's `_staff_only`/`_can_manage` helpers enforce identical thresholds for courses and paths, so reusing the course key isn't a bug, just a registry/UI naming divergence worth knowing about when testing rank floors for paths specifically. |
| `upcycle_project.share_edit_archive` | persona | entity | `/upcycling` — **"Share a project"** form | |

### Comments

| Action | Min rank | Scope | UI location | Notes |
|---|---|---|---|---|
| `comment.add_edit_remove_own` | persona | entity | `CommentSection` component (embedded on articles, groups, events, plants, etc.) — comment box + **Send** icon to add, pencil **Edit** icon → inline edit mode (textarea + **Save**/**Cancel**) on your own comments (nested replies included), trash icon to remove your own | **"Edit" built 2026-07-04** (`UI_BUILD_BACKLOG.md`) — this row's former "degraded, not absent" status is fully resolved. New `PATCH /api/comments/{comment_id}` (owner-only — 403 otherwise, 404 missing, body `min_length=1`, refreshes `updated_at`; the comment response schema now includes `updated_at`). UI details: Escape cancels, textarea autofocuses, an **"(edited)"** marker shows when `updated_at − created_at` > 60s, and a failed save keeps edit mode open with an inline error (i18n `content.edit_failed`). Covered by `tests/test_comment_edit.py` (7 tests). Moderator/admin cancelling someone else's comment (the ☑️/🔑 tier) still uses the same trash icon, gated server-side by rank — edit remains strictly owner-only. |

### Events

| Action | Min rank | Scope | UI location | Notes |
|---|---|---|---|---|
| `event.create_edit_cancel_own` | contributor | entity | `/events` — **"+ New event"** button; `/events/[id]` — Edit/Cancel/Delete controls (owner only, `isOwner` gate) | |
| `event.manage_any` | moderator | entity | `/events/[id]` — **all** owner-gated management controls now render when `isOwner \|\| can("event.manage_any")`: header **Edit**/**Delete** (now with aria-labels), schedule add/remove, venue form, amenities add/delete, sponsors add/remove/visibility-filter, vendors add/form/delete; a stone **"Moderation"** badge shows when acting as non-owner | **Built 2026-07-04** (`UI_BUILD_BACKLOG.md`). The backend (`_check_event_owner`) already allowed moderator+ — this was purely the render-condition fix, same pattern as `product.manage_any`. |
| `event_sponsor.add_edit_cancel_own` | contributor | entity | `/events/[id]` — **Sponsors** tab, add/edit/remove controls (event owner only) | |
| `event_vendor.add_edit_cancel_own` | contributor | entity | `/events/[id]` — **Vendors** tab, add/edit/remove controls (event owner only) | Renamed from "supplier" in the spec to avoid confusion with the `suppliers` platform entity — same UI either way. |
| `event.archive` *(platform)* | super_admin | platform | `/admin/events` — search/list table with a platform-super-admin-only rust **Archive** button per row (`can("event.archive")` client gate via `usePermission`, not a bare role check — an org's own super admin must not see it) | **Built 2026-07-04:** `POST /api/admin/events/{id}/archive`, gated by `can(user, "event.archive")` (the `compost_listing.archive` pattern, NOT a rank-only `require_super_admin` check, which would wrongly pass an org's own rank-5 super admin — the exact latent gap this build surfaced and fixed in `group.archive` itself the same day, see that row). Idempotent, soft (`status="archived"` + new `archived_at` column via idempotent lifespan migration, RSVPs preserved), notifies RSVP'd attendees, audit-logged as `archive_event`. Archived events are excluded unconditionally from the public `GET /api/events/` list and 404 on detail for non-staff; staff list them via `GET /api/admin/events` (moderator+, q/limit/offset, includes archived). Covered by `tests/test_event_archive.py` (6 tests). |

### Social — Follow, Like/Rate, Messages, Donations

| Action | Min rank | Scope | UI location | Notes |
|---|---|---|---|---|
| `user.follow_unfollow` | persona | entity | `/profile?id={id}`, `/network` — **"Follow"** / **"Unfollow"** button | |
| `organization.follow_unfollow` | persona | entity | Same **"Follow"** button on `/profile?id={id}` when the profile's `account_type` is `organization` | There is only one generic follow mechanism (`api.social.follow/unfollow`) for any target user regardless of account type — no separate UI or endpoint per entity kind. |
| `professional.follow_unfollow` | persona | entity | Same **"Follow"** button, for `account_type === "practitioner"` profiles | Same shared mechanism as above. |
| `like.add_revert` | persona | entity | `ContentRating` component (articles/content detail pages) — thumbs-up / thumbs-down buttons; clicking the same reaction again removes it | Implemented as a "rating/reaction" (`api.ratings.rate`/`remove`, up/down + optional tags), not literally a "like" — functionally the closest match to add + revert. |
| `message.send_direct` | persona | entity | `/messages/[id]` — message box + send button | |
| `donation.donate` | visitor | entity | `/donate` (tier buttons → Stripe checkout via `api.points.donate`); `/events/[id]` — **Donate** button/amount field | Genuinely visitor-accessible per the registry's own note — verify the donate flow doesn't hard-require login if testing the visitor tier. |
| `group.join_rsvp` | persona | entity | `/groups/[id]` **"Join"**/"Leave"; `/events/[id]` — **RSVP** button | Listed here again for convenience; same action as the Groups section row. |
| `content.browse_read_public` | visitor | entity | N/A — implicit on every public page (articles, groups, plants, marketplace, events, courses, search) | Not a single button; this is "can you view the site without logging in at all," testable on any public route while logged out. |

### Entities & Team Management

| Action | Min rank | Scope | UI location | Notes |
|---|---|---|---|---|
| `entity.convert_individual_to_professional` | persona | entity | `/entity/convert` — form (tax registration ID + activity registration number), shown only when your account is currently `individual` | |
| `entity.convert_professional_to_organization` | persona | entity | `/entity/convert` — form (organization name), shown only when your account is currently `professional` | Both conversion forms live on the same page; only one renders depending on your current entity kind. |
| `entity.request_dissolution` | super_admin | entity | `/entity/[entityId]` — **"Request dissolution"** button (shown to that entity's own super admin when not yet a platform super admin) | Organization/partners/suppliers only. |
| `entity.dissolve` *(platform)* | super_admin | platform | `/entity/[entityId]` — same section shows **"Dissolve now"** instead, plus **"Approve dissolution"** / **"Reject request"** once a request is pending, all for the **platform** super admin | The page swaps wording/actions based on whether you're the entity's own super admin (request) vs. the platform's (immediate execute/approve) — same route, different buttons per viewer. |
| `entity.reverse_dissolution` *(platform)* | super_admin | platform | `/entity/[entityId]` — **"Reverse dissolution"** button, visible only within the 30-day grace window, platform super admin only | |
| `entity.ban` *(platform)* | super_admin | platform | `/entity/[entityId]` — **"Ban entity"** button, platform super admin only | Entity-level ban (an organization/partner/supplier), distinct from user-level ban (see Account/Session section — that one has no UI at all). |
| `entity.unban` *(platform)* | super_admin | platform | `/entity/[entityId]` — **"Unban entity"** button (replaces "Ban entity" once banned) | |
| `entity.verify_organization_practitioner` *(platform)* | admin | platform | `/admin/entity-verification` (read-only queue, links out to each entity), `/entity/[entityId]` — **"Approve"** / **"Request more info"** / **"Reject"** buttons (staff review section); also `/admin/users` — Verify/Unverify checkmark icon for individual user-level verification | Two related-but-distinct verification surfaces: the entity-document review workflow (`/entity/[entityId]`) and the simpler per-user verified-badge toggle (`/admin/users`). Both gate on admin+. |
| `partner_team.manage_roster` | super_admin | entity | `/entity/[entityId]/team` — **"Add to roster"** (user-ID input + button) / **"Remove"** link per member | `partners`/`suppliers` entities only, gated to that entity's primary contact (or platform super admin), not to a rank-5 tier (those entity types have no rank ladder — see registry's own note). |

### Delegation

The super admin (entity or platform) can delegate a specific **delegable**
action to a specific user ID. There's one shared UI for granting/revoking
*any* delegable action — it isn't a per-action page.

| Where | UI location | Notes |
|---|---|---|
| Grant a delegation | `/entity/[entityId]/team` — **"Delegated permissions"** section: user-ID input + a dropdown of every action the registry marks `delegable: true` (populated live from `GET /api/permissions/registry`) + **"Grant"** button | Shown only to that entity's own super admin or the platform super admin (`canGrantDelegations`). |
| Revoke a delegation | Same section — **"Revoke"** link next to each active grant | **Added 2026-07-04:** the delegations list flags (amber Badge **"Grantee below action rank"** + tooltip) any active grant whose grantee's current rank is below the action's registry `min_rank` — a client-side stopgap over already-fetched data, so a super admin can spot and manually revoke stale grants while the §10 auto-void-on-demotion rule remains an open design decision (see `UI_BUILD_BACKLOG.md`). |
| Actions delegable through this UI | `article.review`, `article.approve`, `article.revert_approval`, `group.manage_any`, `product.manage_any`, `course.manage_any`, `event.manage_any`, `password.reset_entity_member` (entity-scoped, delegable ones), plus the platform-wide delegable ones (`legal.edit_update_content`, `platform_ui.edit_content`, `user.restrict_suspend_ban_lift_platform_wide`) | Cross-check against `permissions_registry.py`'s `delegable=True` entries — the dropdown is generated directly from the registry, so it will show exactly this list live; don't hand-maintain a separate list when testing. |

Note: there is **no dedicated platform-wide delegation-granting page** distinct
from the entity one — the same `/entity/[entityId]/team` form is used when
`entityKind === "platform"` too (the platform is itself modeled as an
entity for this purpose).

### Promote / Demote

| Action | Min rank | Scope | UI location | Notes |
|---|---|---|---|---|
| `user.promote` | moderator | entity | `/entity/[entityId]/team` — **"Promote / demote requests"** section: submit form (target user ID + new rank + reason) and **thumbs-up** approve icon under "Awaiting my approval" | Not a toggle — a request-then-approve workflow (§6). Same form handles both promote and demote (direction is inferred from the target rank vs. current rank). |
| `user.demote` | admin | entity | Same section — same form, **thumbs-down** reject icon | |
| `user.grant_revoke_roles` *(platform)* | super_admin | platform | `/admin/users` — role **`<select>`** dropdown per row (values: user/contributor/moderator/admin/super_admin) | This is the older, direct, non-request-based role change (`PATCH /api/admin/users/{id}/role`) — distinct from the Phase 4 request+approval workflow above. Both exist simultaneously; this one is instant, no approval step. |

### Account / Session / Trusted Publisher

| Action | Min rank | Scope | UI location | Notes |
|---|---|---|---|---|
| `password.reset_own` | persona | entity | `/auth/login` — **"Forgot password?"** link → new page `/auth/forgot-password`: 3-step flow (email → token + new password → success) | **Built 2026-07-04** (`UI_BUILD_BACKLOG.md`). Calls `POST /api/auth/password/reset/request` then `/confirm` (the router in `app/api/auth_security.py` has prefix `/api/auth`, **not** `/api/auth-security` as earlier drafts of this doc said). Product-approved **dev-mode**: no email infrastructure exists, so the reset token is returned in the response and shown on-screen in a dev-note box (and pre-filled). 422 validation errors are mapped to friendly copy. |
| `password.reset_entity_member` | super_admin | entity | `/entity/[entityId]/team` — key-icon **"Reset password"** button per member row (hidden on your own row) | **Built 2026-07-04**, including the previously-missing backend endpoint: `POST /api/entities/{entity_id}/members/{user_id}/reset-password` (min 6 chars; caller must be that entity's own super admin, rank 5, or the platform super admin via `can()`; target must be a member of that entity else 404; also revokes the target's sessions; audit action `reset_member_password`). Covered by `tests/test_entity_member_admin_actions.py`. |
| `password.reset_other_platform_wide` *(platform)* | admin | platform | `/admin/users` — key-icon **"Reset password"** button (prompts for a new password, then confirms) | |
| `session.revoke_own` | persona | entity | `/profile` — settings tab, new **Security** card: **"Log out of all devices"** button | **Built 2026-07-04.** Calls `POST /api/auth/sessions/revoke-mine` (router prefix `/api/auth`, not `/api/auth-security`). Copy deliberately says **all** devices (not "other") — the endpoint revokes every session including the current one; the UI then logs out locally. |
| `session.revoke_other` | admin | entity | `/admin/users` — per-row **"Force logout"** button; also fired automatically after Suspend/Ban (see the restrict/suspend/ban rows below) | **Built 2026-07-04.** Real endpoint path is `POST /api/auth/sessions/{user_id}/revoke` — the router in `app/api/auth_security.py` has prefix `/api/auth`, **not** `/api/auth-security` (earlier drafts of this doc cited the wrong prefix). |
| `user.restrict_suspend_ban_lift` | super_admin | entity | **No entity-scoped UI yet** — the controls built 2026-07-04 live on `/admin/users` (platform admin panel, see the row below); an entity's own super admin still has no restrict/suspend/ban controls on any entity roster view | The backend endpoints (`/api/admin/users/{id}/restrict`, `/lift-restriction`, `/suspend`, `/lift-suspension`, `/ban`, `/unban` — Phase 4) now have UI for the platform-wide sibling action; only this entity-scoped surface remains unbuilt. |
| `user.restrict_suspend_ban_lift_platform_wide` *(platform)* | super_admin | platform | `/admin/users` — per-row **status ladder** `<select>` offering only the valid transitions from the row's current `account_status` (active→restrict/suspend/ban; restricted→lift/suspend/ban; suspended→lift/ban; banned→unban), reason captured via `prompt()`, suspend asks for a number of days (converted to an ISO `until`); plus a status Badge per row (amber restricted/suspended with an until-date tooltip, red banned) | **Built 2026-07-04** (`UI_BUILD_BACKLOG.md`). Suspend/Ban also automatically revoke the target's sessions (see `session.revoke_other` above). Do not confuse with `entity.ban`/`entity.unban` (organization-level ban), which has its own UI at `/entity/[entityId]`. |
| `trusted_publisher.grant_revoke_entity` | admin | entity | `/entity/[entityId]/team` — **PenLine** toggle per member row + sage **"Trusted publisher"** badge (hidden on your own row) | **Built 2026-07-04**, including the previously-missing backend endpoint: `PATCH /api/entities/{entity_id}/members/{user_id}/self-publish` (same auth as the entity reset-password endpoint; eligibility + agreement **required** on grant unless the caller is a platform super admin). `EntityMemberResponse` now includes `can_self_publish`. Covered by `tests/test_entity_member_admin_actions.py`. |
| `trusted_publisher.grant_revoke_platform_default` *(platform)* | admin | platform | `/admin/users` — per-row **PenLine** toggle | **Built 2026-07-04.** Calls `PATCH /api/admin/users/{id}/self-publish`. The platform admin grant is a manual override with **no** eligibility gate — intended: this is the fast-track/override path; the entity-scoped grant above is the one that enforces eligibility + agreement. |

### Platform Admin / Settings

| Action | Min rank | Scope | UI location | Notes |
|---|---|---|---|---|
| `platform_family.add` | super_admin | platform | `/admin/config` — **"Add Family"** form | |
| `platform_family.edit` | admin | platform | `/admin/config` — inline click-to-edit fields on each family row | |
| `platform_family.archive` | super_admin | platform | `/admin/config` — trash-icon **"Delete"** per family | Hard delete (removes the family and its categories), not a soft archive — same naming looseness as `plants.archive`/`group.archive`. |
| `platform.manage_settings_taxonomy` | super_admin | platform | `/admin/config` — the whole families/categories tree (add/edit/delete families and categories) | The **generic key-value Settings store** (`api.admin.listSettings/getSetting/updateSetting`) is a separate, real backend feature with **no UI at all** — grepped the whole frontend, nothing calls it. Only the taxonomy half of this action has a page. |
| `platform_ui.edit_content` | super_admin | platform | Global floating **"Edit page"** button (bottom of every page, via `EditorModeChrome`) — toggles inline WYSIWYG editing of text/images/icons directly on the page; `/admin/copy` — bulk **"Site Text"** key-by-key editor for the same underlying content | The floating toggle is hard-coded to `role === "super_admin"` only in `editor-mode-provider.tsx` (its own comment says so explicitly) — the registry's note that this is delegable all the way down to persona(1) is **not** reflected in the current gate; a delegation grant alone won't be enough to see the button today. **Deferred to the delegation-enforcement session (product decision 2026-07-04):** honoring a delegation here requires the content-ui backend to actually check grants — the first-ever delegation enforcement — which belongs in that future platform-wide session, not a UI-only fix (see `UI_BUILD_BACKLOG.md`). |
| `broadcast.send` *(platform)* | admin | platform | `/admin/notifications` — **"Broadcast"** message textarea + send button | Sends to literally every user platform-wide; there is no audience/segment picker. |
| `notification.send_to_entity_members` | admin | entity | `/entity/[entityId]/team` — **"Notify members"** card: message textarea (0/500 counter) + send button, confirm dialog shows the member count, success toast | **Built 2026-07-04** (`UI_BUILD_BACKLOG.md`), including the previously-missing backend endpoint: `POST /api/entities/{entity_id}/notify-members`, body `{message}` (1–500 chars), gated via `can()` at the registry floor admin(4) **same-entity** (or platform staff). Audience = every member of that entity except the sender; delivered as `NotificationType.system` with link `/entity/{id}`; response `{sent_to: n}`; audit-logged as `notify_entity_members` (new `ModerationAction`). Card visible to rank≥4 of that entity or platform admin+. Covered by `tests/test_entity_notify_members.py` (7 tests). Distinct from `broadcast.send`'s all-users broadcast on `/admin/notifications`. |

### Legal

| Action | Min rank | Scope | UI location | Notes |
|---|---|---|---|---|
| `legal.edit_update_content` *(platform)* | super_admin | platform | `/admin/legal` — the **"legal"** (general legal notices) document tab: edit form + **"Save"** / **"Publish"** | Delegable down to admin(4) per §10 — same page, same buttons for a delegated admin. |
| `legal.edit_documents` *(platform)* | super_admin | platform | `/admin/legal` — the **"privacidade"** (Privacy) and **"termos"** (Terms) document tabs: same edit form + **"Save"** / **"Publish"** workflow | Same page as the row above, different tab/slug — not delegable (no admin-tier fallback for these two specifically, per the registry note). |

---

## Known gaps — no UI yet

The following registry actions have **confirmed real backend support but no
click path in the current frontend** (verified by grepping every relevant
`api.ts` client method and every page/component that might call it — not
inferred from a plausible-sounding route):

1. **`user.restrict_suspend_ban_lift`** (entity scope) — the platform-wide
   sibling now has full UI on `/admin/users` (built 2026-07-04, see its row),
   but an entity's own super admin still has no restrict/suspend/ban
   controls on any entity-scoped roster view.
2. **`platform.manage_settings_taxonomy`**'s generic key-value Settings
   store half (as opposed to its taxonomy-families half, which **is**
   covered at `/admin/config`) — no UI.

That's **2 of the 67** registry actions with no real click path today.
The 2026-07-04 "UI backlog batches 1+2" build (P0+P1 — see
`UI_BUILD_BACKLOG.md`) cleared most of the former 11-item list:
the platform-wide restrict/suspend/ban ladder, `session.revoke_own`,
`session.revoke_other`, `password.reset_own`, `password.reset_entity_member`,
`trusted_publisher.grant_revoke_entity`,
`trusted_publisher.grant_revoke_platform_default`, and the
`product.manage_any`/`event.manage_any` render gaps — see their rows above
for detail. (`compost_listing.create_edit_own`/`compost_listing.archive`
and the `article.review`/`article.approve` collapse were built earlier the
same day.) "UI backlog batch 3" (P2, also 2026-07-04) then cleared the
last three: `event.archive` (`/admin/events`),
`notification.send_to_entity_members` (team-page "Notify members" card),
and the comment "edit" — the one item this list previously carried as
**degraded, not absent** (`comment.add_edit_remove_own`) is now fully
built, so no remaining action sits in that degraded-but-present category.
