# Content Studio — Implementation Status

> **Spec:** [`CONTENT_STUDIO.md`](./CONTENT_STUDIO.md)
> **Last updated:** 2026-07-11 (UX hardening — P2 polish: keyboard, resume-draft, skeletons)

---

## Plan pivot (2026-07-08)

The v1 dashboard-CMS approach (separate `/studio` route with forms, namespace trees, tabbed panels) was rejected by the user — it's the same paradigm they rejected with Payload CMS. The user wants a **visual overlay on the live site**: you see the real page, click on real elements, changes preview live, with constrained controls (sliders with stops, palette pickers, not free-text).

The v2 spec (`CONTENT_STUDIO.md`) documents the full functional specification. The backend APIs, token layer, and block registry are reusable. The `/studio/content` and `/studio/theming` form pages are scrapped. The `/studio` shell and `/studio/blocks` page builder are kept (repurposed as the dashboard control room).

---

## Component-level selection (Phases A-D) — ✅ COMPLETE

The overlay now snaps selection to **component** boundaries — you click a Card,
you get the Card (not the inner h3 or svg). tsc + lint clean (build not run — a
dev server is live on :3001; running `npm run build` would clobber `.next/` per
LESSONS.md #2; run the build separately before deploy).

### Phase A — Extract 7 de facto components ✅
- ✅ `components/ui/DeFacto.tsx` — 7 components. Extended during this work: `FilterPill` gained `variant` (primary | neutral) + optional `icon` + `size`; `SidebarWidget` gained `iconColor`; `IconContainer` gained `inline` (for text-center hero icons); `ResultCard`'s dynamic-class bug (`border-${accent}-200/60`, invisible to Tailwind JIT) fixed with a static `ACCENT_BORDER` map.
- ✅ `PageBlocks.tsx` — hero icons → `IconContainer` (with `inline` for the text-center heros); `LeaderboardListBlock` rows → `RankedListRow` (exact gold/silver/bronze match). `DonateLeaderboardBlock` left as plain rows (`RankedListRow` would add tier styling it intentionally lacks).
- ✅ Search page filters → `FilterPill` (family = primary, content-type = neutral); the 4 sidebar widgets → `SidebarWidget` (each keeps its distinct icon color; also fixes a latent missing-`dark:bg-stone-900` bug). `events`/`marketplace` filters → `FilterPill` (marketplace uses `size="sm"` + `icon`). `feed` has no filter pills (nothing to refactor).
- ⚠️ `BlockComponents.tsx` generic blocks have no clean de facto match without a visual change (SectionHeader's h2 is `text-4xl`; these blocks intentionally use `text-2xl` sub-headings; their cards aren't links so ResultCard doesn't fit). Left structurally as-is; tagged in Phase B. (Decision flagged to user.)
- Decision (user-approved): keep the specialized search result cards' rich layouts; tag them all as `ResultCard` rather than rewriting them onto the generic DeFacto ResultCard.

### Phase B — Tag all components with data-rl-component ✅
- ✅ `data-rl-component="<Name>"` on the root element of 70 tagged elements across `components/ui`, `components/blocks`, `components/search` + the 7 de facto. (3 parallel subagents did the sweep; verified by grep.)
- ✅ `PageHeader` + `Card` gained `...rest` forwarding + `"data-rl-component"?: string` so block-level roots (`GroupsHeaderBlock`/`GroupsHeroBlock`) override the inner `PageHeader`/`Card` tag with their block name.
- The 4 search widgets are covered transitively (their root is now `SidebarWidget`, already tagged).

### Phase C — Selection agent snaps to component boundaries ✅
- ✅ `selection-agent.ts`: hover → nearest `data-rl-component` ancestor (outline + component-name label); click → select that component; **double-click → drill into the nearest child component**; Esc → parent component; breadcrumb → the chain of component ancestors (component names, not raw DOM). The `overlay:select` message now carries `componentType`.
- ⚠️ Spec §3.2 says "double-click selects the parent"; the Phase C plan (this doc) says "drill into child components". These conflict. Implemented the Phase C plan (Esc=up, dblclick=down, breadcrumb=jump) as the coherent component-navigation model. Flagged for user.
- Inline `contentEditable` text editing (Phase 1/2) is retired at the component level (making a whole Card contentEditable would be destructive). Text editing moves to the Phase D inspector's `inline-text` control bound to schema text properties.

### Phase D — Inspector shows schema-only properties ✅
- ✅ `inspector-panel.tsx`: fetches `/api/element-schemas` (grouped map, cached) on mount; on selection looks up the schema by `selected.componentType` (with a lowercase fallback so `Card`→seeded `card`). When a curated schema exists, shows **only** those schema properties via the schema's `control_type`/`options`/`default_value` — no raw CSS dump. When no schema is curated for the component, falls back to constrained controls on computed properties, showing only properties that have a purpose-built control (still no raw dump).
- `SelectedElement` gained `componentType?: string | null` (overlay-provider).
- Note: only the 4 generic seeded types (`heading`/`card`/`button`/`section`) are reachable via the lowercase fallback; PascalCase de facto names (`FilterPill`, `ResultCard`, `SectionHeader`, …) have no curated schema yet → they use the constrained-controls fallback until the dashboard curates schemas keyed by those names.

---

## Theme-token model rebuild (select / edit / panel) — ✅ COMPLETE

A user-review-driven rebuild of the overlay's selection, editing, and inspector to the
spec's actual design: **the theme is the menu of values; selecting an item = picking
theme values for it; per-item edits are reversible overrides storing token NAMES;
dark mode is automatic.** No structural CSS is exposed (would break layouts); no
color-format conversions (the old `normalizeToHex` rgb→hex hack and the removed
`mapTokenToCssVar` are gone — everything is the Tailwind v4 `@theme` language applied
and matched by name).

### 1. Colors + automatic dark mode
- ✅ `selection-agent.ts` `applyStyle(property, value, appliedValue)`: the inspector sends the token NAME (`primary-600`) as `value` (override identity, persisted, dark-mode-safe) and the CSS the browser sees (`var(--color-primary-600)`) as `appliedValue`. Setting the reference — not a bare name or raw hex — is what makes the palette actually apply AND makes dark mode automatic (the `.dark` override re-resolves the named token). The token name is recorded in a `data-rl-*-token` attribute.
- ✅ `constrained-controls.tsx` `PaletteColorPicker`: name-based — the active swatch is the one whose NAME matches the current value. Removed `normalizeToHex` (temp-element rgb→hex hack) entirely; `getPalette` reads declared `--color-*` values straight from the custom properties (returned as-declared, no format normalization).
- ✅ Current-token detection is name-based, no comparison: `readAppliedToken` reads the `data-rl-*-token` attr (for overrides) and falls back to parsing the element's Tailwind utility classes (`text-primary-600`, `bg-earth-100`, …) for the default state. Variant-prefixed classes (`dark:`, `hover:`, …) are skipped so the base (light) value is read.

### 2. Font-family dropdown
- ✅ `FontFamilyPicker`: dropdown listing every ACTIVE font from `/api/fonts` (module-level cache shared with the inspector), each rendered in its own typeface. Picking emits the font NAME; the inspector resolves it to the font's `family` CSS for the browser (`fontFamilyCSS`). Scales to many fonts.

### 3. Inspector panel — theme-value knobs only
- ✅ Rebuilt `inspector-panel.tsx`: only theme-token-backed properties surface, grouped Typography / Colors / Spacing / Corners. **Removed** the structural knobs the prior Phase D wrongly exposed (`display`, `flex-direction`, `justify-content`, `align-items`, `border-style`, `opacity`, raw-pixel margins). Schema-driven when a curated schema exists; else a constrained-controls fallback showing only properties that have a purpose-built control (no raw CSS dump). Per-property **reset** (revert to the Tailwind class default).

### 4. On-page text editing — site-builder convention
- ✅ `selection-agent.ts`: **1st click selects** the nearest tagged component; **2nd click on text** makes that text `contentEditable` and edits it live on the page; 2nd click on a non-text element does nothing (no drilling into `<div>`s). Esc exits text editing, then jumps up to the parent component. The agent posts `overlay:text-change` so the panel mirrors live text; `selected.editing` flags the panel's Content section.
- (Supersedes the Phase C "dblclick drills into child components" model and the retired contentEditable — see the spec §3.2 update.)

### 5. Named theme values for sizes / spacing / radius (same treatment as colors)
- ✅ Controls emit Tailwind v4 token NAMES: `TypeScaleButtons` → `4xl`/`3xl`/… (applied `var(--text-4xl)`); spacing slider → `4` (applied `calc(var(--spacing) * 4)`); radius slider → `xl`/`2xl`/… (applied `var(--radius-xl)`), with `RADIUS_STOPS` routed for corners.
- ✅ Backend `theme_seed.py` seeded the scale tokens (`--text-xs…9xl`, `--spacing`, `--radius-sm…full`) into the theme DB — values match Tailwind v4 defaults exactly (zero visual change) but now dashboard-managed. Refactored the seed to **per-token idempotent upsert** so new tokens back-fill onto an already-seeded Default theme on the next boot (26 theme tests still pass). ⚠️ Requires a backend restart to apply on an existing dev DB (the dev server runs without `--reload`).
- ✅ Dashboard `/studio/theming` gained **Size** and **Spacing** tabs (redefine `--text-2xl` site-wide; one `--spacing` base scales every spacing utility).

### 6. Overrides store names; reset; stale
- ✅ Every per-item edit stores the token NAME (override identity); `resetProperty` removes the inline override so the element reverts to its Tailwind class default. Dark mode follows automatically (named color tokens have dark values).
- ⏳ Stale-warnings for **deactivated** fonts/colors (an override referencing a token later removed from the library/theme) — resolved: on font deactivation or color token deletion, referencing `OverrideLog` rows are auto-deleted so the element silently falls back to its theme default; no stale warning needed (2026-07-09). The font picker shows `current · not in the font library` as a soft signal in the meantime.

### Verification
- tsc + lint clean. `npm run build` not run (dev server live on :3001 — LESSONS.md #2). Backend `ruff` clean; `test_theme_manager` + `test_theme` pass (26).

### Phase 1 follow-up — 1st click identifies the block's text ✅
The earlier model only identified text on double-click (selecting the text element itself). Reworked so **first click** identifies the block AND its text together, matching the user's "1st click selects / 2nd click edits" model:
- `selection-agent.ts`: tracks `textTarget` (the text element under the cursor, found via the same `findTextAt` logic dblclick uses). `selectElement(block, textEl)` sends a `textElement` payload (path/appliedTokens/computedStyles/textContent) when the text differs from the block. `applyStyle`/`resetProperty` route by property — text props (`color`, `font-*`, `text-*`, letter/line-height) → `textTarget`; block props (background, border, padding, radius) → `selected`. Double-click keeps the block selected, refreshes `textTarget` to the dblclicked text, and enters edit mode.
- `overlay-provider.tsx`: `SelectedElement.textElement` added.
- `inspector-panel.tsx`: panel split into **Content** (live text mirror) + **Text** section (font/size/weight/color of the text element, changes route to it) + **Block** section (container props, schema-or-fallback). A `Button` (its own text) reads text props from `selected` directly. Color highlight is mode-aware (dark mode prefers the `dark:` class; opacity modifiers tolerated) and shows a colored chip + "current" instead of raw rgb when a color is inherited.
- Phase 2 ✅: a `<Text k="copy.key">` component (`components/ui/Text.tsx`) auto-tags editable copy with `data-rl-text` (reusing the existing `t()`/`/api/copy` key system) — new pages using `<Text>` can't forget the convention. Computed text (counts/prices/dates from `{expr}`, no `<Text>`) is read-only (double-click does nothing, panel shows "Computed value — not editable"). Inline edits persist via `api.copy.set(key, locale, text)` (committed on Esc/click-away by the agent). `SectionHeader` gained `headingKey`, `LinkWithArrow` gained `copyKey`, `Button` forwards `data-rl-text` via `{...props}`. Homepage blocks (`HomeBlocks.tsx`) migrated as the first tagged surface (~14 copy elements); `Badge` text deferred (needs `...rest` forwarding). Remaining pages migrate incrementally.

---

## Bug fixes applied this session

All 6 bugs from user testing are fixed:
1. ✅ SVG className crash — use `getAttribute("class")`
2. ✅ Layout forced warning — 600ms delay + loading indicator before agent injection
3. ✅ 404 on home block page — `seed_block_pages()` in backend lifespan
4. ✅ Inline text editing — `contentEditable` on text elements when selected
5. ✅ Content shows text not font-size — `textContent` added to `SelectedElement`
6. ✅ Color not highlighted in palette — dynamic palette from `@theme` CSS vars + stone colors overridden as hex (eliminates oklch format mismatch)

## Tailwind v4 migration ✅ COMPLETE

Migrated from v3.4.0 to v4.3.2:
- `@import "tailwindcss"` + `@theme` (hex, no RGB channels)
- `tailwind.config.ts` deleted (106 lines of boilerplate removed)
- `mapTokenToCssVar` runtime hack removed
- Stone colors overridden as hex in `@theme` (v4 default uses oklch)
- `theme_seed.py` stores hex
- `normalizeToHex()` converts oklch/rgb from getComputedStyle to hex (later removed in the theme-token rebuild — see "Theme-token model rebuild" above)

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

## UX hardening — P0 safety (2026-07-11) ✅

From the full UX review (`discovery/assessment/content-studio-ux-review.md` — benchmark, gap
analysis, risk assessment; execution order: Skills → P0 → P1 → P2, user-reviewed per step).

**Skills fixes (same session, before code):** corrected stale agent-skill content that could
mislead future sessions — `design-patterns.md` (fictional forest/sand palette → real
`globals.css` tokens; retired Content-UI-Editor wiring → overlay/`<Text k>` pattern),
`frontend-ui-guardian` (v4 reality, real type scale, new "Back-Office / Tool UI" chapter),
AGENTS.md (brand-override note for `frontend-design`, retired-editor cleanup),
`tailwind-patterns` (RootLink overrides: hex not oklch, real fonts, single `--spacing`),
`common-changes.md` (new-page checklist → overlay convention).

**P0 safety changes:**
- **Overlay exit guard**: `toggle()` confirms before deactivating with unsaved draft changes
  (`overlay-provider.tsx`); every deactivation path covered except forced ineligibility (which
  keeps the draft in memory). `useDirtyGuard` wired for refresh/tab-close + in-app links.
- **Overlay Discard confirmation** + **editing-locale chip** ("Editing: PT/EN") in the top bar
  (`overlay-shell.tsx`) — inline text edits commit to `localStorage.rootlink_locale`; the chip
  makes that visible (indicator only; switcher deferred).
- **Destructive-action confirmations**: block-section delete, catalog property delete, font
  delete, copy revert (warns it removes BOTH locales), override revert.
- **Copy-editor dirty guard**: `/studio/content` uses the shared `useDirtyGuard` — unsaved
  drafts no longer lost silently on navigation.
- **Visible error states**: new `components/studio/LoadError.tsx` (inline notice + "Try again");
  all silent `catch {}` initial-load failures in theming/blocks/catalog/fonts/overrides/content
  now render it — a dead backend no longer looks like deleted content.

Verified: tsc + lint clean (build not run — dev server live on :3001, LESSONS.md #2).

---

## UX hardening — P1 consistency (2026-07-11) ✅

The studio now uses the shared design-system kit instead of a parallel inline mini-design-system.

**Kit additions** (`components/ui/`):
- **`Modal.tsx` (new)** — shared accessible dialog: portal to body (LESSONS #16), Esc-close,
  focus trap, `role="dialog"`/`aria-modal`/`aria-labelledby`, focus restore to opener,
  backdrop click, optional footer. Replaces all 3 bespoke studio modals.
- **`Button`** gained `size="xs"` (studio-density, additive). **`Toggle`** gained dark-mode
  variants (was light-only).

**Studio pages** (theming, fonts, blocks, catalog, content, overrides, audit, overview, shell):
- All 3 bespoke modals → kit `<Modal>`; raw buttons → `<Button size="xs">` (danger for
  destructive); raw fields → kit `<Input>`/`<Textarea>`; fonts' hand-rolled switch → kit
  `<Toggle>`. Segmented tabs/selection rows deliberately kept (with `aria-pressed`/`aria-current`).
- All native `title=` → kit `<Tooltip>` (hover+focus, touch/keyboard accessible); icon-only
  buttons got `aria-label`s. 12px type floor enforced (sub-12px arbitrary sizes → `text-xs`;
  exception: `catalog/ComponentPreview.tsx` miniature previews, by design).
- **Theming debounce**: token edits update local state instantly, API save debounced 400ms
  per token (was one API call per drag tick); post-save refetch dropped so in-flight responses
  can't clobber newer edits. New empty states: empty token category, empty font library
  (kit `EmptyState`), zero namespace-search results.
- Overview lists all 7 live modules (was 3); stale "as they come online" copy removed.
  StudioShell: `aria-current="page"` on active nav, Esc closes the mobile drawer, dead
  footer doc link → plain text. Theme-status legend readable (`text-xs`, labeled glyphs).

**Overlay** (inspector-panel, constrained-controls, overlay-shell):
- 12px floor throughout ("Aa" real-scale specimens exempt — that's the control's purpose);
  contrast bumps `stone-500/600` → `stone-400` on dark chrome; focus-visible rings; Tooltips +
  `aria-label`s on icon-only buttons; stale-override banner now links to `/studio/overrides`
  (new tab — same-tab would kill the edit session). Segmented controls (slider stops, palette
  swatches, button groups) keep native `title` echoes — they have visible text labels;
  Tooltip's inline-flex wrapper would break their stretch layouts.

**Kit gaps logged for later** (not blocking): Modal initial focus lands on its X button
(should prefer content fields); `Tooltip` lacks `className` passthrough (wrapper needed for
absolutely-positioned children); no dense `Select` size; no icon-only `Button` variant.

Verified: tsc + lint clean after every file (build not run — dev server live, LESSONS.md #2).

---

## UX hardening — P2 polish (2026-07-11) ✅

**Esc / Ctrl+K conflict fix (user-reported):** the selection agent's capture-phase Esc handler
swallowed Esc unconditionally, so the CommandPalette (Ctrl+K) opened inside the iframe couldn't
be closed with Esc. The agent now **yields Esc whenever an open dialog exists** in the iframe
(`[role="dialog"], [data-rl-dialog]`); CommandPalette gained proper dialog semantics
(`role="dialog"` + `aria-modal` + `data-rl-dialog`) — which also covers any kit `<Modal>` open
inside the iframe. (LESSONS.md #43.)

**Keyboard:**
- **Redo** — redo stack in the agent (undo pushes onto it; any new edit clears it); Ctrl+Shift+Z /
  Ctrl+Y inside the iframe, `overlay:redo` message, Redo button beside Undo in the inspector.
  Undo/redo are DOM-level (they deliberately don't mutate `draftChanges`, matching existing undo).
- **Ctrl/Cmd+S** — saves the overlay draft from either side of the iframe boundary
  (`overlay:request-save` from the agent + parent-side listener); on `/studio/content` it
  triggers the new **"Save all (N)"** (also a header button; per-key failures stay dirty,
  summary toast).
- **Ctrl/Cmd+Shift+E** — enters edit mode (when the floating toggle is visible); shortcut shown
  in its tooltip.
- **Arrow-key navigation** in the overlay page-switcher and FontFamilyPicker (listbox semantics,
  Home/End, Enter, Esc closes just the menu).

**Feedback & drafts:**
- **Status flash** — emerald "Draft saved" / "Published" / "Draft discarded" chip in the top bar
  (`role="status"`, auto-clears 2.5s).
- **Resume saved draft** — the agent posts `overlay:agent-ready`; the provider fetches
  `api.drafts.get(pageSlug)` and, when a saved draft exists and nothing is unsaved locally,
  offers an amber bar: "This page has a saved draft with N changes" → Resume (re-applies style
  changes live via `overlay:apply-style` + `path`; text changes load into the draft but aren't
  re-applied visually — no set-text message exists yet) / Ignore.
- **Resizable inspector** — left-edge drag handle (pointer capture, since document-level
  listeners die over the iframe), 320–560px, persisted to `localStorage["rl-inspector-width"]`,
  keyboard-resizable (`role="separator"`, arrows ±16px, Enter/dblclick reset 384).

**Studio dashboard:**
- **Skeleton loading** (kit `LoadingSkeleton` compositions matching each page's layout) replaces
  the lone spinner on all 6 data pages.
- **Optimistic section reorder** in the page builder (instant swap, API behind, revert+toast on
  failure, no refetch flash).

Verified: tsc + lint clean; all `overlay:*` message plumbing confirmed wired end-to-end.
**P0–P2 of the UX review are now complete** (`discovery/assessment/content-studio-ux-review.md`).
**The unified UX is codified as a binding contract for all new development** (2026-07-11):
AGENTS.md → "Unified UX contract"; `frontend-ui-guardian` skill → "Back-Office / Tool UI"
(implemented-vocabulary table + keyboard contract); `platform-coherence` →
`design-patterns.md` "Content Studio & back-office UI patterns" + `common-changes.md`
"Add or modify Studio/back-office UI" checklist; spec design principle #11.
Remaining known gaps (deliberate, small): kit Modal initial-focus preference, Tooltip className
passthrough, dense Select size, icon-only Button variant, in-overlay locale switcher, set-text
message for visual draft-text resume.

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
