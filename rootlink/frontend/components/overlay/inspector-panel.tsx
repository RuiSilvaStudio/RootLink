"use client";

/**
 * Content Studio — Inspector Panel (Phase 2).
 *
 * Spec: docs/content-studio/CONTENT_STUDIO.md §3.2 (inspector), §4 (constrained
 * controls), §5 (element property schema).
 *
 * Phase 2: replaces read-only computed-styles with constrained controls
 * (SliderWithStops, PaletteColorPicker, Toggle, ButtonGroup, TypeScaleButtons,
 * InlineTextEditor). Changes apply live to the iframe via postMessage.
 * Undo (Ctrl+Z) works before save.
 */

import { useOverlay, type SelectedElement } from "./overlay-provider";
import {
  SliderWithStops,
  PaletteColorPicker,
  Toggle,
  ButtonGroup,
  TypeScaleButtons,
  InlineTextEditor,
} from "./constrained-controls";
import { MousePointer2, ChevronRight, Undo2 } from "lucide-react";

// ── Property → control mapping ────────────────────────────────
// Each property knows which control to use and what options to offer.

interface PropertyConfig {
  control: "slider" | "palette" | "toggle" | "button-group" | "type-scale" | "inline-text";
  options?: { value: string; label: string }[];
  onValue?: string;
  offValue?: string;
}

const PROPERTY_CONFIG: Record<string, PropertyConfig> = {
  "font-size": { control: "type-scale" },
  "font-family": {
    control: "button-group",
    options: [
      { value: "var(--font-display)", label: "Fraunces" },
      { value: "var(--font-serif)", label: "Source Serif" },
    ],
  },
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
  "letter-spacing": { control: "slider" },
  "line-height": { control: "slider" },
  "color": { control: "palette" },
  "background-color": { control: "palette" },
  "border-color": { control: "palette" },
  "margin-top": { control: "slider" },
  "margin-right": { control: "slider" },
  "margin-bottom": { control: "slider" },
  "margin-left": { control: "slider" },
  "padding-top": { control: "slider" },
  "padding-right": { control: "slider" },
  "padding-bottom": { control: "slider" },
  "padding-left": { control: "slider" },
  "border-radius": { control: "slider" },
  "border-width": { control: "slider" },
  "border-style": {
    control: "button-group",
    options: [
      { value: "none", label: "None" },
      { value: "solid", label: "Solid" },
      { value: "dashed", label: "Dashed" },
      { value: "dotted", label: "Dotted" },
    ],
  },
  "display": {
    control: "button-group",
    options: [
      { value: "block", label: "Block" },
      { value: "flex", label: "Flex" },
      { value: "inline", label: "Inline" },
      { value: "inline-block", label: "Inline B" },
      { value: "grid", label: "Grid" },
      { value: "none", label: "None" },
    ],
  },
  "flex-direction": {
    control: "button-group",
    options: [
      { value: "row", label: "Row" },
      { value: "column", label: "Col" },
      { value: "row-reverse", label: "Row R" },
      { value: "column-reverse", label: "Col R" },
    ],
  },
  "justify-content": {
    control: "button-group",
    options: [
      { value: "flex-start", label: "Start" },
      { value: "center", label: "Center" },
      { value: "flex-end", label: "End" },
      { value: "space-between", label: "Between" },
      { value: "space-around", label: "Around" },
    ],
  },
  "align-items": {
    control: "button-group",
    options: [
      { value: "flex-start", label: "Start" },
      { value: "center", label: "Center" },
      { value: "flex-end", label: "End" },
      { value: "stretch", label: "Stretch" },
    ],
  },
  "gap": { control: "slider" },
  "opacity": { control: "slider" },
};

const PROPERTY_GROUPS: { label: string; properties: string[] }[] = [
  {
    label: "Typography",
    properties: ["font-family", "font-size", "font-weight", "font-style", "letter-spacing", "line-height", "text-align", "text-decoration"],
  },
  {
    label: "Colors",
    properties: ["color", "background-color", "border-color"],
  },
  {
    label: "Spacing",
    properties: ["margin-top", "margin-right", "margin-bottom", "margin-left", "padding-top", "padding-right", "padding-bottom", "padding-left"],
  },
  {
    label: "Border",
    properties: ["border-radius", "border-width", "border-style"],
  },
  {
    label: "Layout",
    properties: ["display", "flex-direction", "justify-content", "align-items", "gap"],
  },
  {
    label: "Effects",
    properties: ["opacity"],
  },
];

// Properties that are "boring" (default/zero/normal) and hidden to reduce clutter
const BORING_VALUES = new Set(["normal", "none", "auto", "0px", "0", "static", "start", "0.25rem", "0.5rem"]);

export function InspectorPanel() {
  const { selected, iframeUrl } = useOverlay();

  /** Send a style change to the iframe (live preview) */
  const applyStyle = (property: string, value: string) => {
    const iframe = document.querySelector("iframe");
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({ type: "overlay:apply-style", property, value }, "*");
    }
  };

  /** Send undo to the iframe */
  const sendUndo = () => {
    const iframe = document.querySelector("iframe");
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({ type: "overlay:undo" }, "*");
    }
  };

  /** Render the right control for a property */
  const renderControl = (propertyName: string, value: string) => {
    const config = PROPERTY_CONFIG[propertyName];
    if (!config) {
      // No constrained control for this property — show read-only
      return <span className="text-stone-400 font-mono text-right truncate text-xs">{value}</span>;
    }

    const commonProps = { value, onChange: (v: string) => applyStyle(propertyName, v) };

    switch (config.control) {
      case "slider":
        return <SliderWithStops {...commonProps} />;
      case "palette":
        return <PaletteColorPicker {...commonProps} />;
      case "toggle":
        return <Toggle {...commonProps} onValue={config.onValue!} offValue={config.offValue!} />;
      case "button-group":
        return <ButtonGroup {...commonProps} options={config.options!} />;
      case "type-scale":
        return <TypeScaleButtons {...commonProps} />;
      case "inline-text":
        return <InlineTextEditor {...commonProps} />;
      default:
        return <span className="text-stone-400 font-mono text-xs">{value}</span>;
    }
  };

  if (!selected) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <MousePointer2 className="w-8 h-8 text-stone-700 mx-auto mb-3" />
          <p className="text-sm text-stone-500 font-serif">
            Click any element on the page to edit its properties.
          </p>
          <p className="text-xs text-stone-600 mt-2 font-serif">
            Double-click to select the parent. Esc to go up. Ctrl+Z to undo.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* ── Breadcrumb ──────────────────────────────────── */}
      <div className="shrink-0 px-3 py-2.5 border-b border-stone-800 bg-stone-900/50">
        <div className="flex items-center gap-1 flex-wrap text-xs">
          {selected.hierarchy.map((item, i) => (
            <span key={item.path} className="flex items-center gap-1">
              {i > 0 && <ChevronRight className="w-3 h-3 text-stone-600" />}
              <button
                onClick={() => {
                  const iframe = document.querySelector("iframe");
                  if (iframe && iframe.contentWindow) {
                    iframe.contentWindow.postMessage({ type: "overlay:select-path", path: item.path }, "*");
                  }
                }}
                className="font-mono text-stone-400 hover:text-primary-300 transition"
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
          <p className="text-xs text-stone-500 mt-0.5">{selected.tagName} element</p>
        </div>
        <button
          onClick={sendUndo}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-xs text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition"
          title="Undo (Ctrl+Z)"
        >
          <Undo2 className="w-3.5 h-3.5" /> Undo
        </button>
      </div>

      {/* ── Editable properties (constrained controls) ──── */}
      <div className="flex-1 overflow-y-auto">
        {/* Content section — inline text editing */}
        {selected.tagName === "h1" || selected.tagName === "h2" || selected.tagName === "h3" ||
         selected.tagName === "h4" || selected.tagName === "h5" || selected.tagName === "h6" ||
         selected.tagName === "p" || selected.tagName === "span" || selected.tagName === "a" ||
         selected.tagName === "button" || selected.tagName === "label" ? (
          <div className="border-b border-stone-800/50">
            <p className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-wider text-stone-500 font-semibold">Content</p>
            <div className="px-4 pb-3">
              <InlineTextEditor
                value={selected.computedStyles["font-size"] || ""}
                onChange={() => {}}
              />
            </div>
          </div>
        ) : null}

        {PROPERTY_GROUPS.map((group) => {
          const props = group.properties
            .map((p) => ({ name: p, value: selected.computedStyles[p] }))
            .filter((p) => p.value && !BORING_VALUES.has(p.value));
          if (props.length === 0) return null;
          return (
            <div key={group.label} className="border-b border-stone-800/50">
              <p className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-wider text-stone-500 font-semibold">
                {group.label}
              </p>
              <div className="px-4 pb-3 space-y-2.5">
                {props.map((prop) => (
                  <div key={prop.name}>
                    <p className="text-xs text-stone-500 font-mono mb-1.5">{prop.name}</p>
                    {renderControl(prop.name, prop.value)}
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Footer ──────────────────────────────────────── */}
      <div className="shrink-0 px-4 py-2.5 border-t border-stone-800 bg-stone-900/50">
        <p className="text-[10px] text-stone-600 font-serif text-center">
          Changes preview live. Undo: Ctrl+Z. Save & publish in Phase 3.
        </p>
      </div>
    </div>
  );
}
