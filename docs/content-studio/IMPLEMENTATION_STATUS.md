# Content Studio — Implementation Status

> **Spec:** [`CONTENT_STUDIO.md`](./CONTENT_STUDIO.md)
> **Last updated:** 2026-07-08

---

## Current phase: Phase 4+ — Page migration to blocks (next)

### Phase 0 — Foundation & contract ✅ COMPLETE
- ✅ Spec + status doc + AGENTS.md rule.
- ✅ `frontend-ui-guardian` skill reconciled (earth-brown/Fraunces).
- ✅ `--token` CSS-variable layer (zero visual change).

### Phase 1 — Studio shell + Content/Copy ✅ COMPLETE
- ✅ `/studio` route-group, `StudioShell` (responsive, super_admin gate), Content module (namespace-tree + PT/EN editor, reuses `/api/copy`).
- ✅ Playwright: 10/10 checks passed.

### Phase 2 — Theming module ✅ COMPLETE
- ✅ Backend: `theme_override` model + `api/theme.py` (10 tests passing).
- ✅ Frontend: `ThemeProvider` (runtime CSS-var injection), `/studio/theming` (color pickers, fonts, radius, live preview, save/revert).
- ✅ Playwright: 10/10 checks passed (override → reload → CSS var injected → revert).

### Phase 3 — Block model ✅ COMPLETE
- ✅ **Backend** (subagent-built): `block_page.py` model (BlockPage + BlockSection) + `api/blocks.py` (public GET, super_admin CRUD, audit-logged) + `tests/test_blocks.py` (12 tests passing).
- ✅ **Block registry** (`lib/block-registry.ts`): 4 starter block types (Hero, Text section, Card grid, CTA) with typed fields + defaults + React components.
- ✅ **BlockRenderer** (`components/blocks/BlockRenderer.tsx`): renders section tree by looking up block types in the registry.
- ✅ **Block components** (`components/blocks/BlockComponents.tsx`): HeroBlock, TextBlock, CardGridBlock, CtaBlock — all using the platform's CSS-var token layer.
- ✅ **Studio block canvas** (`/studio/blocks`): page list + block palette + section composer (add/reorder/edit/delete/publish) with live preview via BlockRenderer.
- ✅ **Live block-composed page** (`/p/[slug]`): public route that fetches a BlockPage and renders its sections.
- ✅ API client: `api.blocks.{listPages,getPage,createPage,updatePage,addSection,updateSection,deleteSection,adminListPages}`.
- ✅ Studio shell + overview: Blocks is now "active".
- ✅ Fixed circular import (registry → BlockComponents directly, not via index.ts).
- ✅ Fixed auto-select of newly created page in the block canvas.
- ✅ Playwright: 10/10 checks passed (create page → add 3 block types → edit props → publish → live page at /p/{slug} renders all sections → mobile viewport).

**Files changed (Phase 3):**
- `rootlink/backend/app/models/block_page.py` (new)
- `rootlink/backend/app/api/blocks.py` (new)
- `rootlink/backend/app/models/__init__.py` (registered BlockPage, BlockSection)
- `rootlink/backend/app/main.py` (registered blocks router + table creation)
- `rootlink/backend/tests/test_blocks.py` (new, 12 tests)
- `rootlink/frontend/lib/block-registry.ts` (new)
- `rootlink/frontend/lib/api.ts` (blocks namespace)
- `rootlink/frontend/components/blocks/BlockComponents.tsx` (new)
- `rootlink/frontend/components/blocks/BlockRenderer.tsx` (new)
- `rootlink/frontend/components/blocks/index.ts` (new)
- `rootlink/frontend/app/studio/blocks/page.tsx` (new — block canvas)
- `rootlink/frontend/app/p/[slug]/page.tsx` (new — live block page)
- `rootlink/frontend/components/studio/StudioShell.tsx` (Blocks → active)
- `rootlink/frontend/app/studio/page.tsx` (Blocks → active)

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
