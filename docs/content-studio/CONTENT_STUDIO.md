# RootLink Content Studio — Specification

> **Status:** Approved — north-star contract (2026-07-08)
> **Owner:** Platform / Rui
> **Companion:** [`IMPLEMENTATION_STATUS.md`](./IMPLEMENTATION_STATUS.md) (updated every phase)
> **Supersedes for site-chrome editing:** the inline Content UI Editor (`components/editor-mode/`), which is retired into the studio across Phases 1–2.

---

## 1. Vision

Build **one** Content Studio — a CMS-like tool that manages the RootLink platform's **UI** and **Content** — designed for expansion and scale, not a closed view of what exists today.

### What the studio manages

| Domain | Scope |
|--------|-------|
| **UI** | themes, dark mode, sections, blocks, components, elements, and all CSS properties related to them — applied **globally** (theme-wide) or **locally** (per-element adjustment), in a standardized way |
| **Content** | marketing and flat copy: menus, labels, buttons, warnings, page headers, footer copy |

### Design principles (non-negotiable)

1. **One studio, not two.** A single product surface manages both UI and Content. No parallel inline-editor + dashboard split.
2. **Mobile-first AND desktop-first, no compromise.** The studio's own UX is excellent on both. This is not "responsive afterthought" — both breakpoints are designed deliberately. The studio must *reflect the excellence it's trying to manage.*
3. **Built for expansion and scale.** The architecture supports (without requiring them today): adding blocks/sections/elements to existing pages, grid adjustments, per-user theme selection, new block types, new content kinds.
4. **Foundation-first, each primitive live immediately.** No "build in a sandbox then wire later" phases — every foundation primitive is proven end-to-end against a real live surface the moment it's built. This is the structural anti-drift mechanism.
5. **Standardized.** Theming/CSS/block editing uses one token model, one override model, one block schema — not per-page ad-hoc patterns.
6. **Studio built first, platform refactored to integrate after.** The CMS tool is built as a first-class product; the existing platform is then adjusted to consume the studio's output (runtime token injection, copy overrides, block rendering).

---

## 2. Historical context

An earlier attempt — the **inline Content UI Editor** (`components/editor-mode/`, deployed 2026-07-02) — provided super_admin WYSIWYG editing of text/image/icon overrides directly on the live page. It hit roadblocks:

- Its scope was limited to scalar overrides (one string / one image / one icon per key), not the full UI/CSS/block model needed.
- It was coupled to `t()` i18n keys, so editor reach was gated on a manual per-namespace migration.
- Its own UI had accessibility gaps (modal focus-traps, keyboard nav, no `Dialog` primitive, no undo).
- There was no runtime CSS-token layer — colors/radii/fonts lived only build-time in `tailwind.config.ts`.

**Decision:** start over with a proper CMS-like tool. The inline editor's text/image/icon capabilities are **retired into the studio** across Phases 1–2 (deprecate, don't delete; cut cleanly once the studio equivalent is live). The inline editor's `/api/copy` and `/api/content-ui` backends are **reused** — they are production-tested and the studio builds on them.

---

## 3. Architectural decisions

### 3.1 Studio surface — `/studio` route-group, same Next.js app

The Content Studio lives at `/studio` inside the existing Next.js frontend, as a **peer to `/admin`** (not inside it):

- **Own layout, own sidebar/inspector, own responsive shell** — designed mobile-first+desktop-first from day one. The studio is a first-class product surface, not a sub-page constrained by the admin shell.
- **Shares** `auth-context`, `locale-context`, `lib/api.ts`, and can **directly import** the platform's components/tokens for live preview.
- **Single Vercel deploy** stays single. The phase-2 integration (studio writes tokens that the live platform consumes) is trivial when they share a process.
- **Gated on `super_admin`** (mirrors the inline editor's gate).

**Rejected:**
- *Extend `/admin`* — admin shell constrains the studio's UX, contradicts "no compromise."
- *Separate repo/app* — doubles deploy/auth/i18n infra, severs the studio from the platform it must theme.

### 3.2 Sequencing — vertical-slice foundation, each primitive live on a real surface immediately

Every foundation primitive is proven end-to-end against one real live surface the moment it's built. No "built but not wired" phases. This is the **structural anti-drift fix** — too-small increments that don't connect to the live site lose their thread across sessions.

### 3.3 Block model — schema-first from day 1; new surfaces compose in blocks; existing pages migrated one-at-a-time

- The **block/section/element schema + registry** is a foundational decision made **once** (never re-litigated later).
- The studio has a **block canvas** for composing *new* surfaces from day 1 (proves the model live).
- **Existing pages migrate one at a time** — homepage first, each migration a self-contained shippable phase.
- Full composability is the **destination**, not the day-1 scope, but the **architecture** is composable from day 1 so the path is always open.

### 3.4 CSS token layer — `--token` CSS-variable layer on Tailwind v3

The runtime theming substrate. See §4.

---

## 4. The token model (runtime theming substrate)

### Problem

Colors, radii, and fonts live **only** in `tailwind.config.ts` (build-time). There is no runtime-writable surface. "Configure all CSS properties with real-time preview" is **impossible** without rebuilds.

### Solution — CSS custom properties as the single token source

1. **Define tokens as CSS custom properties** in `app/globals.css` (`:root { --color-primary-600: #634d33; ... }`), mirroring the existing mockup at `discovery/mockups/handoff-to-basecode/styles/tokens.css`.
2. **Repoint `tailwind.config.ts`** to reference the vars: `primary: { 600: 'var(--color-primary-600)' }`. Tailwind classes (`bg-primary-600`) now resolve to `var(--color-primary-600)` — overridable at runtime.
3. **Zero visual change in Phase 0** — values are identical to current hex defaults. This is a pure substrate addition.
4. **The studio writes overrides** to these vars (global theme on `:root`, local on a scoped container) → live theming with real-time preview, no rebuild.

### Token categories (the standardized surface)

| Category | Examples | Scope |
|----------|----------|-------|
| **Colors** | `--color-primary-*`, `--color-earth-*`, `--color-rust-*`, `--color-cream`, `--color-stone-*` | Global + local |
| **Fonts** | `--font-display` (Fraunces), `--font-serif` (Source Serif 4) | Global |
| **Radius** | `--radius-xl2`, plus standard scale | Global + local |
| **Spacing** | (future — standardized spacing scale) | Global + local |
| **Dark mode** | `.dark` overrides on `:root` vars | Global |

### Override resolution

```
:root (default theme)  →  .dark (dark overrides)  →  [scoped container] (local per-element overrides)
```

The studio's theming module writes to any of these layers; the cascade resolves. Global edits write to `:root`/`.dark`; local edits write to a scoped `style` attribute or a `[data-studio-scope]` container.

---

## 5. The content/copy model

Reuses the **existing** `copy_overrides` backend (`/api/copy`) and `content_ui_overrides` backend (`/api/content-ui`) — both production-tested. The studio provides a first-class CMS UI over them:

- **Sitemap-of-namespaces** navigation (not a flat key grid) — groups i18n keys by page/section, mirroring the site structure.
- **Per-locale editor** (PT + EN side-by-side), with revert-to-default.
- **Live preview** — edits reflect in a preview frame before save.
- **Retires** the ad-hoc `/admin/copy` grid and the inline editor's text piece into one surface.

---

## 6. The block model

### Schema

```
BlockType (registry)     →  id, label, fields schema, render component, default props
Section                 →  a positioned block instance on a page (block_type_id, props, order, page_id)
Page                    →  a composed surface (slug, sections[])
Element                 →  a field within a block (rendered via the token layer for CSS props)
```

- **Block registry** lives in code (TypeScript declarations) — new block types are added by developers and appear in the studio's palette.
- **Block instances** (sections) are data — props, order, page assignment — stored in DB, editable in the studio without a deploy.
- **Render** — the platform consumes the block tree: `Page → Sections → BlockType.render(props)`.

### Scope on day 1

- Schema + registry + a block canvas in the studio (compose new surfaces).
- One new block-composed surface ships live (proves the model).
- Existing pages untouched (migrated in Phase 4+).

---

## 7. Anti-drift mechanism

This project is multi-session by nature. The following survives context loss and prevents path drift:

1. **This spec** (`CONTENT_STUDIO.md`) — the north star. Edited lightly; it's the contract.
2. **`IMPLEMENTATION_STATUS.md`** — updated **in the same change** as every phase's work. A phase is not done until its status entry is written.
3. **`AGENTS.md` rule** — "Before any Content Studio work, read `docs/content-studio/CONTENT_STUDIO.md`."
4. **Hard rule:** no phase starts that isn't documented here; no phase ends without (a) updating status and (b) confirming it advanced a named north-star capability.
5. **Phases sized to be coherent, not micro** — each delivers one visible live capability.
6. **`graphify`** keeps architectural context warm across sessions.

---

## 8. Phase plan

| Phase | Delivers (vertical slice, live on real site) | North-star capability |
|-------|----------------------------------------------|----------------------|
| **0 — Foundation & contract** | This spec + status doc. Reconcile the `frontend-ui-guardian` token conflict. Introduce `--token` CSS-variable layer (read-only, zero visual change). Repoint `tailwind.config.ts` + `globals.css`. | Contract + token substrate |
| **1 — Studio shell + Content/Copy** | `/studio` responsive shell (mobile+desktop). Content module: CMS UI over `/api/copy` — sitemap-of-namespaces + per-locale editor + live preview. Retires inline editor's text piece + `/admin/copy` grid. | Content (copy/menus/labels/buttons/warnings) |
| **2 — Theming module** | Studio writes to `--token` vars: global theme editor (colors/radii/fonts/darkmode) + per-element local override + live preview. Live on homepage. Retires inline editor's image/icon pieces into studio asset management. | UI: themes, darkmode, CSS properties (global + local) |
| **3 — Block model** | Block/section/element schema + registry + block canvas. One new block-composed surface live. | UI: blocks/sections/elements (composition) |
| **4+ — Page migration to blocks** | One page at a time, homepage first. Each migration = one phase. | Expansion: add blocks to existing pages, grid adjustments |
| **N — User theme selection** | Per-user theme override (user-facing picker writing to a user-scoped token-override layer). Only after theming is mature. | Expansion: user-customizable experience |

---

## 9. Prerequisites resolved in Phase 0

1. **`frontend-ui-guardian` token conflict** — the guardian "constitution" specifies emerald/sage + Inter font; the real platform runs earth-brown + Fraunces. **Resolution:** update the guardian skill to match the real platform tokens (earth-brown/Fraunces are the source of truth; the studio manages what exists, not an aspirational palette).
2. **No Alembic** (inline `ALTER TABLE` in `main.py`) — the studio's schema will evolve across phases. Alembic is introduced as a parallel infrastructure task (not blocking Phase 0; the inline-migration pattern is reused for the studio's first tables, Alembic tracked as a follow-up).

---

## 10. Non-goals (explicit)

- **Not a website builder.** The studio configures the existing RootLink UI and content; it does not let users create arbitrary new websites.
- **No multi-tenant theming** (v1). One platform, one theme (+ dark mode + local overrides). Per-user theme selection is Phase N only.
- **No editing of DB-backed content records** (articles/events/listings). The studio manages site chrome and flat copy, not authored entity content.
- **No free-form CSS injection.** Theming edits structured token values, not arbitrary CSS strings (avoids XSS and keeps standardization).

---

## 11. Design tokens (canonical, from `tailwind.config.ts`)

| Token | Value | Notes |
|-------|-------|-------|
| `--font-display` | `"Fraunces", Georgia, serif` | Display/headings |
| `--font-serif` | `"Source Serif 4", Georgia, serif` | Body |
| `--color-primary-600` | `#634d33` | Main brand (earth brown) |
| `--color-primary-700` | `#4f3d2a` | |
| `--color-rust-500` | `#a8643d` | Terracotta emphasis |
| `--color-cream` | `#f8f6f2` | Surface |
| `--radius-xl2` | `16px` | Custom radius |

Full scale (50–900 for primary, earth, rust, stone) defined in `discovery/mockups/handoff-to-basecode/styles/tokens.css` and migrated to `globals.css` in Phase 0.

---

## 12. Tech stack (for the studio)

| Layer | Choice | Rationale |
|-------|--------|----------|
| Framework | Next.js 14 (App Router) | Same as platform; shares deploy |
| Styling | Tailwind v3 + CSS custom properties | Token substrate for runtime theming |
| UI primitives | Hand-rolled `components/ui/` + a new `Dialog` primitive (fixes the inline editor's a11y gap) | On-brand; no new component-lib dependency |
| State | React Context (Phase 1) → evaluate Zustand if inspector complexity grows | |
| i18n | Reuse existing `locale-context` | |
| Backend | FastAPI + SQLAlchemy (reuse existing `/api/copy`, `/api/content-ui`; add studio-specific endpoints) | |
| Migrations | Inline `ALTER TABLE` (Phase 0–3); Alembic as follow-up | |
