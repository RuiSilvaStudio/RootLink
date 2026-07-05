---
type: Note
_width: wide
---

# UI Build Backlog — roles/permissions gaps

> **Status (updated 2026-07-04, after "UI backlog batch 3"):** **P0, P1 and
> P2 are ALL BUILT.** Batches 1+2 covered all seven P0 rows, the
> `product.manage_any`/`event.manage_any` render fixes, and the delegation
> auto-void stopgap badge; batch 3 closed the last three P2 rows — comment
> edit, `event.archive` (`/admin/events`), and
> `notification.send_to_entity_members` — plus a bonus fix to a latent
> `group.archive` authorization gap it surfaced (rank-only
> `require_super_admin` → registry `can()`; an org's own rank-5 super admin
> is now correctly 403'd, per spec §8 platform-only). 295 backend tests
> passing, live-verified with Playwright. The
> `platform_ui.edit_content` delegation-gate row is **DEFERRED** by product
> decision to a future platform-wide delegation-enforcement session, not
> built. Earlier closures remain: (1) two items closed post-Phase-6 by
> product decision rather than by building UI (see
> `docs/roles-permissions/phase0-decisions.md` Addendum 5): the
> professional-entity promote/demote row and the entity-registration-vs-
> conversion-ambiguity row, both under P1 below, read "RESOLVED"; and
> (2) two P2 items built earlier on 2026-07-04 — `compost_listing.*`
> (extends `/composting`) and the real `article.review`/`article.approve`
> two-step flow — both read "BUILT."
> Still unbuilt: P3 only (plus the deferred items in "Next steps" below).
> **Companion doc:** `ACTION_UI_MAP.md` (what exists today, backward-looking).
> This doc is forward-looking: for every action with no UI (or a degraded
> one), what should actually get built, why it matters, roughly how big the
> lift is, and what it depends on.

## How this backlog is organized

Grouped into four priority bands, reasoned as follows:

1. **P0 — Security & account-integrity controls.** Anything where a
   compromised, abusive, or misbehaving account currently has **no admin
   lever at all** in the UI, even though the backend can already stop them.
   These are the actions most likely to matter in an actual incident
   (account takeover, harassment, spam) — a missing button here means "wait
   for someone to hand-write a `curl`/DB query," which is the worst place to
   discover a gap.
2. **P1 — Delegable authority & entity-management parity.** Actions where
   the *design* explicitly wants an entity (or its super admin) to self-serve
   something the backend supports, but the UI silently forces it back to
   "type the URL by hand" or "ask platform staff." These aren't
   security-critical the way P0 is, but they're the difference between the
   permission system actually working as designed vs. being decorative for
   these specific rows.
3. **P2 — Content-workflow completeness.** Degraded UI (edit-less comments,
   collapsed review/approve) and missing archive controls for
   events/products — real product gaps, lower urgency than account safety.
4. **P3 — Platform admin/settings & polish.** Settings key-value store,
   entity-scoped notifications, i18n backfill, and product-decision
   ambiguities that don't block anyone today but should be resolved before
   they cause confusion later.

Backend-only or backend+UI items are called out explicitly in each row and
summarized again in the closing note — don't schedule them as pure frontend
tickets.

---

## Backlog table

| Action | Why it matters | Suggested UI | Complexity | Depends on |
|---|---|---|---|---|
| **P0 — Security & account-integrity controls** |
| ~~`user.restrict_suspend_ban_lift` (entity) + `user.restrict_suspend_ban_lift_platform_wide` (platform)~~ — **BUILT 2026-07-04 (platform-wide surface)** | ~~The entire 4-rung enforcement ladder (§4) exists end-to-end in the backend (Phase 4) but has **zero admin-panel controls**.~~ **Built: `/admin/users` now has a per-row status-ladder `<select>` offering only the valid transitions from the row's current `account_status` (active→restrict/suspend/ban; restricted→lift/suspend/ban; suspended→lift/ban; banned→unban), reason captured via `prompt()`, suspend takes a number of days (converted to an ISO `until`), plus a per-row status Badge (amber restricted/suspended with until-date tooltip, red banned). Suspend/Ban also auto-revoke the target's sessions (see next rows).** | Built — per-row status ladder + Badge on `/admin/users`, exactly as suggested. The entity-scoped roster surface (for an entity's own super admin) remains future work, as this row originally anticipated ("a future entity-scoped roster view"). | Done (platform-wide surface). | Closed for the platform-wide action; the entity-scoped action still has no roster view to live on. |
| ~~`session.revoke_own`~~ — **BUILT 2026-07-04** | ~~There's no "log out of all devices" control anywhere.~~ **Built: `/profile`'s settings tab now has a Security card with a "Log out of all devices" button calling `POST /api/auth/sessions/revoke-mine` (router prefix is `/api/auth`, not `/api/auth-security` as this row previously said). Copy deliberately says *all* devices, not "other" — the endpoint revokes every session including the current one, and the UI then logs out locally.** | Built — Security card on `/profile`'s settings tab. | Done. | Closed. |
| ~~`session.revoke_other`~~ — **BUILT 2026-07-04** | ~~The endpoint exists but isn't called from anywhere — not even the admin ban/suspend flow.~~ **Built exactly as suggested: auto-revoke after Suspend/Ban on `/admin/users`, plus a standalone per-row "Force logout" button. Real endpoint path: `POST /api/auth/sessions/{user_id}/revoke` (the router in `app/api/auth_security.py` has prefix `/api/auth`, not `/api/auth-security`).** | Built — per-row "Force logout" + auto-revoke on suspend/ban. | Done. | Closed. |
| ~~`password.reset_own`~~ — **BUILT 2026-07-04** | ~~The self-service "forgot password" backend flow exists but there's no "Forgot password?" link anywhere.~~ **Built: "Forgot password?" link on `/auth/login` → new page `/auth/forgot-password`, a 3-step flow (email → token + new password → success) calling `POST /api/auth/password/reset/request` + `/confirm` (prefix `/api/auth`, not `/api/auth-security`). Dev-mode: the token comes back in the response and is shown on-screen in a dev-note box AND pre-filled into the form. 422 validation errors are mapped to friendly copy.** | Built — `/auth/forgot-password`, reusing `/auth/login`'s form styling. | Done. | **Resolved: the product owner approved shipping the dev-mode token-in-response behavior as-is (2026-07-04).** No email infrastructure exists yet (per `phase0-decisions.md` Addendum 2), so the on-screen token is the deliberate, explicitly-flagged stand-in until real email delivery is built. |
| ~~`password.reset_entity_member`~~ — **BUILT 2026-07-04 (backend + UI)** | ~~An entity's own super admin has no way to reset a member's password without escalating to platform staff.~~ **Built, including the previously-missing backend endpoint: `POST /api/entities/{entity_id}/members/{user_id}/reset-password` (min 6 chars; caller = that entity's own super admin, rank 5, or the platform super admin via `can()`; target must be a member of that entity else 404; also revokes the target's sessions; audit action `reset_member_password`). UI: key-icon "Reset password" button per member row on `/entity/[entityId]/team` (hidden on your own row).** | Built — key icon on the team page's members table, same interaction as `/admin/users`'s existing one. | Done. | Closed — see `tests/test_entity_member_admin_actions.py` for coverage. |
| ~~`trusted_publisher.grant_revoke_platform_default` (platform)~~ — **BUILT 2026-07-04** | ~~The admin grant/revoke endpoint exists server-side; no button anywhere calls it.~~ **Built: per-row PenLine toggle on `/admin/users` calling `PATCH /api/admin/users/{id}/self-publish`. The platform admin grant is a manual override with NO eligibility gate — intended: it's the fast-track/override path (the entity-scoped grant below is the one that enforces eligibility + agreement).** | Built — PenLine toggle on `/admin/users`'s per-row actions. | Done. | Closed. |
| ~~`trusted_publisher.grant_revoke_entity`~~ — **BUILT 2026-07-04 (backend + UI)** | ~~No entity-scoped implementation exists under this name at all.~~ **Built, including the previously-missing backend endpoint: `PATCH /api/entities/{entity_id}/members/{user_id}/self-publish` (same auth as the entity reset-password endpoint above; eligibility + agreement REQUIRED on grant unless the caller is a platform super admin). UI: PenLine toggle + sage "Trusted publisher" badge per member row on `/entity/[entityId]/team` (hidden on your own row). `EntityMemberResponse` now includes `can_self_publish`.** | Built — team-page member rows. | Done. | Closed — see `tests/test_entity_member_admin_actions.py` for coverage. |
| **P1 — Delegable authority & entity-management parity** |
| ~~`product.manage_any`~~ — **BUILT 2026-07-04 (+ backend floor fix)** | ~~`/marketplace/[id]` only ever renders Edit/Delete when `isOwner` is true — no discoverable click path.~~ **Built: `/marketplace/[id]`'s Edit/Delete now render when `isOwner \|\| can("product.manage_any")`, with a stone "Moderation" badge/hint when acting as non-owner. Also fixed a backend enforcement floor in `app/api/marketplace.py` (2 sites): PUT/DELETE listings required admin(4) while the registry says moderator(3) — lowered to moderator to match the registry (spec is source of truth; same class of fix as the earlier `article.approve` floor).** | Built — render-condition fix + Moderation badge, mirroring `course.manage_any`'s pattern as suggested. | Done. | Closed — see `tests/test_marketplace_manage_any.py` (4 tests) for coverage. |
| ~~`event.manage_any`~~ — **BUILT 2026-07-04** | ~~`/events/[id]` gates every edit/delete/venue/amenity/schedule control on `isOwner` only.~~ **Built: ALL of `/events/[id]`'s owner-gated management controls now use `isOwner \|\| can("event.manage_any")` — header Edit/Delete (now with aria-labels), schedule add/remove, venue form, amenities add/delete, sponsors add/remove/visibility-filter, vendors add/form/delete — with a stone "Moderation" badge when acting as non-owner. The backend (`_check_event_owner`) already allowed moderator+; this was purely the render-condition fix.** | Built — render-condition fix across every management sub-section. | Done. | Closed. |
| `group.manage_any` — parity check | `ACTION_UI_MAP.md` reports this one *does* have a working `canManage` gate on `/groups/[id]`'s Edit icon. No action needed here — listed only so the product owner sees the pattern applied correctly at least once, to use as the template for the two rows above. | N/A — already built. | N/A | N/A |
| ~~Entity-scoped promote/demote for `professional` entities~~ — **RESOLVED, by design, not a gap** | ~~`phase0-decisions.md` Addendum 3 found that `professional` entities have no shared "team" schema...~~ **Resolved post-Phase-6 (`phase0-decisions.md` Addendum 5): the product owner confirmed professional entities never get entity-scoped promote/demote capability, permanently — this is organization-only by design, not a temporary gap awaiting a schema decision.** Professional-kind users' rank changes are handled directly via `/admin/users` instead. Verified (not newly built): `role_requests.py`'s existing block is correct and permanent; professional accounts never get an `entity_id`, so `/entity/[entityId]/team` is structurally unreachable for them (confirmed by `tests/test_roles_decisions_professional_no_team_workflow.py`); no dangling UI link was found offering this path. `ROLES_PERMISSIONS.md` §3/§6 updated to state this outright rather than describe it as an open gap. | N/A — no schema will be built for this. | N/A | Closed — no further action. |
| Delegation auto-void on demotion — **stopgap badge BUILT 2026-07-04; underlying design decision still open** | §10 states delegation grants are voided "on any demotion... of the grantee," but `phase0-decisions.md` Addendum 4 confirms this is wired for departure/dissolution only, **not** for demotion (`role_requests._decide`) — a demoted user can retain a delegated permission (e.g. `article.review`) they may no longer be appropriate to hold. | **Stopgap built exactly as described here:** `/entity/[entityId]/team`'s delegations list now flags (amber Badge **"Grantee below action rank"** + tooltip) any active grant whose grantee's current rank is below the delegated action's registry `min_rank`, so the entity super admin can spot and manually revoke it via the existing Revoke button. Pure client-side computation over already-fetched data (`registry`, `delegations`, `members`). | Done (stopgap). The real auto-void-on-demotion logic remains unbuilt. | **Still blocked on the same §10 design decision** (per Addendum 4's framing): should a grant survive a *partial* demotion that still leaves the grantee above the action's own `min_rank`, or does ANY demotion void it regardless? The built stopgap works either way; the real auto-void fix needs this decided first — unchanged. |
| `platform_ui.edit_content` delegation-gate mismatch — **DEFERRED (product decision 2026-07-04), not built** | The registry marks this delegable all the way down to persona(1) (§10's broadest delegation reach of any action) — but the floating "Edit page" toggle is hard-coded to `role === "super_admin"` only in `editor-mode-provider.tsx` (the component's own comment says so explicitly). A delegated persona/contributor/moderator/admin — e.g. a "Copy editor" badge holder per §2 — gets a delegation grant through the UI that then does nothing; the button never appears for them. | Update `editor-mode-provider.tsx`'s visibility check to also honor an active `platform_ui.edit_content` delegation grant for the current user (the same delegation data already fetched/available via `usePermission()`/the registry), not just `role === "super_admin"`. | Small–Medium — one conditional in an existing provider, but needs the delegation-lookup wired into a context that currently only checks static role. | **DEFERRED to the future platform-wide delegation-enforcement session (product decision 2026-07-04):** making the button honor a delegation requires the content-ui *backend* to actually check grants — which would be the first-ever delegation enforcement in the codebase — so it belongs in that dedicated session, not a UI-only batch. Frontend-only visibility without backend enforcement would show a button that 403s. |
| ~~Entity-registration vs. entity-conversion ambiguity~~ — **RESOLVED: conversion is self-service only, as designed** | ~~`phase0-decisions.md` Addendum 4 flags that a `professional` user can become an organization's founder through two different, un-reconciled flows...~~ **Resolved post-Phase-6 (`phase0-decisions.md` Addendum 5): the product owner confirmed entity conversion is intentionally self-service only** — no admin-triggered path, no `user_id` parameter anywhere in `entity_conversion.py`/its request schemas or endpoints (confirmed by reading the code, and by a dedicated test that a smuggled `user_id` in the request body is ignored). Both flows existing side by side is accepted as intentional: `/entity/convert` is the fast, immediate, self-service path (no review, no `user_id`, always acts on the caller); the general-purpose entity-registration path remains the review-gated route for founding a genuinely new, separate organization. No merge of the two flows was requested or built. | N/A — no flow merge was requested. | N/A | Closed — no further action. If a future session wants explanatory copy distinguishing the two flows for end users (the original "Suggested UI" idea below this row's history), that remains a separate, small, optional polish item, not a blocker. |
| **P2 — Content-workflow completeness** |
| ~~`compost_listing.create_edit_own` + `compost_listing.archive`~~ — **BUILT 2026-07-04** | ~~This row was about two unused, never-implemented registry entries...~~ **Resolved by product decision: these govern the existing `/composting` community hub feature (`CompostingHub`), extended — not a separate marketplace-style listing.** No structured "permit" field (deferred — owner describes permits/services in the free-text description, trust-based for now). Built: `PATCH /api/waste/hubs/{id}` (contributor+ own edit; an organization's own super admin can also edit a fellow member's hub, no middle ☑️ tier for moderator/admin, per §7's own note); creation (`POST /hubs`) also newly gated contributor+ (previously ungated for any logged-in user, a pre-existing gap closed as part of this build). | Built — `/composting` page now has an inline Edit form (pencil icon) and a platform-super-admin-only Archive action. | Done. | Closed — see `ROLES_PERMISSIONS.md` §7/§8 for the updated spec notes and `tests/test_compost_hub_management.py` for coverage. |
| ~~`comment.add_edit_remove_own` — missing "edit"~~ — **BUILT 2026-07-04 (backend + UI)** | ~~Registry name says "add/edit/remove," but only add (`POST`) and remove (`DELETE`) exist — there's no `PATCH` comment endpoint and no edit UI in `CommentSection.tsx`.~~ **Built, including the previously-missing backend endpoint: `PATCH /api/comments/{comment_id}` (owner-only — 403 otherwise, 404 missing, body `min_length=1`, refreshes `updated_at`; the comment response schema now includes `updated_at`). The registry action's "degraded, not absent" status is fully resolved — add/edit/remove all exist now.** | Built — inline edit mode in `CommentSection.tsx` exactly as suggested: pencil Edit icon on your own comments (nested replies too), textarea + Save/Cancel, Escape cancels, autofocus, an "(edited)" marker when `updated_at − created_at` > 60s, and failed saves keep edit mode open with an inline error (i18n `content.edit_failed`). | Done. | Closed — see `tests/test_comment_edit.py` (7 tests) for coverage. |
| ~~`article.review` vs. `article.approve` — collapsed into one step~~ — **BUILT 2026-07-04, real two-step design** | ~~Previously collapsed into the same "Approve"/"Unreview" buttons...~~ **Resolved by product decision: build the real two-step flow as originally specified, no scope changes.** New `reviewed` status between `in_review` and `published`; contributor+ "Mark reviewed" (`PATCH /content/{id}/review`, optional internal-only note in new `review_comment` column, distinct from author-facing `review_note`) is an optional waypoint — a moderator can still approve directly from `in_review` too (flexible, no strict ordering, by product decision). `approve_content` fixed to genuinely require moderator+ (previously reachable at contributor+, closing the documented enforcement mismatch) and now blocks self-approval (403, previously ungated — §6 separation of duties). `revert_approval` split into its own endpoint (published → `in_review`, not `rejected`) so undoing an approval doesn't get conflated with `reject`'s existing appeal flow. | Built — `/admin/review-queue` has "Mark reviewed"/"Approve"/"Reject"; `/admin/content` has "Revert approval" in place of the old "Unreview". | Done. | Closed — see `ROLES_PERMISSIONS.md` §7/§10 for the updated spec notes and `tests/test_article_review_approve.py` for coverage. |
| ~~`event.archive` (platform)~~ — **BUILT 2026-07-04** | ~~No `/admin/events` page exists, no `archiveEvent` client method, and no super-admin-gated archive endpoint...~~ **Built end-to-end.** Backend: `Event.archived_at` column (+ idempotent lifespan migration), idempotent `POST /api/admin/events/{id}/archive` gated by `can(user, "event.archive")` (the `compost_listing.archive` platform-only pattern — deliberately NOT a rank-only `require_super_admin`, which would wrongly pass an org's own rank-5 super admin; that exact latent gap was then found live in `group.archive` itself and fixed the same day, `can(user, "group.archive")` + regression test `test_org_super_admin_cannot_archive_group` in `tests/test_groups_manage.py`), notifies RSVP'd attendees, audit-logged as `archive_event`; archived events excluded unconditionally from the public `GET /api/events/` list and 404 on detail for non-staff; new staff listing `GET /api/admin/events` (moderator+, q/limit/offset, includes archived). | Built — `/admin/events` (modeled on `/admin/groups`, but fully i18n'd EN+PT and using `can("event.archive")` via `usePermission` instead of a bare role check); registered in the sidebar's Events & Commerce section; `api.admin.listEvents`/`archiveEvent` added. | Done. | Closed — see `ACTION_UI_MAP.md`'s `event.archive` row and `tests/test_event_archive.py` (6 tests) for coverage. |
| ~~`notification.send_to_entity_members`~~ — **BUILT 2026-07-04 (backend + UI)** | ~~The only notification-broadcast endpoint (`POST /api/admin/broadcast`) sends to literally every user platform-wide — there's no entity-scoped variant.~~ **Built, including the previously-missing backend endpoint: `POST /api/entities/{entity_id}/notify-members`, body `{message}` (1–500 chars), gated via `can()` at the registry floor admin(4) same-entity (or platform staff); audience = every member of that entity except the sender, delivered as `NotificationType.system` with link `/entity/{id}`; response `{sent_to: n}`; audit action `notify_entity_members` (new `ModerationAction`).** | Built — "Notify members" card on `/entity/[entityId]/team` (textarea + 0/500 counter, confirm dialog showing the member count, success toast), visible to rank≥4 of that entity or platform admin+ — modeled on `/admin/notifications`'s broadcast form, as suggested. | Done. | Closed — see `tests/test_entity_notify_members.py` (7 tests) for coverage. |
| **P3 — Platform admin/settings & polish** |
| `platform.manage_settings_taxonomy` — generic key-value Settings store half | `/admin/config` fully covers the taxonomy-families half of this action (add/edit/delete families and categories) — but the separate, real generic key-value Settings store (`api.admin.listSettings`/`getSetting`/`updateSetting`, backed by `GET/PUT /api/admin/settings[/{key}]`) has **no UI at all**; nothing in the frontend calls it, so any platform-wide config value meant to live in this store today can only be read/written via direct API calls. | Add a new tab or sibling section on `/admin/config` (keep it visually adjacent to the taxonomy tree, since it's the same registry action) — a simple key/value list-and-edit table: list all settings (`listSettings()`), inline edit value + description per row (click-to-edit, matching `/admin/config`'s existing inline-edit-field pattern for family rows), Save calling `updateSetting`. | **Large** — no existing key-value editor pattern anywhere in the codebase to copy verbatim; needs its own list/edit/validate UI, and settings values may be typed (string/number/bool/JSON) with no existing schema-driven form generator in this codebase to reuse. | None blocking (endpoints are fully built) — but worth scoping down first (does every setting need a rich editor, or is a plain textarea-per-key acceptable for v1?) before committing to the Large estimate. |
| Phase 5 UI surfaces — missing i18n | `phase0-decisions.md` Addendum 4 flags that all ~7 new Phase 5 pages (entity registration, `/entity/convert`, `/entity/[entityId]` dissolution/ban section, `/entity/[entityId]/team`, the verification review queue, and related forms) use hardcoded English copy instead of the `t()`/`messages/{locale}.json` pattern every other page in this codebase follows. Not broken (the `t()` fallback returns the raw key, nothing crashes) but these pages are the only ones on the platform not localized, which will read as an inconsistency to any non-English user who reaches them. | Extract the hardcoded strings from those ~7 pages into `messages/en.json`/`messages/pt.json` following the existing `t("namespace.key")` convention used everywhere else, and swap the JSX over. | Medium — mechanical but touches every string on 7 pages; no design work needed, just following the existing i18n pattern. | None — purely additive, can be done incrementally page-by-page. |

---

## Items intentionally NOT included here

- **Permission bundles** (§10's "Roadmap note") — explicitly deferred to a
  future iteration in the spec itself, not a current gap. Not scheduled here;
  revisit only if delegation-sprawl actually becomes a pain point.
- **Enforcement-floor mismatches** (e.g. `article.approve`/`plants.create_edit`/
  `plants.import`/`link.remove_submitted` enforcing a looser rank than the
  registry states) — these are backend authorization bugs, not missing UI.
  They belong on a backend tech-debt list (see `TECH_DEBT.md`), not this one.
  (`article.approve` and marketplace's `product.manage_any` floors were fixed
  2026-07-04 as part of building their UI; the rest remain.)
- **Team-page promote/demote form shown to low-rank members** (flagged by live
  verification 2026-07-04, pre-existing Phase 5 UI): `/entity/[entityId]/team`
  renders the full "Promote / demote requests" form (raw target-user-ID + rank
  inputs) to rank 1–2 members, while every other management control on the page
  is gated. The backend gates the actual submission, so this is a UX
  inconsistency, not an authorization hole. Product owner decision 2026-07-04:
  log for later, don't fix now. Same pass should also replace the page's raw
  user-ID number inputs with a member picker.

---

## Backend work required, not just frontend

**As of the 2026-07-04 "batch 3" build, nothing left in this backlog needs
new backend endpoints.** Every item that required real backend work got it
and is closed: `compost_listing.*`, the `article.review`/`article.approve`
split, the P0 entity-scoped endpoints for `password.reset_entity_member`
and `trusted_publisher.grant_revoke_entity`, and the P2 trio —
`comment.add_edit_remove_own`'s `PATCH /api/comments/{id}`,
`event.archive`'s archive + staff-listing endpoints, and
`notification.send_to_entity_members`' entity-scoped broadcast — see their
rows above. P3's settings key-value editor is pure frontend (its
`GET/PUT /api/admin/settings` endpoints have been fully built all along),
and the i18n backfill is frontend-only by nature. This section is kept so
future additions to the backlog remember to flag backend-required items
explicitly rather than scheduling them as pure frontend tickets.

---

## Next steps (handoff — read this if resuming cold)

**Current state (updated 2026-07-04, after "UI backlog batch 3"):**
**P0, P1 and P2 are done.** Batch 1 (all seven P0 rows: the platform-wide
restrict/suspend/ban status ladder, session revoke x2, password reset x2,
trusted-publisher grant/revoke x2 — including the two new entity-scoped
backend endpoints) and Batch 2 (the `product.manage_any`/`event.manage_any`
render fixes + a marketplace backend-floor fix, and the delegation
auto-void stopgap badge) took the suite from 257 to 274. Batch 3 (the last
three P2 rows: comment edit — new `PATCH /api/comments/{id}` + inline edit
UI in `CommentSection.tsx`; `event.archive` — new archive/staff-listing
endpoints + `/admin/events` page; `notification.send_to_entity_members` —
new entity-scoped broadcast endpoint + team-page "Notify members" card) is
built, tested (295 backend tests passing, up from 274: +7
`tests/test_comment_edit.py`, +6 `tests/test_event_archive.py`, +7
`tests/test_entity_notify_members.py`, +1 `group.archive` regression in
`tests/test_groups_manage.py`), and live-verified with Playwright (5/5
flows). Batch 3 also fixed a latent `group.archive` authorization gap it
surfaced: the endpoint's rank-only `require_super_admin` wrongly passed an
organization's own rank-5 super admin (spec §8 says platform-only) — now
the registry `can(user, "group.archive")` check (see `docs/LESSONS.md`
#38). The `platform_ui.edit_content` delegation-gate row remains
**deferred by product decision (2026-07-04)** to a future platform-wide
delegation-enforcement session — see its row. The earlier closures stand:
`compost_listing.*` and the `article.review`/`article.approve` two-step
flow (built 2026-07-04), and the two Addendum-5 product-decision
resolutions (professional promote/demote, entity-conversion
self-service-only).

**What remains:**

- **P3 only** (settings key-value editor, i18n backfill on the ~7 Phase 5
  pages) — worth explicitly confirming with the product owner whether this
  is even wanted before scheduling; no backend work needed for either.
- The **deferred delegation-enforcement session** (`platform_ui.edit_content`
  gate + first-ever backend grant-checking), a separate future session.
- The entity-scoped roster surface for `user.restrict_suspend_ban_lift`
  (the platform-wide surface is built; there is no entity roster view yet).

**Deployment plan — decision pending with the product owner:** either do
one combined production deploy of everything built so far (P0 + P1 + P2 +
the earlier compost/review-approve work), OR continue to P3 first and
deploy once at the very end. Neither has been chosen yet; nothing from
these batches is deployed to production at the time of this update.

If resuming: same discipline as every batch so far (fresh session reads
`IMPLEMENTATION_STATUS.md` + this doc + `ROLES_PERMISSIONS.md` → implements
→ runs full test suite + `tsc`/lint → live-verifies with Playwright against
local dev → updates docs → stops and reports).

**Docs to hand to a fresh session, in order:** `IMPLEMENTATION_STATUS.md` →
`ROLES_PERMISSIONS.md` → this file (`UI_BUILD_BACKLOG.md`) →
`phase0-decisions.md` (for the "why" behind prior judgment calls) →
`ACTION_UI_MAP.md` (what already exists, for QA once batches ship).
