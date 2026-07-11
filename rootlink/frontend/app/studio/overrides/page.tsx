"use client";

/**
 * Content Studio — Override Report (Phase 6).
 *
 * Spec: docs/content-studio/CONTENT_STUDIO.md §3.1 (dashboard — override report),
 * §6 (stale-override warnings).
 *
 * Dashboard view of all deviations across the site: what's overriding what,
 * which overrides are stale (the default changed since the override was made),
 * and who made the change.
 */

import { useState, useEffect, useCallback } from "react";
import { Loader2, AlertTriangle, RotateCcw, Filter } from "lucide-react";
import { useToast } from "@/lib/toast-context";
import { api } from "@/lib/api";

interface OverrideRow {
  id: number;
  page_slug: string;
  element_path: string;
  property: string;
  old_value: string;
  new_value: string;
  is_stale: boolean;
  created_at?: string;
}

export default function OverrideReportPage() {
  const { addToast } = useToast();
  const [overrides, setOverrides] = useState<OverrideRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<"all" | "stale" | "active">("all");

  const fetch = useCallback(async () => {
    try { setOverrides(await api.overrides.all()); } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const revert = async (id: number) => {
    try { await api.overrides.remove(id); await fetch(); addToast("info", "Override reverted"); } catch (e: any) { addToast("error", e?.message); }
  };
  const markStale = async (id: number) => {
    try { await api.overrides.markStale(id); await fetch(); } catch (e: any) { addToast("error", e?.message); }
  };

  if (loading) return <div className="flex items-center justify-center h-full min-h-[60vh]"><Loader2 className="w-5 h-5 animate-spin text-stone-400" /></div>;

  const filtered = overrides.filter((o) => filter === "all" || (filter === "stale" ? o.is_stale : !o.is_stale));
  const staleCount = overrides.filter((o) => o.is_stale).length;

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 px-6 py-4 border-b border-primary-200/40 dark:border-stone-800">
        <h1 className="font-display text-xl font-semibold text-stone-800 dark:text-stone-100">Override Report</h1>
        <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">All deviations from theme defaults across the site</p>
      </div>

      <div className="shrink-0 px-6 py-3 border-b border-primary-200/30 dark:border-stone-800/50 flex items-center gap-3">
        <div className="flex gap-1 p-1 rounded-lg bg-stone-100 dark:bg-stone-800/50">
          {(["all", "active", "stale"] as const).map((f) => (
            <button key={f} onClick={() => setFilter(f)} className={`px-3 py-1 rounded-md text-xs font-medium transition capitalize ${filter === f ? "bg-white dark:bg-stone-900 text-primary-700 dark:text-primary-300 shadow-sm" : "text-stone-500 hover:text-stone-700 dark:hover:text-stone-200"}`}>
              {f} {f === "stale" && staleCount > 0 && `(${staleCount})`}
            </button>
          ))}
        </div>
        <span className="text-xs text-stone-400">{filtered.length} override{filtered.length !== 1 ? "s" : ""}</span>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        {filtered.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-sm text-stone-400 font-serif">No overrides {filter !== "all" ? `(${filter})` : ""}. The site matches the theme defaults.</p>
          </div>
        ) : (
          <div className="max-w-4xl space-y-2">
            {filtered.map((row) => (
              <div key={row.id} className={`flex items-center gap-3 p-3 rounded-lg border ${row.is_stale ? "border-amber-300/60 dark:border-amber-800/40 bg-amber-50/30 dark:bg-amber-950/10" : "border-stone-200/60 dark:border-stone-800"}`}>
                {row.is_stale && <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-primary-600 dark:text-primary-400">{row.page_slug}</span>
                    <span className="text-stone-300">/</span>
                    <code className="text-[10px] font-mono text-stone-500 truncate">{row.element_path}</code>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-xs text-stone-600 dark:text-stone-300 font-mono">{row.property}</code>
                    <span className="text-stone-400 text-xs">:</span>
                    <code className="text-xs text-stone-400 font-mono line-through">{row.old_value}</code>
                    <span className="text-stone-400 text-xs">→</span>
                    <code className="text-xs text-rust-600 dark:text-rust-400 font-mono">{row.new_value}</code>
                    {row.is_stale && <span className="text-[10px] uppercase text-amber-600 dark:text-amber-400 font-medium">Stale</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => markStale(row.id)} className="px-2 py-1 text-xs text-stone-400 hover:text-amber-500 transition" title="Mark stale">Stale</button>
                  <button onClick={() => revert(row.id)} className="flex items-center gap-1 px-2 py-1 text-xs text-stone-400 hover:text-red-500 transition" title="Revert"><RotateCcw className="w-3 h-3" /></button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
