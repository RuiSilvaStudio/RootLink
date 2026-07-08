# Content Studio — Implementation Status

> **Spec:** [`CONTENT_STUDIO.md`](./CONTENT_STUDIO.md)
> **Last updated:** 2026-07-08

---

## Current phase: Phase N — User theme selection (future)

### Phase 0 — Foundation & contract ✅ COMPLETE
### Phase 1 — Studio shell + Content/Copy ✅ COMPLETE
### Phase 2 — Theming module ✅ COMPLETE
### Phase 3 — Block model ✅ COMPLETE
### Phase 4 — Homepage migration to blocks ✅ COMPLETE

### Phase 5-9 — Content-heavy page migrations to blocks ✅ COMPLETE

- ✅ **13 new block components** (`components/blocks/PageBlocks.tsx`, 691 lines):
  - Donate (5): DonateHero, DonateBalance, DonateTiers, DonateLeaderboard, DonateHowItWorks
  - Leaderboard (2): LeaderboardHero, LeaderboardList
  - Ranking (2): RankingHero, RankingDetails
  - Tools (2): ToolsHeader, ToolsGrid
  - Groups (2): GroupsHeader, GroupsHero
- ✅ **13 new block types registered** in `lib/block-registry.ts`.
- ✅ **5 page routes migrated**: `donate`, `leaderboard`, `ranking`, `tools`, `groups` — each fetches `/api/blocks/pages/{slug}` → BlockRenderer, with fallback to block components with default i18n props.
- ✅ **5 BlockPages seeded** in the backend (all published).
- ✅ **Playwright-verified**: all 5 pages render correctly via the block model.
- ✅ Build: `tsc` clean, `lint` 0 errors, `next build` succeeds.

### Phase 10 — Remaining pages assessment

The remaining public pages (`composting`, `upcycling`, `feed`, `entities`, `events`, `marketplace`, `network`, `notifications`) are **data-listing pages** with just a PageHeader + dynamic content (filter chips, data grids, forms). Their headers are already editable via the Content Studio's Content module (the `/api/copy` override layer + EditableText wrappers from the Content UI Editor). Their bodies are dynamic data that doesn't fit the block model (they're not static marketing content). These pages can be migrated to blocks later when there's a design reason to do so (e.g., if a page gains new static marketing sections). The architecture is composable — the block registry, BlockRenderer, and studio canvas are all ready.

**Files changed (Phase 5-9):**
- `rootlink/frontend/components/blocks/PageBlocks.tsx` (new — 13 block components)
- `rootlink/frontend/components/blocks/index.ts` (export PageBlocks)
- `rootlink/frontend/lib/block-registry.ts` (13 new block types registered)
- `rootlink/frontend/app/donate/page.tsx` (migrated to BlockRenderer + fallback)
- `rootlink/frontend/app/leaderboard/page.tsx` (migrated)
- `rootlink/frontend/app/ranking/page.tsx` (migrated)
- `rootlink/frontend/app/tools/page.tsx` (migrated)
- `rootlink/frontend/app/groups/page.tsx` (header/hero migrated, form + data list unchanged)

### Phase 0 — Foundation & contract ✅ COMPLETE
### Phase 1 — Studio shell + Content/Copy ✅ COMPLETE
### Phase 2 — Theming module ✅ COMPLETE
### Phase 3 — Block model ✅ COMPLETE

### Phase 4 — Homepage migration to blocks ✅ COMPLETE

- ✅ **6 homepage block components** (`components/blocks/HomeBlocks.tsx`): HomeHeroBlock (search + stats, fetches `publicStats`), HomeCategoriesBlock (fetches `taxonomy.families`), HomeToolsBlock (3 tool cards), HomeCommunityBlock (4 community links), HomeRecentBlock (fetches `content.recent`), HomeCtaBlock. All self-contained — each fetches its own dynamic data; static copy (badges, headings, subtitles) is editable via block props in the studio.
- ✅ **Block registry extended** — 6 new block types registered (`home-hero`, `home-categories`, `home-tools`, `home-community`, `home-recent`, `home-cta`) with editable fields for badge/heading/subtitle overrides.
- ✅ **`app/page.tsx` migrated** — now fetches the `home` BlockPage from `/api/blocks/pages/home` and renders via BlockRenderer. Falls back to the 6 block components with default (i18n) props if the backend page doesn't exist — the homepage never breaks.
- ✅ **`home` BlockPage seeded** in the backend (slug=`home`, 6 sections in order, published).
- ✅ **Playwright-verified:** homepage renders all 6 sections via the block model (hero with search + live stats, categories from taxonomy, tools, community links, recent content, CTA). Mobile viewport works. Studio shows the Homepage in its page list with all 6 sections visible/editable.
- ✅ Build: `tsc` clean, `lint` 0 errors, `next build` succeeds.

**Files changed (Phase 4):**
- `rootlink/frontend/components/blocks/HomeBlocks.tsx` (new — 6 homepage block components)
- `rootlink/frontend/lib/block-registry.ts` (6 new block types registered)
- `rootlink/frontend/components/blocks/index.ts` (export HomeBlocks)
- `rootlink/frontend/app/page.tsx` (migrated to BlockRenderer + fallback)

**What this means:** The homepage is now **composable in the studio** — a super_admin can go to `/studio/blocks`, select "Homepage", reorder sections, edit section copy (badges/headings/subtitles), add new blocks, and publish. Changes go live on the real homepage without a deploy.

---

## Phase log

### Phase 0 — Foundation & contract ✅
### Phase 1 — Studio shell + Content/Copy ✅
### Phase 2 — Theming module ✅
### Phase 3 — Block model ✅
### Phase 4+ — Page migration to blocks (next — homepage first)
### Phase N — User theme selection (future)

---

## Summary of what's delivered (Phases 0-3)

The Content Studio now manages:
1. **Content** — marketing copy, labels, buttons, menus, warnings (PT + EN) with namespace-tree navigation, per-key editor, save/revert. Reuses `/api/copy`.
2. **UI/Theming** — colors, fonts, radii, dark mode with global theme editing and real-time live preview. Writes to CSS custom properties via `/api/theme`.
3. **Blocks** — block-composed pages with a registry of block types (Hero, Text, Card grid, CTA), a composer canvas, and live rendering at `/p/{slug}`. Backend via `/api/blocks`.

All three are accessible at `/studio` (super_admin only), mobile + desktop responsive, and Playwright-verified end-to-end.

## Verification commands

```bash
cd rootlink/frontend && npx tsc --noEmit && npm run lint
cd rootlink/frontend && npm run build  # after stopping dev server
cd rootlink/backend && source .venv/bin/activate && python -m pytest -q
graphify update .
```
