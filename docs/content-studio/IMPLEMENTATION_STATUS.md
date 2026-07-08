# Content Studio — Implementation Status

> **Spec:** [`CONTENT_STUDIO.md`](./CONTENT_STUDIO.md)
> **Last updated:** 2026-07-08

---

## Current phase: Phase 5+ — Continue page migration (next)

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
