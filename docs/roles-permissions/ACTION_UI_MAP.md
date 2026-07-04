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
| `article.review` | contributor | entity | `/admin/review-queue` and `/admin/content` — **"Approve"** / **"Unreview"** buttons | The backend has no separate "review" step distinct from "approve/reject" — `article.review` and `article.approve` collapse into the exact same two buttons on these two pages. Treat them as one test, not two. |
| `article.approve` | moderator | entity | Same as `article.review` above — `/admin/review-queue` "Approve", `/admin/content` "Approve" | **Enforcement mismatch:** the real endpoint (`PATCH /api/admin/content/{id}/approve`) only requires **contributor+**, not moderator+ as the registry states — a documented, deliberate Phase 3 non-migration (see module docstring). Testing as a contributor should succeed even though the registry table says moderator. |
| `article.revert_approval` | moderator | entity | `/admin/content` — **"Unreview"** button (shown once an item's status is `community_reviewed`) | This is the practical "undo approval" action; it calls the same reject endpoint, which requires **moderator+** (matches registry). Not present on `/admin/review-queue` (items there haven't been approved yet). |
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
| `group.archive` *(platform)* | super_admin | platform | `/admin/groups` — **"Archive"** button per row | Client-side gated strictly to `role === "super_admin"` (a non-super-admin sees "Super admin only" text instead of a button) — matches the registry exactly, one of the few rows where enforcement and UI agree precisely. |
| `group.join_rsvp` | persona | entity | `/groups/[id]` — **"Join"** / **"Leave"** button | |

### Products / Marketplace

| Action | Min rank | Scope | UI location | Notes |
|---|---|---|---|---|
| `product.create_edit_archive` | persona | entity | `/marketplace/create` (new listing form), `/marketplace/edit/[id]` (edit form), `/marketplace/[id]` — **"Edit"** / **"Delete"** buttons (owner only) | |
| `product.manage_any` | moderator | entity | **No discoverable button.** The backend (`PUT`/`DELETE /api/marketplace/listings/{id}`) does allow **admin+** to edit/delete someone else's listing, but `/marketplace/[id]` only ever renders the Edit/Delete buttons when `isOwner` is true — a moderator/admin has no click path to another user's listing's edit form; it's only reachable by manually typing `/marketplace/edit/{id}` into the address bar. | Flag this as a real UI gap when testing, not a "no UI" (the endpoint and page both work if navigated to directly) — but there is nothing to click. |
| `compost_listing.create_edit_own` | contributor | entity | **No UI — API only** (and, more precisely, not even a real API: no backend endpoint or model named "compost listing" exists at all) | Grepped the whole backend for `compost_listing` — the only two hits are the registry's own two entries. The live composting feature is a different model, **composting hubs/deposits** (`/composting` — "Create a hub", "Join", log a deposit), which has no per-item create/edit/archive-by-someone-else's-item semantics matching this action's description. |
| `compost_listing.archive` *(platform)* | super_admin | platform | **No UI — API only** (same finding as above — no backend implementation under this name) | |

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
| `comment.add_edit_remove_own` | persona | entity | `CommentSection` component (embedded on articles, groups, events, plants, etc.) — comment box + **Send** icon to add, trash icon to remove your own | **"Edit" is not actually implemented anywhere** — there is no `PATCH` comment endpoint in the backend and no edit UI in `CommentSection.tsx`, only create (`POST`) and delete (`DELETE`). The registry name says "add/edit/remove" but only add+remove exist in practice. Moderator/admin cancelling someone else's comment (the ☑️/🔑 tier) uses the same trash icon, gated server-side by rank, not surfaced differently in the UI. |

### Events

| Action | Min rank | Scope | UI location | Notes |
|---|---|---|---|---|
| `event.create_edit_cancel_own` | contributor | entity | `/events` — **"+ New event"** button; `/events/[id]` — Edit/Cancel/Delete controls (owner only, `isOwner` gate) | |
| `event.manage_any` | moderator | entity | **No discoverable button.** `_check_event_owner` in `app/api/events.py` does let moderator+ update/delete any event server-side, but `/events/[id]` gates every edit/delete/venue/amenity/schedule control on `isOwner` only — the page's own `isAdmin` variable is used **only** for the ticket check-in action, never for event management. | Same shape of gap as `product.manage_any` — real backend support, zero UI entry point. |
| `event_sponsor.add_edit_cancel_own` | contributor | entity | `/events/[id]` — **Sponsors** tab, add/edit/remove controls (event owner only) | |
| `event_vendor.add_edit_cancel_own` | contributor | entity | `/events/[id]` — **Vendors** tab, add/edit/remove controls (event owner only) | Renamed from "supplier" in the spec to avoid confusion with the `suppliers` platform entity — same UI either way. |
| `event.archive` *(platform)* | super_admin | platform | **No UI — API only**, and more precisely **no distinct backend concept either** | There's no `/admin/events` page, no `archiveEvent` client method, and no super-admin-gated "archive" endpoint distinct from the existing owner/moderator+ `DELETE /api/events/{id}` used by `event.create_edit_cancel_own` above. |

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
| Revoke a delegation | Same section — **"Revoke"** link next to each active grant | |
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
| `password.reset_own` | persona | entity | **No UI — API only** | Backend has a full self-service flow (`POST /api/auth-security/password/reset/request`, `/confirm`) but `lib/api.ts` never calls either endpoint and no "Forgot password?" link exists on `/auth/login` or anywhere else. |
| `password.reset_entity_member` | super_admin | entity | **No UI — API only** | No entity-scoped reset-password endpoint or button exists anywhere (checked `/entity/[entityId]/team` specifically — not there). Only the platform-wide admin version below has UI. |
| `password.reset_other_platform_wide` *(platform)* | admin | platform | `/admin/users` — key-icon **"Reset password"** button (prompts for a new password, then confirms) | |
| `session.revoke_own` | persona | entity | **No UI — API only** | `POST /api/auth-security/sessions/revoke-mine` exists server-side; no logout-all-devices button anywhere in the frontend. |
| `session.revoke_other` | admin | entity | **No UI — API only** | `POST /api/auth-security/sessions/{user_id}/revoke` exists server-side; not called from admin ban/suspend or anywhere else. |
| `user.restrict_suspend_ban_lift` | super_admin | entity | **No UI — API only** | Backend endpoints exist (`/api/admin/users/{id}/restrict`, `/lift-restriction`, `/suspend`, `/lift-suspension`, `/ban`, `/unban` — per `IMPLEMENTATION_STATUS.md` Phase 4), but `/admin/users` has no restrict/suspend/ban controls at all (only role dropdown, verify, and reset-password). |
| `user.restrict_suspend_ban_lift_platform_wide` *(platform)* | super_admin | platform | **No UI — API only** | Same endpoints as above, same finding — no admin UI surfaces user-level restrict/suspend/ban anywhere. Do not confuse with `entity.ban`/`entity.unban` (organization-level ban), which **does** have UI at `/entity/[entityId]`. |
| `trusted_publisher.grant_revoke_entity` | admin | entity | **No UI — API only** | No entity-scoped grant/revoke endpoint exists in the backend at all under this name. |
| `trusted_publisher.grant_revoke_platform_default` *(platform)* | admin | platform | **No UI — API only** | `PATCH /api/admin/users/{id}/self-publish` exists server-side (grants/revokes `can_self_publish`); `lib/api.ts`'s `selfPublish` object only wires the **user's own** eligibility-check/accept endpoints (`/api/me/self-publish/...`), never the admin grant/revoke one — no button anywhere calls it. |

### Platform Admin / Settings

| Action | Min rank | Scope | UI location | Notes |
|---|---|---|---|---|
| `platform_family.add` | super_admin | platform | `/admin/config` — **"Add Family"** form | |
| `platform_family.edit` | admin | platform | `/admin/config` — inline click-to-edit fields on each family row | |
| `platform_family.archive` | super_admin | platform | `/admin/config` — trash-icon **"Delete"** per family | Hard delete (removes the family and its categories), not a soft archive — same naming looseness as `plants.archive`/`group.archive`. |
| `platform.manage_settings_taxonomy` | super_admin | platform | `/admin/config` — the whole families/categories tree (add/edit/delete families and categories) | The **generic key-value Settings store** (`api.admin.listSettings/getSetting/updateSetting`) is a separate, real backend feature with **no UI at all** — grepped the whole frontend, nothing calls it. Only the taxonomy half of this action has a page. |
| `platform_ui.edit_content` | super_admin | platform | Global floating **"Edit page"** button (bottom of every page, via `EditorModeChrome`) — toggles inline WYSIWYG editing of text/images/icons directly on the page; `/admin/copy` — bulk **"Site Text"** key-by-key editor for the same underlying content | The floating toggle is hard-coded to `role === "super_admin"` only in `editor-mode-provider.tsx` (its own comment says so explicitly) — the registry's note that this is delegable all the way down to persona(1) is **not** reflected in the current gate; a delegation grant alone won't be enough to see the button today. |
| `broadcast.send` *(platform)* | admin | platform | `/admin/notifications` — **"Broadcast"** message textarea + send button | Sends to literally every user platform-wide; there is no audience/segment picker. |
| `notification.send_to_entity_members` | admin | entity | **No UI — API only**, and more precisely **no distinct backend endpoint either** | The only notification-broadcast endpoint (`POST /api/admin/broadcast`) sends to **all** users unconditionally — there is no entity-scoped variant to send only to one organization's members. |

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

1. **`compost_listing.create_edit_own`** and **`compost_listing.archive`** —
   no backend endpoint or model exists under this name at all; nearest
   analog is `/composting` (hub deposits), which is a different feature.
2. **`product.manage_any`** — backend allows admin+ to edit/delete another
   user's marketplace listing; no button anywhere surfaces another user's
   listing for a moderator/admin to manage (only reachable by manually
   typing the edit URL).
3. **`event.manage_any`** — same shape of gap as above, for events.
4. **`event.archive`** *(platform)* — no admin events page, no archive
   endpoint distinct from the existing owner/moderator delete.
5. **`notification.send_to_entity_members`** — no entity-scoped broadcast
   endpoint exists; only the all-users platform broadcast is implemented.
6. **`password.reset_own`** — self-service "forgot password" backend flow
   exists but is never called from the frontend; no "Forgot password?" link.
7. **`password.reset_entity_member`** — no entity-scoped reset-password
   endpoint or UI.
8. **`session.revoke_own`** and **`session.revoke_other`** — force-logout
   backend endpoints exist, unused by any frontend page.
9. **`user.restrict_suspend_ban_lift`** (entity) and
   **`user.restrict_suspend_ban_lift_platform_wide`** (platform) — the full
   restrict/suspend/ban/lift backend (Phase 4) has no admin-panel controls
   at all; do not confuse with entity-level `entity.ban`/`entity.unban`,
   which **does** have UI.
10. **`trusted_publisher.grant_revoke_entity`** — no entity-scoped
    implementation exists.
11. **`trusted_publisher.grant_revoke_platform_default`** *(platform)* — the
    admin grant/revoke endpoint exists server-side; no button calls it (only
    the end-user's own eligibility/accept flow is wired).
12. **`platform.manage_settings_taxonomy`**'s generic key-value Settings
    store half (as opposed to its taxonomy-families half, which **is**
    covered at `/admin/config`) — no UI.

That's **12 of the 67** registry actions with no real click path today
(several of them not even implemented as distinct backend endpoints). Two
more are documented as **degraded, not absent** — `comment.add_edit_remove_own`
(no "edit," only add/remove exist) and `article.review`/`article.approve`
(collapsed into one pair of buttons, not two distinct steps) — see their
rows above for detail.
