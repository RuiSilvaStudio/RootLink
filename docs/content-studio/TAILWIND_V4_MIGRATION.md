# Tailwind v4 Migration — Task Brief

> **Status:** ✅ COMPLETE (2026-07-09). This file is kept as a historical record of the
> migration. The patterns section (§"How to use v4") below is still valid as a reference.
>
> **Priority:** ~~HIGH — blocking all other Content Studio work~~ (done)
> **Created:** 2026-07-09
> **Context:** The Content Studio was built on Tailwind v3.4.0 with an RGB-channel hack for CSS variables. The user added a `tailwindcss-development` skill explicitly documenting v4 usage. The entire platform must migrate to v4.3.2 (latest).

---

## Why

1. **The user explicitly asked for v4.** A `tailwindcss-development` skill was added documenting v4 patterns. It was ignored during Content Studio development — v3 patterns were used throughout.
2. **v3 is being deprecated.** The v3 RGB-channel hack (`rgb(var(--token) / <alpha-value>)`) is a workaround that v4 makes unnecessary.
3. **Color format inconsistency.** The same colors are stored as RGB channels in `globals.css`/`theme_seed.py` but as hex in `constrained-controls.tsx` PALETTE and `tokens.css`. This inconsistency caused a real bug (color values never highlighted in the palette picker).
4. **Excellence.** The user expects the platform to reflect excellence — v3 hacks are not that.

## Current state (v3)

| File | What's there | Format |
|---|---|---|
| `package.json` | `tailwindcss: ^3.4.0` | v3 |
| `tailwind.config.ts` | 106 lines of `rgb(var(--color-X) / <alpha-value>)` boilerplate | v3 JS config |
| `app/globals.css` | `@tailwind base; @tailwind components; @tailwind utilities;` + `:root { --color-primary-600: 99 77 51; }` | v3 directives + RGB channels |
| `lib/theme-context.tsx` | Fetches theme tokens, injects as CSS vars (expects RGB channels) | RGB channels |
| `components/overlay/constrained-controls.tsx` | PALETTE array with hex values | Hex |
| `components/overlay/selection-agent.ts` | `mapTokenToCssVar()` converts token names to `var(--color-X)` | Runtime hack |
| `backend/app/services/theme_seed.py` | Seeds tokens as RGB channels (`99 77 51`) | RGB channels |
| `backend/app/services/element_catalog_seed.py` | Default values reference token names | Token names (ok) |

## Target state (v4)

| File | What it should be | Format |
|---|---|---|
| `package.json` | `tailwindcss: ^4.3.2`, `@tailwindcss/postcss`, `postcss` | v4 |
| `postcss.config.mjs` | `{ plugins: { "@tailwindcss/postcss": {} } }` | v4 PostCSS |
| `tailwind.config.ts` | **DELETED** — no JS config | N/A |
| `app/globals.css` | `@import "tailwindcss";` + `@theme { --color-primary-600: #634d33; ... }` | v4 import + hex in `@theme` |
| `lib/theme-context.tsx` | Fetches theme tokens, injects as CSS vars (hex values) | Hex |
| `components/overlay/constrained-controls.tsx` | PALETTE array with hex values (unchanged) | Hex |
| `components/overlay/selection-agent.ts` | No `mapTokenToCssVar()` needed — CSS vars are native | N/A |
| `backend/app/services/theme_seed.py` | Seeds tokens as hex (`#634d33`) | Hex |

## Migration steps

### 1. Install v4 dependencies
```bash
cd rootlink/frontend
npm install tailwindcss@4.3.2 @tailwindcss/postcss postcss
```

### 2. Create PostCSS config
Create `rootlink/frontend/postcss.config.mjs`:
```js
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
```
(If a `postcss.config.js` already exists, replace its content. Next.js auto-detects `.mjs`.)

### 3. Rewrite `app/globals.css`
- Replace `@tailwind base; @tailwind components; @tailwind utilities;` with `@import "tailwindcss";`
- Replace the `:root { --color-*: RGB channels; }` block with `@theme { --color-*: #hex; }`
- All colors as readable hex (convert from RGB channels: `99 77 51` → `#634d33`)
- Fonts: `--font-display: "Fraunces", Georgia, serif;` (same, just in `@theme`)
- Radius: `--radius-xl2: 16px;` (same, just in `@theme`)
- Keep the `@layer base`, `@layer components`, keyframes, and utility classes — they work in v4
- Dark mode: v4 uses `@custom-variant dark (&:where(.dark, .dark *));` to configure class-based dark mode (instead of v3's `darkMode: "class"` in JS config). Add this after the `@import`.

### 4. Delete `tailwind.config.ts`
Everything moves to `@theme` in CSS. The `content` paths (where to scan for classes) are auto-detected in v4. The `darkMode: "class"` setting moves to the `@custom-variant` directive. Keyframes/animations move to `@theme` or stay as regular CSS.

### 5. Update the Content Studio's theme backend
- `theme_seed.py`: change all `light_value` from RGB channels (`99 77 51`) to hex (`#634d33`)
- The `ThemeProvider` (`lib/theme-context.tsx`): no format conversion needed — hex values inject directly as CSS vars
- The `PaletteColorPicker` (`constrained-controls.tsx`): the PALETTE array already uses hex — now it matches the backend format. ~~The reverse-lookup bug (computed RGB can't match palette hex) is fixed by converting `getComputedStyle` RGB output to hex for comparison.~~ **Superseded:** the `normalizeToHex` rgb→hex hack was later removed entirely in the theme-token model rebuild — current-token detection is now name-based via `data-rl-*-token` attrs (no color-format comparison at all). See `IMPLEMENTATION_STATUS.md` → "Theme-token model rebuild."
- The `selection-agent.ts`: remove `mapTokenToCssVar()` — in v4, setting `el.style.setProperty('--color-primary-600', '#634d33')` works natively

### 6. Verify
- `npx tsc --noEmit` — clean
- `npm run lint` — clean
- `npm run build` — succeeds (stop dev server first!)
- Visual parity: the site should look identical (same colors, same fonts, same layout)
- Dark mode toggle works
- Content Studio overlay works (select element, see inspector, change color)

## Key v4 patterns to use (from the official docs)

### Import
```css
@import "tailwindcss";
```

### Theme (replaces tailwind.config.ts)
```css
@theme {
  --color-primary-50: #f3f0eb;
  --color-primary-600: #634d33;
  --color-primary-700: #4f3d2a;
  --color-cream: #f8f6f2;
  --font-display: "Fraunces", Georgia, serif;
  --font-serif: "Source Serif 4", Georgia, serif;
  --radius-xl2: 16px;
}
```
This auto-generates: `bg-primary-600`, `text-cream`, `font-display`, `rounded-xl2`, etc.

### Dark mode (class-based)
```css
@custom-variant dark (&:where(.dark, .dark *));
```

### Custom component classes (same as v3)
```css
@layer components {
  .card-lift { @apply bg-white border rounded-xl2 transition-all; }
}
```

### Keyframes/animations in @theme
```css
@theme {
  --animate-fade-in: fade-in 0.6s ease-out forwards;
  @keyframes fade-in {
    0% { opacity: 0; transform: translateY(16px); }
    100% { opacity: 1; transform: translateY(0); }
  }
}
```

## What NOT to do
- Do NOT use `@tailwind base/components/utilities` — use `@import "tailwindcss"`
- Do NOT create a `tailwind.config.ts` or `tailwind.config.js` — use `@theme` in CSS
- Do NOT use `rgb(var(--token) / <alpha-value>)` — use hex in `@theme`, v4 handles opacity natively
- Do NOT store colors as RGB channels anywhere — hex everywhere
- Do NOT fall back to v3 patterns in future sessions — the AGENTS.md rule enforces v4
