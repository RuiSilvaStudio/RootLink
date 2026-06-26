# Design Patterns

> UI conventions, component patterns, and design consistency rules.

## Color Theme

RootLink uses an earth/nature color palette via Tailwind CSS custom tokens.

### Primary Colors
- **Earth Brown:** Primary actions, headers, important UI elements
- **Forest Green:** Secondary actions, success states, nature-related elements
- **Warm Sand:** Backgrounds, cards, neutral surfaces
- **Deep Soil:** Text, dark elements, high contrast

### Tailwind Classes
```css
/* Primary palette */
bg-earth-50 to earth-900    /* Earth brown scale */
bg-forest-50 to forest-900  /* Forest green scale */
bg-sand-50 to sand-900      /* Warm sand scale */

/* Semantic colors */
text-primary      /* Primary text */
text-secondary    /* Secondary text */
bg-primary        /* Primary background */
bg-secondary      /* Secondary background */
```

### Usage Rules
- Use earth tones for primary UI (buttons, headers, navigation)
- Use forest green for nature-related content and success states
- Use sand for backgrounds and neutral surfaces
- Maintain WCAG AA contrast ratios (4.5:1 for text)

## Typography

### Font Stack
- Primary: System font stack (via Tailwind defaults)
- Monospace: For code snippets only

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
- Never use font size below `text-xs` (12px)
- Headings: use consistent hierarchy (h1 → h2 → h3)

## Component Patterns

### Shared UI Primitives (`components/ui/`)
- `Button` — primary, secondary, ghost variants
- `Card` — content container with consistent padding
- `Badge` — status labels, category tags
- `StatCounter` — animated number display
- `LoadingSkeleton` — loading states
- `Collapsible` — animated expand/collapse

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
