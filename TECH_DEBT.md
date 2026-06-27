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
These come transitively from dependencies. Audit and upgrade root deps where possible.
- `eslint@8.57.1` — no longer supported → upgrade to ESLint 9
- `rimraf@2.7.1`, `rimraf@3.0.2` — < v4 unsupported
- `glob@7.2.3`, `glob@10.3.10` — old, security advisories
- `inflight@1.0.6` — leaks memory, unsupported
- `rollup-plugin-terser@7.0.2` — deprecated → `@rollup/plugin-terser`
- `sourcemap-codec@1.4.8` → `@jridgewell/sourcemap-codec`
- `workbox-*@6.6.0` (from next-pwa) — outdated
- `@humanwhocodes/config-array`, `@humanwhocodes/object-schema` — replaced by `@eslint/*`
- `@types/minimatch@6.0.0` — stub, removable
- `source-map@0.8.0-beta.0` — beta, won't ship

## 3. Version / framework currency
- Next.js pinned at `14.2.x`; Vercel build machine uses Node 24. Evaluate Next 15 upgrade.
- `next-pwa@5.6.0` pulls most of the deprecated workbox packages — check for maintained fork or replacement.
- Backend: dependabot PRs open for bcrypt 5, redis 8, lxml 6, sqlalchemy, pydantic, celery, etc. Review/merge after testing.

## 4. Remaining feature work (separate from tech debt)
- Link article feed from home page
- Liberapay tier subscription sync logic
- Remove stray repo-root files: `fix_dark_mode.js`, `scan_and_fix.js`, `setup_stripe.sh`, `reset_admin.py` (move to scripts/ or delete)

## 5. Migration hygiene
- Production DB was patched manually via ALTER TABLE + stamped to head. Verify the prod schema matches the Alembic head exactly so future migrations apply cleanly.
