"use client";

/**
 * Content Studio — Element Catalog (Phase 5).
 *
 * Spec: docs/content-studio/CONTENT_STUDIO.md §5 (element property schema), §3.1 (dashboard).
 *
 * The dashboard's element type registry. Manage which properties exist per
 * element type, whether they're intrinsic (part of the component) or extrinsic
 * (defaulted from theme, overridable per-instance), what control type to use,
 * and whether they're visible in the overlay's inspector.
 */

import { useState, useEffect, useCallback } from "react";
import { Loader2, Plus, Trash2, Eye, EyeOff } from "lucide-react";
import { useToast } from "@/lib/toast-context";
import { api } from "@/lib/api";

const CONTROL_TYPES = ["slider", "palette", "toggle", "button-group", "type-scale", "inline-text", "image-picker"];
const PROPERTY_TYPES = ["intrinsic", "extrinsic"];

interface SchemaRow {
  id: number;
  property_name: string;
  property_type: string;
  control_type: string;
  default_value: string | null;
  options: any;
  is_visible: boolean;
}

export default function ElementCatalogPage() {
  const { addToast } = useToast();
  const [schemas, setSchemas] = useState<Record<string, SchemaRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [addingProp, setAddingProp] = useState("");
  const [saving, setSaving] = useState<number | null>(null);

  const fetch = useCallback(async () => {
    try {
      const data = await api.elementSchemas.all();
      setSchemas(data);
      const types = Object.keys(data);
      if (types.length > 0 && !selectedType) setSelectedType(types[0]);
    } catch {} finally { setLoading(false); }
  }, [selectedType]);

  useEffect(() => { fetch(); }, [fetch]);

  const addProperty = async () => {
    if (!selectedType || !addingProp.trim()) return;
    try {
      await api.elementSchemas.upsert({
        element_type: selectedType,
        property_name: addingProp.trim(),
        property_type: "extrinsic",
        control_type: "slider",
        is_visible: true,
      });
      setAddingProp("");
      await fetch();
      addToast("success", "Property added");
    } catch (e: any) { addToast("error", e?.message || "Failed"); }
  };

  const updateRow = async (row: SchemaRow, field: string, value: any) => {
    setSaving(row.id);
    try {
      await api.elementSchemas.update(row.id, { [field]: value });
      await fetch();
    } catch (e: any) { addToast("error", e?.message); }
    finally { setSaving(null); }
  };

  const deleteRow = async (id: number) => {
    try {
      await api.elementSchemas.remove(id);
      await fetch();
      addToast("info", "Property removed");
    } catch (e: any) { addToast("error", e?.message); }
  };

  if (loading) return <div className="flex items-center justify-center h-full min-h-[60vh]"><Loader2 className="w-5 h-5 animate-spin text-stone-400" /></div>;

  const elementTypes = Object.keys(schemas).sort();
  const currentRows = selectedType ? schemas[selectedType] || [] : [];

  return (
    <div className="flex flex-col h-full">
      <div className="px-6 py-4 border-b border-primary-200/40 dark:border-stone-800">
        <h1 className="font-display text-xl font-semibold text-stone-800 dark:text-stone-100">Element Catalog</h1>
        <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">Manage element property schemas — intrinsic vs extrinsic, control type, inspector visibility</p>
      </div>

      <div className="flex-1 flex min-h-0">
        {/* Element type list */}
        <div className="w-48 shrink-0 border-r border-primary-200/40 dark:border-stone-800 p-3 overflow-y-auto">
          <p className="px-1 pb-2 text-[10px] uppercase tracking-wider text-stone-400 font-medium">Types</p>
          {elementTypes.map((type) => (
            <button key={type} onClick={() => setSelectedType(type)}
              className={`w-full px-2.5 py-2 rounded-md text-sm transition mb-1 capitalize ${selectedType === type ? "bg-primary-600 text-cream" : "text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800"}`}>
              {type} <span className={`text-[10px] ${selectedType === type ? "text-cream/60" : "text-stone-400"}`}>({schemas[type].length})</span>
            </button>
          ))}
        </div>

        {/* Property table */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6">
          {selectedType ? (
            <div className="max-w-3xl">
              <h2 className="font-display text-lg font-semibold capitalize text-stone-800 dark:text-stone-100 mb-4">{selectedType}</h2>
              <div className="space-y-2">
                {currentRows.map((row) => (
                  <div key={row.id} className={`flex items-center gap-3 p-3 rounded-lg border ${row.is_visible ? "border-stone-200/60 dark:border-stone-800" : "border-stone-200/30 dark:border-stone-800/50 opacity-60"}`}>
                    <button onClick={() => updateRow(row, "is_visible", !row.is_visible)} className="shrink-0" title={row.is_visible ? "Visible in inspector" : "Hidden"}>
                      {row.is_visible ? <Eye className="w-4 h-4 text-primary-500" /> : <EyeOff className="w-4 h-4 text-stone-400" />}
                    </button>
                    <code className="text-xs font-mono text-stone-600 dark:text-stone-300 flex-1 min-w-0 truncate">{row.property_name}</code>
                    <select value={row.property_type} onChange={(e) => updateRow(row, "property_type", e.target.value)} disabled={saving === row.id}
                      className="text-xs rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 px-2 py-1">
                      {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <select value={row.control_type} onChange={(e) => updateRow(row, "control_type", e.target.value)} disabled={saving === row.id}
                      className="text-xs rounded-md border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 px-2 py-1">
                      {CONTROL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    {row.default_value && <code className="text-[10px] font-mono text-stone-400 hidden sm:block">= {row.default_value}</code>}
                    <button onClick={() => deleteRow(row.id)} className="shrink-0 text-stone-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
              {/* Add property */}
              <div className="mt-4 flex items-center gap-2">
                <input type="text" value={addingProp} onChange={(e) => setAddingProp(e.target.value)} placeholder="e.g. box-shadow" onKeyDown={(e) => e.key === "Enter" && addProperty()}
                  className="flex-1 px-3 py-2 text-sm rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 focus:outline-none focus:ring-1 focus:ring-primary-500 font-mono" />
                <button onClick={addProperty} disabled={!addingProp.trim()} className="flex items-center gap-1 px-3 py-2 text-xs font-semibold rounded-lg bg-primary-600 hover:bg-primary-700 text-cream disabled:opacity-50"><Plus className="w-3.5 h-3.5" /> Add</button>
              </div>
            </div>
          ) : <div className="text-center py-20"><p className="text-sm text-stone-400 font-serif">Select an element type.</p></div>}
        </div>
      </div>
    </div>
  );
}
