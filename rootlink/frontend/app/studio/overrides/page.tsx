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
import { AlertTriangle, RotateCcw, Filter, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button, Tooltip, EmptyState } from "@/components/ui";
import { ListSkeleton } from "@/components/ui/LoadingSkeleton";
import { LoadError } from "@/components/studio/LoadError";

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
  const [overrides, setOverrides] = useState<OverrideRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [filter, setFilter] = useState<"all" | "stale" | "active">("all");

  const fetch = useCallback(async () => {
    try { setOverrides(await api.overrides.all()); setLoadError(false); } catch { setLoadError(true); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const revert = async (id: number) => {
    if (!window.confirm("Revert this override? The element returns to its theme default.")) return;
    try { await api.overrides.remove(id); await fetch(); toast.info("Override reverted"); } catch (e: any) { toast.error(e?.message); }
  };
  const markStale = async (id: number) => {
    try { await api.overrides.markStale(id); await fetch(); } catch (e: any) { toast.error(e?.message); }
  };

  if (loading) {
    return (
      <div className="p-4 lg:p-6 min-h-[60vh]">
        <div className="max-w-4xl">
          <ListSkeleton rows={6} />
        </div>
      </div>
    );
  }

  if (loadError) return <div className="p-6 max-w-xl"><LoadError onRetry={fetch} /></div>;

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
          <EmptyState
            icon={<CheckCircle2 className="w-7 h-7 text-rust-500" />}
            title={filter !== "all" ? `No ${filter} overrides` : "No overrides"}
            message={filter !== "all" ? `No overrides are currently marked as ${filter}.` : "The site matches the theme defaults. Every element uses its theme-defined value."}
          />
        ) : (
          <div className="max-w-4xl space-y-2">
            {filtered.map((row) => (
              <div key={row.id} className={`flex items-center gap-3 p-3 rounded-lg border ${row.is_stale ? "border-amber-300/60 dark:border-amber-800/40 bg-amber-50/30 dark:bg-amber-950/10" : "border-stone-200/60 dark:border-stone-800"}`}>
                {row.is_stale && <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-xs font-mono text-primary-600 dark:text-primary-400">{row.page_slug}</span>
                    <span className="text-stone-300">/</span>
                    <code className="text-xs font-mono text-stone-500 truncate">{row.element_path}</code>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <code className="text-xs text-stone-600 dark:text-stone-300 font-mono">{row.property}</code>
                    <span className="text-stone-400 text-xs">:</span>
                    <code className="text-xs text-stone-400 font-mono line-through">{row.old_value}</code>
                    <span className="text-stone-400 text-xs">→</span>
                    <code className="text-xs text-rust-600 dark:text-rust-400 font-mono">{row.new_value}</code>
                    {row.is_stale && <span className="text-xs uppercase text-amber-600 dark:text-amber-400 font-medium">Stale</span>}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <Tooltip content="Mark this override as stale">
                    <Button size="xs" variant="ghost" onClick={() => markStale(row.id)}>Stale</Button>
                  </Tooltip>
                  <Tooltip content="Revert to theme default">
                    <Button size="xs" variant="danger" onClick={() => revert(row.id)} aria-label="Revert override">
                      <RotateCcw className="w-3 h-3" />
                    </Button>
                  </Tooltip>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
