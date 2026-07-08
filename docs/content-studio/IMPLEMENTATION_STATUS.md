# Content Studio — Implementation Status

> **Spec:** [`CONTENT_STUDIO.md`](./CONTENT_STUDIO.md)
> **Last updated:** 2026-07-08 (v2 pivot — visual overlay)

---

## Plan pivot (2026-07-08)

The v1 dashboard-CMS approach (separate `/studio` route with forms, namespace trees, tabbed panels) was rejected by the user — it's the same paradigm they rejected with Payload CMS. The user wants a **visual overlay on the live site**: you see the real page, click on real elements, changes preview live, with constrained controls (sliders with stops, palette pickers, not free-text).

The v2 spec (`CONTENT_STUDIO.md`) documents the full functional specification. The backend APIs, token layer, and block registry are reusable. The `/studio/content` and `/studio/theming` form pages are scrapped. The `/studio` shell and `/studio/blocks` page builder are kept (repurposed as the dashboard control room).

---

## Current phase: Phase 1 — Overlay shell + selection (in progress)

### Reusable from prior work ✅
- Token CSS-variable layer (globals.css + tailwind.config.ts)
- Backend APIs (/api/theme, /api/copy, /api/blocks)
- Block registry + BlockRenderer + block components
- /studio shell + /studio/blocks page builder
- 6 seeded BlockPages

### Scrapped
- /studio/content (namespace-tree form editor) — replaced by visual overlay inline editing
- /studio/theming (tabbed color-picker panel) — replaced by visual overlay inspector + dashboard theme manager

---

## Phase log

### v1 (Phases 0-9) — dashboard CMS ✅ (superseded by v2)
Built the dashboard CMS with form editors, theming panels, block canvas, and migrated 6 pages to blocks. All backend infrastructure and the token layer are reused in v2. The frontend form editors are scrapped.

### v2 Phase 1 — Overlay shell + selection ✅ COMPLETE

- ✅ `CONTENT_STUDIO.md` spec rewritten (v2 visual overlay paradigm).
- ✅ `IMPLEMENTATION_STATUS.md` updated with plan pivot.
- ✅ **OverlayProvider** (`components/overlay/overlay-provider.tsx`) — edit-mode state context, super_admin + desktop gate, postMessage listener for iframe→parent communication.
- ✅ **Selection agent** (`components/overlay/selection-agent.ts`) — injected into the iframe: hover outlines + labels, click-to-select (capture-phase interception prevents page's own handlers), computed-styles capture, breadcrumb hierarchy builder, keyboard nav (Esc=parent), double-click=parent.
- ✅ **OverlayShell** (`components/overlay/overlay-shell.tsx`) — full-screen overlay: top bar (exit button + "Edit Mode" label), iframe container (loads the real current page), inspector dock (right side, 384px).
- ✅ **InspectorPanel** (`components/overlay/inspector-panel.tsx`) — breadcrumb hierarchy at top, element label, computed styles grouped by category (Typography, Colors, Spacing, Border, Layout, Effects). Read-only in Phase 1; editing controls arrive in Phase 2.
- ✅ **OverlayToggle** (`components/overlay/overlay-toggle.tsx`) — floating "Edit page" button (bottom-right), visible to super_admin on desktop, suppressed on /studio /admin /auth routes.
- ✅ Mounted in root layout (`app/layout.tsx`) inside OverlayProvider — renders nothing for non-super_admin or mobile.
- ✅ **Playwright-verified (8/8 checks):** super_admin sees toggle → activates overlay → iframe loads real page → selection agent injected → click element → inspector shows computed styles + breadcrumb → exit deactivates. Non-admin test skipped (no test account available).

**Files changed:**
- `docs/content-studio/CONTENT_STUDIO.md` (rewritten v2)
- `docs/content-studio/IMPLEMENTATION_STATUS.md` (updated)
- `rootlink/frontend/components/overlay/overlay-provider.tsx` (new)
- `rootlink/frontend/components/overlay/selection-agent.ts` (new)
- `rootlink/frontend/components/overlay/overlay-shell.tsx` (new)
- `rootlink/frontend/components/overlay/inspector-panel.tsx` (new)
- `rootlink/frontend/components/overlay/overlay-toggle.tsx` (new)
- `rootlink/frontend/app/layout.tsx` (mounted OverlayProvider + OverlayShell + OverlayToggle)

### v2 Phase 2 — Constrained controls + live editing (next)
- ⏳ Build constrained control components: SliderWithStops, PaletteColorPicker, Toggle, ButtonGroup, TypeScaleButtons, InlineTextEditor, VisualImagePicker
- ⏳ Wire them to the inspector panel (replace read-only values with editable controls)
- ⏳ Changes preview live in the iframe
- ⏳ Undo before save

---

## Verification commands

```bash
cd rootlink/frontend && npx tsc --noEmit && npm run lint
cd rootlink/frontend && npm run build  # after stopping dev server
cd rootlink/backend && source .venv/bin/activate && python -m pytest -q
graphify update .
```
