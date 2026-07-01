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
