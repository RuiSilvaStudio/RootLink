"use client";

/**
 * Content Studio — Inspector Panel.
 *
 * Spec: docs/content-studio/CONTENT_STUDIO.md §3.2 (inspector), §4 (constrained
 * controls), §5 (element property schema), §6 (override guardrail).
 *
 * Theme-token model: the panel only ever offers theme VALUES (colors from the
 * palette, fonts from the library, sizes from the type scale, spacing from the
 * spacing scale, radii from the radius scale). It never exposes structural CSS
 * (display/flex/opacity/margins) — those would break layouts. Each change
 * stores the token NAME as the override identity; the agent applies the theme
 * reference (var(--color-…)) so dark mode is automatic and reset reverts to the
 * Tailwind class default. Per the spec §3.2, text is edited inline ON THE PAGE
 * (the agent makes it contentEditable); the panel mirrors that text live.
 */

import { useOverlay, type SelectedElement } from "./overlay-provider";
import {
  SliderWithStops,
  PaletteColorPicker,
  Toggle,
  ButtonGroup,
  TypeScaleButtons,
  InlineTextEditor,
  FontFamilyPicker,
  fontFamilyCSS,
  RADIUS_STOPS,
} from "./constrained-controls";
import { MousePointer2, ChevronRight, Undo2, Redo2, AlertTriangle, X } from "lucide-react";
import { Tooltip } from "@/components/ui/Tooltip";
import { api } from "@/lib/api";
import { useState, useEffect, ReactNode } from "react";
import { ResetButton } from "./ResetButton";

/** Collapsible inspector section — clickable header with a chevron that
 *  toggles the body. Default open; collapse state persists per section key
 *  (scoped to the selected component type). */
function CollapsibleSection({ title, children, defaultOpen = true, storageKey }: {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
  storageKey?: string;
}) {
  const [open, setOpen] = useState(defaultOpen);
  useEffect(() => {
    if (!storageKey) return;
    const stored = localStorage.getItem(storageKey);
    if (stored !== null) setOpen(stored === "true");
  }, [storageKey]);
  const toggle = () => {
    const next = !open;
    setOpen(next);
    if (storageKey) {
      try { localStorage.setItem(storageKey, String(next)); } catch {}
    }
  };
  return (
    <div className="border-b border-stone-800/50">
      <button
        onClick={toggle}
        aria-expanded={open}
        className="w-full flex items-center gap-1.5 px-4 pt-3 pb-1 text-xs uppercase tracking-wider text-stone-400 font-semibold hover:text-stone-200 transition"
      >
        <ChevronRight className={`w-3 h-3 transition-transform ${open ? "rotate-90" : ""}`} />
        {title}
      </button>
      {open && <div className="px-4 pb-3 space-y-2.5">{children}</div>}
    </div>
  );
}

// ── Property → control mapping (theme-value properties only) ───────
// Structural CSS (display, flex-direction, justify-content, align-items,
// border-style, opacity, width/height, raw margins) is intentionally ABSENT —
// exposing it would invite layout-breaking edits. Only properties that map to a
// theme value are surfaced.

interface PropertyConfig {
  control: "slider" | "palette" | "toggle" | "button-group" | "type-scale" | "font-family";
  options?: { value: string; label: string }[];
  onValue?: string;
  offValue?: string;
}

const COLOR_PROPS = new Set(["color", "background-color", "border-color"]);

// Properties that belong to the block's TEXT element (color = text color).
// These read from / apply to `selected.textElement` (or `selected` when the
// block IS the text element, e.g. a Button). Everything else is a block
// (container) property — background, padding, radius.
const TEXT_PROPS = new Set([
  "color", "font-family", "font-size", "font-weight", "font-style",
  "text-align", "text-decoration", "letter-spacing", "line-height",
]);
const TEXT_GROUP: string[] = [
  "font-family", "font-size", "font-weight", "font-style", "text-align",
  "color", "text-decoration", "letter-spacing", "line-height",
];

const PROPERTY_CONFIG: Record<string, PropertyConfig> = {
  "font-family": { control: "font-family" },
  "font-size": { control: "type-scale" },
  "font-weight": {
    control: "button-group",
    options: [
      { value: "300", label: "Light" },
      { value: "400", label: "Regular" },
      { value: "500", label: "Medium" },
      { value: "600", label: "Semi" },
      { value: "700", label: "Bold" },
    ],
  },
  "font-style": {
    control: "button-group",
    options: [
      { value: "normal", label: "Normal" },
      { value: "italic", label: "Italic" },
    ],
  },
  "text-align": {
    control: "button-group",
    options: [
      { value: "left", label: "Left" },
      { value: "center", label: "Center" },
      { value: "right", label: "Right" },
      { value: "justify", label: "Justify" },
    ],
  },
  "text-decoration": {
    control: "button-group",
    options: [
      { value: "none", label: "None" },
      { value: "underline", label: "Underline" },
    ],
  },
  "letter-spacing": { control: "slider" },
  "line-height": { control: "slider" },
  "color": { control: "palette" },
  "background-color": { control: "palette" },
  "border-color": { control: "palette" },
  "padding": { control: "slider" },
  "gap": { control: "slider" },
  "border-radius": { control: "slider" },
};

// Container-property groups (read from the BLOCK, not its text element).
const PROPERTY_GROUPS: { label: string; properties: string[] }[] = [
  { label: "Colors", properties: ["background-color", "border-color"] },
  { label: "Spacing", properties: ["padding", "gap"] },
  { label: "Corners", properties: ["border-radius"] },
];

// Shorthand → representative longhand for reading the current value.
const SHORTHAND_LONGHAND: Record<string, string> = {
  padding: "padding-top",
  margin: "margin-top",
};

// Values that are "boring" (default/zero/normal) and hidden in fallback mode.
const BORING_VALUES = new Set(["normal", "none", "auto", "0px", "0", "start", "0.25rem", "0.5rem"]);

// Phase D: a property row from the element-schema catalog.
interface SchemaProperty {
  id: number;
  property_name: string;
  property_type: string; // intrinsic | extrinsic
  control_type: string; // slider | palette | toggle | button-group | type-scale | inline-text
  default_value: string | null;
  options: { value: string; label: string }[] | null;
  is_visible: boolean;
}

export function InspectorPanel() {
  const { selected, requestChange, resetProperty, pageSlug, draftChanges, redo } = useOverlay();
  const [staleOverrides, setStaleOverrides] = useState<any[]>([]);
  const [schemaMap, setSchemaMap] = useState<Record<string, SchemaProperty[]>>({});

  // Fetch the schema map once (cached for the panel's lifetime).
  useEffect(() => {
    api.elementSchemas.all().then(setSchemaMap).catch(() => setSchemaMap({}));
  }, []);

  // Fetch overrides for the current page to surface stale ones.
  useEffect(() => {
    if (!pageSlug) return;
    api.overrides.list(pageSlug).then((data) => {
      setStaleOverrides(data.filter((o) => o.is_stale));
    }).catch(() => setStaleOverrides([]));
  }, [pageSlug]);

  const selectedStale = selected ? staleOverrides.filter((o) => o.element_path === selected.path) : [];

  const shorthand = (p: string) => SHORTHAND_LONGHAND[p] || p;

  /** The source for a property's value/changes: the block's text element for
   *  text props (when one is identified and differs from the block), else the
   *  block itself (covers a Button, which is its own text). */
  const sourceFor = (property: string) => {
    const te = selected?.textElement;
    return TEXT_PROPS.has(property) && te ? te : selected!;
  };

  /** Request a change. `value` is the theme token NAME (override identity);
   *  we translate it to the CSS the browser sees (`appliedValue`) — var(--color-…)
   *  for colors, var(--text-…) for sizes, calc(var(--spacing) * N) for spacing,
   *  var(--radius-…) for corners, the font's family string for fonts. Routes to
   *  the text element's path for text props, the block's path otherwise. */
  const handleChange = async (property: string, value: string) => {
    if (!selected) return;
    let appliedValue: string | undefined;
    if (COLOR_PROPS.has(property)) {
      appliedValue = `var(--color-${value})`;
    } else if (property === "font-family") {
      appliedValue = (await fontFamilyCSS(value)) ?? value;
    } else if (property === "font-size") {
      appliedValue = `var(--text-${value})`;
    } else if (property === "padding" || property === "gap") {
      appliedValue = `calc(var(--spacing) * ${value})`;
    } else if (property === "border-radius") {
      appliedValue = `var(--radius-${value})`;
    }
    const src = sourceFor(property);
    const oldValue = src.appliedTokens?.[property] || src.computedStyles?.[shorthand(property)] || "";
    requestChange(src.path, property, oldValue, value, selected.label, appliedValue);
  };

  /** Send undo to the iframe. */
  const sendUndo = () => {
    const iframe = document.querySelector("iframe");
    if (iframe && iframe.contentWindow) iframe.contentWindow.postMessage({ type: "overlay:undo" }, "*");
  };

  /** Reset a property to its theme default (remove the inline override). Routes
   *  to the text element's path for text props. */
  const sendReset = (property: string) => {
    if (!selected) return;
    resetProperty(sourceFor(property).path, property);
  };

  /** The value to show a control: the applied token NAME when known (so the
   *  swatch/option highlights), else the raw computed value. */
  const displayValue = (property: string): string => {
    const src = sourceFor(property);
    const applied = src.appliedTokens?.[property];
    if (applied) return applied;
    return src.computedStyles?.[shorthand(property)] || "";
  };

  /** Render the right control for a property. */
  const renderControl = (propertyName: string) => {
    const config = PROPERTY_CONFIG[propertyName];
    if (!config) return null;
    const value = displayValue(propertyName);
    const onChange = (v: string) => handleChange(propertyName, v);
    switch (config.control) {
      case "slider": return <SliderWithStops value={value} onChange={onChange} stops={propertyName === "border-radius" ? RADIUS_STOPS : undefined} />;
      case "palette": return <PaletteColorPicker value={value} onChange={onChange} />;
      case "toggle":
        return <Toggle value={value} onChange={onChange} onValue={config.onValue!} offValue={config.offValue!} />;
      case "button-group": return <ButtonGroup value={value} onChange={onChange} options={config.options!} />;
      case "type-scale": return <TypeScaleButtons value={value} onChange={onChange} />;
      case "font-family": return <FontFamilyPicker value={value} onChange={onChange} />;
      default: return null;
    }
  };

  /** Render a control for a SCHEMA-defined property (control_type from the catalog). */
  const renderSchemaControl = (prop: SchemaProperty) => {
    const value = displayValue(prop.property_name);
    const onChange = (v: string) => handleChange(prop.property_name, v);
    switch (prop.control_type) {
      case "slider": return <SliderWithStops value={value} onChange={onChange} stops={prop.property_name === "border-radius" ? RADIUS_STOPS : undefined} />;
      case "palette": return <PaletteColorPicker value={value} onChange={onChange} />;
      case "toggle":
        return <Toggle value={value} onChange={onChange} onValue={prop.options?.[0]?.value || "true"} offValue={prop.options?.[1]?.value || "false"} />;
      case "button-group": return <ButtonGroup value={value} onChange={onChange} options={prop.options || []} />;
      case "type-scale": return <TypeScaleButtons value={value} onChange={onChange} />;
      case "font-family":
      case "inline-text":
        // font-family from the catalog uses the font picker too.
        return <FontFamilyPicker value={value} onChange={onChange} />;
      default: return null; // unknown control — show nothing (no raw dump)
    }
  };

  /** Whether a property currently has a local override (to show a reset button). */
  const isOverridden = (property: string) => {
    if (!selected) return false;
    const src = sourceFor(property);
    if (src.appliedTokens?.[property]) return true;
    return draftChanges.some((c) => c.elementPath === src.path && c.property === property);
  };

  const componentType = selected?.componentType || null;
  const schemaProps: SchemaProperty[] = componentType
    ? (schemaMap[componentType] || []).filter((p) => p.is_visible)
    : [];
  const hasSchema = schemaProps.length > 0;

  if (!selected) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <MousePointer2 className="w-8 h-8 text-stone-700 mx-auto mb-3" />
          <p className="text-sm text-stone-400 font-serif">
            Click any element on the page to customize it.
          </p>
          <p className="text-xs text-stone-400 mt-2 font-serif">
            Double-click text to edit it. Esc to go up. Ctrl+Z to undo.
          </p>
        </div>
      </div>
    );
  }

  const isText = ["h1", "h2", "h3", "h4", "h5", "h6", "p", "span", "a", "button", "label", "li", "strong", "em", "code", "small"].includes(selected.tagName);
  // A Text section shows whenever the block has an identified text element OR
  // the block itself is a text tag (e.g. a Button).
  const hasText = !!selected.textElement || isText;
  const textContent = selected.textElement?.textContent ?? selected.textContent ?? "";

  // Schema-mode groups (when a curated schema exists for this component type).
  const schemaGroups = PROPERTY_GROUPS.map((g) => ({
    label: g.label,
    props: schemaProps.filter((p) => g.properties.includes(p.property_name)),
  })).filter((g) => g.props.length > 0);
  const schemaLeftover = schemaProps.filter((p) => !PROPERTY_GROUPS.flatMap((g) => g.properties).includes(p.property_name) && !TEXT_PROPS.has(p.property_name));
  const allSchemaGroups = schemaLeftover.length ? [...schemaGroups, { label: "Other", props: schemaLeftover }] : schemaGroups;

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* ── Breadcrumb ──────────────────────────────────── */}
      <div className="shrink-0 px-3 py-2.5 border-b border-stone-800 bg-stone-900/50">
        <div className="flex items-center gap-1 flex-wrap text-xs">
          {selected.hierarchy.map((item, i) => (
            <span key={item.path} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="w-3 h-3 text-stone-600" aria-hidden="true" />}
              <button
                onClick={() => {
                  const iframe = document.querySelector("iframe");
                  if (iframe && iframe.contentWindow) {
                    iframe.contentWindow.postMessage({ type: "overlay:select-path", path: item.path }, "*");
                  }
                }}
                className="font-mono text-stone-400 hover:text-primary-300 transition rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
              >
                {item.label}
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* ── Element header + undo ───────────────────────── */}
      <div className="shrink-0 px-4 py-3 border-b border-stone-800 flex items-center justify-between">
        <div>
          <code className="text-sm font-mono text-primary-300">{selected.label}</code>
          <p className="text-xs text-stone-400 mt-0.5">
            {selected.componentType ? `${selected.componentType} component` : `${selected.tagName} element`}
          </p>
        </div>
        <div className="flex items-center gap-1">
          <Tooltip content="Undo (Ctrl+Z)" side="left">
            <button
              onClick={sendUndo}
              aria-label="Undo"
              className="flex items-center justify-center p-1.5 rounded-md text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
            >
              <Undo2 className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </Tooltip>
          <Tooltip content="Redo (Ctrl+Shift+Z)" side="left">
            <button
              onClick={redo}
              aria-label="Redo"
              className="flex items-center justify-center p-1.5 rounded-md text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
            >
              <Redo2 className="w-3.5 h-3.5" aria-hidden="true" />
            </button>
          </Tooltip>
        </div>
      </div>

      {/* ── Stale-override warning ──────────────────────── */}
      {selectedStale.length > 0 && (
        <div className="shrink-0 px-4 py-2 border-b border-amber-800/40 bg-amber-950/20">
          <div className="flex items-center gap-2 text-xs text-amber-400">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" aria-hidden="true" />
            <span>
              {selectedStale.length} override{selectedStale.length !== 1 ? "s" : ""} on this element may be stale (the default changed).{" "}
              <a
                href="/studio/overrides"
                target="_blank"
                rel="noopener"
                className="font-medium hover:underline hover:text-amber-300 rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-amber-500/40"
              >
                Review in the dashboard →
              </a>
            </span>
          </div>
        </div>
      )}

      {/* ── Properties ─────────────────────────────────── */}
      <div className="flex-1 overflow-y-auto">
        {/* Content — live mirror of the block's text. Editable when the text
            has a copy key (data-rl-text); read-only for computed values. */}
        {hasText && (
          <div className="border-b border-stone-800/50">
            <p className="px-4 pt-3 pb-1 text-xs uppercase tracking-wider text-stone-400 font-semibold">Content</p>
            <div className="px-4 pb-3">
              {selected.copyKey ? (
                <InlineTextEditor value={textContent} editing={selected.editing} onChange={() => {}} />
              ) : (
                <div className="rounded-md border border-stone-800 bg-stone-900 px-2 py-1.5">
                  <p className="text-sm font-serif text-stone-300 whitespace-pre-wrap break-words min-h-[1.25rem]">
                    {textContent || <span className="text-stone-400 italic">empty</span>}
                  </p>
                  <p className="mt-1.5 text-xs font-mono text-stone-400">
                    Computed value — not editable.
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Text — font / size / weight / color of the block's text (or the
            block itself when it's a text tag like a Button). Reads from / applies
            to the text element via sourceFor()). */}
        {hasText && (() => {
          const props = TEXT_GROUP
            .filter((p) => PROPERTY_CONFIG[p])
            .map((p) => ({ name: p, value: displayValue(p) }))
            .filter((p) => p.value && !BORING_VALUES.has(p.value));
          if (props.length === 0) return null;
          return (
            <CollapsibleSection title="Text" storageKey="rl-inspector-text-open">
              {props.map((prop) => (
                <div key={prop.name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs text-stone-400 font-mono">{prop.name}</p>
                    {isOverridden(prop.name) && (
                      <ResetButton property={prop.name} onClick={() => sendReset(prop.name)} />
                    )}
                  </div>
                  {renderControl(prop.name)}
                </div>
              ))}
            </CollapsibleSection>
          );
        })()}

        {/* Block — container properties (background, border, spacing, corners).
            Schema-driven when a curated schema exists; else a constrained-
            controls fallback. No raw CSS dump. */}
        {hasSchema ? (
          allSchemaGroups.map((group) => (
            <CollapsibleSection key={group.label} title={group.label} storageKey={`rl-inspector-schema-${group.label}`}>
              {group.props.map((prop) => (
                <div key={prop.property_name}>
                  <div className="flex items-center justify-between mb-1.5">
                    <p className="text-xs text-stone-400 font-mono">{prop.property_name}</p>
                    {isOverridden(prop.property_name) && (
                      <ResetButton property={prop.property_name} onClick={() => sendReset(prop.property_name)} />
                    )}
                  </div>
                  {renderSchemaControl(prop)}
                </div>
              ))}
            </CollapsibleSection>
          ))
        ) : (
          <>
            {componentType && (
              <div className="px-4 py-2 border-b border-stone-800/50 bg-stone-900/30">
                <p className="text-xs text-stone-400 font-serif">
                  No curated schema for <code className="text-stone-300">{componentType}</code>. Showing theme controls on the current values.
                </p>
              </div>
            )}
            {PROPERTY_GROUPS.map((group) => {
              const props = group.properties
                .filter((p) => PROPERTY_CONFIG[p])
                .map((p) => ({ name: p, value: displayValue(p) }))
                .filter((p) => p.value && !BORING_VALUES.has(p.value));
              if (props.length === 0) return null;
              return (
                <CollapsibleSection key={group.label} title={group.label} storageKey={`rl-inspector-fallback-${group.label}`}>
                  {props.map((prop) => (
                    <div key={prop.name}>
                      <div className="flex items-center justify-between mb-1.5">
                        <p className="text-xs text-stone-400 font-mono">{prop.name}</p>
                        {isOverridden(prop.name) && (
                          <ResetButton property={prop.name} onClick={() => sendReset(prop.name)} />
                        )}
                      </div>
                      {renderControl(prop.name)}
                    </div>
                  ))}
                </CollapsibleSection>
              );
            })}
          </>
        )}
      </div>

      {/* ── Footer (dismissible hint) ────────────────────── */}
      <DismissibleFooter />
    </div>
  );
}

/** Dismissible footer hint — shows the keyboard/model cheat sheet until the
 *  user dismisses it. Persists dismissal in localStorage. */
function DismissibleFooter() {
  const [dismissed, setDismissed] = useState(false);
  useEffect(() => {
    try {
      setDismissed(localStorage.getItem("rl-inspector-hint-dismissed") === "true");
    } catch {}
  }, []);
  if (dismissed) return null;
  return (
    <div className="shrink-0 px-4 py-2.5 border-t border-stone-800 bg-stone-900/50 flex items-center gap-2">
      <p className="flex-1 text-xs text-stone-400 font-serif text-center">
        Pick from the theme. Changes preview live; dark mode follows. Undo: Ctrl+Z.
      </p>
      <button
        onClick={() => {
          setDismissed(true);
          try { localStorage.setItem("rl-inspector-hint-dismissed", "true"); } catch {}
        }}
        aria-label="Dismiss hint"
        className="shrink-0 p-0.5 rounded-sm text-stone-500 hover:text-stone-300 transition"
      >
        <X className="w-3 h-3" />
      </button>
    </div>
  );
}
