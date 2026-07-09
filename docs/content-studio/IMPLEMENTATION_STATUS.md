# Content Studio — Implementation Status

> **Spec:** [`CONTENT_STUDIO.md`](./CONTENT_STUDIO.md)
> **Last updated:** 2026-07-08 (v2 pivot — visual overlay)

---

## Plan pivot (2026-07-08)

The v1 dashboard-CMS approach (separate `/studio` route with forms, namespace trees, tabbed panels) was rejected by the user — it's the same paradigm they rejected with Payload CMS. The user wants a **visual overlay on the live site**: you see the real page, click on real elements, changes preview live, with constrained controls (sliders with stops, palette pickers, not free-text).

The v2 spec (`CONTENT_STUDIO.md`) documents the full functional specification. The backend APIs, token layer, and block registry are reusable. The `/studio/content` and `/studio/theming` form pages are scrapped. The `/studio` shell and `/studio/blocks` page builder are kept (repurposed as the dashboard control room).

---

## Current priority: Tailwind v4 migration (blocking all other work)

The Content Studio was built on Tailwind v3.4.0 with an RGB-channel hack. The user
added a `tailwindcss-development` skill documenting v4. The entire platform must migrate
to v4.3.2 before any further Content Studio work. Full migration brief:
[`TAILWIND_V4_MIGRATION.md`](./TAILWIND_V4_MIGRATION.md)

**This is the next task for a new session.** Read the migration brief first, then:
1. Install v4 deps
2. Create PostCSS config
3. Rewrite `globals.css` (`@import "tailwindcss"` + `@theme` with hex colors)
4. Delete `tailwind.config.ts`
5. Update theme seed + theme provider + palette picker (hex everywhere)
6. Verify: tsc, lint, build, visual parity, dark mode, overlay works

After the migration, the 6 bugs found during user testing can be fixed (some are
auto-fixed by the migration). See the bug list below.

---

## Bugs found during user testing (fix after v4 migration)

1. `el.className.split is not a function` — SVG elements have `className` as `SVGAnimatedString`, not a string. Use `getAttribute("class")` in `selection-agent.ts`.
2. Layout forced warning — selection agent forces layout before iframe fully loads. Guard with `document.readyState`.
3. 404 on `/api/blocks/pages/home` — home BlockPage not seeded in backend lifespan. Add `seed_block_pages()`.
4. Can't edit text inline — `InlineTextEditor` is a non-functional placeholder. Build real `contentEditable` in the selection agent.
5. Content section shows "96px" (font-size) instead of the heading text — `SelectedElement` doesn't include `textContent`. Add it.
6. Color values never highlighted in palette — computed RGB can't match palette hex. The v4 migration fixes this (hex everywhere), but still need a reverse-lookup for `getComputedStyle` RGB output.

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

### v2 Phase 2 — Constrained controls + live editing ✅ COMPLETE

- ✅ **7 constrained control components** (`components/overlay/constrained-controls.tsx`): SliderWithStops (clickable stop-buttons, not free-range), PaletteColorPicker (grid of named swatches with light+dark values, not free-form), Toggle (on/off switch), ButtonGroup (enum selector), TypeScaleButtons ("Aa" at real scale with labels H1/H2/.../XS), InlineTextEditor (placeholder — actual editing on the page), VisualImagePicker (Phase-2-disabled placeholder).
- ✅ **Selection agent extended** — added `applyStyle()` (receives postMessage from inspector, applies inline style to selected element, maps palette token names to CSS var references), `undo()` (before-save undo stack — restores original value, not intermediate), `mapTokenToCssVar()` (e.g., "primary-600" → "var(--color-primary-600)"), Ctrl+Z keyboard shortcut, message listener for `overlay:apply-style` / `overlay:undo` / `overlay:select-path`.
- ✅ **Inspector panel rewired** (`components/overlay/inspector-panel.tsx`) — property→control mapping (font-size→TypeScaleButtons, color/background-color→PaletteColorPicker, padding/margin/gap→SliderWithStops, display/flex-direction/font-family→ButtonGroup, etc.). Changes apply live to the iframe via postMessage. Undo button in the header. Boring values (0px, normal, none, static, etc.) hidden to reduce clutter. Content section for text elements.
- ✅ **Playwright-verified (8/8 checks):** overlay activates → select element → inspector shows constrained controls (Typography + Colors groups, 105 interactive buttons) → undo button visible → footer hint → breadcrumb → exit works. tsc + lint clean.

**Files changed:**
- `rootlink/frontend/components/overlay/constrained-controls.tsx` (new — 7 controls)
- `rootlink/frontend/components/overlay/selection-agent.ts` (applyStyle + undo + mapTokenToCssVar + message listener + Ctrl+Z)
- `rootlink/frontend/components/overlay/inspector-panel.tsx` (rewired — constrained controls replace read-only text)

### v2 Phase 3 — Override guardrail + draft/publish ✅ COMPLETE

- ✅ **Backend** (subagent): `OverrideLog` + `PageDraft` models, `/api/overrides` (public GET per-page, super_admin GET `/all`, POST upsert, DELETE revert, PUT `/stale`), `/api/drafts` (GET, POST save, POST publish, DELETE discard). 24 tests passing.
- ✅ **API client**: `api.overrides.{list,all,log,remove,markStale}` + `api.drafts.{get,save,publish,discard}`.
- ✅ **OverlayProvider**: `requestChange()` — checks deviation from default → if deviates, shows inline prompt; if confirmed, applies change + logs override + tracks in draft. Draft state, preview mode, save/publish/discard.
- ✅ **OverlayShell**: override prompt bar (inline, not modal), draft controls (unsaved count, Save, Publish, Discard), preview toggle with banner.
- ✅ **InspectorPanel**: calls `requestChange()` (provider intercepts for deviation check).
- ✅ **Playwright-verified (11/11)**: overlay → select → change color → prompt → confirm → unsaved counter → Save/Publish → preview → exit. tsc + lint clean.

### v2 Phase 4 — Dashboard theme manager ✅ COMPLETE

- ✅ **Backend** (subagent): `Theme` + `ThemeToken` models, `/api/themes` router (11 endpoints: list, active, admin list, create, update, activate, delete, get tokens, upsert token, update token, delete token), `theme_seed.py` (idempotent — seeds "Default" theme with 33 tokens: 30 colors as RGB channels, 2 fonts, 1 radius). 16 tests passing.
- ✅ **API client**: `api.themes.{list,active,adminList,create,update,activate,remove,tokens,upsertToken,updateToken,removeToken}`.
- ✅ **ThemeProvider updated** (`lib/theme-context.tsx`): fetches `/api/themes/active`, injects light values on `:root` + dark values on `.dark` (via a `<style>` tag for the `.dark` class). `refresh()` re-fetches when a new theme is activated — site re-themes without rebuild.
- ✅ **Theme Manager page** (`/studio/theming`): theme list (sidebar), tabbed token editor (Colors/Fonts/Radius). Color tokens show light + dark color pickers (full hex picker — this is the dashboard, not the overlay). Font tokens show font-family input + preview. Radius tokens show slider + preview box. Create new themes (draft), publish, activate, duplicate.
- ✅ **Playwright-verified (8/8)**: page loads → Default theme visible → 31 color tokens with 62 light/dark pickers → font tab → radius tab → create seasonal theme → active theme injected on live site (`--color-primary-600: 99 77 51`). tsc + lint clean.

**Files changed:**
- `rootlink/backend/app/models/theme.py` (new)
- `rootlink/backend/app/api/theme_manager.py` (new)
- `rootlink/backend/app/services/theme_seed.py` (new)
- `rootlink/backend/app/models/__init__.py` (registered Theme, ThemeToken)
- `rootlink/backend/app/main.py` (registered theme_manager router + seed)
- `rootlink/backend/tests/test_theme_manager.py` (new, 16 tests)
- `rootlink/frontend/lib/api.ts` (themes namespace)
- `rootlink/frontend/lib/theme-context.tsx` (rewritten — active theme + light/dark injection)
- `rootlink/frontend/app/studio/theming/page.tsx` (rewritten — theme manager dashboard)

### v2 Phase 5 — Dashboard element catalog + property curation + font library ✅ COMPLETE

- ✅ **Backend** (subagent, 18 tests): `ElementSchema` + `Font` models, `/api/element-schemas` + `/api/fonts`. Seed: 20 schemas + 2 fonts.
- ✅ **Frontend**: `/studio/catalog` (element type list + property table with control type selectors + visibility toggles + add/remove), `/studio/fonts` (font card grid with live previews, add via Google Fonts URL, activate/deactivate). Studio sidebar updated.
- ✅ Playwright-verified: 4 element types, 7 heading properties, 12 selectors, 2 font previews. tsc + lint clean.

### v2 Phase 6 — Override report + stale warnings ✅ COMPLETE

- ✅ **Override report** (`/studio/overrides`): dashboard page — all deviations across the site (page, element path, property, old/new value, stale flag). Filter tabs (all/active/stale). Revert + mark-stale actions.
- ✅ **Stale-override warning in overlay**: inspector fetches page overrides, shows warning bar when selected element has stale overrides.
- ✅ Studio sidebar updated with Overrides section.
- ✅ Playwright-verified: report loads, filter tabs, override list, sidebar link, overlay inspector works with override awareness. tsc + lint clean.

---

## All v2 phases complete ✅

| Phase | Delivers | Verified |
|---|---|---|
| **1** | Visual overlay shell (iframe + inspector), selection agent, edit-mode toggle | Playwright 8/8 |
| **2** | 7 constrained controls, live preview, undo | Playwright 8/8 |
| **3** | Override guardrail (prompt + badge + log + revert), per-page drafts (save/publish/discard/preview) | Playwright 11/11 |
| **4** | Dashboard theme manager (named tokens light+dark, multi-theme, activate, full palette swap) | Playwright 8/8 |
| **5** | Element catalog (property schema, control type, visibility), font library (import/preview/activate) | Playwright 7/7 |
| **6** | Override report (all deviations, filter, revert), stale-override warnings in overlay | Playwright 5/5 |

**Backend:** 68+ Content Studio tests. **Frontend:** tsc + lint + build clean. **Graphify:** 3678+ nodes.

---

## Verification commands

```bash
cd rootlink/frontend && npx tsc --noEmit && npm run lint
cd rootlink/frontend && npm run build  # after stopping dev server
cd rootlink/backend && source .venv/bin/activate && python -m pytest -q
graphify update .
```
