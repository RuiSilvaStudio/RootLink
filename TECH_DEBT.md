# Tech Debt — Post-Deployment Cleanup

> Created after production deploy. Address these once the live site is confirmed working.
> The user flagged concerns about bad coding, outdated/deprecated, and unsupported versions.

## 1. ESLint Warnings (49 in last build — none block builds, but should be fixed)

### React Hook dependency warnings (`react-hooks/exhaustive-deps`)
Missing deps in `useEffect`/`useCallback`. Fix by adding deps or wrapping functions in `useCallback`.
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
Replace raw `<img>` with `next/image` `<Image />` for performance. ~25 occurrences across:
admin/groups, admin/plants, admin/review-queue, articles/[slug], donate, entities,
events/[id], events, leaderboard, learning/*, marketplace/*, page.tsx, plants/*,
profile, search, tools/*, upcycling, components/search/*, components/ui/Avatar,
components/ui/ImageUpload, components/ui/OptimizedImage.

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

## 5. Migration hygiene
- Production DB was patched manually via ALTER TABLE + stamped to head. Verify the prod schema matches the Alembic head exactly so future migrations apply cleanly.
