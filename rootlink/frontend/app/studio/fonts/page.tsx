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
import { Plus, Trash2, Type, Link as LinkIcon } from "lucide-react";
import { useToast } from "@/lib/toast-context";
import { Button, EmptyState, Input, Modal, Toggle, Tooltip } from "@/components/ui";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";
import { api } from "@/lib/api";
import { LoadError } from "@/components/studio/LoadError";

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
  const [loadError, setLoadError] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newFamily, setNewFamily] = useState("");
  const [newUrl, setNewUrl] = useState("");

  const fetch = useCallback(async () => {
    try { setFonts(await api.fonts.list()); setLoadError(false); } catch { setLoadError(true); } finally { setLoading(false); }
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
    try { await api.fonts.update(font.id, { is_active: !font.is_active }); await fetch(); } catch (e: any) { addToast("error", e?.message || "Failed to update font"); }
  };

  const removeFont = async (font: FontRow) => {
    if (!window.confirm(`Delete the font "${font.name}" from the library? Elements using it will fall back to the theme default.`)) return;
    try { await api.fonts.remove(font.id); await fetch(); addToast("info", "Font removed"); } catch (e: any) { addToast("error", e?.message); }
  };

  if (loading) {
    return (
      <div className="p-4 lg:p-6 min-h-[60vh]">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl">
          {Array.from({ length: 6 }).map((_, i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
      </div>
    );
  }

  if (loadError) return <div className="p-6 max-w-xl"><LoadError onRetry={fetch} /></div>;

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 px-6 py-4 border-b border-primary-200/40 dark:border-stone-800 flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-semibold text-stone-800 dark:text-stone-100">Font Library</h1>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">Import and manage fonts — active fonts appear in the theme manager + inspector</p>
        </div>
        <Button size="xs" variant="primary" onClick={() => setAdding(true)}><Plus className="w-3.5 h-3.5" /> Add font</Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        {fonts.length === 0 ? (
          <EmptyState
            icon={<Type className="w-7 h-7 text-primary-500" />}
            title="No fonts yet"
            message="Add a font from a Google Fonts URL to start building the library."
            action={{ label: "Add font", onClick: () => setAdding(true) }}
          />
        ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl">
          {fonts.map((font) => (
            <div key={font.id} className={`p-5 rounded-xl2 border transition ${font.is_active ? "border-primary-200/60 dark:border-stone-800 bg-white dark:bg-stone-900" : "border-stone-200/30 dark:border-stone-800/50 opacity-50"}`}>
              <div className="flex items-start justify-between mb-3">
                <Type className="w-5 h-5 text-primary-500" />
                <div className="flex items-center gap-2">
                  <Toggle
                    label="Active"
                    id={`font-active-${font.id}`}
                    checked={font.is_active}
                    onChange={() => toggleActive(font)}
                  />
                  <Tooltip content="Delete font">
                    <Button size="xs" variant="danger" onClick={() => removeFont(font)} aria-label={`Delete font ${font.name}`}>
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </Tooltip>
                </div>
              </div>
              <h3 className="font-display font-semibold text-stone-800 dark:text-stone-100 mb-1">{font.name}</h3>
              <code className="text-xs font-mono text-stone-400 dark:text-stone-500 block mb-3 truncate">{font.family}</code>
              <p className="text-2xl mb-2" style={{ fontFamily: font.family }}>Aa Bb Cc 123</p>
              <p className="text-sm font-serif" style={{ fontFamily: font.family }}>The quick brown fox</p>
              {font.url && <p className="text-xs text-stone-400 dark:text-stone-500 mt-2 flex items-center gap-1"><LinkIcon className="w-3 h-3" /> Google Fonts</p>}
            </div>
          ))}
        </div>
        )}
      </div>

      <Modal
        open={adding}
        onClose={() => setAdding(false)}
        title="Add font"
        footer={
          <>
            <Button size="xs" variant="ghost" onClick={() => setAdding(false)}>Cancel</Button>
            <Button size="xs" variant="primary" onClick={addFont} disabled={!newName.trim() || !newFamily.trim()}>Add</Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input label="Name" value={newName} onChange={(e) => setNewName(e.target.value)} placeholder="e.g. Inter" />
          <Input label="CSS font-family" value={newFamily} onChange={(e) => setNewFamily(e.target.value)} placeholder='"Inter", sans-serif' className="font-mono" />
          <Input label="Google Fonts URL (optional)" type="url" value={newUrl} onChange={(e) => setNewUrl(e.target.value)} placeholder="https://fonts.googleapis.com/css2?family=..." />
        </div>
      </Modal>
    </div>
  );
}
