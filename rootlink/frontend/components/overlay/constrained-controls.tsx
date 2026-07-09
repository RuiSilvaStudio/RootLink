"use client";

/**
 * Content Studio — Constrained Controls.
 *
 * Spec: docs/content-studio/CONTENT_STUDIO.md §4 (constrained controls).
 *
 * The control vocabulary for the inspector panel. Never free-text where a
 * purpose-built control exists — each property type maps to a specific control
 * that only permits valid theme-token values. Phase 2: wired into the
 * inspector, changes preview live in the iframe. Phase 3 adds override
 * guardrail + draft/publish around these.
 *
 * All controls share the ControlProps shape (value + onChange + optional label)
 * and render against the inspector's dark surface (bg-stone-950, text-stone-300).
 * Active/selected state is `bg-primary-600 text-cream`; hover is `hover:bg-stone-800`;
 * labels are `text-xs text-stone-500 font-mono`. Compact sizing — the inspector
 * is 384px (w-96) wide.
 */

import { MousePointer2, Upload, FolderOpen, ImageIcon } from "lucide-react";

// ── Shared types ────────────────────────────────────────────────
export interface ControlProps {
  value: string;
  onChange: (value: string) => void;
  label?: string;
}

// ── Shared label header (optional property label above a control) ──
function ControlLabel({ label }: { label?: string }) {
  if (!label) return null;
  return (
    <p className="text-xs text-stone-500 font-mono mb-1.5">{label}</p>
  );
}

// ══════════════════════════════════════════════════════════════════
// 1. SliderWithStops
// ══════════════════════════════════════════════════════════════════
// A slider with pre-defined stops (NOT free-range). Rendered as a row of
// clickable stop-buttons (segmented control). The active stop is highlighted;
// the current value is echoed below in monospace. Used for padding, margin,
// gap, letter-spacing, border-radius, border-width.

const SPACING_STOPS = [
  { value: "0px", label: "0" },
  { value: "0.25rem", label: "xs" },
  { value: "0.5rem", label: "sm" },
  { value: "1rem", label: "md" },
  { value: "1.5rem", label: "lg" },
  { value: "2rem", label: "xl" },
  { value: "3rem", label: "2xl" },
];

export function SliderWithStops({ value, onChange, label }: ControlProps) {
  const activeIndex = SPACING_STOPS.findIndex((s) => s.value === value);

  return (
    <div>
      <ControlLabel label={label} />
      <div className="flex gap-0.5 rounded-lg bg-stone-900 p-0.5 border border-stone-800">
        {SPACING_STOPS.map((stop) => {
          const active = stop.value === value;
          return (
            <button
              key={stop.value}
              type="button"
              onClick={() => onChange(stop.value)}
              className={`flex-1 px-1 py-1 rounded-md text-[11px] font-mono transition ${
                active
                  ? "bg-primary-600 text-cream"
                  : "text-stone-400 hover:bg-stone-800 hover:text-stone-200"
              }`}
              aria-pressed={active}
              title={stop.value}
            >
              {stop.label}
            </button>
          );
        })}
      </div>
      <p className="mt-1 text-[11px] font-mono text-stone-500">
        {activeIndex >= 0 ? value : `custom · ${value || "—"}`}
      </p>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// 2. PaletteColorPicker
// ══════════════════════════════════════════════════════════════════
// A grid of named palette colors (4 columns) — NOT a free-form color wheel.
// Each swatch is a button showing the light-mode color as its background with
// the token name below in tiny text. The active swatch has a ring/border.
// onChange is called with the token name (e.g. "primary-600"). If the current
// value isn't a known palette token, a "Custom" line shows at the top.

interface PaletteEntry {
  name: string;   // e.g. "primary-600"
  light: string;  // hex e.g. "#634d33"
  dark: string;   // hex (may equal light if no dark override)
}

let _paletteCache: PaletteEntry[] | null = null;

/**
 * Dynamically build the color palette from the @theme CSS variables at
 * runtime. Reads all --color-* variables from getComputedStyle on :root
 * (light values) and on a .dark element (dark values). This ensures the
 * palette is always in sync with the theme — any color added to @theme
 * automatically appears in the palette picker. No manual maintenance.
 */
function getPalette(): PaletteEntry[] {
  if (_paletteCache) return _paletteCache;

  const root = document.documentElement;
  const rootStyles = getComputedStyle(root);
  const entries: PaletteEntry[] = [];

  // Read dark-mode values from a temp .dark element
  const darkEl = document.createElement("div");
  darkEl.className = "dark";
  darkEl.style.display = "none";
  document.body.appendChild(darkEl);
  const darkStyles = getComputedStyle(darkEl);

  // Iterate all CSS custom properties on :root
  const styleSheets = Array.from(document.styleSheets);
  const tokenNames = new Set<string>();

  for (const sheet of styleSheets) {
    try {
      for (const rule of Array.from(sheet.cssRules)) {
        if (rule instanceof CSSStyleRule) {
          const style = rule.style;
          for (let i = 0; i < style.length; i++) {
            const prop = style.item(i);
            if (prop && prop.startsWith("--color-")) {
              tokenNames.add(prop);
            }
          }
        }
      }
    } catch { /* cross-origin stylesheet — skip */ }
  }

  // Also scan :root inline styles (ThemeProvider injects via style attr)
  for (let i = 0; i < root.style.length; i++) {
    const prop = root.style.item(i);
    if (prop && prop.startsWith("--color-")) {
      tokenNames.add(prop);
    }
  }

  for (const tokenName of Array.from(tokenNames)) {
    // tokenName is like "--color-primary-600"
    const name = tokenName.replace("--color-", "");
    const light = rootStyles.getPropertyValue(tokenName).trim();
    const dark = darkStyles.getPropertyValue(tokenName).trim() || light;
    if (light) {
      entries.push({ name, light: light.startsWith("#") ? light : normalizeToHex(light) || light, dark: dark.startsWith("#") ? dark : normalizeToHex(dark) || dark });
    }
  }

  // Sort: primary, earth, rust, cream, stone — then by shade number
  const familyOrder = ["primary", "earth", "rust", "cream", "stone"];
  entries.sort((a, b) => {
    const aFam = familyOrder.findIndex((f) => a.name.startsWith(f));
    const bFam = familyOrder.findIndex((f) => b.name.startsWith(f));
    if (aFam !== bFam) return aFam - bFam;
    const aNum = parseInt(a.name.match(/\d+/)?.[0] || "0");
    const bNum = parseInt(b.name.match(/\d+/)?.[0] || "0");
    return aNum - bNum;
  });

  document.body.removeChild(darkEl);
  _paletteCache = entries;
  return entries;
}

/**
 * Convert any CSS color string (oklch, rgb, hex, named) to a normalized
 * lowercase hex string for comparison. The browser's getComputedStyle
 * returns oklch() or rgb() format even though we store hex in @theme —
 * this function bridges the gap.
 */
function normalizeToHex(cssColor: string): string {
  if (!cssColor) return "";
  if (cssColor.startsWith("#")) return cssColor.toLowerCase();
  // If it's a token name (e.g. "primary-600"), return as-is
  if (!cssColor.includes("(") && !cssColor.startsWith("rgb") && !cssColor.startsWith("oklch") && !cssColor.startsWith("hsl")) {
    return cssColor;
  }
  // Use a temp element to normalize through the browser's color parser
  try {
    const temp = document.createElement("div");
    temp.style.color = cssColor;
    temp.style.display = "none";
    document.body.appendChild(temp);
    const computed = getComputedStyle(temp).color;
    document.body.removeChild(temp);
    const match = computed.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)/);
    if (match) {
      const [, r, g, b] = match;
      return "#" + [r, g, b].map((n) => parseInt(n).toString(16).padStart(2, "0")).join("");
    }
    // Canvas fallback for oklch (Chrome canvas supports oklch)
    const ctx = document.createElement("canvas").getContext("2d");
    if (ctx) {
      ctx.fillStyle = cssColor;
      const hex = ctx.fillStyle;
      if (hex.startsWith("#")) return hex.toLowerCase();
    }
  } catch {}
  return cssColor;
}

export function PaletteColorPicker({ value, onChange, label }: ControlProps) {
  const palette = getPalette();
  const valueHex = normalizeToHex(value);
  const matchedToken = palette.find((c) => c.light.toLowerCase() === valueHex);
  const activeTokenName = matchedToken?.name || value;
  const isKnown = palette.some((c) => c.name === activeTokenName);

  return (
    <div>
      <ControlLabel label={label} />
      {!isKnown && (
        <p className="mb-1.5 text-[11px] font-mono text-stone-500">
          custom · <span className="text-stone-400">{value || "—"}</span>
        </p>
      )}
      <div className="grid grid-cols-4 gap-1">
        {palette.map((color) => {
          const active = color.name === activeTokenName;
          return (
            <button
              key={color.name}
              type="button"
              onClick={() => onChange(color.name)}
              className={`flex flex-col items-center gap-1 rounded-md p-1 transition ${
                active
                  ? "ring-2 ring-primary-400 bg-stone-800"
                  : "hover:bg-stone-800"
              }`}
              aria-pressed={active}
              title={color.name}
            >
              <span
                className="w-full h-7 rounded border border-stone-700/60"
                style={{ backgroundColor: color.light }}
              />
              <span className="text-[9px] font-mono text-stone-400 leading-none truncate w-full text-center">
                {color.name}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// 3. Toggle
// ══════════════════════════════════════════════════════════════════
// A pill-shaped on/off switch. `on` when value === onValue, `off` when
// value === offValue. Clicking flips between the two. Primary when on,
// gray when off.

export interface ToggleProps extends ControlProps {
  onValue: string;
  offValue: string;
}

export function Toggle({ value, onChange, label, onValue, offValue }: ToggleProps) {
  const isOn = value === onValue;

  return (
    <div>
      <ControlLabel label={label} />
      <button
        type="button"
        onClick={() => onChange(isOn ? offValue : onValue)}
        className="inline-flex items-center gap-2 group"
        aria-pressed={isOn}
        aria-label={label || (isOn ? onValue : offValue)}
      >
        <span
          className={`relative w-9 h-5 rounded-full transition-colors ${
            isOn ? "bg-primary-600" : "bg-stone-700"
          }`}
        >
          <span
            className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-cream shadow-sm transition-transform ${
              isOn ? "translate-x-4" : "translate-x-0"
            }`}
          />
        </span>
        <span className="text-[11px] font-mono text-stone-400">
          {isOn ? onValue : offValue}
        </span>
      </button>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// 4. ButtonGroup
// ══════════════════════════════════════════════════════════════════
// A horizontal row of buttons for enum selection. The active option is
// `bg-primary-600 text-cream`. Used for font-family, border-style, text-align,
// display, flex-direction.

export interface ButtonGroupProps extends ControlProps {
  options: { value: string; label: string }[];
}

export function ButtonGroup({ value, onChange, label, options }: ButtonGroupProps) {
  return (
    <div>
      <ControlLabel label={label} />
      <div className="flex flex-wrap gap-0.5 rounded-lg bg-stone-900 p-0.5 border border-stone-800">
        {options.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`px-2 py-1 rounded-md text-[11px] font-mono transition ${
                active
                  ? "bg-primary-600 text-cream"
                  : "text-stone-400 hover:bg-stone-800 hover:text-stone-200"
              }`}
              aria-pressed={active}
              title={opt.value}
            >
              {opt.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// 5. TypeScaleButtons
// ══════════════════════════════════════════════════════════════════
// "Aa" buttons at real scale for font-size selection. Each button renders
// "Aa" at the actual font-size of that option (inline style) with the label
// (H1, H2, ...) below in tiny text. Active button: `bg-primary-600 text-cream`.
// If the current value isn't a known scale step, show the raw value as a
// non-selectable label.

const TYPE_SCALE = [
  { value: "1.875rem", label: "H1", size: "1.875rem" },
  { value: "1.5rem", label: "H2", size: "1.5rem" },
  { value: "1.25rem", label: "H3", size: "1.25rem" },
  { value: "1.125rem", label: "H4", size: "1.125rem" },
  { value: "1rem", label: "Body", size: "1rem" },
  { value: "0.875rem", label: "Small", size: "0.875rem" },
  { value: "0.75rem", label: "XS", size: "0.75rem" },
];

export function TypeScaleButtons({ value, onChange, label }: ControlProps) {
  const isKnown = TYPE_SCALE.some((s) => s.value === value);

  return (
    <div>
      <ControlLabel label={label} />
      <div className="flex flex-wrap gap-0.5 rounded-lg bg-stone-900 p-0.5 border border-stone-800">
        {TYPE_SCALE.map((opt) => {
          const active = opt.value === value;
          return (
            <button
              key={opt.value}
              type="button"
              onClick={() => onChange(opt.value)}
              className={`flex flex-col items-center justify-center px-2 py-1 rounded-md min-w-[2.25rem] transition ${
                active
                  ? "bg-primary-600 text-cream"
                  : "text-stone-300 hover:bg-stone-800"
              }`}
              aria-pressed={active}
              title={opt.value}
            >
              <span style={{ fontSize: opt.size }} className="font-serif leading-none">
                Aa
              </span>
              <span className="mt-0.5 text-[9px] font-mono opacity-80 leading-none">
                {opt.label}
              </span>
            </button>
          );
        })}
      </div>
      {!isKnown && (
        <p className="mt-1 text-[11px] font-mono text-stone-500">
          custom · <span className="text-stone-400">{value || "—"}</span>
        </p>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// 6. InlineTextEditor
// ══════════════════════════════════════════════════════════════════
// Placeholder control — the actual inline editing happens on the page (in the
// iframe) via the selection agent, which makes the text contentEditable. This
// component just shows the current text value (read-only) and a hint to click
// the text on the page to edit it inline.

export function InlineTextEditor({ value, label }: ControlProps) {
  return (
    <div>
      <ControlLabel label={label} />
      <div className="rounded-md border border-stone-800 bg-stone-900 px-2 py-1.5">
        <p className="text-sm font-serif text-stone-300 whitespace-pre-wrap break-words min-h-[1.25rem]">
          {value || <span className="text-stone-600 italic">empty</span>}
        </p>
      </div>
      <p className="mt-1.5 flex items-center gap-1 text-[10px] font-mono text-stone-500">
        <MousePointer2 className="w-3 h-3" />
        Click the text on the page to edit it inline.
      </p>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// 7. VisualImagePicker
// ══════════════════════════════════════════════════════════════════
// Phase 2 placeholder: shows the current image URL (thumbnail + URL in
// monospace), a "Browse assets" button, and an "Upload" dropzone. Both the
// browse button and the dropzone are disabled in Phase 2 — wired in Phase 5
// once the font/image asset library exists.

function looksLikeUrl(v: string): boolean {
  return (
    !!v &&
    (v.startsWith("http://") ||
      v.startsWith("https://") ||
      v.startsWith("/") ||
      v.startsWith("data:"))
  );
}

export function VisualImagePicker({ value, label }: ControlProps) {
  const hasUrl = looksLikeUrl(value);

  return (
    <div>
      <ControlLabel label={label} />

      {hasUrl ? (
        <div className="mb-2 flex items-center gap-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={value}
            alt=""
            className="w-12 h-12 rounded-md object-cover border border-stone-700 shrink-0"
          />
          <p className="text-[11px] font-mono text-stone-400 truncate">{value}</p>
        </div>
      ) : (
        value ? (
          <p className="mb-2 text-[11px] font-mono text-stone-500 truncate">
            {value}
          </p>
        ) : null
      )}

      <button
        type="button"
        disabled
        className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-[11px] font-mono text-stone-500 bg-stone-900 border border-stone-800 cursor-not-allowed"
      >
        <FolderOpen className="w-3.5 h-3.5" />
        Browse assets
      </button>

      <div className="mt-1.5 flex flex-col items-center justify-center gap-1 px-2 py-4 rounded-md border border-dashed border-stone-800 text-stone-600 cursor-not-allowed">
        <Upload className="w-4 h-4" />
        <p className="text-[10px] font-mono">Upload</p>
      </div>

      {!hasUrl && (
        <p className="mt-1.5 flex items-center gap-1 text-[10px] font-mono text-stone-600">
          <ImageIcon className="w-3 h-3" />
          Asset library arrives in Phase 5.
        </p>
      )}
    </div>
  );
}
