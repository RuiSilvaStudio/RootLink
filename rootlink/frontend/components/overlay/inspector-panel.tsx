"use client";

/**
 * Content Studio — Inspector Panel.
 *
 * Spec: docs/content-studio/CONTENT_STUDIO.md §3.2 (inspector), §4 (constrained
 * controls), §5 (element property schema).
 *
 * Phase 1: read-only — shows the selected element's computed styles, grouped
 * by category, plus the breadcrumb hierarchy for navigation.
 * Phase 2: replaces the read-only values with constrained controls (sliders,
 * palette pickers, toggles, button groups).
 * Phase 3: adds override guardrail (deviation prompt + badge + log + revert).
 */

import { useOverlay, type SelectedElement } from "./overlay-provider";
import { MousePointer2, ChevronRight } from "lucide-react";

// ── Property groups (how computed styles are organized) ────────
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
    properties: ["display", "flex-direction", "justify-content", "align-items", "gap", "width", "height", "max-width", "max-height"],
  },
  {
    label: "Effects",
    properties: ["opacity", "box-shadow", "z-index"],
  },
];

export function InspectorPanel() {
  const { selected, select } = useOverlay();

  if (!selected) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <MousePointer2 className="w-8 h-8 text-stone-700 mx-auto mb-3" />
          <p className="text-sm text-stone-500 font-serif">
            Click any element on the page to inspect its properties.
          </p>
          <p className="text-xs text-stone-600 mt-2 font-serif">
            Double-click to select the parent. Esc to go up.
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
                  // Tell the iframe to select this ancestor
                  window.postMessage({
                    type: "overlay:select-path",
                    path: item.path,
                  }, "*");
                }}
                className="font-mono text-stone-400 hover:text-primary-300 transition"
              >
                {item.label}
              </button>
            </span>
          ))}
        </div>
      </div>

      {/* ── Element header ──────────────────────────────── */}
      <div className="shrink-0 px-4 py-3 border-b border-stone-800">
        <code className="text-sm font-mono text-primary-300">{selected.label}</code>
        <p className="text-xs text-stone-500 mt-0.5">{selected.tagName} element</p>
      </div>

      {/* ── Computed styles (read-only, grouped) ────────── */}
      <div className="flex-1 overflow-y-auto">
        {PROPERTY_GROUPS.map((group) => {
          const props = group.properties
            .map((p) => ({ name: p, value: selected.computedStyles[p] }))
            .filter((p) => p.value && p.value !== "normal" && p.value !== "none" && p.value !== "auto" && p.value !== "0px" && p.value !== "0" && p.value !== "static" && p.value !== "start");
          if (props.length === 0) return null;
          return (
            <div key={group.label} className="border-b border-stone-800/50">
              <p className="px-4 pt-3 pb-1 text-[10px] uppercase tracking-wider text-stone-500 font-semibold">
                {group.label}
              </p>
              <div className="px-4 pb-3 space-y-1">
                {props.map((prop) => (
                  <div key={prop.name} className="flex items-center justify-between gap-3 text-xs">
                    <span className="text-stone-500 font-mono shrink-0">{prop.name}</span>
                    <span className="text-stone-300 font-mono text-right truncate">{prop.value}</span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* ── Footer (Phase 1 hint) ───────────────────────── */}
      <div className="shrink-0 px-4 py-2.5 border-t border-stone-800 bg-stone-900/50">
        <p className="text-[10px] text-stone-600 font-serif text-center">
          Phase 1: read-only inspection. Editing controls arrive in Phase 2.
        </p>
      </div>
    </div>
  );
}
