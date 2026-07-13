"use client";

/**
 * Content Studio — Content/Copy module.
 *
 * A CMS UI over the existing /api/copy override layer: a first-class
 * surface for editing all interface text (PT + EN) — namespace-tree
 * navigation + per-locale editor + live "modified" indicators + per-key
 * save/revert + bulk "Save all".
 *
 * Spec: docs/content-studio/CONTENT_STUDIO.md §5 (content/copy model).
 *
 * Data flow:
 *   1. Static messages (messages/{en,pt}.json) = defaults — imported directly.
 *   2. api.copy.all() = DB overrides — fetched on mount.
 *   3. User edits → draft → api.copy.set (save) / api.copy.revert (revert).
 *
 * Responsive: two-column on desktop (namespace list | key editors),
 * single-column on mobile (select for namespace + key editors below).
 */

import { useState, useMemo, useEffect, useCallback, useRef } from "react";
import { Search, Check, RotateCcw, AlertCircle, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import enMessages from "@/messages/en.json";
import ptMessages from "@/messages/pt.json";
import { Button, Input, Textarea, Tooltip } from "@/components/ui";
import { ListSkeleton, CardSkeleton, TextSkeleton } from "@/components/ui/LoadingSkeleton";
import { ResizableSplit } from "@/components/ui/ResizableSplit";
import { LoadError } from "@/components/studio/LoadError";
import { useDirtyGuard } from "@/lib/use-dirty-guard";

type Overrides = Record<string, string>;
interface OverrideEntry {
  key: string;
  locale: string;
  value: string;
}

/** Flatten a nested JSON object into dotted-key → string pairs. */
function flatten(obj: Record<string, unknown>, prefix = ""): Record<string, string> {
  const result: Record<string, string> = {};
  for (const [key, val] of Object.entries(obj)) {
    const fullKey = prefix ? `${prefix}.${key}` : key;
    if (val && typeof val === "object" && !Array.isArray(val)) {
      Object.assign(result, flatten(val as Record<string, unknown>, fullKey));
    } else if (typeof val === "string") {
      result[fullKey] = val;
    }
  }
  return result;
}

const EN_DEFAULTS = flatten(enMessages as Record<string, unknown>);
const PT_DEFAULTS = flatten(ptMessages as Record<string, unknown>);

/** Group top-level namespaces into domains for the navigation tree. */
const NAMESPACE_DOMAINS: { label: string; prefixes: string[] }[] = [
  { label: "Site chrome", prefixes: ["home", "nav", "common", "editor"] },
  { label: "Pages", prefixes: ["events", "groups", "learning", "marketplace", "feed", "search", "donate", "leaderboard", "ranking", "notifications", "messages", "network", "plants", "tools", "waste", "submit", "content", "create"] },
  { label: "Profile & account", prefixes: ["profile", "auth"] },
  { label: "Entities", prefixes: ["entities", "entity_convert", "entity_detail", "entity_register", "entity_team"] },
  { label: "Admin", prefixes: ["admin"] },
  { label: "Utilities", prefixes: ["calc", "calendar", "month"] },
];

/** All top-level namespaces, derived from the static messages. */
const ALL_NAMESPACES = Array.from(
  new Set([...Object.keys(EN_DEFAULTS), ...Object.keys(PT_DEFAULTS)].map((k) => k.split(".")[0]))
).sort();

/** Map each namespace to its domain, or "Other" if unmatched. */
function domainFor(ns: string): string {
  for (const domain of NAMESPACE_DOMAINS) {
    if (domain.prefixes.includes(ns)) return domain.label;
  }
  return "Other";
}

/** Keys within a namespace, sorted. */
function keysInNamespace(ns: string): string[] {
  return Object.keys(EN_DEFAULTS)
    .filter((k) => k.startsWith(`${ns}.`))
    .sort();
}

const DOMAINS = NAMESPACE_DOMAINS.map((d) => d.label);
// Add "Other" if any namespace doesn't match a domain
if (ALL_NAMESPACES.some((ns) => !NAMESPACE_DOMAINS.some((d) => d.prefixes.includes(ns)))) {
  DOMAINS.push("Other");
}

export default function ContentPage() {
  const [overrides, setOverrides] = useState<OverrideEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectedNs, setSelectedNs] = useState<string>("home");
  const [search, setSearch] = useState("");
  const [drafts, setDrafts] = useState<Record<string, { pt?: string; en?: string }>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savingAll, setSavingAll] = useState(false);
  const [translatingKey, setTranslatingKey] = useState<string | null>(null);
  const [translatingAll, setTranslatingAll] = useState(false);
  // Origin map: { `${key}:${locale}` → origin } — tracks how the current value
  // was produced. Origins from the API: "tm_exact" (TM exact match), "tm_fuzzy"
  // (TM near-match), "mt" (machine translation). "human" is inferred from
  // saved overrides (not stored in this map — getOrigin handles it).
  const [origins, setOrigins] = useState<Record<string, string>>({});

  // Fetch all overrides on mount
  const fetchOverrides = useCallback(async () => {
    try {
      const data = await api.copy.all();
      setOverrides(data);
      setLoadError(false);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchOverrides();
  }, [fetchOverrides]);

  // Build a quick-lookup map: { `${key}:${locale}` → value }
  const overrideMap = useMemo(() => {
    const m: Record<string, string> = {};
    for (const e of overrides) {
      m[`${e.key}:${e.locale}`] = e.value;
    }
    return m;
  }, [overrides]);

  // Filtered namespaces based on search
  const filteredNamespaces = useMemo(() => {
    if (!search.trim()) return ALL_NAMESPACES;
    const q = search.toLowerCase();
    return ALL_NAMESPACES.filter((ns) => {
      if (ns.includes(q)) return true;
      return keysInNamespace(ns).some(
        (k) =>
          k.toLowerCase().includes(q) ||
          EN_DEFAULTS[k]?.toLowerCase().includes(q) ||
          PT_DEFAULTS[k]?.toLowerCase().includes(q)
      );
    });
  }, [search]);

  const currentKeys = useMemo(() => keysInNamespace(selectedNs), [selectedNs]);

  const getValue = (key: string, locale: "pt" | "en"): string => {
    const draft = drafts[key]?.[locale];
    if (draft !== undefined) return draft;
    const override = overrideMap[`${key}:${locale}`];
    if (override !== undefined) return override;
    return locale === "pt" ? (PT_DEFAULTS[key] ?? "") : (EN_DEFAULTS[key] ?? "");
  };

  const isModified = (key: string): boolean => {
    return overrideMap[`${key}:pt`] !== undefined || overrideMap[`${key}:en`] !== undefined;
  };

  const isDirty = (key: string): boolean => {
    const draft = drafts[key];
    if (!draft) return false;
    return (
      (draft.pt !== undefined && draft.pt !== (overrideMap[`${key}:pt`] ?? PT_DEFAULTS[key] ?? "")) ||
      (draft.en !== undefined && draft.en !== (overrideMap[`${key}:en`] ?? EN_DEFAULTS[key] ?? ""))
    );
  };

  const setDraft = (key: string, locale: "pt" | "en", value: string) => {
    setDrafts((prev) => ({
      ...prev,
      [key]: { ...prev[key], [locale]: value },
    }));
  };

  /** Origin of the current value for display: explicit origin map → "human" if
   * there's a saved override → undefined (no badge). */
  const getOrigin = (key: string, locale: "pt" | "en"): string | undefined => {
    const ek = `${key}:${locale}`;
    if (origins[ek]) return origins[ek];
    if (overrideMap[ek] !== undefined) return "human";
    return undefined;
  };

  /** Auto-translate a single key's EN field from its PT source. Fills the EN
   * draft (unsaved). No-ops if the PT source is empty or EN already has a value. */
  const autoTranslateKey = async (key: string) => {
    const ptSource = getValue(key, "pt");
    if (!ptSource || !ptSource.trim()) {
      toast.error("No PT source text to translate");
      return;
    }
    const enCurrent = getValue(key, "en");
    if (enCurrent && enCurrent.trim()) {
      toast.error("EN already has a value — clear it first to re-translate");
      return;
    }
    setTranslatingKey(key);
    try {
      const res = await api.translate.single(ptSource, "pt", "en");
      setDraft(key, "en", res.value);
      setOrigins((prev) => ({ ...prev, [`${key}:en`]: res.origin }));
      const originLabel = res.origin === "tm_exact" ? "TM exact match" :
        res.origin === "tm_fuzzy" ? "TM fuzzy match" : "machine translation";
      toast.success(`Translated "${key}" (${originLabel})`);
    } catch (e: any) {
      toast.error(e?.message || "Translation failed");
    } finally {
      setTranslatingKey(null);
    }
  };

  /** Auto-translate every empty EN field in the current namespace. Fills each
   * as a draft (unsaved). Skips keys with no PT source or with existing EN. */
  const autoTranslateAllEmpty = async () => {
    const emptyKeys = currentKeys.filter((k) => {
      const enVal = getValue(k, "en");
      return (!enVal || !enVal.trim()) && getValue(k, "pt").trim();
    });
    if (emptyKeys.length === 0) {
      toast.info("No empty EN keys in this namespace");
      return;
    }
    setTranslatingAll(true);
    try {
      const items = emptyKeys.map((k) => ({ key: k, source_text: getValue(k, "pt") }));
      const res = await api.translate.bulk(items, "pt", "en");
      let filled = 0;
      let failed = 0;
      for (const r of res.results) {
        if (r.value && !r.error) {
          setDraft(r.key, "en", r.value);
          setOrigins((prev) => ({ ...prev, [`${r.key}:en`]: r.origin }));
          filled++;
        } else {
          failed++;
        }
      }
      if (failed > 0) {
        toast.error(`Translated ${filled}, ${failed} failed`);
      } else {
        toast.success(`Translated ${filled} ${filled === 1 ? "key" : "keys"}`);
      }
    } catch (e: any) {
      toast.error(e?.message || "Bulk translation failed");
    } finally {
      setTranslatingAll(false);
    }
  };

  const saveKey = async (key: string) => {
    const draft = drafts[key];
    if (!draft) return;
    setSavingKey(key);
    try {
      const tasks: Promise<unknown>[] = [];
      if (draft.pt !== undefined && draft.pt !== (overrideMap[`${key}:pt`] ?? PT_DEFAULTS[key] ?? "")) {
        tasks.push(api.copy.set(key, "pt", draft.pt));
      }
      if (draft.en !== undefined && draft.en !== (overrideMap[`${key}:en`] ?? EN_DEFAULTS[key] ?? "")) {
        // Send the PT source text so the backend can upsert a Translation
        // Memory entry (source → accepted value) for future auto-translations.
        const ptSource = getValue(key, "pt");
        tasks.push(api.copy.set(key, "en", draft.en, ptSource));
      }
      await Promise.all(tasks);
      await fetchOverrides();
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      toast.success(`Saved "${key}"`);
    } catch (e: any) {
      toast.error(e?.message || "Failed to save");
    } finally {
      setSavingKey(null);
    }
  };

  const revertKey = async (key: string) => {
    if (!window.confirm(`Revert "${key}" to its default text? This removes the saved override for BOTH languages (PT and EN).`)) return;
    setSavingKey(key);
    try {
      await Promise.all([api.copy.revert(key, "pt"), api.copy.revert(key, "en")]);
      await fetchOverrides();
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      toast.info(`Reverted "${key}" to default`);
    } catch (e: any) {
      toast.error(e?.message || "Revert failed");
    } finally {
      setSavingKey(null);
    }
  };

  // Guard against losing unsaved drafts on navigation (in-app links + refresh/close)
  const dirtyCount = Object.keys(drafts).filter(isDirty).length;

  /** Save every dirty key at once. Failed keys stay dirty; a summary toast reports the outcome. */
  const saveAll = async () => {
    const dirtyKeys = Object.keys(drafts).filter(isDirty);
    if (dirtyKeys.length === 0 || savingAll) return;
    setSavingAll(true);
    try {
      const results = await Promise.all(
        dirtyKeys.map(async (key) => {
          const draft = drafts[key];
          try {
            const tasks: Promise<unknown>[] = [];
            if (draft?.pt !== undefined && draft.pt !== (overrideMap[`${key}:pt`] ?? PT_DEFAULTS[key] ?? "")) {
              tasks.push(api.copy.set(key, "pt", draft.pt));
            }
            if (draft?.en !== undefined && draft.en !== (overrideMap[`${key}:en`] ?? EN_DEFAULTS[key] ?? "")) {
              const ptSource = getValue(key, "pt");
              tasks.push(api.copy.set(key, "en", draft.en, ptSource));
            }
            await Promise.all(tasks);
            return { key, ok: true };
          } catch {
            return { key, ok: false };
          }
        })
      );
      const savedKeys = results.filter((r) => r.ok).map((r) => r.key);
      const failedCount = results.length - savedKeys.length;
      await fetchOverrides();
      setDrafts((prev) => {
        const next = { ...prev };
        for (const key of savedKeys) delete next[key];
        return next;
      });
      if (failedCount > 0) {
        toast.error(`Saved ${savedKeys.length}, ${failedCount} failed`);
      } else {
        toast.success(`Saved ${savedKeys.length} ${savedKeys.length === 1 ? "key" : "keys"}`);
      }
    } finally {
      setSavingAll(false);
    }
  };

  // Ctrl/Cmd+S: always suppress the browser save dialog on this page; save all when there are dirty keys.
  const saveAllRef = useRef(saveAll);
  saveAllRef.current = saveAll;
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        saveAllRef.current();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useDirtyGuard(dirtyCount > 0, {
    message: "You have unsaved copy changes. Leave and lose them?",
  });

  if (loading) {
    return (
      <div className="flex h-full min-h-[60vh]">
        <div className="hidden lg:block w-64 shrink-0 border-r border-primary-200/40 dark:border-stone-800 p-3">
          <ListSkeleton rows={7} />
        </div>
        <div className="flex-1 p-4 lg:p-6">
          <TextSkeleton lines={1} className="max-w-xs mb-6" />
          <div className="space-y-4 max-w-3xl">
            <CardSkeleton />
            <CardSkeleton />
            <CardSkeleton />
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-6 max-w-xl">
        <LoadError onRetry={fetchOverrides} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="shrink-0 px-6 py-4 border-b border-primary-200/40 dark:border-stone-800 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-semibold text-stone-800 dark:text-stone-100">
            Content
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            Marketing copy, labels, buttons, menus, warnings — PT + EN
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Button
            size="xs"
            variant="ghost"
            onClick={autoTranslateAllEmpty}
            loading={translatingAll}
            disabled={translatingAll || savingAll}
            title="Auto-translate every empty EN field in this namespace from its PT source (Argos Translate)"
          >
            {!translatingAll && <Sparkles className="w-3 h-3" />}
            Auto-translate EN
          </Button>
          {dirtyCount > 0 && (
            <>
              <span className="text-xs font-medium text-rust-600 dark:text-rust-400 flex items-center gap-1.5">
                <AlertCircle className="w-3.5 h-3.5" />
                {dirtyCount} unsaved
              </span>
              <Button size="xs" variant="primary" onClick={saveAll} loading={savingAll}>
                Save all ({dirtyCount})
              </Button>
            </>
          )}
        </div>
      </div>

      {/* Auto-translate helper note — explains the safeguard so users know
          existing translations won't be touched. */}
      <div className="shrink-0 px-6 py-1.5 border-b border-primary-200/40 dark:border-stone-800 bg-primary-50/20 dark:bg-stone-900/40">
        <p className="text-[11px] text-stone-500 dark:text-stone-400 font-serif">
          <Sparkles className="w-3 h-3 inline -mt-0.5 mr-1 text-stone-400" />
          <strong className="font-medium text-stone-600 dark:text-stone-300">Auto-translate</strong> fills only empty EN fields from their PT source as unsaved drafts — existing translations are never overwritten. Review and save each one.
        </p>
      </div>
      <div className="lg:hidden shrink-0 p-3 border-b border-primary-200/40 dark:border-stone-800">
        <div className="relative mb-2">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400 pointer-events-none z-10" />
          <Input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search keys…"
            aria-label="Search keys"
            className="pl-8"
          />
        </div>
        <select
          value={selectedNs}
          onChange={(e) => setSelectedNs(e.target.value)}
          className="w-full px-3 py-2 text-sm rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
        >
          {ALL_NAMESPACES.map((ns) => (
            <option key={ns} value={ns}>
              {ns} ({keysInNamespace(ns).length})
            </option>
          ))}
        </select>
      </div>

      <ResizableSplit
        defaultWidth={256}
        minWidth={192}
        maxWidth={384}
        className="flex-1"
        leftClassName="hidden lg:block"
        left={
          <div className="h-full flex flex-col border-r border-primary-200/40 dark:border-stone-800">
            <div className="p-3 border-b border-primary-200/30 dark:border-stone-800/50">
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400 pointer-events-none z-10" />
                <Input
                  type="text"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search keys…"
                  aria-label="Search keys"
                  className="pl-8"
                />
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {DOMAINS.map((domain) => {
                const namespaces = filteredNamespaces.filter((ns) => domainFor(ns) === domain);
                if (namespaces.length === 0) return null;
                return (
                  <div key={domain} className="mb-3">
                    <p className="px-2 py-1 text-xs uppercase tracking-wider text-stone-400 font-medium">
                      {domain}
                    </p>
                    {namespaces.map((ns) => {
                      const keyCount = keysInNamespace(ns).length;
                      const modCount = keysInNamespace(ns).filter(isModified).length;
                      return (
                        <button
                          key={ns}
                          onClick={() => setSelectedNs(ns)}
                          className={`w-full flex items-center justify-between px-2 py-1.5 rounded-md text-sm transition ${
                            selectedNs === ns
                              ? "bg-primary-600 text-cream"
                              : "text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800"
                          }`}
                        >
                          <span className="font-mono text-xs">{ns}</span>
                          <span className="flex items-center gap-1.5">
                            {modCount > 0 && (
                              <Tooltip content={`${modCount} modified`}>
                                <span
                                  className={`w-1.5 h-1.5 rounded-full ${
                                    selectedNs === ns ? "bg-cream/70" : "bg-rust-500"
                                  }`}
                                />
                              </Tooltip>
                            )}
                            <span className={`text-xs ${selectedNs === ns ? "text-cream/70" : "text-stone-400"}`}>
                              {keyCount}
                            </span>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                );
              })}
              {filteredNamespaces.length === 0 && (
                <p className="px-2 py-4 text-sm text-stone-400 dark:text-stone-500 text-center">
                  No namespaces match your search.
                </p>
              )}
            </div>
          </div>
        }
        right={
          <div className="h-full overflow-y-auto p-4 lg:p-6">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-mono text-sm text-stone-500 dark:text-stone-400">
              {selectedNs}.*
            </h2>
            <span className="text-xs text-stone-400">
              {currentKeys.length} keys · {currentKeys.filter(isModified).length} modified
            </span>
          </div>

          <div className="space-y-4 max-w-3xl">
            {currentKeys.map((key) => {
              const dirty = isDirty(key);
              const modified = isModified(key);
              const saving = savingKey === key;
              return (
                <div
                  key={key}
                  className={`rounded-xl2 border p-4 transition ${
                    dirty
                      ? "border-rust-300 dark:border-rust-700 bg-rust-50/30 dark:bg-rust-950/10"
                      : modified
                      ? "border-primary-300/60 dark:border-stone-700 bg-white dark:bg-stone-900"
                      : "border-stone-200/60 dark:border-stone-800 bg-white dark:bg-stone-900"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <code className="text-xs text-stone-500 dark:text-stone-400 font-mono">
                      {key}
                    </code>
                    <div className="flex items-center gap-2">
                      {(() => {
                        const o = getOrigin(key, "en");
                        if (!o) return null;
                        const labels: Record<string, { text: string; cls: string; tip: string }> = {
                          mt: { text: "MT", cls: "text-stone-500 bg-stone-100 dark:bg-stone-800", tip: "Machine-translated draft (Argos)" },
                          tm_exact: { text: "TM", cls: "text-rust-600 bg-rust-50 dark:bg-rust-950/30", tip: "Translation Memory exact match (human-accepted)" },
                          tm_fuzzy: { text: "TM~", cls: "text-rust-500 bg-rust-50/50 dark:bg-rust-950/20", tip: "Translation Memory fuzzy match (review recommended)" },
                          human: { text: "human", cls: "text-primary-600 bg-primary-50 dark:bg-primary-950/30", tip: "Human-edited" },
                        };
                        const l = labels[o];
                        if (!l) return null;
                        return (
                          <Tooltip content={l.tip}>
                            <span className={`text-[10px] uppercase tracking-wide px-1.5 py-0.5 rounded ${l.cls}`}>
                              {l.text}
                            </span>
                          </Tooltip>
                        );
                      })()}
                      {modified && !dirty && (
                        <span className="text-xs uppercase tracking-wide text-primary-600 dark:text-primary-400 px-1.5 py-0.5 rounded bg-primary-50 dark:bg-primary-950/30">
                          Modified
                        </span>
                      )}
                      {dirty && (
                        <span className="text-xs uppercase tracking-wide text-rust-600 dark:text-rust-400 px-1.5 py-0.5 rounded bg-rust-50 dark:bg-rust-950/30">
                          Unsaved
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3">
                    {(["pt", "en"] as const).map((locale) => (
                      <div key={locale}>
                        <label className="flex items-center gap-1.5 text-xs uppercase tracking-wider text-stone-400 font-medium mb-1.5">
                          {locale === "pt" ? "Português" : "English"}
                          {overrideMap[`${key}:${locale}`] !== undefined && (
                            <Tooltip content="Has a saved override">
                              <span className="text-primary-500">●</span>
                            </Tooltip>
                          )}
                        </label>
                        {getValue(key, locale).length > 80 ? (
                          <Textarea
                            value={getValue(key, locale)}
                            onChange={(e) => setDraft(key, locale, e.target.value)}
                            rows={3}
                            aria-label={`${key} — ${locale === "pt" ? "Portuguese" : "English"}`}
                            className="font-serif"
                          />
                        ) : (
                          <Input
                            type="text"
                            value={getValue(key, locale)}
                            onChange={(e) => setDraft(key, locale, e.target.value)}
                            aria-label={`${key} — ${locale === "pt" ? "Portuguese" : "English"}`}
                            className="font-serif"
                          />
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-end gap-2 mt-3">
                    {modified && !dirty && (
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => revertKey(key)}
                        disabled={saving || savingAll || !!translatingKey}
                      >
                        <RotateCcw className="w-3 h-3" /> Revert to default
                      </Button>
                    )}
                    {!getValue(key, "en").trim() && getValue(key, "pt").trim() && (
                      <Button
                        size="xs"
                        variant="ghost"
                        onClick={() => autoTranslateKey(key)}
                        loading={translatingKey === key}
                        disabled={saving || savingAll || !!translatingKey}
                        title="Auto-translate from PT (Argos Translate)"
                      >
                        {translatingKey !== key && <Sparkles className="w-3 h-3" />}
                        Auto-translate
                      </Button>
                    )}
                    {dirty && (
                      <Button size="xs" onClick={() => saveKey(key)} loading={saving} disabled={savingAll || !!translatingKey}>
                        {!saving && <Check className="w-3 h-3" />}
                        Save
                      </Button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          </div>
        }
      />
    </div>
  );
}
