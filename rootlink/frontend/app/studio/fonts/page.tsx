"use client";

import { useState, useEffect, useCallback, useMemo } from "react";
import { Plus, Trash2, Type, Pencil, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { Button, EmptyState, Input, Modal, Toggle, Tooltip, Badge } from "@/components/ui";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";
import { api } from "@/lib/api";
import { LoadError } from "@/components/studio/LoadError";

interface FontRow {
  id: number;
  name: string;
  family: string;
  url: string | null;
  axes: string | null;
  is_active: boolean;
}

/* ─── URL parser — extracts axes from a Google Fonts CSS2 URL ─── */
interface ParsedAxes {
  ital?: boolean;
  wght?: [number, number];
  opsz?: [number, number] | null;
  slnt?: [number, number] | null;
  wdth?: [number, number] | null;
  SOFT?: [number, number] | null;
  WONK?: [number, number] | null;
  [key: string]: any;
}

const AXIS_LABELS: Record<string, string> = {
  ital: "Italic",
  wght: "Weight",
  opsz: "Optical size",
  slnt: "Slant",
  wdth: "Width",
  SOFT: "Softness",
  WONK: "Wonky",
};

function parseGoogleFontsUrl(url: string): { family: string | null; axes: ParsedAxes | null; multiFamily: boolean } {
  if (!url.trim()) return { family: null, axes: null, multiFamily: false };
  try {
    const parsed = new URL(url.trim());
    const params = parsed.searchParams;
    const familyParams = params.getAll("family");
    if (familyParams.length === 0) return { family: null, axes: null, multiFamily: false };
    
    const firstFamily = familyParams[0];
    const multiFamily = familyParams.length > 1;
    
    // family param format: FamilyName or FamilyName:axis_list@tuple_list
    const colonIdx = firstFamily.indexOf(":");
    if (colonIdx === -1) {
      // No axes — just the family name
      return { family: firstFamily, axes: null, multiFamily };
    }
    
    const familyName = firstFamily.substring(0, colonIdx);
    const axisSpec = firstFamily.substring(colonIdx + 1);
    
    // axisSpec format: axis1,axis2,...@tuple1;tuple2;...
    const atIdx = axisSpec.indexOf("@");
    if (atIdx === -1) return { family: familyName, axes: null, multiFamily };
    
    const axisTags = axisSpec.substring(0, atIdx).split(",");
    const tupleStr = axisSpec.substring(atIdx + 1);
    const tuples = tupleStr.split(";");
    
    // Detect italic: 2 tuples = upright;italic
    const hasItalic = tuples.length === 2 && axisTags.includes("ital");
    
    // Parse values from the first (upright) tuple
    const firstTupleValues = tuples[0].split(",");
    const axes: ParsedAxes = {};
    
    if (hasItalic) axes.ital = true;
    
    for (let i = 0; i < axisTags.length; i++) {
      const tag = axisTags[i];
      if (tag === "ital") continue; // handled above
      
      const val = firstTupleValues[i];
      if (!val) continue;
      
      if (val.includes("..")) {
        const [min, max] = val.split("..").map(Number);
        axes[tag] = [min, max];
      } else {
        const num = parseFloat(val);
        axes[tag] = [num, num];
      }
    }
    
    return { family: familyName, axes, multiFamily };
  } catch {
    return { family: null, axes: null, multiFamily: false };
  }
}

export default function FontLibraryPage() {
  const [fonts, setFonts] = useState<FontRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [adding, setAdding] = useState(false);
  const [editing, setEditing] = useState<FontRow | null>(null);

  const fetch = useCallback(async () => {
    try { setFonts(await api.fonts.list()); setLoadError(false); } catch { setLoadError(true); } finally { setLoading(false); }
  }, []);

  useEffect(() => { fetch(); }, [fetch]);

  const toggleActive = async (font: FontRow) => {
    try { await api.fonts.update(font.id, { is_active: !font.is_active }); await fetch(); } catch (e: any) { toast.error(e?.message || "Failed"); }
  };

  const removeFont = async (font: FontRow) => {
    if (!window.confirm(`Delete "${font.name}"? Elements using it will fall back to the theme default.`)) return;
    try { await api.fonts.remove(font.id); await fetch(); toast.info("Font removed"); } catch (e: any) { toast.error(e?.message); }
  };

  if (loading) {
    return (
      <div className="p-4 lg:p-6 min-h-[60vh]">
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl">
          {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
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
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">Active fonts appear in the theme manager + inspector</p>
        </div>
        <Button size="xs" variant="primary" onClick={() => setAdding(true)}><Plus className="w-3.5 h-3.5" /> Add font</Button>
      </div>

      <div className="flex-1 overflow-y-auto p-4 lg:p-6">
        {fonts.length === 0 ? (
          <EmptyState
            icon={<Type className="w-7 h-7 text-primary-500" />}
            title="No fonts yet"
            message="Add a font from Google Fonts to start building the library."
            action={{ label: "Add font", onClick: () => setAdding(true) }}
          />
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-4xl">
            {fonts.map((font) => {
              const axes: ParsedAxes | null = font.axes ? (() => { try { return JSON.parse(font.axes); } catch { return null; } })() : null;
              const axisNames = axes ? Object.entries(axes).filter(([, v]) => v !== null && v !== false).map(([k]) => AXIS_LABELS[k] || k) : [];
              return (
                <div key={font.id} className={`p-5 rounded-xl2 border transition ${font.is_active ? "border-primary-200/60 dark:border-stone-800 bg-white dark:bg-stone-900" : "border-stone-200/30 dark:border-stone-800/50 opacity-50"}`}>
                  <div className="flex items-start justify-between mb-3">
                    <Type className="w-5 h-5 text-primary-500" />
                    <div className="flex items-center gap-2">
                      <Toggle label="Active" id={`font-active-${font.id}`} checked={font.is_active} onChange={() => toggleActive(font)} />
                      <Tooltip content="Edit font">
                        <Button size="xs" variant="secondary" onClick={() => setEditing(font)}><Pencil className="w-3.5 h-3.5" /></Button>
                      </Tooltip>
                      <Tooltip content="Delete font">
                        <Button size="xs" variant="danger" onClick={() => removeFont(font)}><Trash2 className="w-3.5 h-3.5" /></Button>
                      </Tooltip>
                    </div>
                  </div>
                  <h3 className="font-display font-semibold text-stone-800 dark:text-stone-100 mb-1">{font.name}</h3>
                  <code className="text-xs font-mono text-stone-400 dark:text-stone-500 block mb-2 truncate">{font.family}</code>
                  {axisNames.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {axisNames.map(a => <Badge key={a} variant="sage">{a}</Badge>)}
                    </div>
                  )}
                  <p className="text-2xl mb-1" style={{ fontFamily: font.family }}>Aa Bb Cc 123</p>
                  <p className="text-sm font-serif italic" style={{ fontFamily: font.family, fontStyle: axes?.ital ? "italic" : "normal" }}>The quick brown fox</p>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {(adding || editing) && (
        <FontFormModal
          font={editing}
          onClose={() => { setAdding(false); setEditing(null); }}
          onSaved={() => { setAdding(false); setEditing(null); fetch(); }}
        />
      )}
    </div>
  );
}

/* ─── Font form modal — paste URL, parse axes, save ─── */
function FontFormModal({ font, onClose, onSaved }: { font: FontRow | null; onClose: () => void; onSaved: () => void }) {
  const isEditing = !!font;
  const [name, setName] = useState(font?.name || "");
  const [family, setFamily] = useState(font?.family || "");
  const [url, setUrl] = useState(font?.url || "");
  const [saving, setSaving] = useState(false);

  // Parse the URL in real-time
  const parsed = useMemo(() => parseGoogleFontsUrl(url), [url]);
  
  // Auto-fill name and family from the parsed URL
  useEffect(() => {
    if (parsed.family && !name.trim()) {
      setName(parsed.family);
      setFamily(`"${parsed.family}", sans-serif`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parsed.family]);

  const buildAxesJSON = (): string | null => {
    if (!parsed.axes) return null;
    const clean: Record<string, any> = {};
    for (const [key, val] of Object.entries(parsed.axes)) {
      if (val !== null && val !== false) clean[key] = val;
    }
    return Object.keys(clean).length > 0 ? JSON.stringify(clean) : null;
  };

  const save = async () => {
    if (!name.trim() || !family.trim()) return;
    if (!url.trim()) { toast.error("Please paste the Google Fonts URL"); return; }
    setSaving(true);
    const axesJSON = buildAxesJSON();
    try {
      if (isEditing && font) {
        await api.fonts.update(font.id, { name: name.trim(), family: family.trim(), url: url.trim(), axes: axesJSON || undefined });
      } else {
        await api.fonts.create({ name: name.trim(), family: family.trim(), url: url.trim(), axes: axesJSON || undefined });
      }
      toast.success(isEditing ? "Font updated" : "Font added");
      onSaved();
    } catch (e: any) { toast.error(e?.message || "Failed"); }
    finally { setSaving(false); }
  };

  const axisKeys = parsed.axes ? Object.entries(parsed.axes).filter(([, v]) => v !== null && v !== false).map(([k]) => k) : [];

  return (
    <Modal
      open
      onClose={onClose}
      title={isEditing ? `Edit ${font?.name}` : "Add font"}
      footer={
        <>
          <Button size="xs" variant="ghost" onClick={onClose}>Cancel</Button>
          <Button size="xs" variant="primary" onClick={save} disabled={!name.trim() || !family.trim() || !url.trim() || saving}>
            {saving ? "Saving…" : isEditing ? "Save" : "Add font"}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {/* Instructions */}
        <div className="p-3 rounded-lg bg-primary-50/50 dark:bg-primary-900/20 text-xs text-stone-500 dark:text-stone-400 space-y-1.5">
          <p className="font-medium text-stone-600 dark:text-stone-300">How to add a font:</p>
          <ol className="list-decimal list-inside space-y-0.5 ml-1">
            <li>Go to <a href="https://fonts.google.com" target="_blank" rel="noopener" className="text-rust-500 hover:underline inline-flex items-center gap-0.5">fonts.google.com <ExternalLink className="w-2.5 h-2.5" /></a> and select your font</li>
            <li>Configure the styles you want (weights, italic, etc.)</li>
            <li>Copy the generated URL from the &quot;Use on the web&quot; section</li>
            <li>Paste it below — the system auto-extracts the axes</li>
          </ol>
        </div>

        {/* URL input — the primary field */}
        <Input
          label="Google Fonts URL"
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://fonts.googleapis.com/css2?family=Fraunces:ital,opsz,wght,SOFT,WONK@…"
          className="font-mono text-xs"
        />

        {/* Multi-family warning */}
        {parsed.multiFamily && (
          <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-900/20 text-xs text-amber-700 dark:text-amber-400">
            This URL contains multiple fonts — only the first ({parsed.family}) will be saved.
          </div>
        )}

        {/* Parsed axes display */}
        {parsed.axes && axisKeys.length > 0 && (
          <div className="p-3 rounded-lg border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900">
            <p className="text-xs font-display font-medium text-stone-500 uppercase tracking-wide mb-2">Detected axes</p>
            <div className="flex flex-wrap gap-1.5">
              {axisKeys.map(key => {
                const val = parsed.axes![key];
                const label = AXIS_LABELS[key] || key;
                let valStr = "";
                if (typeof val === "boolean") valStr = val ? "on" : "";
                else if (Array.isArray(val)) valStr = val[0] !== val[1] ? `${val[0]}..${val[1]}` : String(val[0]);
                return (
                  <span key={key} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-primary-100/60 text-primary-600 dark:bg-primary-900/30 dark:text-primary-400">
                    {label}{valStr && <span className="opacity-60">{valStr}</span>}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {/* Identity fields */}
        <Input label="Display name" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Fraunces, or Fraunces — Groups accent italic" />
        <Input label="CSS font-family stack" value={family} onChange={(e) => setFamily(e.target.value)} placeholder='"Fraunces", Georgia, serif' className="font-mono" />

        {/* Live preview */}
        {family.trim() && (
          <div className="pt-3 border-t border-primary-100 dark:border-stone-800 space-y-1">
            <p className="text-xs text-stone-400 mb-2">Preview</p>
            <p className="text-3xl" style={{ fontFamily: family.trim() }}>Aa Bb Cc 123</p>
            <p className="text-sm" style={{ fontFamily: family.trim(), fontStyle: parsed.axes?.ital ? "italic" : "normal" }}>The quick brown fox jumps over the lazy dog</p>
          </div>
        )}
      </div>
    </Modal>
  );
}
