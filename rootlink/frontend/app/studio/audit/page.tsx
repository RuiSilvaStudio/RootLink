"use client";

/**
 * Content Studio — Visual Audit page.
 *
 * Shows all 49 component types as a grid of hand-crafted CSS previews.
 * Each card shows the preview, name, group label, and clickable links to
 * the live pages where the component is used. Filterable by group.
 * Click any preview to open a full-size modal (1:1 scale, no clipping).
 *
 * Purpose: identify components that look the same, compare them live,
 * then decide which to merge and which to keep separate.
 */

import { useState } from "react";
import { ExternalLink, AlertCircle } from "lucide-react";
import { Tooltip, Modal } from "@/components/ui";
import { ComponentPreview } from "../catalog/ComponentPreview";
import {
  COMPONENT_GROUPS,
  GROUP_COLORS,
  GROUP_ORDER,
  COMPONENT_ROUTES,
} from "../component-config";

export default function VisualAuditPage() {
  const [filter, setFilter] = useState<string>("All");
  const [modalType, setModalType] = useState<string | null>(null);

  const allTypes = Object.keys(COMPONENT_GROUPS).sort((a, b) => a.localeCompare(b));
  const types = filter === "All" ? allTypes : allTypes.filter((t) => COMPONENT_GROUPS[t] === filter);

  const counts: Record<string, number> = { All: allTypes.length };
  for (const g of GROUP_ORDER) {
    counts[g] = allTypes.filter((t) => COMPONENT_GROUPS[t] === g).length;
  }

  const modalRoutes = modalType ? COMPONENT_ROUTES[modalType] : null;
  const modalGroup = modalType ? (COMPONENT_GROUPS[modalType] || "") : "";
  const modalIsUnused = modalRoutes === "unused";
  const modalIsSiteWide = modalRoutes === "site-wide";

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 px-6 py-4 border-b border-primary-200/40 dark:border-stone-800">
        <h1 className="font-display text-xl font-semibold text-stone-800 dark:text-stone-100">Visual Audit</h1>
        <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
          Compare components visually, see where they&apos;re used, identify duplicates to merge or keep separate.
        </p>
      </div>

      {/* Filter bar */}
      <div className="shrink-0 flex items-center gap-2 px-6 py-3 border-b border-primary-200/40 dark:border-stone-800 overflow-x-auto">
        {["All", ...GROUP_ORDER].map((g) => (
          <button key={g} onClick={() => setFilter(g)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-medium transition shrink-0 ${
              filter === g ? "bg-primary-600 text-cream" : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700"
            }`}>
            {g !== "All" && <span className={`w-2 h-2 rounded-full ${GROUP_COLORS[g] || "bg-stone-400"}`} />}
            {g} ({counts[g] || 0})
          </button>
        ))}
      </div>

      {/* Grid */}
      <div className="flex-1 overflow-y-auto p-6">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-6xl">
          {types.map((type) => {
            const group = COMPONENT_GROUPS[type] || "";
            const dot = GROUP_COLORS[group] || "bg-stone-400";
            const routes = COMPONENT_ROUTES[type];
            const isUnused = routes === "unused";
            const isSiteWide = routes === "site-wide";
            return (
              <div key={type} className="rounded-xl border border-stone-200/60 dark:border-stone-800 bg-white dark:bg-stone-900/50 overflow-hidden flex flex-col">
                {/* Preview — clickable */}
                <Tooltip content="Click to view full size">
                  <button
                    onClick={() => setModalType(type)}
                    aria-label={`View ${type} full size`}
                    className="w-full border-b border-stone-200/40 dark:border-stone-800 cursor-zoom-in hover:bg-stone-50 dark:hover:bg-stone-900/70 transition"
                  >
                    <div className="[&>div:first-child]:mb-0 [&>div:first-child]:rounded-none [&>div:first-child]:border-0 [&>div:first-child]:h-40">
                      <ComponentPreview type={type} />
                    </div>
                  </button>
                </Tooltip>

                {/* Info */}
                <div className="p-3 flex-1 flex flex-col gap-2">
                  <div className="flex items-center gap-2">
                    <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                    <span className="text-sm font-medium text-stone-800 dark:text-stone-100 truncate">{type}</span>
                    {isUnused && (
                      <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-100/60 dark:bg-amber-950/30 px-1.5 py-0.5 rounded-full">
                        <AlertCircle className="w-3 h-3" /> unused
                      </span>
                    )}
                  </div>
                  {group && <div className="text-xs text-stone-400 -mt-1">{group}</div>}
                  <div className="flex flex-wrap gap-1.5 mt-auto pt-1">
                    {isUnused ? (
                      <span className="text-xs text-stone-400 italic">Not rendered on any page</span>
                    ) : isSiteWide ? (
                      <span className="text-xs text-stone-500 dark:text-stone-400">Used on most pages</span>
                    ) : routes && Array.isArray(routes) ? (
                      routes.map((r) => (
                        <a key={r.href} href={r.href} target="_blank" rel="noopener noreferrer"
                          className="flex items-center gap-1 text-xs text-primary-600 dark:text-primary-300 hover:underline">
                          {r.label} <ExternalLink className="w-2.5 h-2.5" />
                        </a>
                      ))
                    ) : null}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Full-size modal (accessible: focus trap, Esc, focus restore, aria) */}
      <Modal
        open={!!modalType}
        onClose={() => setModalType(null)}
        title={modalType || "Preview"}
        widthClassName="max-w-3xl"
      >
        {modalType && (
          <>
            {/* Group label + route links */}
            <div className="flex items-center gap-3 mb-3">
              <span className={`w-2.5 h-2.5 rounded-full ${GROUP_COLORS[modalGroup] || "bg-stone-400"}`} />
              <span className="text-xs text-stone-400">{modalGroup}</span>
              {modalIsUnused && (
                <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-100/60 dark:bg-amber-950/30 px-1.5 py-0.5 rounded-full">
                  <AlertCircle className="w-3 h-3" /> unused
                </span>
              )}
            </div>

            {/* Large preview at 1:1 scale */}
            <ComponentPreview type={modalType} large />

            {/* Route links */}
            <div className="flex flex-wrap gap-2 mt-4">
              {modalIsUnused ? (
                <span className="text-xs text-stone-400 italic">Not rendered on any page</span>
              ) : modalIsSiteWide ? (
                <span className="text-xs text-stone-500 dark:text-stone-400">Used on most pages</span>
              ) : modalRoutes && Array.isArray(modalRoutes) ? (
                modalRoutes.map((r) => (
                  <a key={r.href} href={r.href} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-300 hover:bg-primary-100 dark:hover:bg-primary-900/50 transition">
                    {r.label} <ExternalLink className="w-3 h-3" />
                  </a>
                ))
              ) : null}
            </div>
          </>
        )}
      </Modal>
    </div>
  );
}
