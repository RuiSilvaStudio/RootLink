"use client";

import { useEffect, useMemo, useState } from "react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import { Search, RotateCcw, Save } from "lucide-react";
import en from "@/messages/en.json";
import pt from "@/messages/pt.json";

function flatten(obj: any, prefix = "", out: Record<string, string> = {}): Record<string, string> {
  for (const [k, v] of Object.entries(obj)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out[key] = v;
    else if (v && typeof v === "object") flatten(v, key, out);
  }
  return out;
}

const EN = flatten(en);
const PT = flatten(pt);
const ALL_KEYS = Array.from(new Set([...Object.keys(EN), ...Object.keys(PT)])).sort();
const LIMIT = 60;

export default function AdminCopyPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const canEdit = user?.role === "super_admin" || user?.can_edit_copy;

  const [search, setSearch] = useState("");
  const [overrides, setOverrides] = useState<Record<string, string>>({}); // `${locale}:${key}` -> value
  const [edits, setEdits] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);

  useEffect(() => {
    if (!canEdit) return;
    api.copy.all().then((rows) => {
      const map: Record<string, string> = {};
      rows.forEach((r) => { map[`${r.locale}:${r.key}`] = r.value; });
      setOverrides(map);
    }).catch(() => {});
  }, [canEdit]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return ALL_KEYS.slice(0, LIMIT);
    return ALL_KEYS.filter((k) =>
      k.toLowerCase().includes(q) || (EN[k] || "").toLowerCase().includes(q) || (PT[k] || "").toLowerCase().includes(q)
    ).slice(0, LIMIT);
  }, [search]);

  const effective = (locale: "en" | "pt", key: string) => {
    const ek = `${locale}:${key}`;
    if (ek in edits) return edits[ek];
    if (ek in overrides) return overrides[ek];
    return (locale === "en" ? EN : PT)[key] ?? "";
  };

  const isOverridden = (key: string) => `en:${key}` in overrides || `pt:${key}` in overrides;

  const save = async (key: string) => {
    setSaving(key);
    try {
      for (const locale of ["en", "pt"] as const) {
        const ek = `${locale}:${key}`;
        if (ek in edits) {
          await api.copy.set(key, locale, edits[ek]);
          setOverrides((o) => ({ ...o, [ek]: edits[ek] }));
        }
      }
      setEdits((e) => { const n = { ...e }; delete n[`en:${key}`]; delete n[`pt:${key}`]; return n; });
      addToast("success", "Copy saved");
    } catch (err: any) {
      addToast("error", err.message);
    }
    setSaving(null);
  };

  const revert = async (key: string) => {
    setSaving(key);
    try {
      for (const locale of ["en", "pt"] as const) {
        if (`${locale}:${key}` in overrides) await api.copy.revert(key, locale);
      }
      setOverrides((o) => { const n = { ...o }; delete n[`en:${key}`]; delete n[`pt:${key}`]; return n; });
      setEdits((e) => { const n = { ...e }; delete n[`en:${key}`]; delete n[`pt:${key}`]; return n; });
      addToast("success", "Reverted to default");
    } catch (err: any) {
      addToast("error", err.message);
    }
    setSaving(null);
  };

  if (!canEdit) {
    return <p className="text-stone-500 font-serif py-8">You don&apos;t have permission to edit site copy.</p>;
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl sm:text-4xl font-display font-semibold text-stone-800 dark:text-stone-100 leading-[1.08]">Site copy</h1>
        <p className="text-sm text-stone-500 dark:text-stone-400 mt-2 font-serif">
          Edit any interface text without a redeploy. Changes override the defaults; revert restores the original.
        </p>
      </div>

      <div className="relative mb-5 max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search keys or text (e.g. create.button, Publish)…"
          className="w-full pl-9 pr-3 py-2 border border-stone-200/60 rounded-xl text-sm bg-white dark:bg-stone-900 font-serif focus:outline-none focus:ring-2 focus:ring-primary-500/15"
        />
      </div>

      <div className="space-y-3">
        {filtered.map((key) => {
          const dirty = `en:${key}` in edits || `pt:${key}` in edits;
          return (
            <div key={key} className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200/60 dark:border-stone-700 p-4">
              <div className="flex items-center justify-between gap-2 mb-2">
                <code className="text-xs text-primary-600 dark:text-primary-400 font-mono">{key}</code>
                {isOverridden(key) && <span className="text-[10px] uppercase tracking-wide text-rust-600 bg-rust-50 px-2 py-0.5 rounded-full">overridden</span>}
              </div>
              <div className="grid sm:grid-cols-2 gap-3">
                {(["en", "pt"] as const).map((loc) => (
                  <div key={loc}>
                    <label className="block text-[11px] font-medium text-stone-400 uppercase mb-1">{loc}</label>
                    <textarea
                      value={effective(loc, key)}
                      onChange={(e) => setEdits((ed) => ({ ...ed, [`${loc}:${key}`]: e.target.value }))}
                      rows={2}
                      className="w-full px-2.5 py-1.5 text-sm rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 resize-y"
                    />
                  </div>
                ))}
              </div>
              <div className="flex items-center gap-2 mt-2">
                <button
                  onClick={() => save(key)}
                  disabled={!dirty || saving === key}
                  className="inline-flex items-center gap-1.5 text-xs bg-primary-600 text-white px-3 py-1.5 rounded-lg hover:bg-primary-700 disabled:opacity-40 font-medium transition"
                >
                  <Save className="w-3.5 h-3.5" /> {saving === key ? "Saving…" : "Save"}
                </button>
                {isOverridden(key) && (
                  <button
                    onClick={() => revert(key)}
                    disabled={saving === key}
                    className="inline-flex items-center gap-1.5 text-xs bg-stone-100 text-stone-600 px-3 py-1.5 rounded-lg hover:bg-stone-200 font-medium transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" /> Revert
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
      {!search && (
        <p className="text-xs text-stone-400 mt-4 font-serif">Showing first {LIMIT} keys — search to find any of {ALL_KEYS.length} copy strings.</p>
      )}
    </div>
  );
}
