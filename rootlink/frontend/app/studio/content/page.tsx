"use client";

/**
 * Content Studio — Content/Copy module.
 *
 * A CMS UI over the existing /api/copy override layer. Replaces the ad-hoc
 * /admin/copy grid and the inline editor's text piece with a first-class
 * surface: namespace-tree navigation + per-locale (PT + EN) editor + live
 * "modified" indicators + per-key save/revert.
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

import { useState, useMemo, useEffect, useCallback } from "react";
import { Search, Check, RotateCcw, Loader2, AlertCircle } from "lucide-react";
import { useToast } from "@/lib/toast-context";
import { api } from "@/lib/api";
import enMessages from "@/messages/en.json";
import ptMessages from "@/messages/pt.json";

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
  const { addToast } = useToast();
  const [overrides, setOverrides] = useState<OverrideEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedNs, setSelectedNs] = useState<string>("home");
  const [search, setSearch] = useState("");
  const [drafts, setDrafts] = useState<Record<string, { pt?: string; en?: string }>>({});
  const [savingKey, setSavingKey] = useState<string | null>(null);

  // Fetch all overrides on mount
  const fetchOverrides = useCallback(async () => {
    try {
      const data = await api.copy.all();
      setOverrides(data);
    } catch {
      // Non-fatal — editor shows defaults only
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
      return keysInNamespace(ns).some((k) => k.toLowerCase().includes(q) || EN_DEFAULTS[k]?.toLowerCase().includes(q));
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
        tasks.push(api.copy.set(key, "en", draft.en));
      }
      await Promise.all(tasks);
      await fetchOverrides();
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      addToast("success", `Saved "${key}"`);
    } catch (e: any) {
      addToast("error", e?.message || "Failed to save");
    } finally {
      setSavingKey(null);
    }
  };

  const revertKey = async (key: string) => {
    setSavingKey(key);
    try {
      await Promise.all([api.copy.revert(key, "pt"), api.copy.revert(key, "en")]);
      await fetchOverrides();
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[key];
        return next;
      });
      addToast("info", `Reverted "${key}" to default`);
    } catch (e: any) {
      addToast("error", e?.message || "Revert failed");
    } finally {
      setSavingKey(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <Loader2 className="w-5 h-5 animate-spin text-stone-400" />
      </div>
    );
  }

  const dirtyCount = Object.keys(drafts).filter(isDirty).length;

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="px-6 py-4 border-b border-primary-200/40 dark:border-stone-800 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-semibold text-stone-800 dark:text-stone-100">
            Content
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            Marketing copy, labels, buttons, menus, warnings — PT + EN
          </p>
        </div>
        {dirtyCount > 0 && (
          <span className="text-xs font-medium text-rust-600 dark:text-rust-400 flex items-center gap-1.5">
            <AlertCircle className="w-3.5 h-3.5" />
            {dirtyCount} unsaved
          </span>
        )}
      </div>

      <div className="flex-1 flex min-h-0">
        {/* ── Namespace list (desktop) ────────────────────── */}
        <div className="hidden lg:flex flex-col w-64 shrink-0 border-r border-primary-200/40 dark:border-stone-800">
          <div className="p-3 border-b border-primary-200/30 dark:border-stone-800/50">
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search keys…"
                className="w-full pl-8 pr-3 py-1.5 text-sm rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
          </div>
          <div className="flex-1 overflow-y-auto p-2">
            {DOMAINS.map((domain) => {
              const namespaces = filteredNamespaces.filter((ns) => domainFor(ns) === domain);
              if (namespaces.length === 0) return null;
              return (
                <div key={domain} className="mb-3">
                  <p className="px-2 py-1 text-[10px] uppercase tracking-wider text-stone-400 font-medium">
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
                            <span
                              className={`w-1.5 h-1.5 rounded-full ${
                                selectedNs === ns ? "bg-cream/70" : "bg-rust-500"
                              }`}
                              title={`${modCount} modified`}
                            />
                          )}
                          <span className={`text-[10px] ${selectedNs === ns ? "text-cream/70" : "text-stone-400"}`}>
                            {keyCount}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Namespace select (mobile) ───────────────────── */}
        <div className="lg:hidden p-3 border-b border-primary-200/40 dark:border-stone-800">
          <div className="relative mb-2">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search keys…"
              className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
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

        {/* ── Key editors ──────────────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6">
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
                      {modified && !dirty && (
                        <span className="text-[10px] uppercase tracking-wide text-primary-600 dark:text-primary-400 px-1.5 py-0.5 rounded bg-primary-50 dark:bg-primary-950/30">
                          Modified
                        </span>
                      )}
                      {dirty && (
                        <span className="text-[10px] uppercase tracking-wide text-rust-600 dark:text-rust-400 px-1.5 py-0.5 rounded bg-rust-50 dark:bg-rust-950/30">
                          Unsaved
                        </span>
                      )}
                    </div>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3">
                    {(["pt", "en"] as const).map((locale) => (
                      <div key={locale}>
                        <label className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-stone-400 font-medium mb-1.5">
                          {locale === "pt" ? "Português" : "English"}
                          {overrideMap[`${key}:${locale}`] !== undefined && (
                            <span className="text-primary-500" title="Has DB override">●</span>
                          )}
                        </label>
                        {getValue(key, locale).length > 80 ? (
                          <textarea
                            value={getValue(key, locale)}
                            onChange={(e) => setDraft(key, locale, e.target.value)}
                            rows={3}
                            className="w-full px-3 py-2 text-sm rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 focus:outline-none focus:ring-1 focus:ring-primary-500 resize-y font-serif"
                          />
                        ) : (
                          <input
                            type="text"
                            value={getValue(key, locale)}
                            onChange={(e) => setDraft(key, locale, e.target.value)}
                            className="w-full px-3 py-2 text-sm rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 focus:outline-none focus:ring-1 focus:ring-primary-500 font-serif"
                          />
                        )}
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center justify-end gap-2 mt-3">
                    {modified && !dirty && (
                      <button
                        onClick={() => revertKey(key)}
                        disabled={saving}
                        className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition"
                      >
                        <RotateCcw className="w-3 h-3" /> Revert to default
                      </button>
                    )}
                    {dirty && (
                      <button
                        onClick={() => saveKey(key)}
                        disabled={saving}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary-600 hover:bg-primary-700 text-cream disabled:opacity-50 transition"
                      >
                        {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                        Save
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
