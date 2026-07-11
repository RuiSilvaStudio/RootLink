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

import { useEffect, useId, useRef, useState } from "react";
import { MousePointer2, Upload, FolderOpen, ImageIcon, ChevronDown } from "lucide-react";
import { api } from "@/lib/api";

export interface FontEntry {
  id: number;
  name: string;
  family: string;   // CSS font-family value, e.g. '"Routtage", sans-serif'
  is_active: boolean;
}

// Module-level font cache (shared by the picker + the inspector's name→family
// resolver), so a font chosen in the picker applies with one fetch.
let _fontsCache: FontEntry[] | null = null;

async function loadFonts(): Promise<FontEntry[]> {
  if (_fontsCache) return _fontsCache;
  try {
    const all = await api.fonts.list();
    _fontsCache = all.filter((f) => f.is_active);
  } catch {
    _fontsCache = [];
  }
  return _fontsCache;
}

/** Resolve a font NAME to its CSS font-family value (or null if unknown).
 *  Triggers a load if the cache is empty. */
export async function fontFamilyCSS(name: string): Promise<string | null> {
  const fonts = await loadFonts();
  return fonts.find((f) => f.name === name)?.family ?? null;
}

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
    <p className="text-xs text-stone-400 font-mono mb-1.5">{label}</p>
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
  { value: "0", label: "0" },
  { value: "1", label: "xs" },
  { value: "2", label: "sm" },
  { value: "3", label: "md" },
  { value: "4", label: "lg" },
  { value: "6", label: "xl" },
  { value: "8", label: "2xl" },
];

export const RADIUS_STOPS = [
  { value: "none", label: "0" },
  { value: "sm", label: "sm" },
  { value: "md", label: "md" },
  { value: "lg", label: "lg" },
  { value: "xl", label: "xl" },
  { value: "2xl", label: "2xl" },
  { value: "3xl", label: "3xl" },
  { value: "full", label: "full" },
];

export interface SliderProps extends ControlProps {
  stops?: { value: string; label: string }[];
}

export function SliderWithStops({ value, onChange, label, stops = SPACING_STOPS }: SliderProps) {
  const activeIndex = stops.findIndex((s) => s.value === value);

  return (
    <div>
      <ControlLabel label={label} />
      <div className="flex gap-0.5 rounded-lg bg-stone-900 p-0.5 border border-stone-800">
        {stops.map((stop) => {
          const active = stop.value === value;
          return (
            <button
              key={stop.value}
              type="button"
              onClick={() => onChange(stop.value)}
              className={`flex-1 px-1 py-1 rounded-md text-xs font-mono transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 ${
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
      <p className="mt-1 text-xs font-mono text-stone-400">
        {activeIndex >= 0 ? value : `custom · ${value || "—"}`}
      </p>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// 2. PaletteColorPicker
// ══════════════════════════════════════════════════════════════════
// A grid of named palette colors (4 columns) — NOT a free-form color wheel.
// Each swatch shows the color; the token NAME sits below it. The active swatch
// is the one whose NAME matches the current value — no color-format
// comparison (the inspector passes the applied token NAME, read from the
// element's data-rl-*-token attr / Tailwind class by the agent). onChange
// emits the token NAME (e.g. "primary-600"); the inspector turns that into
// `var(--color-primary-600)` for the browser and keeps the name as the
// override identity (dark-mode-safe, survives theme swaps).

interface PaletteEntry {
  name: string;   // e.g. "primary-600"
  value: string;  // the declared CSS value (hex), for the swatch background
}

let _paletteCache: PaletteEntry[] | null = null;

/** Collect every `--color-*` custom-property name declared on the page
 *  (from <style>/@theme and :root inline injection by ThemeProvider). */
function collectColorTokenNames(): string[] {
  const names = new Set<string>();
  const styleSheets = Array.from(document.styleSheets);
  for (const sheet of styleSheets) {
    try {
      for (const rule of Array.from(sheet.cssRules)) {
        if (rule instanceof CSSStyleRule) {
          const style = rule.style;
          for (let i = 0; i < style.length; i++) {
            const prop = style.item(i);
            if (prop && prop.startsWith("--color-")) names.add(prop);
          }
        }
      }
    } catch { /* cross-origin stylesheet — skip */ }
  }
  const root = document.documentElement;
  for (let i = 0; i < root.style.length; i++) {
    const prop = root.style.item(i);
    if (prop && prop.startsWith("--color-")) names.add(prop);
  }
  return Array.from(names);
}

/** Build the color palette from the live theme. Idempotent (cached). The
 *  swatch value is the declared CSS (hex) read straight from the custom
 *  property — getComputedStyle returns custom-property values as-declared,
 *  so no rgb/oklch normalization is needed. */
function getPalette(): PaletteEntry[] {
  if (_paletteCache) return _paletteCache;
  const rootStyles = getComputedStyle(document.documentElement);
  const entries: PaletteEntry[] = [];
  for (const tokenName of collectColorTokenNames()) {
    const value = rootStyles.getPropertyValue(tokenName).trim();
    if (value) entries.push({ name: tokenName.replace("--color-", ""), value });
  }
  const familyOrder = ["primary", "earth", "rust", "cream", "stone"];
  entries.sort((a, b) => {
    const aFam = familyOrder.findIndex((f) => a.name.startsWith(f));
    const bFam = familyOrder.findIndex((f) => b.name.startsWith(f));
    if (aFam !== bFam) return aFam - bFam;
    const aNum = parseInt(a.name.match(/\d+/)?.[0] || "0");
    const bNum = parseInt(b.name.match(/\d+/)?.[0] || "0");
    return aNum - bNum;
  });
  _paletteCache = entries;
  return entries;
}

export function PaletteColorPicker({ value, onChange, label }: ControlProps) {
  const palette = getPalette();
  // `value` is the applied token NAME (or, when the element uses a non-token
  // color, a raw CSS value — in which case nothing matches and "custom" shows).
  const isKnown = palette.some((c) => c.name === value);

  return (
    <div>
      <ControlLabel label={label} />
      {!isKnown && value && (
        <div className="mb-1.5 flex items-center gap-2">
          <span
            className="w-4 h-4 rounded border border-stone-700/60 shrink-0"
            style={{ backgroundColor: value }}
            aria-hidden
          />
          <span className="text-xs font-mono text-stone-400">current · not a theme color</span>
        </div>
      )}
      <div className="grid grid-cols-4 gap-1">
        {palette.map((color) => {
          const active = color.name === value;
          return (
            <button
              key={color.name}
              type="button"
              onClick={() => onChange(color.name)}
              className={`flex flex-col items-center gap-1 rounded-md p-1 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 ${
                active
                  ? "ring-2 ring-primary-400 bg-stone-800"
                  : "hover:bg-stone-800"
              }`}
              aria-pressed={active}
              title={color.name}
            >
              <span
                className="w-full h-7 rounded border border-stone-700/60"
                style={{ backgroundColor: color.value }}
              />
              <span className="text-xs font-mono text-stone-400 leading-none truncate w-full text-center">
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
        className="inline-flex items-center gap-2 group rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
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
        <span className="text-xs font-mono text-stone-400">
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
              className={`px-2 py-1 rounded-md text-xs font-mono transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 ${
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
// (H1, H2, ...) below. The VALUE emitted is the Tailwind v4 type-scale NAME
// (e.g. "4xl"); the inspector applies `var(--text-4xl)`. Active button:
// `bg-primary-600 text-cream`. If the current value isn't a known scale step,
// show the raw value as a non-selectable label.

const TYPE_SCALE = [
  { value: "9xl", label: "9XL", size: "8rem" },
  { value: "8xl", label: "8XL", size: "6rem" },
  { value: "7xl", label: "7XL", size: "4.5rem" },
  { value: "6xl", label: "6XL", size: "3.75rem" },
  { value: "5xl", label: "5XL", size: "3rem" },
  { value: "4xl", label: "H1", size: "2.25rem" },
  { value: "3xl", label: "H2", size: "1.875rem" },
  { value: "2xl", label: "H3", size: "1.5rem" },
  { value: "xl", label: "H4", size: "1.25rem" },
  { value: "lg", label: "Lg", size: "1.125rem" },
  { value: "base", label: "Body", size: "1rem" },
  { value: "sm", label: "Small", size: "0.875rem" },
  { value: "xs", label: "XS", size: "0.75rem" },
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
              className={`flex flex-col items-center justify-center px-2 py-1 rounded-md min-w-[2.25rem] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 ${
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
              <span className="mt-0.5 text-xs font-mono opacity-80 leading-none">
                {opt.label}
              </span>
            </button>
          );
        })}
      </div>
      {!isKnown && (
        <p className="mt-1 text-xs font-mono text-stone-400">
          custom · <span className="text-stone-300">{value || "—"}</span>
        </p>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// 6. FontFamilyPicker
// ══════════════════════════════════════════════════════════════════
// A dropdown of every ACTIVE font in the library (/api/fonts), each rendered in
// its own typeface so you see the font as you pick. onChange emits the font
// NAME (override identity); the inspector resolves that to the font's CSS
// `family` string for the browser. Scales to many fonts (scrollable list).

// Normalize font strings for comparison — browsers may use different
// quotes/whitespace than what the font library stores.
const normalizeFont = (s: string) => s.toLowerCase().replace(/['"]/g, "").replace(/\s+/g, " ").trim();

export function FontFamilyPicker({ value, onChange, label }: ControlProps) {
  const [fonts, setFonts] = useState<FontEntry[]>(_fontsCache ?? []);
  const [open, setOpen] = useState(false);
  // Keyboard-navigation cursor over the open list. Focus stays on the trigger;
  // the active option is exposed via aria-activedescendant + option ids.
  const [activeIdx, setActiveIdx] = useState(-1);
  const listboxId = useId();
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadFonts().then(setFonts);
  }, []);

  // Close on outside click.
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const normalizedValue = normalizeFont(value || "");
  const current = fonts.find((f) => f.name === value || normalizeFont(f.family) === normalizedValue);

  // When the list opens, start keyboard navigation on the current font.
  useEffect(() => {
    if (!open) return;
    setActiveIdx((prev) => {
      const idx = fonts.findIndex((f) => f.name === value || normalizeFont(f.family) === normalizeFont(value || ""));
      return idx >= 0 ? idx : prev >= 0 ? prev : 0;
    });
  }, [open, fonts, value]);

  /** Move the keyboard cursor and keep the option visible. */
  const moveActive = (next: number) => {
    if (fonts.length === 0) return;
    const clamped = Math.max(0, Math.min(fonts.length - 1, next));
    setActiveIdx(clamped);
    document.getElementById(`${listboxId}-opt-${clamped}`)?.scrollIntoView({ block: "nearest" });
  };

  const onTriggerKeyDown = (e: React.KeyboardEvent<HTMLButtonElement>) => {
    if (!open) {
      if (e.key === "ArrowDown" || e.key === "ArrowUp") {
        e.preventDefault();
        setOpen(true);
      }
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      moveActive(activeIdx + 1);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      moveActive(activeIdx - 1);
    } else if (e.key === "Home") {
      e.preventDefault();
      moveActive(0);
    } else if (e.key === "End") {
      e.preventDefault();
      moveActive(fonts.length - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      const font = fonts[activeIdx];
      if (font) onChange(font.name);
      setOpen(false);
    } else if (e.key === "Escape") {
      e.preventDefault();
      e.stopPropagation();
      setOpen(false);
    }
  };

  return (
    <div ref={ref}>
      <ControlLabel label={label} />
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        onKeyDown={onTriggerKeyDown}
        className="w-full flex items-center justify-between gap-2 px-2.5 py-2 rounded-md border border-stone-800 bg-stone-900 text-left transition hover:bg-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listboxId : undefined}
        aria-activedescendant={open && activeIdx >= 0 ? `${listboxId}-opt-${activeIdx}` : undefined}
      >
        <span
          className="text-sm text-stone-200 truncate"
          style={{ fontFamily: current?.family ?? "var(--font-serif)" }}
        >
          {current?.name ?? (value ? value : "Select a font…")}
        </span>
        <ChevronDown className="w-3.5 h-3.5 text-stone-500 shrink-0" aria-hidden="true" />
      </button>
      {open && (
        <div
          id={listboxId}
          role="listbox"
          aria-label="Fonts"
          className="mt-1 max-h-60 overflow-y-auto rounded-md border border-stone-800 bg-stone-900 shadow-lg"
        >
          {fonts.length === 0 ? (
            <p className="px-3 py-2 text-xs font-mono text-stone-400">
              No active fonts. Add fonts in the dashboard.
            </p>
          ) : (
            fonts.map((f, i) => {
              const active = f.name === value || normalizeFont(f.family) === normalizedValue;
              return (
                <button
                  key={f.id}
                  id={`${listboxId}-opt-${i}`}
                  type="button"
                  onClick={() => { onChange(f.name); setOpen(false); }}
                  className={`w-full text-left px-3 py-2 text-sm transition flex items-center justify-between gap-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-primary-500/40 ${
                    active
                      ? "bg-primary-600 text-cream"
                      : i === activeIdx
                        ? "bg-stone-800 text-stone-200"
                        : "text-stone-200 hover:bg-stone-800"
                  }`}
                  style={{ fontFamily: f.family }}
                  role="option"
                  aria-selected={active}
                >
                  <span className="truncate">{f.name}</span>
                  {active && <span className="text-xs font-mono opacity-80 shrink-0">active</span>}
                </button>
              );
            })
          )}
        </div>
      )}
      {!current && value && (
        <p className="mt-1 text-xs font-mono text-stone-400">
          current · not in the font library
        </p>
      )}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// 7. InlineTextEditor
// ══════════════════════════════════════════════════════════════════
// Shows the live text of a selected text element while it's being edited
// inline on the page (the agent makes it contentEditable). Read-only mirror of
// the on-page text — the editing itself happens in the iframe, and updates
// here via overlay:text-change messages. When not editing, shows a hint to
// double-click the text on the page to edit it.

export interface InlineTextEditorProps extends ControlProps {
  editing?: boolean;
}

export function InlineTextEditor({ value, label, editing }: InlineTextEditorProps) {
  return (
    <div>
      <ControlLabel label={label} />
      <div className={`rounded-md border bg-stone-900 px-2 py-1.5 ${editing ? "border-primary-500" : "border-stone-800"}`}>
        <p className="text-sm font-serif text-stone-300 whitespace-pre-wrap break-words min-h-[1.25rem]">
          {value || <span className="text-stone-400 italic">empty</span>}
        </p>
      </div>
      <p className="mt-1.5 flex items-center gap-1 text-xs font-mono text-stone-400">
        <MousePointer2 className="w-3 h-3" aria-hidden="true" />
        {editing ? "Editing on the page — Esc to stop." : "Double-click the text on the page to edit it."}
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
          <p className="text-xs font-mono text-stone-400 truncate">{value}</p>
        </div>
      ) : (
        value ? (
          <p className="mb-2 text-xs font-mono text-stone-400 truncate">
            {value}
          </p>
        ) : null
      )}

      <button
        type="button"
        disabled
        className="w-full flex items-center justify-center gap-1.5 px-2 py-1.5 rounded-md text-xs font-mono text-stone-500 bg-stone-900 border border-stone-800 cursor-not-allowed"
      >
        <FolderOpen className="w-3.5 h-3.5" />
        Browse assets
      </button>

      <div className="mt-1.5 flex flex-col items-center justify-center gap-1 px-2 py-4 rounded-md border border-dashed border-stone-800 text-stone-600 cursor-not-allowed">
        <Upload className="w-4 h-4" />
        <p className="text-xs font-mono">Upload</p>
      </div>

      {!hasUrl && (
        <p className="mt-1.5 flex items-center gap-1 text-xs font-mono text-stone-400">
          <ImageIcon className="w-3 h-3" aria-hidden="true" />
          Asset library arrives in Phase 5.
        </p>
      )}
    </div>
  );
}
