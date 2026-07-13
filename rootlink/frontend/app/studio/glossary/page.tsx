"use client";

/**
 * Content Studio — Glossary (Phase 3).
 *
 * Brand and domain term management for the translation pipeline.
 * Brand terms (is_brand=true) pass through MT untranslated ("RootLink" →
 * "RootLink" in every language). Domain terms use the human-chosen target
 * rendering instead of whatever MT produces.
 *
 * Forward-only: applies to new auto-translations, not retroactively.
 * Spec: docs/content-platform/ (Phase 3 — Glossary).
 */

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, BookOpen } from "lucide-react";
import { toast } from "sonner";
import { Button, EmptyState, Input, Toggle, Tooltip } from "@/components/ui";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";
import { api, type GlossaryEntry } from "@/lib/api";
import { LoadError } from "@/components/studio/LoadError";

export default function GlossaryPage() {
  const [terms, setTerms] = useState<GlossaryEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState("");
  const [adding, setAdding] = useState(false);
  const [newTerm, setNewTerm] = useState({ term_source: "", term_target: "", is_brand: false, notes: "" });

  const fetchTerms = useCallback(async () => {
    try {
      setTerms(await api.glossary.list());
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTerms(); }, [fetchTerms]);

  const handleAdd = async () => {
    if (!newTerm.term_source || !newTerm.term_target) {
      toast.error("Source and target terms are required");
      return;
    }
    setAdding(true);
    try {
      const entry: GlossaryEntry = {
        term_source: newTerm.term_source,
        source_locale: "pt",
        target_locale: "en",
        term_target: newTerm.is_brand ? newTerm.term_source : newTerm.term_target,
        is_brand: newTerm.is_brand,
        notes: newTerm.notes || null,
      };
      await api.glossary.upsert(entry);
      setNewTerm({ term_source: "", term_target: "", is_brand: false, notes: "" });
      await fetchTerms();
      toast.success("Glossary term added");
    } catch (e: any) {
      toast.error(e?.message || "Failed to add term");
    } finally {
      setAdding(false);
    }
  };

  const handleDelete = async (term: GlossaryEntry) => {
    if (!window.confirm(`Delete glossary term "${term.term_source}"?`)) return;
    try {
      await api.glossary.remove(term.term_source, term.source_locale, term.target_locale);
      await fetchTerms();
      toast.success("Term deleted");
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete");
    }
  };

  const filtered = terms.filter((t) =>
    !search.trim() ||
    t.term_source.toLowerCase().includes(search.toLowerCase()) ||
    t.term_target.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return (
      <div className="p-6 max-w-3xl space-y-4">
        <CardSkeleton />
        <CardSkeleton />
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-6 max-w-xl">
        <LoadError onRetry={fetchTerms} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 px-6 py-4 border-b border-primary-200/40 dark:border-stone-800">
        <h1 className="font-display text-xl font-semibold text-stone-800 dark:text-stone-100">
          Glossary
        </h1>
        <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
          Brand names (never translated) and domain terms (fixed translation) — applied consistently to every auto-translate
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        {/* Search */}
        <div className="relative mb-4 max-w-md">
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search terms…"
            aria-label="Search glossary"
          />
        </div>

        {/* Add new term */}
        <div className="mb-6 p-4 rounded-xl border border-primary-200/60 dark:border-stone-700 bg-white dark:bg-stone-900">
          <p className="text-xs uppercase tracking-wider text-stone-400 font-medium mb-3">Add term</p>
          <div className="flex flex-wrap items-end gap-3">
            <div className="flex-1 min-w-[150px]">
              <label className="block text-[11px] font-medium text-stone-400 uppercase mb-1">Source (PT)</label>
              <Input
                type="text"
                value={newTerm.term_source}
                onChange={(e) => setNewTerm({ ...newTerm, term_source: e.target.value })}
                placeholder="e.g. RootLink, compostagem"
                aria-label="Source term"
              />
            </div>
            <div className="flex-1 min-w-[150px]">
              <label className="block text-[11px] font-medium text-stone-400 uppercase mb-1">Target (EN)</label>
              <Input
                type="text"
                value={newTerm.is_brand ? newTerm.term_source : newTerm.term_target}
                onChange={(e) => setNewTerm({ ...newTerm, term_target: e.target.value })}
                placeholder={newTerm.is_brand ? "Same as source (brand)" : "e.g. RootLink, composting"}
                disabled={newTerm.is_brand}
                aria-label="Target term"
              />
            </div>
            <div className="flex items-center gap-2">
              <Toggle
                label="Brand"
                checked={newTerm.is_brand}
                onChange={(e) => {
                  const v = e.target.checked;
                  setNewTerm({ ...newTerm, is_brand: v, term_target: v ? newTerm.term_source : "" });
                }}
              />
              <Tooltip content="Brand terms pass through MT untranslated (e.g. 'RootLink' stays 'RootLink')">
                <span className="text-xs text-stone-500">Brand</span>
              </Tooltip>
            </div>
            <Button size="sm" onClick={handleAdd} loading={adding} disabled={adding || !newTerm.term_source}>
              {!adding && <Plus className="w-3.5 h-3.5" />}
              Add
            </Button>
          </div>
        </div>

        {/* Terms list */}
        {filtered.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="w-8 h-8" />}
            title={terms.length === 0 ? "No glossary terms yet" : "No matches"}
            message={terms.length === 0 ? "Add brand names and domain terms above to ensure consistent translations." : "Try a different search."}
          />
        ) : (
          <div className="space-y-2 max-w-2xl">
            {filtered.map((t) => (
              <div
                key={`${t.term_source}:${t.source_locale}:${t.target_locale}`}
                className="flex items-center gap-3 p-3 rounded-xl border border-stone-200/60 dark:border-stone-800 bg-white dark:bg-stone-900"
              >
                <div className="flex-1 grid grid-cols-3 gap-3 items-center">
                  <div>
                    <p className="text-sm text-stone-700 dark:text-stone-200">{t.term_source}</p>
                    <p className="text-[10px] text-stone-400">{t.source_locale}</p>
                  </div>
                  <div>
                    <p className="text-sm text-stone-700 dark:text-stone-200">
                      {t.is_brand ? <span className="italic text-stone-500">brand (same)</span> : t.term_target}
                    </p>
                    <p className="text-[10px] text-stone-400">{t.target_locale}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {t.is_brand && (
                      <span className="text-[10px] uppercase tracking-wide text-rust-600 bg-rust-50 dark:bg-rust-950/30 px-1.5 py-0.5 rounded">
                        Brand
                      </span>
                    )}
                    {t.notes && (
                      <Tooltip content={t.notes}>
                        <span className="text-[10px] text-stone-400">·</span>
                      </Tooltip>
                    )}
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(t)}
                  className="p-2 text-stone-400 hover:text-red-500 transition shrink-0"
                  aria-label="Delete term"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
