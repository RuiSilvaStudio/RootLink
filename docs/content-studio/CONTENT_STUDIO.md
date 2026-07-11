# RootLink Content Studio — Specification

> **Status:** Approved v2 — visual overlay paradigm (2026-07-08)
> **Owner:** Platform / Rui
> **Companion:** [`IMPLEMENTATION_STATUS.md`](./IMPLEMENTATION_STATUS.md) (updated every phase)
> **Supersedes:** v1 (dashboard CMS paradigm) and the inline Content UI Editor (`components/editor-mode/`)

---

## 1. Vision

A **visual site editor** that lives on top of the actual live RootLink site, plus a **dashboard control room** for defining the theme, font library, CSS variables, element catalog, and structural composition. You see the real site while editing — changes preview live — with constrained controls that make it impossible to break the site.

### What the studio manages

| Domain | Scope |
|--------|-------|
| **UI** | themes (named color tokens with light+dark pairs), dark mode, CSS properties — applied globally (theme) or locally (per-element), in a standardized way |
| **Content** | marketing and flat copy: menus, labels, buttons, warnings, page headers, footer copy — edited inline on the live page |
| **Structure** | blocks, sections, elements — composed in the dashboard's page builder (add/reorder/delete), customized visually in the overlay |

### Design principles (non-negotiable)

1. **Visual, not dashboard forms.** The primary editing surface is a visual overlay on the live site. You see the real page, click on real elements, and changes preview immediately. No separate form pages where you have to imagine the result.
2. **Constrained controls — never free-text where a purpose-built control exists.** Sliders with pre-defined stops (not free-range), palette color pickers (pick from named tokens, not raw hex), toggles for booleans, button groups for enums, "Aa" type-scale buttons at real scale, inline text editing, visual image pickers. Typos can't break the site.
3. **Theme-driven choices.** The dashboard defines the palette (named tokens with light+dark values), font library, CSS variables. The overlay only lets you pick FROM those — you can't invent new values.
4. **Dark mode is never breakable.** Every color is a named token with a light value AND a dark value. Overrides pick token names, not raw hex. Dark mode just swaps the token's dark values. You can never set a raw value that only works in one mode.
5. **Override guardrail.** When a local edit deviates from the default, the user is prompted (inline, not modal), the deviation is logged, a badge shows on the element, and revert is one click. When the default changes later, the override stays but a stale-override warning appears.
6. **Draft → Publish.** Nothing goes live without an explicit publish. Per-page drafts (all changes to a page are one draft). Preview as visitor. Publish to go live. Discard to throw away. Undo works before save; after save, revert is the only way back.
7. **Two surfaces with distinct roles:**
   - **Dashboard (`/studio`)** = the control room: define theme tokens, manage fonts, define CSS variables, curate element property schemas, manage block/element/component catalog, page builder (structural composition), override report.
   - **Visual overlay** = the editing surface: activate edit mode on the live site, select any visible element, edit content inline + style in inspector, with constrained controls. Desktop-only editing; mobile = preview.
8. **Block composition is dashboard-only.** Add/reorder/delete blocks happens in the dashboard's page builder. The overlay is for customizing content/style of existing elements, not structural changes.
9. **Dynamic pages: edit the template.** Dynamic pages (article detail, group detail) have a template you can edit — changes apply to all instances of that page type. Individual record content is not editable here.
10. **Multi-theme.** Multiple named themes (Default, Christmas, Halloween). Each is a full palette swap. Publishing a theme activates it. Overrides persist across theme changes (they reference token names, and tokens now resolve to the new theme's values).
11. **Unified UX contract (2026-07-11).** All studio + overlay UI follows the `frontend-ui-guardian` skill's "Back-Office / Tool UI" chapter and its implemented vocabulary (kit Modal/Button/Input/Toggle/Tooltip/EmptyState/skeletons, `LoadError` + retry on every fetch, `useDirtyGuard` on every dirty state, confirmations on every destructive action, 12px type floor, the keyboard contract incl. Esc-yields-to-dialogs). Established by the UX hardening pass (`discovery/assessment/content-studio-ux-review.md`, P0–P2); the checklist lives in `platform-coherence` → `references/common-changes.md` → "Add or modify Studio/back-office UI". No new studio feature ships outside this contract.

---

## 2. Historical context

### v1 (dashboard CMS — superseded)

Built a `/studio` route with namespace-tree form editors, tabbed color-picker panels, and a block canvas. This was the dashboard paradigm the user rejected (same as the earlier Payload CMS attempt). The forms took you away from the live site — you had to imagine changes instead of seeing them.

### Inline Content UI Editor (superseded)

An earlier inline WYSIWYG editor (`components/editor-mode/`) that overlaid the live site. It was closer to the visual paradigm but: (a) limited to text/image/icon scalar overrides, (b) hit click-conflict roadblocks on interactive elements (tabs, filters, dropdowns), (c) had no constrained controls or override guardrails. Retired.

### v2 (visual overlay — this spec)

Solves the click-conflict problem with an **iframe + inspector** architecture: the real page renders in an iframe (complete JS isolation — the page's own click handlers never conflict with the editor's selection). A selection agent inside the iframe handles hover/click/computed-styles. The inspector panel docks outside the iframe. Inline text editing works via the selection agent making text `contentEditable` inside the iframe.

---

## 3. The two surfaces

### 3.1 Dashboard (`/studio`) — the control room

| Section | What it does |
|---|---|
| **Theme manager** | Define named color tokens (each with light + dark values), create multiple themes (Default, Christmas, Halloween), draft→publish a theme, activate. Full palette swaps. Overrides persist. |
| **Font library** | Import/manage fonts (Google Fonts URL or uploaded), assign to font-family tokens. |
| **CSS variable manager** | Define/edit CSS variables (the token registry). |
| **Element catalog** | Manage element types (heading, card, button, etc.), their property schemas (intrinsic vs extrinsic, control type per property), curate which properties show in the inspector. |
| **Page builder** | Structural composition — add/reorder/delete blocks per page. Already exists as `/studio/blocks`. |
| **Override report** | View all deviations across the site (what's overriding what, which are stale). |

### 3.2 Visual overlay — the editing surface

**Architecture:** iframe + inspector. The real page renders in a same-origin iframe. A "selection agent" script runs inside the iframe. The inspector docks outside. Communication via `postMessage`.

**Activation:** an "Edit mode" toggle (visible to super_admin only, desktop only). When activated:
1. The current page renders inside an iframe.
2. The inspector panel docks on the right.
3. The selection agent activates inside the iframe.

**Selection (site-builder convention):** hover shows an outline + label snapping to the nearest *component* (an element carrying `data-rl-component`), not the raw DOM node under the cursor. **First click selects** that component (outline + inspector). **Second click on text** edits that text directly on the page (contentEditable) — there is no drilling into structural tags like `<div>`. The breadcrumb at the top of the inspector shows the component hierarchy (Page > Section > Card) — click any level to select it. Keyboard: Esc exits text editing, then jumps up to the parent component; Ctrl+Z undoes the last change.

**Inspector:** shows grouped properties for the selected element (Content, Typography, Color, Spacing, etc.). Initially derived from the element's **computed styles** at runtime. The dashboard can curate which properties show per element type (add/remove).

**Content vs style:** text/copy is edited inline on the page (click text, type, it updates live). Images are clicked to open a visual picker. Style properties (color, font, spacing) are in the inspector panel, grouped.

**Mobile:** preview only. The overlay doesn't activate on mobile — you see the published page as a visitor would. Editing is desktop-only.

---

## 4. Constrained controls (the control vocabulary)

Never free-text where a purpose-built control exists. Each property type maps to a specific control. **Only theme-token-backed properties are exposed** — structural CSS (`display`, `flex-direction`, `justify-content`, `align-items`, `border-style`, `opacity`, raw pixel margins, width/height) is never surfaced, because changing it would break the layout. Every pick stores the token **NAME** as the override identity (e.g. `primary-600`, `2xl`, `Fraunces`); the browser sees the theme reference (`var(--color-primary-600)`, `var(--text-2xl)`, the font's family string). Because the reference is a named token, **dark mode is automatic** (every color token has a dark value) and **reset reverts** to the Tailwind class default.

| Property type | Control | Example |
|---|---|---|
| Numeric (padding, gap, radius, letter-spacing, line-height) | **Slider with pre-defined stops** — named stops (xs/sm/md/lg/xl), not free-range | Padding: sm ↔ md ↔ lg |
| Color (element/component) | **Palette color picker** — named palette colors with swatches + names, NOT a free-form color wheel | Card background: primary-50 / earth-100 / rust-500 |
| Color (theme definition, dashboard only) | **Full color picker** — hex/RGB wheel, for defining the palette itself | Theme's primary-600: #634d33 |
| Boolean (on/off, show/hide) | **Toggle switch** | Show badge: on/off |
| Font family | **Font dropdown** — every active font in the library, each rendered in its own typeface | Heading font: Fraunces / Routtage / … |
| Enumeration (font weight, font style, text-align) | **Button group** | Weight: Light / Regular / Semi / Bold |
| Type scale (font size) | **"Aa" button group at real scale** — buttons showing "Aa" at the actual size with a label (H1, H2, …, Body, Small) | Heading size: Aa(H1) Aa(H2) Aa(H3) |
| Text/copy | **Inline text editor** — edit the text directly on the page (see §3.2) | Headline: "Find what feeds your land" |
| Image | **Visual image picker** — thumbnail grid of existing assets + upload dropzone | Hero image: [grid of assets] |
| Structural position | **Drag handle** (dashboard page builder only) | Section order: drag to reorder |

---

## 5. Element property schema

Each element type has a schema defining:

- **Intrinsic properties** — part of the component's definition (e.g., a button's variant: primary/secondary/ghost; a card's layout: grid/flex)
- **Extrinsic properties** — styling defaults from the theme, overridable per-instance (e.g., a card's background color — defaults to the theme's "card-bg" token but can be changed to another token per-instance)
- **Control type** per property — which constrained control to use (slider/toggle/palette/button-group/type-scale/inline-text/image-picker)
- **Default value** — the theme's default for this property on this element type
- **Visibility** — whether the property shows in the inspector (curated from the dashboard)

**Initial property set:** derived from the element's **computed styles** at runtime (what CSS the element actually uses). The dashboard then curates which properties show per element type.

**Schema ownership:** hybrid — developers register element types and intrinsic properties in code; the dashboard can add extrinsic properties and curate visibility.

---

## 6. Override guardrail

### When it triggers

When an element's property deviates from its **default value** (the theme's default for that property on that element type).

### What happens

1. **Inline prompt** (not a modal): "This deviates from the default [property: old_value]. [Confirm] [Cancel]"
2. If confirmed → the override is **logged** (element_path, property, old_value, new_value, user, timestamp)
3. A **badge** appears on the element showing it has an override
4. Click the badge → **revert** to the default value

### Override persistence

- Overrides **attach to structural position** (e.g., "3rd card in the category grid"). If the list re-renders with different data, the override stays on the 3rd position.
- Overrides **persist across theme changes**. When a new theme is published, overrides keep their token names — the tokens just resolve to the new theme's values.
- **Stale-override warning:** if the default value changes in the dashboard (e.g., the theme's default card-bg changes from primary-50 to earth-100), existing overrides stay but a warning shows: "This element's default changed. The override may no longer be intentional."

---

## 7. Draft → Publish

### Per-page drafts (overlay)

- All changes to a page (content edits, style overrides, property changes) are one **page-level draft**.
- In edit mode, you see your draft changes live. Visitors see the published version.
- **Preview as visitor** — toggle to see the published version (draft hidden).
- **Publish page** — the draft goes live for all visitors.
- **Discard draft** — throw away all uncommitted changes on that page.
- **Undo** — Ctrl+Z works before saving to draft. After save, revert (per-element) is the only way back.

### Theme revisions (dashboard)

- Theme changes in the dashboard go through their own draft→publish flow.
- A theme can be drafted, previewed, then published to activate.
- Publishing a theme does NOT reset element overrides (they persist).

---

## 8. Dark mode safety

Every color in the palette is a **named token with a light value AND a dark value.**

| Token name | Light mode | Dark mode |
|---|---|---|
| `card-bg` | `primary-50` (#f3f0eb) | `stone-900` (#1c1917) |
| `card-text` | `stone-800` (#292524) | `stone-100` (#f5f5f4) |
| `accent` | `rust-500` (#a8643d) | `rust-400` (#c07d53) |

When you override a card's background in the overlay, you pick a **token name** (e.g., "rust-500"), not a raw hex. The token itself has a dark-mode variant. In dark mode, the card automatically gets the dark variant. **You can never break dark mode** because you can never set a raw value that only works in one mode.

The dashboard's theme settings are where you define these light+dark pairs.

---

## 9. Multi-theme (seasonal)

Multiple named themes exist (Default, Christmas, Halloween). Each is a **full palette swap** — all color tokens get new light+dark values.

- Publishing a theme swaps the active palette.
- **Overrides persist** because they reference token names, and the tokens now resolve to the new theme's colors.
- After a seasonal period, publish the default theme back.

---

## 10. Anti-drift mechanism

1. **This spec** (`CONTENT_STUDIO.md`) — the north star. Edited lightly; it's the contract.
2. **`IMPLEMENTATION_STATUS.md`** — updated in the same change as every phase's work.
3. **`AGENTS.md` rule** — "Before any Content Studio work, read this spec first."
4. **Hard rule:** no phase starts that isn't documented here; no phase ends without (a) updating status and (b) confirming it advanced a named capability.
5. **Phases sized to be coherent** — each delivers one visible live capability.
6. **`graphify`** keeps architectural context warm across sessions.

---

## 11. Phase plan

| Phase | Delivers (live, visible) | North-star capability |
|---|---|---|
| **1 — Overlay shell + selection** | Edit-mode toggle on the live site (desktop). iframe + inspector dock. Hover/click to select any element. Breadcrumb navigation. Inspector shows computed styles (read-only). | Visual selection + inspection |
| **2 — Constrained controls + live editing** | All constrained control components wired to the inspector. Changes preview live in the iframe. Undo before save. | Visual editing with constrained controls |
| **3 — Override guardrail + draft/publish** | Deviation detection + inline prompt + badge + log + revert. Per-page drafts, preview-as-visitor, publish, discard. | Safe editing with draft→publish |
| **4 — Dashboard theme manager** | Named tokens with light/dark pairs. Multiple themes. Draft→publish a theme. Activate. Full palette swap. Overrides persist. | Theme definition + multi-theme |
| **5 — Dashboard element catalog + property curation** | Element type registry. Property schema (intrinsic/extrinsic, control type). Curate which properties show in the inspector. Font library. CSS variable manager. | Element/schema/font management |
| **6 — Override report + stale warnings + dynamic templates** | Dashboard report of all deviations. Stale-override warnings. Dynamic page template editing. | Full guardrail + template editing |

---

## 12. What's reusable from prior work

| Infrastructure | Status | Reuse |
|---|---|---|
| Token CSS-variable layer (`globals.css` + `tailwind.config.ts`) | ✅ Live | Foundation for named tokens — extend with light/dark pairs |
| Backend APIs (`/api/theme`, `/api/copy`, `/api/blocks`) | ✅ Live | Extend for multi-theme + drafts + override logs |
| Block registry + BlockRenderer + block components | ✅ Live | Reuse for the dashboard's page builder |
| `/studio` dashboard shell (StudioShell) | ✅ Live | Repurpose as the control room |
| `editor-mode` components | ✅ Live | Patterns reusable (portal-to-body, dirty-guard); components retired |
| 6 seeded BlockPages | ✅ Live | Keep |

**Scrapped:** `/studio/content` (namespace-tree form), `/studio/theming` (tabbed color panel). These are the dashboard-CMS forms the user rejected. Replace with the visual overlay + dashboard theme manager.
