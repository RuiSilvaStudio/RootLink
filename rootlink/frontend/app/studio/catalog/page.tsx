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
import { Plus, Trash2, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { Button, Input, Tooltip, EmptyState } from "@/components/ui";
import { ListSkeleton, TextSkeleton } from "@/components/ui/LoadingSkeleton";
import { ResizableSplit } from "@/components/ui/ResizableSplit";
import { LoadError } from "@/components/studio/LoadError";
import { ComponentPreview } from "./ComponentPreview";
import { COMPONENT_GROUPS, GROUP_COLORS } from "../component-config";

const CONTROL_TYPES = ["slider", "palette", "toggle", "button-group", "type-scale", "font-family", "inline-text", "image-picker"];
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

// ── Page component ────────────────────────────────────────────────────────

export default function ElementCatalogPage() {
  const [schemas, setSchemas] = useState<Record<string, SchemaRow[]>>({});
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [addingProp, setAddingProp] = useState("");
  const [saving, setSaving] = useState<number | null>(null);

  const fetch = useCallback(async () => {
    try {
      const data = await api.elementSchemas.all();
      setSchemas(data);
      setLoadError(false);
      const types = Object.keys(data);
      if (types.length > 0 && !selectedType) setSelectedType(types[0]);
    } catch { setLoadError(true); } finally { setLoading(false); }
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
      toast.success("Property added");
    } catch (e: any) { toast.error(e?.message || "Failed"); }
  };

  const updateRow = async (row: SchemaRow, field: string, value: any) => {
    setSaving(row.id);
    try {
      await api.elementSchemas.update(row.id, { [field]: value });
      await fetch();
    } catch (e: any) { toast.error(e?.message); }
    finally { setSaving(null); }
  };

  const deleteRow = async (row: SchemaRow) => {
    if (!window.confirm(`Remove the property "${row.property_name}" from this element type?`)) return;
    try {
      await api.elementSchemas.remove(row.id);
      await fetch();
      toast.info("Property removed");
    } catch (e: any) { toast.error(e?.message); }
  };

  if (loading) {
    return (
      <div className="flex h-full min-h-[60vh]">
        <div className="hidden lg:block w-52 shrink-0 border-r border-primary-200/40 dark:border-stone-800 p-3">
          <ListSkeleton rows={7} />
        </div>
        <div className="flex-1 p-4 lg:p-6">
          <div className="max-w-3xl">
            <TextSkeleton lines={1} className="max-w-xs mb-6" />
            <ListSkeleton rows={5} />
          </div>
        </div>
      </div>
    );
  }

  if (loadError) return <div className="p-6 max-w-xl"><LoadError onRetry={fetch} /></div>;

  const elementTypes = Object.keys(schemas).sort();
  const currentRows = selectedType ? schemas[selectedType] || [] : [];

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 px-6 py-4 border-b border-primary-200/40 dark:border-stone-800">
        <h1 className="font-display text-xl font-semibold text-stone-800 dark:text-stone-100">Element Catalog</h1>
        <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">Manage element property schemas — intrinsic vs extrinsic, control type, inspector visibility</p>
      </div>

      <ResizableSplit
        defaultWidth={208}
        minWidth={160}
        maxWidth={320}
        className="flex-1"
        leftClassName="hidden lg:block"
        left={
          <div className="h-full border-r border-primary-200/40 dark:border-stone-800 p-3 overflow-y-auto">
            <p className="px-1 pb-2 text-xs uppercase tracking-wider text-stone-400 font-medium">Types</p>
            {elementTypes.map((type) => {
              const group = COMPONENT_GROUPS[type] || "";
              const dot = GROUP_COLORS[group] || "bg-stone-400";
              return (
                <button key={type} onClick={() => setSelectedType(type)}
                  className={`w-full px-2.5 py-2 rounded-md text-sm transition mb-1 flex items-center gap-2 ${
                    selectedType === type ? "bg-primary-600 text-cream" : "text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800"
                  }`}>
                  <span className={`w-2 h-2 rounded-full shrink-0 ${dot}`} />
                  <div className="min-w-0 flex-1 text-left">
                    <div className="truncate font-medium">{type}</div>
                    {group && <div className={`text-xs leading-tight ${selectedType === type ? "text-cream/60" : "text-stone-400"}`}>{group}</div>}
                  </div>
                  <span className={`text-xs shrink-0 ${selectedType === type ? "text-cream/60" : "text-stone-400"}`}>{schemas[type].length}</span>
                </button>
              );
            })}
          </div>
        }
        right={
          <div className="h-full overflow-y-auto p-4 lg:p-6">
          {selectedType ? (
            <div className="max-w-3xl">
              <ComponentPreview type={selectedType} />
              <h2 className="font-display text-lg font-semibold text-stone-800 dark:text-stone-100 mb-1 capitalize">{selectedType}</h2>
              {COMPONENT_GROUPS[selectedType] && (
                <p className="text-xs text-stone-400 mb-4">{COMPONENT_GROUPS[selectedType]}</p>
              )}
              <div className="space-y-2">
                {currentRows.map((row) => (
                  <div key={row.id} className={`flex items-center gap-3 p-3 rounded-lg border ${row.is_visible ? "border-stone-200/60 dark:border-stone-800" : "border-stone-200/30 dark:border-stone-800/50 opacity-60"}`}>
                    <Tooltip content={row.is_visible ? "Visible in inspector" : "Hidden from inspector"}>
                      <button
                        onClick={() => updateRow(row, "is_visible", !row.is_visible)}
                        aria-label={row.is_visible ? `Hide ${row.property_name} from inspector` : `Show ${row.property_name} in inspector`}
                        className="shrink-0"
                      >
                        {row.is_visible ? <Eye className="w-4 h-4 text-primary-500" /> : <EyeOff className="w-4 h-4 text-stone-400" />}
                      </button>
                    </Tooltip>
                    <code className="text-xs font-mono text-stone-600 dark:text-stone-300 flex-1 min-w-0 truncate">{row.property_name}</code>
                    <select value={row.property_type} onChange={(e) => updateRow(row, "property_type", e.target.value)} disabled={saving === row.id}
                      aria-label={`Property type for ${row.property_name}`}
                      className="text-xs px-2 py-1 rounded-lg border border-primary-200/60 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 transition-all duration-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15 focus:outline-none">
                      {PROPERTY_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    <select value={row.control_type} onChange={(e) => updateRow(row, "control_type", e.target.value)} disabled={saving === row.id}
                      aria-label={`Control type for ${row.property_name}`}
                      className="text-xs px-2 py-1 rounded-lg border border-primary-200/60 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 transition-all duration-200 focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15 focus:outline-none">
                      {CONTROL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}
                    </select>
                    {row.default_value && <code className="text-xs font-mono text-stone-400 hidden sm:block">= {row.default_value}</code>}
                    <Tooltip content="Remove property">
                      <button onClick={() => deleteRow(row)} aria-label={`Remove property ${row.property_name}`} className="shrink-0 text-stone-400 hover:text-red-500"><Trash2 className="w-3.5 h-3.5" /></button>
                    </Tooltip>
                  </div>
                ))}
              </div>
              {/* Add property */}
              <div className="mt-4 flex items-center gap-2">
                <div className="flex-1">
                  <Input type="text" value={addingProp} onChange={(e) => setAddingProp(e.target.value)} placeholder="e.g. box-shadow" onKeyDown={(e) => e.key === "Enter" && addProperty()}
                    aria-label="New property name" className="font-mono" />
                </div>
                <Button size="xs" onClick={addProperty} disabled={!addingProp.trim()}>
                  <Plus className="w-3.5 h-3.5" /> Add
                </Button>
              </div>
            </div>
          ) : <EmptyState title="No element type selected" message="Select an element type from the left to view and curate its property schema." />}
          </div>
        }
      />
    </div>
  );
}
