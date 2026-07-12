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

## 3. Canvas Animation System — managed library + per-hero assignment + separate Workshop app

> **Status:** Planned (2026-07-11). Replaces the earlier narrow "color control
> + swappable" scope. This is a two-project initiative: a RootLink integration
> (moderate, additive) and a separate Animation Workshop app (larger,
> security-sensitive). Build the API contract first, both sides simultaneously.

### Vision

Content Studio users can browse a library of animated backgrounds (birds,
particles, rain, neon patterns, Vanta effects, etc.), assign one to any page
hero, choose its colors from the RootLink theme palette, adjust its settings
with simple sliders/toggles/choices, and see it live — all through Content
Studio, no code needed.

A separate **Animation Workshop** app lets an admin import new animations
from URLs or uploads, review their detected settings, and publish them into
RootLink's library after approval.

### Decisions (locked 2026-07-11)

- **Eligible sections:** heroes and banners only.
- **Per-hero limit:** one animation at a time per hero.
- **Color control:** each animation exposes its own color roles; the user
  picks from the active RootLink theme palette (token names like
  `primary-700`, not raw hex). Separate bird and sky colors per effect.
- **Pointer interaction:** non-interactive by default; approved effects may
  optionally react to pointer position without capturing clicks.
- **Adding animations:** both approaches, in phases — Phase 1 approved
  library (developer-registered), Phase 2 Workshop importer (URL + upload,
  detect-then-confirm controls).
- **Safe fallback:** automatic still image or theme color on phones,
  reduced-motion devices, or hardware that cannot run the effect.
- **Publish flow:** Workshop publish → pending approval in RootLink →
  super_admin approves → RootLink mirrors the bundle to its own storage.
- **Workshop location:** same home server (`192.168.1.230`), new Caddy site
  block `workshop.ruisilvastudio.com` → `localhost:8098`, own Docker
  Compose, own SQLite DB, own volume. Same pattern as Immich / uptime-kuma.
- **Dark mode:** no animation-specific workaround. Full dark-token
  correctness depends on the separate platform-wide dark-mode fix
  (TECH_DEBT.md §8). Animations will use the current active palette and
  follow whatever the platform provides.

### Architecture

```
┌──────────────────────────────────────────────────────────────┐
│  Animation Workshop (separate repo, separate project)         │
│  workshop.ruisilvastudio.com → localhost:8098                 │
│  Own Docker Compose, own SQLite, own volume                   │
│  Import → Analyze → Package → Review → Publish                │
│  Serves animation packages + assets via API                   │
└──────────────────────────────────────────────────────────────┘
                              │
                              │  publish API (POST + shared API key)
                              ▼
┌──────────────────────────────────────────────────────────────┐
│  RootLink backend (existing)                                  │
│  api.ruisilvastudio.com → localhost:8000                      │
│  New: /api/animations/* endpoints                             │
│  New: animation_package, hero_animation_assignment tables     │
│  Stores: which hero uses which animation + settings           │
│  Mirrors: approved package bundles → backend-data/media/anims │
│  Does NOT import or run untrusted code                        │
└──────────────────────────────────────────────────────────────┘
                              │
                              │  visitor page load (cached, from
                              │  RootLink's own mirrored storage)
                              ▼
┌──────────────────────────────────────────────────────────────┐
│  Browser                                                       │
│  AnimationBackground component loads bundle in isolated        │
│  iframe, passes settings + resolved theme colors via           │
│  postMessage, handles fallback / pause / resume               │
└──────────────────────────────────────────────────────────────┘
```

### API Contract (built first, both sides implement)

#### Workshop → RootLink: Publish a package

```
POST /api/animations/packages
Authorization: Bearer <workshop-api-key>

{
  "package_id": "birds-flock",
  "version": "1.0.0",
  "name": "Birds Flock",
  "description": "...",
  "author": "...",
  "source_url": "...",
  "license": "MIT",
  "license_url": "...",
  "engine": "canvas2d | webgl | three.js | p5.js | vanta",
  "preview_image_url": "...",
  "fallback_image_url": "...",
  "package_url": "...",       // manifest JSON
  "bundle_url": "...",        // zip
  "checksum": "sha256:...",
  "controls": [
    { "key": "bird_color", "label": "Bird color", "control_type": "palette", "default": "primary-700", "category": "color" },
    { "key": "sky_color_top", "label": "Sky top", "control_type": "palette", "default": "earth-100", "category": "color" },
    { "key": "flock_size", "label": "Flock size", "control_type": "slider", "default": 60, "min": 10, "max": 120, "step": 5, "category": "behavior" },
    { "key": "speed", "label": "Speed", "control_type": "slider", "default": 1.0, "min": 0.1, "max": 3.0, "step": 0.1, "category": "behavior" }
  ],
  "capabilities": {
    "desktop": true, "mobile": true,
    "reduced_motion_fallback": "static_image",
    "webgl_required": false,
    "pointer_interactive": false
  },
  "performance_class": "light | medium | heavy"
}
```

RootLink stores this as **pending approval**.

#### RootLink: Approve a package

```
POST /api/animations/packages/{package_id}/versions/{version}/approve
Authorization: Bearer <super_admin session>
```

On approval, RootLink downloads and mirrors the bundle to
`backend-data/media/animations/` so live pages never depend on the Workshop.

#### RootLink: List available animations (Content Studio)

```
GET /api/animations/library
→ [{ package_id, version, name, description, preview_image_url, controls, capabilities }]
```

#### RootLink: Assign animation to a hero

```
POST /api/animations/assign
{
  "page_slug": "home",
  "section_id": 42,
  "package_id": "birds-flock",
  "version": "1.0.0",
  "settings": { "bird_color": "primary-700", "flock_size": 80, "speed": 1.2 }
}
```

Settings store **theme-token names** for color fields, not hex values.

#### RootLink: Get assignment for a hero (frontend render)

```
GET /api/animations/assignment?page_slug=home&section_id=42
→ { package_id, version, settings, bundle_url, controls, capabilities }
```

### Standard package contents

Every published animation follows the same contract regardless of engine:

- Name, description, preview, author, source
- License and attribution
- Immutable version number
- Rendering engine and included dependencies (packaged with the animation,
  not added to RootLink's bundle)
- Animation code and local assets
- Configurable controls (label, control type, default, safe range, category)
- Theme-color slots (palette-typed controls)
- Desktop and mobile capabilities
- Performance classification (light / medium / heavy)
- Static fallback image or color
- Integrity checksum

Runtime protocol (standardized for all effects):
start, applySettings, resize, pause, resume, generateFallback, destroy.

### RootLink side: what changes

| Area | Change | Size |
|------|--------|------|
| Database | Two new tables: `animation_package` (mirrored metadata + bundle path), `hero_animation_assignment` (page_slug, section_id, package_id, version, settings JSON) | Small |
| Backend API | New `/api/animations/*` router (receive, approve, library list, assign, get assignment) | Moderate |
| Auth | Workshop publishes with shared API key (env var); approval requires super_admin | Small |
| Frontend | New `AnimationBackground` component: isolated iframe, postMessage protocol, theme-color resolution, fallback, pause/resume | Moderate |
| Content Studio | New "Background → Animation" section in hero inspector: browse library, pick animation, render controls dynamically from package's `controls` array | Moderate |
| BlockRenderer | Hero blocks get an optional animation background slot (wrapper), driven by assignment data | Small |
| Draft/Publish | Animation assignments follow existing per-page draft flow | Small |
| Existing code | No rewrites; `HeroParticleCanvas` becomes one approved library entry | None |

### Workshop side: separate project

| Area | Detail |
|------|--------|
| Repo | New git repo (`animation-workshop`) |
| Stack | FastAPI + SQLite (same pattern as RootLink, independent DB) |
| Docker | Own `docker-compose.yml`, port `:8098`, own volume |
| Caddy | New site block: `workshop.ruisilvastudio.com` → `localhost:8098` |
| Import | Paste URL or upload package; fetch and quarantine source |
| Analyze | Parse JS/shaders for likely configurable values; present for review |
| Package | Bundle code + assets + manifest; generate preview + fallback images |
| Publish | POST to RootLink's `/api/animations/packages` endpoint |
| Approval | Workshop marks "submitted"; RootLink super_admin approves in Content Studio |
| Dependencies | Three.js, p5.js, analysis tools — all isolated, never added to RootLink |

### Safety protections

- Only one effect per hero.
- Effects pause when their hero is outside the viewport.
- Clicking and scrolling always reach the hero, not the canvas.
- Reduced-motion receives a still fallback.
- Unsupported WebGL receives a still or theme-color fallback.
- Heavy effects use reduced quality on smaller or slower devices.
- Imported code runs in an isolated frame: no access to RootLink auth,
  cookies, user data, or surrounding page content.
- Communication only through a small validated message protocol.
- Studio warns when several animated heroes on one page could create a
  performance problem.
- Versioned packages: a new version requires explicit upgrade approval;
  live heroes never change unexpectedly.
- RootLink mirrors approved bundles; a Workshop outage does not affect
  live pages.

### Build order

1. **Write the package manifest spec** — one document both projects implement
   against (controls, capabilities, bundle format, runtime protocol).
2. **RootLink side**: new tables, `/api/animations/*` endpoints (receive,
   approve, library, assign, get assignment), `AnimationBackground` component
   (isolated frame, theme-color resolution, fallback, pause/resume), Content
   Studio "Background → Animation" inspector section.
3. **Workshop side**: new repo, basic FastAPI app, manual package creation
   (no import yet), publish to RootLink API.
4. **Prove with 3 hand-built packages**: Canvas 2D particles (existing
   `HeroParticleCanvas`), a custom WebGL effect, a Vanta/Three.js effect.
5. **Workshop import**: URL fetch, source analysis, control detection,
   preview generation.
6. **Workshop upload**: package upload, same pipeline.
7. **Expand library**: more effects, performance testing, license
   verification, automatic fallback generation.

### User journey (Content Studio)

1. Open a page, select its hero.
2. Open **Background** → choose **Animation**.
3. Browse approved animations (thumbnails + names).
4. Select one.
5. Content Studio builds the controls from the animation's published
   `controls` array — colors as theme-palette pickers, behaviors as
   sliders/toggles/choices.
6. Adjust settings, see them live behind the real hero content.
7. Save through existing draft → publish flow.
8. Each hero's settings are independent. Same animation on different heroes
   can have completely different colors, speed, and density.

### User journey (Animation Workshop)

1. Open `workshop.ruisilvastudio.com`.
2. Paste a CodePen/GitHub URL or upload an animation package.
3. Workshop fetches and inspects the code in quarantine.
4. It detects likely settings (colors, speeds, quantities, sizes).
5. Review and rename those settings in plain language.
6. Mark which color fields use RootLink's theme palette.
7. Set safe ranges and defaults.
8. Preview desktop, mobile, and reduced-motion behavior.
9. Workshop generates a still fallback image.
10. Add license and source information.
11. Publish → sends the package to RootLink via API.
12. Package appears as **pending approval** in RootLink.
13. Super_admin approves in Content Studio.
14. RootLink downloads and mirrors the bundle to its own storage.
15. Animation appears in the library, ready to assign.

### Reference effects (need individual license/perf review before inclusion)

| Effect | Source | Engine | Notes |
|--------|--------|--------|-------|
| Birds of a Feather | CodePen `tmrDevelops/pen/dMdNvy` | Canvas 2D | Low-poly flock; reimplement, don't copy |
| Sakura petals | CodePen `at80/pen/kyOdeK` | WebGL | GLSL shaders; complex but self-contained |
| Neon hexagons | CodePen `towc/pen/mJzOWJ` | Canvas 2D | Simple, good control surface |
| Liquid Lights | CodePen `tmrDevelops/pen/rVNxVQ` | Canvas 2D | Glow blobs; straightforward |
| Rain & Water | Codrops `RainEffect` | WebGL | Requires background textures; needs adaptation |
| Vanta Halo/Clouds/Cells/Net/Topology | vantajs.com | Three.js / p5.js | License TBD; needs Three.js packaged per-effect |
| particles.js default | vincentgarreau.com/particles.js | Canvas 2D | MIT-licensed; good control surface |

### Dependencies

- **Dark-mode fix (TECH_DEBT.md §8):** separate initiative. Animations will
  use the current active palette; full dark-token switching follows when
  the platform-wide fix ships.
- **No new RootLink runtime dependencies:** Three.js, p5.js, etc. are
  packaged per-animation inside the Workshop bundle, loaded only inside the
  isolated iframe. They do not enter RootLink's build or page bundle.

---

## 6. Face-lift items — decided NOT to implement (2026-07-12)

During the UI face-lift review (`discovery/assessment/content-studio-facelift-review.md`), the
following items were evaluated and **explicitly decided against** by the product owner. They are
recorded here so they don't get re-proposed. The rationale: the current implementation is
sufficient; the polish return doesn't justify the effort.

| Item | What it was | Why not |
|---|---|---|
| **S6** | Extract `PageList` component from blocks page (mobile/desktop duplication) | The duplication is tolerable; extraction adds abstraction for ~30 lines of saved JSX |
| **S9** | Re-layout theming color-picker rows (Sun/Moon beside their pickers, not flanking the slash) | Minor visual nit; the current layout is functional |
| **S10** | Replace theming "library/custom" lowercase ghost buttons with kit `ButtonGroup` | The current buttons work; the visual asymmetry is barely noticeable |
| **O10** | PaletteColorPicker dark-mode swatch preview (Sun/Moon toggle to see dark values) | The overlay is always-dark chrome; the user edits on the live page which shows the real mode. Swatch preview adds complexity for marginal value |
| **O11** | FontFamilyPicker search/filter + dropdown flip-up | The font library is small (2-5 fonts); search is premature optimization |
| **4.6** | Use the element's actual font in TypeScaleButtons "Aa" preview (instead of brand serif) | The "Aa" shows the SIZE, not the font; using the real font would conflate two properties in one control |

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
