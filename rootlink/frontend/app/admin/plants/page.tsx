"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Search, Plus, Pencil, Trash2, Upload, ExternalLink, Sprout, Flower2, ChevronDown } from "lucide-react";
import { useLocale } from "@/lib/locale-context";
import { Collapsible } from "@/components/Collapsible";
import { ImageUpload } from "@/components/ui/ImageUpload";

export default function AdminPlantsPage() {
  const { t } = useLocale();
  const [plants, setPlants] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<any | null>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [crawlName, setCrawlName] = useState("");
  const [crawling, setCrawling] = useState(false);
  const [crawlingAll, setCrawlingAll] = useState(false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (message) {
      const t = setTimeout(() => setMessage(null), 5000);
      return () => clearTimeout(t);
    }
  }, [message]);

  const loadPlants = async (q?: string) => {
    setLoading(true);
    try {
      const res = await api.plants.search({ q: q || "", limit: 100 });
      setPlants(res);
    } catch {} finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPlants(); }, []);

  const handleSearch = () => loadPlants(query);

  const handleDelete = async (id: number) => {
    if (!confirm(t("admin.delete_plant_confirm"))) return;
    try {
      await api.plants.delete(id);
      setMessage({ type: "success", text: "Plant deleted." });
      loadPlants();
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message || "Delete failed" });
    }
  };

  const handleCrawlAll = async () => {
    if (!confirm("Crawl all plants from UTAD? This may take a while.")) return;
    setCrawlingAll(true);
    setMessage(null);
    try {
      const res = await api.plants.crawlUtadAll();
      const updated = res.results?.filter((r: any) => r.status === "updated").length || 0;
      const notFound = res.results?.filter((r: any) => r.status === "not_found").length || 0;
      loadPlants();
      setMessage({ type: "success", text: `Crawl complete: ${updated} updated, ${notFound} not found (${res.total} total).` });
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message || "Batch crawl failed" });
    } finally {
      setCrawlingAll(false);
    }
  };

  const handleCrawl = async () => {
    if (!crawlName.trim()) return;
    setCrawling(true);
    setMessage(null);
    try {
      const result = await api.plants.crawlUtad(crawlName.trim());
      loadPlants();
      setCrawlName("");
      setMessage({ type: "success", text: `"${result.scientific_name || crawlName.trim()}" imported from UTAD.` });
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message || "Crawl failed" });
    } finally {
      setCrawling(false);
    }
  };

  const handleSave = async (data: any) => {
    setSaving(true);
    setMessage(null);
    try {
      if (editing?.id) {
        await api.plants.update(editing.id, data);
      } else {
        await api.plants.create(data);
      }
      setEditing(null);
      setShowAdd(false);
      setMessage({ type: "success", text: editing ? "Plant updated." : "Plant created." });
      loadPlants();
    } catch (err: any) {
      setMessage({ type: "error", text: err?.message || "Save failed" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div>
      {message && (
        <div className={`mb-4 px-4 py-3 rounded-lg text-sm font-medium ${
          message.type === "success" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
        }`}>
          {message.text}
          <button className="float-right font-bold" onClick={() => setMessage(null)}>×</button>
        </div>
      )}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-stone-800">{t("admin.plants_title")}</h1>
        <div className="flex gap-2">
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-1 bg-primary-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-primary-700"
          >
            <Plus className="w-4 h-4" /> {t("admin.plant_add")}
          </button>
        </div>
      </div>

      {/* UTAD crawl */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6">
        <div className="flex items-center gap-3">
          <Sprout className="w-5 h-5 text-amber-600 shrink-0" />
          <input
            type="text"
            value={crawlName}
            onChange={(e) => setCrawlName(e.target.value)}
            placeholder={t("admin.crawl_placeholder")}
            className="flex-1 border border-amber-300 rounded-lg px-3 py-2 text-sm"
          />
          <button
            onClick={handleCrawl}
            disabled={crawling || !crawlName.trim()}
            className="flex items-center gap-1 bg-amber-600 text-white px-3 py-2 rounded-lg text-sm hover:bg-amber-700 disabled:opacity-50"
          >
            <Upload className="w-4 h-4" /> {crawling ? t("common.loading") : t("admin.crawl_button")}
          </button>
        </div>
        <div className="mt-2 flex items-center gap-2 text-xs text-stone-500">
          <span className="ml-8">— or —</span>
          <button
            onClick={handleCrawlAll}
            disabled={crawlingAll}
            className="text-amber-700 hover:text-amber-800 underline font-medium disabled:opacity-50"
          >
            {crawlingAll ? "Crawling all plants..." : "Crawl all plants from UTAD"}
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="flex gap-2 mb-4">
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleSearch()}
          placeholder={t("admin.search_plants_placeholder")}
          className="flex-1 border border-stone-300 rounded-lg px-3 py-2 text-sm"
        />
        <button onClick={handleSearch} className="bg-stone-100 text-stone-600 px-3 py-2 rounded-lg hover:bg-stone-200">
          <Search className="w-4 h-4" />
        </button>
      </div>

      {/* Plant list */}
      {loading ? (
        <p className="text-stone-400 text-center py-8">{t("common.loading")}</p>
      ) : plants.length === 0 ? (
        <p className="text-stone-400 text-center py-8">{t("admin.no_plants")}</p>
      ) : (
        <div className="space-y-2">
          {plants.map((p) => (
            <PlantCard
              key={p.id}
              plant={p}
              expanded={expanded === p.id}
              onToggle={() => setExpanded(expanded === p.id ? null : p.id)}
              onEdit={() => setEditing(p)}
              onDelete={() => handleDelete(p.id)}
            />
          ))}
        </div>
      )}

      {/* Add/Edit modal */}
      {(showAdd || editing) && (
        <PlantFormModal
          plant={editing}
          onSave={handleSave}
          onClose={() => { setEditing(null); setShowAdd(false); }}
          saving={saving}
          t={t}
        />
      )}
    </div>
  );
}

function PlantCard({ plant, expanded, onToggle, onEdit, onDelete }: {
  plant: any;
  expanded: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const cn = (v: string | null | undefined, fallback?: string) => v ?? fallback ?? "—";
  const names = plant.common_names_pt?.join(", ") || "";
  const flowering = [plant.flowering_start, plant.flowering_end].filter(Boolean).join(" – ") || null;
  const hasDetail = plant.habitat || flowering || plant.distribution_general || plant.image_url;

  return (
    <div className="bg-white border border-stone-200 rounded-xl overflow-hidden">
      <div className="flex items-start gap-3 p-3">
        {plant.image_url ? (
          <img
            src={plant.image_url}
            alt={plant.scientific_name}
            loading="lazy"
            className="w-14 h-14 rounded-lg object-cover border border-stone-200 shrink-0"
          />
        ) : (
          <div className="w-14 h-14 rounded-lg bg-stone-100 flex items-center justify-center text-stone-300 shrink-0">
            <Sprout className="w-6 h-6" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-stone-800 text-sm">{cn(plant.common_names_pt?.[0], plant.scientific_name)}</span>
            {plant.plant_type && (
              <span className="text-[10px] bg-green-100 text-green-700 px-1.5 py-0.5 rounded-full font-medium">{plant.plant_type}</span>
            )}
            {plant.kc_mid != null && (
              <span className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded-full">Kc: {plant.kc_mid}</span>
            )}
          </div>
          <div className="text-xs text-stone-400 italic">{plant.scientific_name_full || plant.scientific_name}</div>
          {names && <div className="text-xs text-stone-500 mt-0.5">{names}</div>}
          {(flowering || plant.habitat) && (
            <div className="text-xs text-stone-400 mt-1 flex gap-3 flex-wrap">
              {flowering && <span><Flower2 className="w-3 h-3 inline mr-1" />{flowering}</span>}
              {plant.habitat && <span>{plant.habitat}</span>}
            </div>
          )}
        </div>
        <div className="flex items-center gap-1 shrink-0">
          <button onClick={onEdit} className="p-1.5 text-stone-400 hover:text-primary-600 rounded-lg hover:bg-stone-100">
            <Pencil className="w-4 h-4" />
          </button>
          <button onClick={onDelete} className="p-1.5 text-stone-400 hover:text-red-600 rounded-lg hover:bg-stone-100">
            <Trash2 className="w-4 h-4" />
          </button>
          {hasDetail && (
            <button onClick={onToggle} className="p-1.5 text-stone-400 hover:text-stone-600 rounded-lg hover:bg-stone-100">
              <ChevronDown className={`w-4 h-4 transition-transform ${expanded ? "rotate-180" : ""}`} />
            </button>
          )}
        </div>
      </div>
      <Collapsible open={expanded && hasDetail}>
        <div className="px-3 pb-3 pt-0 border-t border-stone-100 mt-0">
          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-stone-500 mt-2">
            {plant.distribution_general && (
              <div className="col-span-2">
                <span className="font-medium text-stone-600">Distribution: </span>{plant.distribution_general}
              </div>
            )}
            {plant.distribution_portugal?.length > 0 && (
              <div className="col-span-2">
                <span className="font-medium text-stone-600">PT regions: </span>{plant.distribution_portugal.join(", ")}
              </div>
            )}
            {plant.growth_form && (
              <div><span className="font-medium text-stone-600">Growth: </span>{plant.growth_form}</div>
            )}
            {plant.root_depth_cm != null && (
              <div><span className="font-medium text-stone-600">Root: </span>{plant.root_depth_cm} cm</div>
            )}
            {plant.row_spacing_cm && plant.plant_spacing_cm && (
              <div className="col-span-2"><span className="font-medium text-stone-600">Spacing: </span>{plant.row_spacing_cm}×{plant.plant_spacing_cm} cm</div>
            )}
            {plant.image_url && (
              <div className="col-span-2 mt-1">
                <img src={plant.image_url} alt="" loading="lazy" className="max-h-40 rounded border border-stone-200" />
              </div>
            )}
          </div>
        </div>
      </Collapsible>
    </div>
  );
}

function PlantFormModal({ plant, onSave, onClose, saving, t }: {
  plant: any | null;
  onSave: (data: any) => Promise<void>;
  onClose: () => void;
  saving: boolean;
  t: (key: string, vars?: any) => string;
}) {
  const [form, setForm] = useState<any>(
    plant || {
      scientific_name: "",
      scientific_name_full: "",
      common_names_pt: [],
      common_names_en: [],
      plant_type: "vegetable",
      family: "",
      genus: "",
      order_name: "",
      habitat: "",
      flowering_start: "",
      flowering_end: "",
      growth_form: "",
      distribution_general: "",
      image_url: "",
      kc_initial: null,
      kc_mid: null,
      kc_late: null,
      root_depth_cm: null,
      row_spacing_cm: null,
      plant_spacing_cm: null,
      sun_requirement: "",
      soil_drainage: "",
      notes: "",
    }
  );

  const set = (field: string, val: any) => setForm({ ...form, [field]: val });
  const num = (field: string) => (e: React.ChangeEvent<HTMLInputElement>) =>
    set(field, e.target.value ? parseFloat(e.target.value) : null);
  const str = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
    set(field, e.target.value);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  const Label = ({ children }: { children: React.ReactNode }) => (
    <label className="block text-xs font-semibold text-stone-500 uppercase tracking-wide mb-1">{children}</label>
  );

  return (
    <div className="fixed inset-0 bg-black/40 flex items-start justify-center z-50 pt-10" onClick={onClose}>
      <div className="bg-white rounded-xl p-6 max-w-2xl w-full mx-4 max-h-[85vh] overflow-y-auto shadow-xl" onClick={(e) => e.stopPropagation()}>
        <h2 className="text-lg font-bold text-stone-800 mb-5">
          {plant ? t("admin.plant_edit") : t("admin.plant_add")}
        </h2>

        {/* Image preview */}
        {plant?.image_url && (
          <div className="mb-5 rounded-lg overflow-hidden border border-stone-200">
            <img src={plant.image_url} alt="" loading="lazy" className="w-full max-h-48 object-cover" />
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          {/* Taxonomy section */}
          <fieldset>
            <legend className="text-sm font-semibold text-stone-700 mb-2 pb-1 border-b border-stone-200 w-full">Taxonomy</legend>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Scientific name *</Label>
                <input value={form.scientific_name || ""} onChange={str("scientific_name")} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm" required />
              </div>
              <div>
                <Label>Full name</Label>
                <input value={form.scientific_name_full || ""} onChange={str("scientific_name_full")} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <Label>Common names (pt)</Label>
                <input value={(form.common_names_pt || []).join(", ")} onChange={(e) => set("common_names_pt", e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean))} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <Label>Common names (en)</Label>
                <input value={(form.common_names_en || []).join(", ")} onChange={(e) => set("common_names_en", e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean))} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <Label>Genus</Label>
                <input value={form.genus || ""} onChange={str("genus")} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <Label>Family</Label>
                <input value={form.family || ""} onChange={str("family")} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <Label>Order</Label>
                <input value={form.order_name || ""} onChange={str("order_name")} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <Label>Growth form</Label>
                <input value={form.growth_form || ""} onChange={str("growth_form")} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
          </fieldset>

          {/* Type section */}
          <fieldset>
            <legend className="text-sm font-semibold text-stone-700 mb-2 pb-1 border-b border-stone-200 w-full">Classification</legend>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Plant type</Label>
                <select value={form.plant_type || "vegetable"} onChange={(e) => set("plant_type", e.target.value)} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm">
                  <option value="fruit_tree">Fruit tree</option>
                  <option value="vegetable">Vegetable</option>
                  <option value="herb">Herb</option>
                  <option value="flower">Flower</option>
                  <option value="shrub">Shrub</option>
                </select>
              </div>
              <div>
                <Label>Sun requirement</Label>
                <select value={form.sun_requirement || ""} onChange={(e) => set("sun_requirement", e.target.value)} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm">
                  <option value="">—</option>
                  <option value="full_sun">Full sun</option>
                  <option value="partial_shade">Partial shade</option>
                  <option value="shade">Shade</option>
                </select>
              </div>
              <div>
                <Label>Soil drainage</Label>
                <select value={form.soil_drainage || ""} onChange={(e) => set("soil_drainage", e.target.value)} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm">
                  <option value="">—</option>
                  <option value="well_drained">Well drained</option>
                  <option value="moist">Moist</option>
                  <option value="wet">Wet</option>
                  <option value="clay">Clay</option>
                </select>
              </div>
            </div>
          </fieldset>

          {/* Phenology section */}
          <fieldset>
            <legend className="text-sm font-semibold text-stone-700 mb-2 pb-1 border-b border-stone-200 w-full">Phenology & Ecology</legend>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Flowering start</Label>
                <input value={form.flowering_start || ""} onChange={str("flowering_start")} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <Label>Flowering end</Label>
                <input value={form.flowering_end || ""} onChange={str("flowering_end")} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="col-span-2">
                <Label>Habitat / Ecology</Label>
                <input value={form.habitat || ""} onChange={str("habitat")} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div className="col-span-2">
                <Label>General distribution</Label>
                <textarea value={form.distribution_general || ""} onChange={str("distribution_general")} rows={2} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm resize-none" />
              </div>
            </div>
          </fieldset>

          {/* Irrigation data */}
          <fieldset>
            <legend className="text-sm font-semibold text-stone-700 mb-2 pb-1 border-b border-stone-200 w-full">Irrigation</legend>
            <div className="grid grid-cols-3 gap-3">
              <div>
                <Label>Kc initial</Label>
                <input type="number" step="0.01" value={form.kc_initial ?? ""} onChange={num("kc_initial")} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <Label>Kc mid</Label>
                <input type="number" step="0.01" value={form.kc_mid ?? ""} onChange={num("kc_mid")} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <Label>Kc late</Label>
                <input type="number" step="0.01" value={form.kc_late ?? ""} onChange={num("kc_late")} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <Label>Root depth (cm)</Label>
                <input type="number" step="1" value={form.root_depth_cm ?? ""} onChange={num("root_depth_cm")} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <Label>Row spacing (cm)</Label>
                <input type="number" step="1" value={form.row_spacing_cm ?? ""} onChange={num("row_spacing_cm")} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <Label>Plant spacing (cm)</Label>
                <input type="number" step="1" value={form.plant_spacing_cm ?? ""} onChange={num("plant_spacing_cm")} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm" />
              </div>
            </div>
          </fieldset>

          {/* Image & notes */}
          <fieldset>
            <legend className="text-sm font-semibold text-stone-700 mb-2 pb-1 border-b border-stone-200 w-full">Media & Notes</legend>
            <div className="space-y-3">
              <ImageUpload
                onUpload={(urls) => set("image_url", urls.thumb)}
                label="Upload image"
                maxSizeMb={10}
              />
              <div>
                <Label>Or paste Image URL</Label>
                <input value={form.image_url || ""} onChange={str("image_url")} placeholder="https://..." className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm" />
              </div>
              <div>
                <Label>Notes</Label>
                <textarea value={form.notes || ""} onChange={str("notes")} rows={2} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm resize-none" />
              </div>
            </div>
          </fieldset>

          {/* Actions */}
          <div className="flex justify-end gap-2 pt-2 border-t border-stone-200">
            <button type="button" onClick={onClose} className="px-4 py-2 text-sm text-stone-600 hover:text-stone-800">
              {t("common.cancel")}
            </button>
            <button type="submit" disabled={saving} className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm hover:bg-primary-700 disabled:opacity-50">
              {saving ? t("common.saving") : t("common.save")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
