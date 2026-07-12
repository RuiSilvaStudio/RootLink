# Design Patterns

> UI conventions, component patterns, and design consistency rules.

## Color Theme

RootLink uses an earth/nature palette defined as **Tailwind v4 `@theme` tokens in
`rootlink/frontend/app/globals.css`** (hex values, deliberately NOT oklch — see
LESSONS/Content Studio docs for the oklch-mismatch bug). **The codebase is the source of
truth** — if this file and `globals.css` disagree, `globals.css` wins.

### Actual palette (from `globals.css @theme`)
- **`primary-50…900`** — earth brown (`primary-600` `#634d33` = main brand actions, headers; `primary-700` hover)
- **`earth-50…900`** — warm tan (`earth-500` `#8c6b48` = secondary nature content)
- **`rust-50…900`** — terracotta (`rust-500` `#a8643d` = emphasis, editor/selection accent)
- **`cream`** — `#f8f6f2`, the surface/background color
- **`stone-50…950`** — neutrals (overridden as hex, not v4's oklch defaults) — text, borders, dark-mode surfaces
- **`brand`** — `#4f3d2a`

There are **no `forest-*` or `sand-*` scales and no `text-primary`/`bg-secondary` semantic
utilities** — never use them.

### Semantic status colors
Tailwind defaults, used sparingly: `emerald` = success/active/published, `amber` = warning/draft/stale,
`red` = error/destructive. Color is never the only indicator of state.

### Usage Rules
- Use `primary` for primary UI (buttons, headers, navigation); `rust` for emphasis/selection
- Use `cream` (light) / `stone-900+` (dark) for backgrounds and surfaces
- Runtime theming: the Content Studio theme manager rewrites these CSS variables — always
  reference tokens (`bg-primary-600`), never hardcoded hex, so seasonal themes apply
- Maintain WCAG AA contrast ratios (4.5:1 for text)

## Typography

### Font Stack (from `globals.css @theme`)
- Display: **Fraunces** (`font-display`) — headings, editorial elements
- Body: **Source Serif 4** (`font-serif`) — primary reading content
- Monospace: system mono, for code/technical data only

### Type Scale
```css
text-xs    /* 12px - captions, labels */
text-sm    /* 14px - secondary text */
text-base  /* 16px - body text */
text-lg    /* 18px - subheadings */
text-xl    /* 20px - section headings */
text-2xl   /* 24px - page titles */
text-3xl   /* 30px - hero text */
```

### Rules
- Body text: `text-base` (16px) minimum for readability
- Line height: `leading-relaxed` (1.625) for body text
- Never use font size below `text-xs` (12px) — this floor applies to studio/admin UI too
- Headings: use consistent hierarchy (h1 → h2 → h3)
- Don't hand-roll page/section headings — use the shared components, which define the real
  scale: `PageHeader` h1 is `text-4xl sm:text-5xl md:text-6xl font-display`; `SectionHeader`
  h2 is `text-4xl sm:text-5xl font-display`

## Component Patterns

### Shared UI Primitives (`components/ui/`)
- `Button` — primary, secondary, ghost, danger variants; `size="xs"` for tool density
- `Card` — content container (variants: default/lift/glass/plain)
- `Badge` — status labels, category tags (variants: sage/green/earth/blue/stone/amber/red)
- `Input` / `Textarea` / `Select` / `Toggle` — form primitives (Select accepts `options` or `children`)
- `Modal` — accessible dialog (portal, Esc, focus trap, `aria-modal`, footer slot)
- `Tooltip` — hover/focus tooltip (`role="tooltip"`, keyboard-accessible)
- `EmptyState` — centered empty-state with icon + action
- `LoadingSkeleton` — skeleton compositions (Card/List/Text/Page/Profile)
- `Toaster` — Sonner wrapper, themed to RootLink palette (mounted globally in `app/layout.tsx`)
- `Text` — editable-copy renderer (`<Text k="copy.key">` auto-marks `data-rl-text`)
- `StatCounter` — animated number display
- `PageHeader` / `Section` — marketing page headers/sections
- `ResizableSplit` — two-panel split with drag + keyboard resize
- `InfoPopover` — "(i)" help button with popover
- `ImageUpload` — drag-drop image uploader with preview

### Component Naming
- PascalCase for component files and exports
- Feature components in feature directories
- Shared components in `components/ui/`

### Component Structure
```tsx
// Standard component pattern
interface ComponentProps {
  // Props with clear types
}

export function Component({ prop1, prop2 }: ComponentProps) {
  // Hooks at top
  // Event handlers
  // Render
  return (
    <div className="...">
      {/* Content */}
    </div>
  )
}
```

## Animation Patterns

### Framer Motion
- Page transitions: `AnimatePresence` + `motion.div`
- List items: staggered entrance animations
- Modals: fade in/out with scale
- Hover effects: subtle scale or opacity changes

### Animation Rules
- Keep animations under 300ms for responsiveness
- Use `ease-out` for entrances, `ease-in` for exits
- Respect `prefers-reduced-motion` media query
- Never animate layout properties (width, height) — use transforms

## Internationalization (i18n)

### Translation System
- Custom locale context (not next-intl runtime)
- Default locale: Portuguese (`pt`)
- Secondary locale: English (`en`)
- Translations in `messages/pt.json` and `messages/en.json`

### Usage
```tsx
import { useLocale } from '@/lib/locale-context'

const { t, locale, setLocale } = useLocale()

// Translation
<h1>{t('home.title')}</h1>

// With variables
<p>{t('events.attendees', { count: 5 })}</p>

// Conditional
<span>{locale === 'pt' ? 'Português' : 'English'}</span>
```

### Rules
- Always use `t()` for user-facing strings
- Never hardcode language-specific text
- Include both PT and EN translations
- Use interpolation for dynamic values
- Keep translation keys hierarchical (e.g., `events.detail.title`)

## Responsive Design

### Breakpoints (Tailwind defaults)
```css
sm: 640px    /* Mobile landscape */
md: 768px    /* Tablet */
lg: 1024px   /* Desktop */
xl: 1280px   /* Large desktop */
```

### Layout Rules
- Mobile-first: design for mobile, enhance for larger screens
- Use Tailwind responsive prefixes: `sm:`, `md:`, `lg:`, `xl:`
- Test on actual devices, not just browser resize
- Navigation: collapsible on mobile, horizontal on desktop
- Content: single column on mobile, multi-column on desktop

### Grid Patterns
```tsx
{/* Card grid — responsive */}
<div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
  {items.map(item => <Card key={item.id} />)}
</div>

{/* Sidebar layout */}
<div className="flex flex-col lg:flex-row gap-6">
  <main className="flex-1">{/* Content */}</main>
  <aside className="w-full lg:w-80">{/* Sidebar */}</aside>
</div>
```

## Page Patterns

### List Pages
```tsx
// Standard list page structure
export default function ListPage() {
  return (
    <Container>
      <Header title="..." />
      <Filters />
      <Grid>
        {items.map(item => <Card key={item.id} />)}
      </Grid>
      <Pagination />
    </Container>
  )
}
```

### Detail Pages
```tsx
// Standard detail page structure
export default function DetailPage({ params }) {
  return (
    <Container>
      <Breadcrumbs />
      <Header />
      <Content />
      <Sidebar />
      <Comments />
    </Container>
  )
}
```

### Form Patterns
- Use controlled components
- Validate on submit, show errors inline
- Loading state on submit button
- Success feedback (toast or redirect)
- Cancel button returns to previous page

### Content Studio overlay & editable copy (supersedes the retired Content UI Editor)

The old inline `components/editor-mode/` editor (`EditableText`/`EditableImage`/`EditableIcon`)
is **RETIRED** — do not wire new pages into it. It was replaced by the **Content Studio visual
overlay** (`components/overlay/`, spec: `docs/content-studio/CONTENT_STUDIO.md` — read the spec
before any Content Studio work).

How editable copy works now:
- **All editable marketing/copy text uses `<Text k="copy.key">`** (`components/ui/Text.tsx`).
  It auto-marks the element with `data-rl-text="copy.key"` so the overlay knows the text is
  editable and which copy key persists edits (via `/api/copy`).
- **Computed values** (counts, prices, dates, usernames, API data) render as plain `{expr}` —
  no `<Text>`, no `data-rl-text`. The overlay treats these as read-only ("Computed value — not
  editable"). Editable copy = keyed = `<Text>`; computed = unkeyed = read-only.
- `SectionHeader` accepts `headingKey`, `LinkWithArrow` accepts `copyKey`, `Button` forwards
  `data-rl-text` via `{...props}` — use these for text inside DeFacto/Button components.
- Selectable components carry `data-rl-component="<Name>"` on their root element so the
  overlay's selection agent can snap to them. New reusable components should be tagged.
- Coverage is added page by page, not automatically. **When adding a new page or new static
  copy, ask the user whether it should be wired in — never assume either way.**
- If the same copy renders inside a `.map()` over a static array, carry the i18n **key** in the
  array item (`nameKey`/`descKey`), not a pre-resolved string, so new entries stay editable.

## Content Studio & back-office UI patterns (binding — 2026-07-11 unified UX)

All studio/admin/dashboard UI follows the `frontend-ui-guardian` skill's "Back-Office / Tool UI"
chapter. The concrete implementations to REUSE (never re-invent):

| Pattern | Implementation | Notes |
|---|---|---|
| Dialog | `components/ui/Modal.tsx` | Portal to body, Esc-close, focus trap, `aria-modal`, footer slot |
| Load failure | `components/studio/LoadError.tsx` | Inline notice + "Try again"; NEVER a silent `catch {}` |
| Dirty-state guard | `lib/use-dirty-guard.ts` | `useDirtyGuard(dirty, { message })` — beforeunload + in-app link interception |
| Destructive confirm | `window.confirm()` (OK/Cancel wording) | Delete/revert/discard/exit-with-draft always confirm |
| Loading | Kit `LoadingSkeleton` compositions | Shape them like the page's real layout |
| Tooltip | `components/ui/Tooltip` + `aria-label` on icon-only buttons | Native `title=` is banned (keyboard/touch-invisible) |
| Buttons/fields | Kit `Button` (`size="xs"` for tool density, `danger` for destructive), `Input`, `Textarea`, `Toggle` | Segmented tabs/selection rows may stay raw with `aria-pressed`/`aria-current` |
| Empty states | Kit `EmptyState`; quiet `text-sm` line in small panes | A blank pane is a bug |
| Save feedback (studio) | Sonner `toast.success()` / `toast.error()` via `components/ui/Toaster.tsx` | Silence after save |
| Save feedback (overlay) | Status-flash chip (`role="status"`, `aria-live="polite"`, ~2.5s; `{msg, variant}` — emerald=success, rust=error) | Silence after save |
| Input → API | Local state instant, API debounced ~400ms per item | See theming token editor |
| List mutations | Optimistic update, revert + toast on failure, no refetch flash | See blocks section reorder |
| Type floor | 12px (`text-xs`) minimum everywhere | Exception: scaled miniature previews (`catalog/ComponentPreview.tsx`) |

**Keyboard contract** (grep before adding any shortcut): `Ctrl+K` command palette · `Esc`
closes an open dialog FIRST, then overlay selection-up (capture-phase handlers must yield to
`[role="dialog"], [data-rl-dialog]` — LESSONS.md #43; every dialog-like surface must carry one
of those attributes) · `Ctrl+Z`/`Ctrl+Shift+Z`/`Ctrl+Y` undo/redo · `Ctrl+S` save draft /
save all · `Ctrl+Shift+E` enter overlay edit mode.

Overlay-specific: selectable components carry `data-rl-component`; editable copy carries
`data-rl-text` via `<Text k>`; the inspector is resizable (`localStorage["rl-inspector-width"]`);
inspector sections are collapsible (`CollapsibleSection` with `storageKey`, persisted per-section);
the footer hint is dismissible (`localStorage["rl-inspector-hint-dismissed"]`); undo/redo are
icon-only + tooltip (symmetric); `ResetButton` is the shared per-property reset control
(`components/overlay/ResetButton.tsx`); new color families must be added to `COLOR_FAMILIES` in
`selection-agent.ts` (LESSONS.md #42).

## Accessibility

### Rules
- All images must have `alt` text
- Form inputs must have associated labels
- Color is never the only indicator of state
- Keyboard navigation support for all interactive elements
- Focus visible styles on all focusable elements
- Semantic HTML (headings, landmarks, lists)
- ARIA labels for icon-only buttons

### Testing
- Test with keyboard only (no mouse)
- Test with screen reader (VoiceOver/NVDA)
- Check color contrast ratios
- Verify focus order is logical
