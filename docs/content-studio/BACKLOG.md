# Content Studio — Backlog

> Future work items for the Content Studio. Not started yet — spec each one
> out properly when ready to tackle it. Items are ordered by the user's
> priority list, not by implementation effort.

---

## 1. Header NavBar — manageable via dashboard

**Current state:** Nav items are hardcoded in `components/nav/NavConfig.ts`
(3 groups: Discover, Grow, Exchange — 11 items total). Not tagged with
`data-rl-component`, not selectable in the overlay, not editable through
the dashboard.

**Goal:** Manage nav items through the dashboard — reorder, hide/show,
add/remove links. Like the block page builder but for nav items.

**Approach:** Store nav config in the DB (like BlockPage). Dashboard page
at `/studio/navigation` with drag-to-reorder + toggle visibility. NavBar
fetches config from API on mount. Falls back to hardcoded defaults if no
config exists.

---

## 2. Footer — manageable via dashboard

**Current state:** Footer (`components/Footer.tsx`) has hardcoded link
groups, a botanical SVG separator, and uses `<Text>` for copy (already
editable via overlay). Not tagged with `data-rl-component`, not selectable.
Links are hardcoded.

**Goal:** Manage footer links through the dashboard — reorder, add,
hide/show links. Same pattern as NavBar.

**Approach:** Same as NavBar — DB-backed config, dashboard management
page, fallback to defaults.

---

## 3. Canvas animation — color control + swappable

**Current state:** `HeroParticleCanvas` (`components/ui/HeroParticleCanvas.tsx`)
has hardcoded color palettes (`LIGHT` and `DARK` constants at the top of
the file — RGBA arrays). It's tagged `data-rl-component="HeroParticleCanvas"`
but has zero configurable properties.

**Goal:** Control colors through the theme system + ability to swap the
entire animation for different canvas effects (particles, waves, gradient
mesh, etc.).

**Approach:**
- Colors: replace the hardcoded RGBA arrays with theme token references
  (`var(--color-primary-300)` etc.) so the canvas reads from the active
  theme
- Swappable: make the canvas component accept a `variant` prop or
  register multiple canvas effects in a registry (like `BLOCK_REGISTRY`).
  Dashboard picks which effect renders on which page.

---

## 4. Icon library — manage icons used in UI components

**Current state:** All icons are hardcoded lucide-react imports in each
component (e.g., `Search`, `Users`, `CalendarDays` in NavConfig). No way
to change an icon without editing code.

**Goal:** A dashboard icon library where you browse/select icons for
specific UI slots (nav items, card icons, empty states, etc.). Similar
to how the font library works.

**Approach:** Store icon selections in the DB (like fonts). A
`/studio/icons` page with a searchable icon browser (lucide has ~1000
icons). Components fetch their icon by name from the library instead of
hardcoding the import.

---

## 5. Logo text-mark — proper component with media type selection

**Current state:** The NavBar shows "Content Studio" as text (line 152-156
in `NavBar.tsx`). No dedicated logo component. No `data-rl-component` tag.

**Goal:** A `Logo` component that supports multiple media types:
- **Text:** wordmark with font/size/color from the theme
- **SVG:** custom vector logo with color options
- **Image:** uploaded logo image with size/position options

**Approach:** New `Logo` component under `components/ui/`. Dashboard at
`/studio/branding` to configure: pick media type, upload/select asset,
set size/position. The NavBar (and Footer, and studio sidebar) all
render `<Logo />` instead of hardcoded text.
