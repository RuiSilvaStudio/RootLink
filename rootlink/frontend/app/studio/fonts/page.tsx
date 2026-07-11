"use client";

/**
 * Content Studio — Font Library (Phase 5).
 *
 * Spec: docs/content-studio/CONTENT_STUDIO.md §3.1 (dashboard — font library).
 *
 * Import and manage fonts. Each font has a name, a CSS font-family value,
 * and optionally a Google Fonts URL (auto-loaded). Active fonts are available
 * as font-family options in the theme manager and the overlay's inspector.
 */

import { useState, useEffect, useCallback } from "react";
import { Loader2, Plus, Trash2, Type, Link as LinkIcon } from "lucide-react";
import { useToast } from "@/lib/toast-context";
import { api } from "@/lib/api";

interface FontRow {
  id: number;
  name: string;
  family: string;
  url: string | null;
  is_active: boolean;
}

export default function FontLibraryPage() {
  const { addToast } = useToast();
  const [fonts, setFonts] = useState<FontRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newFamily, setNewFamily] = useState("");
  const [newUrl, setNewUrl] = useState("");

  const fetch = useCallback(async () => {
    try { setFonts(await api.fonts.list()); } catch {} finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const addFont = async () => {
    if (!newName.trim() || !newFamily.trim()) return;
    try {
      await api.fonts.create({ name: newName, family: newFamily, url: newUrl || undefined });
      setNewName(""); setNewFamily(""); setNewUrl(""); setAdding(false);
      await fetch();
      addToast("success", "Font added");
    } catch (e: any) { addToast("error", e?.message || "Failed"); }
  };

  const toggleActive = async (font: FontRow) => {
    try { await api.fonts.update(font.id, { is_active: !font.is_active }); await fetch(); } catch {}
  };

  const removeFont = async (id: number) => {
    try { await api.fonts.remove(id); await fetch(); addToast("info", "Font removed"); } catch (e: any) { addToast("error", e?.message); }
  };

  if (loading) return <div className="flex items-center justify-center h-full min-h-[60vh]"><Loader2 className="w-5 h-5 animate-spin text-stone-400" /></div>;

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 px-6 py-4 border-b border-primary-200/40 dark:border-stone-800 flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold text-stone-800 dark:text-stone-100">Font Library</h1>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">Import and manage fonts — active fonts appear in the theme manager + inspector</p>
        </div>
        <button onClick={() => setAdding(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary-600 hover:bg-primary-700 text-cream"><Plus className="w-3.5 h-3.5" /> Add font</button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl">
          {fonts.map((font) => (
            <div key={font.id} className={`p-5 rounded-xl2 border transition ${font.is_active ? "border-primary-200/60 dark:border-stone-800 bg-white dark:bg-stone-900" : "border-stone-200/30 dark:border-stone-800/50 opacity-50"}`}>
              <div className="flex items-start justify-between mb-3">
                <Type className="w-5 h-5 text-primary-500" />
                <div className="flex items-center gap-1">
                  <button onClick={() => toggleActive(font)} className={`w-9 h-5 rounded-full transition relative ${font.is_active ? "bg-primary-600" : "bg-stone-300 dark:bg-stone-700"}`}>
                    <span className={`absolute top-0.5 w-4 h-4 rounded-full bg-white transition ${font.is_active ? "left-4" : "left-0.5"}`} />
                  </button>
                  <button onClick={() => removeFont(font.id)} className="text-stone-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                </div>
              </div>
              <h3 className="font-display font-semibold text-stone-800 dark:text-stone-100 mb-1">{font.name}</h3>
              <code className="text-[10px] font-mono text-stone-400 block mb-3 truncate">{font.family}</code>
              <p className="text-2xl mb-2" style={{ fontFamily: font.family }}>Aa Bb Cc 123</p>
              <p className="text-sm font-serif" style={{ fontFamily: font.family }}>The quick brown fox</p>
              {font.url && <p className="text-[10px] text-stone-400 mt-2 flex items-center gap-1"><LinkIcon className="w-3 h-3" /> Google Fonts</p>}
            </div>
          ))}
        </div>
      </div>

      {adding && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center px-4" onClick={() => setAdding(false)}>
          <div className="absolute inset-0 bg-stone-950/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-md bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border border-stone-200/60 dark:border-stone-700 p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display font-semibold text-stone-800 dark:text-stone-100 mb-4">Add font</h2>
            <div className="space-y-3">
              <div><label className="block text-xs font-medium text-stone-500 mb-1">Name</label><input type="text" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Inter" className="w-full px-3 py-2 text-sm rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 focus:outline-none focus:ring-1 focus:ring-primary-500" autoFocus /></div>
              <div><label className="block text-xs font-medium text-stone-500 mb-1">CSS font-family</label><input type="text" value={newFamily} onChange={(e) => setNewFamily(e.target.value)} placeholder='"Inter", sans-serif' className="w-full px-3 py-2 text-sm rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 focus:outline-none focus:ring-1 focus:ring-primary-500 font-mono" /></div>
              <div><label className="block text-xs font-medium text-stone-500 mb-1">Google Fonts URL (optional)</label><input type="url" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://fonts.googleapis.com/css2?family=..." className="w-full px-3 py-2 text-sm rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 focus:outline-none focus:ring-1 focus:ring-primary-500" /></div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setAdding(false)} className="px-3 py-2 text-xs font-medium rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800">Cancel</button>
              <button onClick={addFont} disabled={!newName.trim() || !newFamily.trim()} className="px-4 py-2 text-xs font-semibold rounded-lg bg-primary-600 hover:bg-primary-700 text-cream disabled:opacity-50">Add</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
