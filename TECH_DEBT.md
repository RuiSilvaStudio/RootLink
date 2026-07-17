# Tech Debt — Post-Deployment Cleanup

> Created after production deploy. Address these once the live site is confirmed working.
> The user flagged concerns about bad coding, outdated/deprecated, and unsupported versions.

## STATUS SUMMARY
- ✅ **Phase 1** — Removed dead deps (next-pwa, next-intl): 306 deprecated packages gone.
- ✅ **Phase 2a** — ESLint already at final 8.x (8.57.1); ESLint 9 coupled to Next 15 (Phase 5).
- ✅ **Phase 4** — All 27 react-hooks/exhaustive-deps warnings resolved.
- ✅ **Phase 3a** — `<img>` rule disabled project-wide (documented decision).
- ✅ **Phase 6** — Repo root tidied (scripts/ created, one-offs removed).
- **Vercel build is now 0 warnings / 0 errors.**
- ⏳ **Phase 5** (Next 15 + ESLint 9 + Next CVEs + backend dependabot) — remaining, dedicated effort.
- ✅ **§0 RESOLVED (2026-07-03)** — `super_admin`-not-a-superset-of-`admin` bug closed via the
  roles/permissions redesign's Phase 3 backend endpoint cutover. See §0 below for the closure
  details; it's safe to promote a real `admin` to `super_admin` now.

## 0. ✅ RESOLVED (2026-07-03) — `super_admin` is not a strict superset of `admin` (found 2026-07-02)

> **Resolution:** Closed as part of the roles/permissions redesign's Phase 3 backend endpoint
> cutover (`docs/roles-permissions/roadmap.md` Phase 3 — backend half only; the frontend
> `isStaff`/`isAdmin`/`isSuperAdmin` mirror of this same bug, `docs/roles-permissions/user-logic-review.md` §9, was
> closed too, in the same Phase 3 — see `docs/roles-permissions/IMPLEMENTATION_STATUS.md`'s Phase 3
> entry). All 23 sites below, plus `admin.py`'s `require_role` factory,
> `groups.py`'s `STAFF_ROLES`/`_can_manage_group`, were migrated to call a single shared helper,
> `rank_at_least` (`app/core/permissions.py`), built on `app/core/entity_resolution.py`'s
> `resolve_entity_and_rank` — so `super_admin` (resolved rank 5) structurally passes every floor
> `admin` (rank 4) does, everywhere, by construction rather than by remembering to list one more
> string per site. `comments.py` needed no change: its only endpoint is self-service
> (delete-your-own); the actual comment-moderation delete lives in `admin.py`
> (`/api/admin/comments/{id}`), already covered by the `require_role`/`rank_at_least` fix.
>
> Deliberately did **not** route these 23 sites through the new `can()`/permissions-registry
> helper directly (built the same session, `app/core/permissions_registry.py`) — several of these
> sites' historical rank floors don't match `docs/roles-permissions/ROLES_PERMISSIONS.md`'s redesigned per-action floors for the
> closest-named registry action (e.g. plants creation here allows `contributor`+, while
> `docs/roles-permissions/ROLES_PERMISSIONS.md` §7's "Create/edit plants" row starts at `moderator`); adopting the registry's
> floor at those sites would have silently changed *who* is allowed, not just closed this named bug
> — a real product decision for a later phase, out of scope for this fix.
>
> **Update 2026-07-04:** the marketplace pair of these floor mismatches (sites 18/19 below —
> `PUT`/`DELETE /api/marketplace/listings/{id}` enforcing admin-only vs. the registry's
> moderator(3) floor for `product.manage_any`) **is now fixed** to the registry floor, as part of
> the roles/permissions UI-backlog P1 work (spec is source of truth; same class of fix as the
> earlier `article.approve` floor — coverage in `tests/test_marketplace_manage_any.py`). The
> plants/other floors remain deliberately unmigrated pending that product decision.
>
> Closure proof: `tests/test_tech_debt_0_super_admin_closure.py` — both a unit-level check (every
> rank floor used across the cutover sites, `super_admin` passes each one `admin` does, for both
> already-migrated and never-migrated/freshly-registered user shapes) and integration-level checks
> hitting 3 real endpoints (`articles.py` delete-any, `events.py` update-any, `plants.py` delete —
> the exact worst-case bare `role != "admin"` site) with a real super_admin acting on content it
> doesn't own. Also spot-checked live against the running dev server using the actual seed
> `e2e-editor-test@example.com` account (migrated to `entity_kind=platform`/`rank=5` by the
> roles/permissions Phase 1 data migration).
>
> The original finding is kept below for the historical record.

**The bug:** `docs/content-platform/CONTENT_PLATFORM.md` documents `super_admin > admin >
moderator > contributor > user` as an explicit invariant — *"super_admin — the only role that can
edit any content in any state"* (§4.1), with a verb matrix stating super_admin's "edit any" is a
strict superset of admin's. This is correctly implemented in `app/api/admin.py`'s `require_role()`
helper (super_admin satisfies every gate, checked first) and a handful of ad-hoc checks
(`copy.py:24`, `articles.py:282/299/349`, `groups.py`'s `STAFF_ROLES` tuple). **But 23 other
authorization checks across 8 API modules were written as `role in ("admin", "moderator")` or
`role != "admin"` and never updated to also include `super_admin`.** Promoting a real admin to
super_admin today would make them **lose** capabilities they currently have.

**How this was found:** tried to promote `admin@rootlink.app` to `super_admin` (to grant access to
the new Content UI Editor, see below) and caught it before applying — see chat history
2026-07-02. Worked around it for now by creating a **separate, dedicated** `super_admin` account
(`content-ui-editor@rootlink.app`) instead of promoting the real admin account, so zero regression
risk today. **This is a stopgap, not a fix** — the real admin account still can't safely become
super_admin, and the underlying inconsistency affects the whole platform, not just this feature.

**Full list of checks that exclude `super_admin` (must all be fixed together, then tested):**

| # | File:Line | Code | Breaks |
|---|---|---|---|
| 1 | `articles.py:256` | `current_user.role in ("admin", "moderator")` | draft/in_review preview visibility |
| 2 | `articles.py:325` | `current_user.role not in ("admin", "moderator")` | publish-any (ownership bypass) |
| 3 | `articles.py:418` | `current_user.role not in ("admin", "moderator")` | delete-any |
| 4 | `content.py:200` | `current_user.role in ("admin", "moderator")` | draft/in_review preview visibility |
| 5 | `events.py:104` | `user.role not in (UserRole.admin, UserRole.moderator)` | update-any |
| 6 | `events.py:113` | `user.role not in (UserRole.admin, UserRole.moderator)` | delete-any |
| 7 | `events.py:119` | `user.role in (UserRole.admin, UserRole.moderator)` | draft-view-any |
| 8 | `events.py:184` | `current_user.role in (UserRole.admin, UserRole.moderator)` | group-only view-any |
| 9 | `learning.py:35` (`_can_manage`) | `user.role in (UserRole.admin, UserRole.moderator) or user.id == owner_id` | update/delete-any course |
| 10 | `learning.py:39` (`_staff_only`) | `user.role not in (UserRole.admin, UserRole.moderator, UserRole.contributor)` | staff-only create |
| 11 | `learning.py:149` | `current_user.role in (UserRole.admin, UserRole.moderator)` | "my courses" staff view |
| 12 | `learning.py:343` | same pattern | same, 2nd site |
| 13 | `plants.py:186` | `current_user.role not in ("admin", "moderator", "contributor")` | create |
| 14 | `plants.py:208` | same | update |
| 15 | `plants.py:228` | `current_user.role != "admin"` (bare exact-match, worst case) | delete |
| 16 | `plants.py:244` | `current_user.role not in ("admin", "moderator", "contributor")` | (another action) |
| 17 | `plants.py:283` | `current_user.role not in ("admin", "moderator")` | crawl-utad-all |
| 18 | `marketplace.py:182` | `current_user.role.value != "admin"` (bare exact-match) | update-any listing |
| 19 | `marketplace.py:204` | `current_user.role.value != "admin"` (bare exact-match) | delete-any listing |
| 20 | `feeds.py:126` | `current_user.role not in ("admin", "moderator")` | view feed status |
| 21 | `feeds.py:160` | same | refresh feed |
| 22 | `feeds.py:203` | same | disconnect-any feed |
| 23 | `taxonomy.py:146` (`_require_admin`) | `user.role.value != "admin"` (bare exact-match), gates 7 endpoints (lines 156,168,191,209,237,258,276) | all taxonomy admin CRUD (`/admin/config`) |

**Recommended fix:** don't patch each site ad hoc. Either (a) add `super_admin` to every list above
(23 mechanical edits, needs careful per-site review since a couple use `UserRole.admin` enum
members and others use bare strings — check both), or (b) — likely better — introduce a single
shared helper (e.g. `is_staff_or_above(user, *, moderator_ok=True, contributor_ok=False)`) that
always treats `super_admin` as satisfying everything, and migrate all 23 sites to call it, so this
class of bug can't recur. Needs its own test coverage per Kind (article/event/course/plant/
marketplace/feed/taxonomy) verifying super_admin passes every one of these gates. Do this **before**
promoting any real admin account to super_admin.

## 1. ESLint Warnings — ✅ RESOLVED (Phases 4 & 3a)

### React Hook dependency warnings (`react-hooks/exhaustive-deps`) — ✅ ALL FIXED (Phase 4)
All 27 resolved. Each effect was intentional (fetch-on-mount, filter-toggle refetch, or
sync guard); used targeted `eslint-disable-line` with rationale where adding the dep would
change behavior or risk render loops. Original list (for reference):
- `app/admin/comments/page.tsx:18` — `fetchComments`
- `app/admin/content/page.tsx:154` — `fetchContent`
- `app/admin/donations/page.tsx:37` — `fetchDonations`
- `app/admin/groups/page.tsx:21` — `fetchGroups`
- `app/admin/sponsors/page.tsx:53` — `fetchSponsors`
- `app/admin/tickets/page.tsx:32` — `fetchData`
- `app/admin/users/page.tsx:41` — `fetchUsers`
- `app/admin/vendors/page.tsx:55` — `fetchVendors`
- `app/articles/edit/[id]/page.tsx:41` — `addToast`
- `app/composting/page.tsx:48` — `fetchHubs`
- `app/events/[id]/page.tsx:167` — `isOwner`
- `app/events/page.tsx:80` — `loadEvents`
- `app/feed/page.tsx:97` — `router`
- `app/learning/courses/[id]/page.tsx:46` — `fetchData`
- `app/learning/paths/[id]/page.tsx:42` — `fetchData`
- `app/marketplace/[id]/page.tsx:45` — `addToast`, `t`
- `app/marketplace/create/page.tsx:64` — `router`
- `app/marketplace/edit/[id]/page.tsx:91` — `addToast`, `router`, `t`
- `app/notifications/page.tsx:26` — `router`
- `app/plants/page.tsx:31` — `loadPlants`
- `app/profile/page.tsx:147` — `router`
- `app/search/page.tsx:119` — `doSearch`, `searchParams`
- `app/upcycling/page.tsx:53` — `fetchProjects`
- `components/admin/AdminSidebar.tsx:89` — `router`
- `components/admin/AdminSidebarSection.tsx:46` — `defaultExpanded`, `section.labelKey`
- `components/editor/ArticleEditor.tsx:107` — `data`
- `components/nav/NavBar.tsx:150,156` — `locale`, `setLocale`, `user`

### `<img>` → `<Image />` warnings (`@next/next/no-img-element`)
✅ **RESOLVED (Phase 3a) — rule disabled project-wide, by design.**

Decision: turned off `@next/next/no-img-element` in `.eslintrc.json` rather than migrate.
Rationale (deliberate, not laziness):
- The vast majority of images are **arbitrary/unbounded sources** — user-uploaded
  avatars & content images, plant photos from iNaturalist/UTAD, and RSS article
  images from any blog. `next/image` requires every host in `remotePatterns`;
  arbitrary hosts can't be safely enumerated.
- `ImageUpload` shows a **local blob/base64 preview** of a just-selected file —
  `next/image` is not applicable to data URLs.
- `OptimizedImage` already implements lazy-loading + skeleton + onError fallback for
  the self-hosted media server; `next/image` would lose that custom logic.
- The Next 14 `npm audit` includes **active `next/image` optimizer CVEs** (unbounded
  disk-cache growth, optimizer DoS). For a small self-hosted NGO, routing arbitrary
  external images through the optimizer is a net negative.

Revisit after Next 15 (Phase 5): if we move to a single known CDN for media and the
optimizer CVEs are patched, reconsider `next/image` for first-party images only.

## 2. Deprecated npm packages (from Vercel install log)
✅ **MOSTLY RESOLVED in Phase 1** by removing unused `next-pwa` + `next-intl` (306 packages removed).
The following were all transitive deps of `next-pwa` and are now GONE:
- ✅ `rimraf@2.7.1`, `rimraf@3.0.2` — removed with next-pwa
- ✅ `glob@7.2.3`, `glob@10.3.10` — removed with next-pwa
- ✅ `inflight@1.0.6` — removed with next-pwa
- ✅ `rollup-plugin-terser@7.0.2` — removed with next-pwa
- ✅ `sourcemap-codec@1.4.8` — removed with next-pwa
- ✅ `workbox-*@6.6.0` — removed with next-pwa
- ✅ `source-map@0.8.0-beta.0` — removed with next-pwa

Still present (coupled to ESLint/Next, fixed only by Next 15 + ESLint 9 — see §3):
- ⏳ `eslint@8.57.1` — this IS the last 8.x release (already at ceiling). "Unsupported"
  refers to the whole 8.x line being EOL. ESLint 9 requires `eslint-config-next@15`,
  which requires Next 15. So this is hard-coupled to the Next 15 upgrade. CANNOT bump
  safely in isolation (eslint-config-next@14 peer dep = `^7 || ^8` only).
- ⏳ `@humanwhocodes/config-array`, `@humanwhocodes/object-schema` — transitive deps of
  eslint@8; go away with ESLint 9.
- ⏳ `@types/minimatch`, `glob` (CLI advisory) — pulled by `@next/eslint-plugin-next@14`;
  resolved by Next 15 / eslint-config-next@15.

### Pre-existing Next.js 14 CVEs (surfaced by `npm audit` after Phase 1)
Not introduced by us — they were always there, hidden under the deprecation noise.
A long list of Next.js 14 advisories (image optimizer DoS, RSC cache poisoning, request
smuggling, middleware bypass, XSS in CSP nonces, etc.) + vulnerable `postcss`/`glob`.
**Do NOT run `npm audit fix --force`** — it jumps to Next 16 unplanned and breaks the app.
All resolved by the controlled Next 15 upgrade in §3.

## 3. Version / framework currency (Phase 5 — dedicated effort, do last)
- **Next.js 14 → 15** — this is the keystone upgrade. It unlocks:
  - `eslint-config-next@15` → ESLint 9 (flat config) → clears the EOL ESLint warning + its transitive deprecated deps
  - Patches the full list of Next 14 CVEs from `npm audit`
  - Requires handling async request APIs (`cookies()`, `headers()`, `params`) and caching changes — needs full regression testing.
- ✅ `next-pwa` removed (Phase 1) — no longer a concern.
- Backend: 1 open dependabot PR (`sqlalchemy 2.0.50`). bcrypt 5 / redis 8 / lxml 6 already handled. Review/merge after testing migrations.

## 4. Remaining feature work (separate from tech debt)
- Link article feed from home page
- Liberapay tier subscription sync logic
- Remove stray repo-root files: `fix_dark_mode.js`, `scan_and_fix.js`, `setup_stripe.sh`, `reset_admin.py` (move to scripts/ or delete)

## 6. Media URLs stored as absolute (root-cause hardening)
**Problem:** Image uploads persist **absolute** URLs into the DB, built from
`settings.media_url` at upload time (`backend/app/api/images.py:_build_urls()` →
`f"{settings.media_url}/media/..."`). The default is `media_url="http://localhost:8001"`
(`backend/app/core/config.py:17`). If `MEDIA_URL` is ever wrong/unset when an upload
happens (dev machine, seed data, before prod env was set), a `localhost` URL gets baked
permanently into production rows (`users.avatar_url`, `content.image_url`, `listings.images`,
event/group images, etc.).

**Impact seen (2026-06-27):** Firefox 150+ "local network access" protection blocked a
prod avatar pointing at `http://localhost:8000/...` and showed a "wants to access other
apps and services on this device" permission prompt on the profile page. Fixed by (a) a
one-off host-rewrite of 3 affected prod rows → `https://api.ruisilvastudio.com`, and (b) a
frontend safety net (`frontend/lib/image-url.ts` `safeImageUrl()`) that refuses to render
localhost/private-network/non-web image URLs (falls back to a placeholder). Applied in
`Avatar`, `OptimizedImage`, the 5 search cards, profile, home, search, my-articles, and
marketplace.

**Proper fix (do later):** Stop persisting absolute media URLs. Store **relative** paths
(`/media/images/<hash>_<size>.webp`) in the DB and prepend the origin at serve/render time
(backend response serialization, or frontend prepends `NEXT_PUBLIC_API_URL`). Then an env
mismatch can never bake a host into the DB again, and the same DB row is portable across
environments. Requires a data migration to strip the host from existing rows + updating
`_build_urls()`/schemas and frontend consumers.

## 5. Migration hygiene — ⚠ DIVERGED AGAIN (content platform, 2026-06-29)
- Earlier: prod DB patched manually + stamped; `alembic current` = `d73cb2cb00bf (head)`.
- **Now:** the content-platform schema (2026-06-29) is applied entirely via the **app
  lifespan** (`create_all` + idempotent `ALTER`/backfills in `app/main.py`), with **no new
  Alembic revisions**. So `alembic upgrade head` is a no-op and Alembic head no longer
  reflects the real schema (it's behind). This works (lifespan is idempotent + flock-serialized
  across workers) but is divergent. **TODO: backfill Alembic revisions** for the new tables
  (`moderation_audit_log`, `content_templates`, `copy_overrides`) and columns
  (users trust/ban fields, `content.review_note` + status states, `lessons.poster`,
  `groups.status/archived_at` + nullable `category`) so the documented path matches reality.

## 7. Content-platform follow-ups (2026-06-29)
Deferred during the content-platform initiative (also tracked in
`docs/content-platform/IMPLEMENTATION_STATUS.md`):
- **Moderation ML service (SHADOW mode):** Detoxify / NudeNet / Falconsai ViT / Whisper —
  self-hosted in-EU; infra-heavy (models + container + Celery). Lifecycle already has the
  `auto_allow/auto_review/auto_block` audit hooks. Its own dedicated task.
- **Cross-Kind "My Content" dashboard** + engagement counts (likes/views) on **public** cards —
  the latter needs `rating_up`/`view_count` added to the search/feed response schemas. Low value.
- ✅ **Editable-copy inline "click any text to edit" mode** — SHIPPED (2026-07-01) as the
  "Content UI Editor" feature, gated strictly to `super_admin` (no `can_edit_copy` delegation).
  See `discovery/mockups/content-ui-editor/briefing-to-build-local.md` for the design and
  `docs/content-platform/IMPLEMENTATION_STATUS.md` for status/known limitations. The `/admin/copy`
  form editor is unaffected and still works for `can_edit_copy` delegates.
- **Vimeo lesson poster backfill** — YouTube thumbnails derive client-side; Vimeo needs `poster`
  populated (set via oEmbed on lesson save). Existing Vimeo lessons would need a re-save/backfill.
- **`email_verified` signal** — self-publish eligibility currently reuses `is_verified` (which
  doubles as org/practitioner verification). Consider a dedicated `email_verified` flag.
- **Liability-disclaimer legal sign-off** (CONTENT_PLATFORM.md §6.2) and **per-Kind retention
  periods** (§8) — product/legal, not code.

## 8. ThemeProvider inline-style bug — dark-mode token swap is dead code (✅ FIXED 2026-07-17)

**Found:** 2026-07-11 (logo/wordmark integration — see LESSONS.md #41).

**Problem:** `theme-context.tsx:applyTokens()` sets light values as **inline styles**
on `<html>` (`root.style.setProperty('--color-X', light_value)`) and dark values in a
`<style>` tag (`.dark { --color-X: dark_value }`). Inline styles have higher CSS
specificity than any class selector, so the `.dark` override **never takes effect** —
every `--color-*` token stays at its light value in both light and dark mode.

This has been latent since the theme system was built (Phase 4). No existing component
noticed because **every component on the site uses explicit `dark:` Tailwind variants**
(e.g. `text-primary-600 dark:text-primary-400`), switching to a *different token* in
dark mode rather than relying on the *same token's* dark value. The wordmark component
(new, using `text-brand` with no `dark:` variant) was the first to rely on the automatic
swap, exposing the bug.

**Current workaround:** The wordmark and brand icon use `text-brand dark:text-primary-300`
(the same explicit-variant pattern every other component uses). This works correctly
because Tailwind v4 generates separate CSS rules for `dark:` variants — it does not depend
on the ThemeProvider's token swap.

**Proper fix (not yet done):** Change `applyTokens()` to use stylesheet rules for **both**
light and dark values, not inline styles for light. For example:

```js
// Instead of: root.style.setProperty('--color-X', light)
// Use a <style> tag:
//   :root { --color-X: light; }
//   .dark { --color-X: dark; }
```

**Risk:** Components that use a single token (e.g. `text-primary-600` with no `dark:`
variant) and were *designed assuming the swap was broken* (i.e. the designer chose a
light-mode color that also looks acceptable in dark mode) would suddenly get a different
dark color. Needs a full visual audit of the site in dark mode after the fix. Track which
components use bare tokens without `dark:` variants before and after.

## 8b. Privacy — `GET /api/events/{id}/attendees` publicly leaks attendee emails (found 2026-07-16, ✅ FIXED)
Surfaced during the Groups backend security audit (same pattern as the groups S1 leak, now
fixed for groups): `events.py:349-356` returns attendee rows including **email addresses**
with no auth dependency. Fix: require authentication + event-owner/manager rights (or strip
emails from the public shape). Not fixed in the groups pass because it's outside that
feature's blast radius — needs its own quick pass + a check for sibling endpoints
(marketplace, courses) with the same pattern.

## 9. Notification messages are hardcoded strings in mixed languages (found 2026-07-16)
Notifications store their display text at creation time (`Notification.message`). Legacy ones
are English ("X started following you"); the Groups notifications (join requests, approvals,
invites) were written in pt-PT per product direction. Long-term the `message` column should
become a message KEY + params rendered through the frontend i18n system, so the bell speaks
the viewer's language consistently. Platform-wide pass — not groups-specific.

## 10. Home page hydration warning — nested `<a>` in `LinkWithArrow` (found 2026-07-16, ✅ FIXED)
Console on `/`: "In HTML, <a> cannot be a descendant of <a>. This will cause a hydration
error." Component stack points at `LinkWithArrow` (DeFacto). Something renders a Next `Link`
inside another anchor. Pre-existing (not from the Groups work — group pages emit 0 warnings).
Quick fix pass needed on the home/DeFacto blocks.
