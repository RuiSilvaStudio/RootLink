"use client";

import { useState } from "react";
import { Button } from "@/components/ui/Button";
import { ImageUpload } from "@/components/ui/ImageUpload";

function Label({ children }: { children: React.ReactNode }) {
  return <label className="block text-xs font-medium text-stone-700 dark:text-stone-300 mb-1">{children}</label>;
}

export function PlantForm({ plant, onSave, onCancel, saving, t }: any) {
  const [form, setForm] = useState<any>(
    plant || {
      scientific_name: "",
      scientific_name_full: "",
      common_names_pt: [],
      common_names_en: [],
      genus: "",
      family: "",
      order_name: "",
      plant_type: "vegetable",
      growth_form: "",
      sun_requirement: "",
      soil_drainage: "",
      flowering_start: "",
      flowering_end: "",
      habitat: "",
      distribution_general: "",
      distribution_portugal: [],
      soil_texture: [],
      notes: "",
      image_url: "",
      sources: {},
    }
  );

  const set = (field: string, val: any) => setForm({ ...form, [field]: val });
  const str = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => set(field, e.target.value);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSave(form);
  };

  return (
    <div>
      {form.image_url && (
        <div className="mb-5 rounded-lg overflow-hidden border border-stone-200 dark:border-stone-700 max-w-sm">
          <img src={form.image_url} alt="" loading="lazy" className="w-full max-h-48 object-cover" />
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        <fieldset className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/60 dark:border-stone-800 p-6 shadow-sm">
          <legend className="text-sm font-display font-semibold text-stone-800 dark:text-stone-100 bg-stone-100 dark:bg-stone-800 px-3 py-1 rounded-full border border-stone-200/60 dark:border-stone-700 -ml-1">{t("plants.form.taxonomy")}</legend>
          <div className="grid md:grid-cols-2 gap-4 mt-2">
            <div>
              <Label>{t("plants.form.scientific_name")}</Label>
              <input value={form.scientific_name || ""} onChange={str("scientific_name")} className="w-full border border-stone-200 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 rounded-xl px-3 py-2 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15 focus:outline-none" required />
            </div>
            <div>
              <Label>{t("plants.form.full_name")}</Label>
              <input value={form.scientific_name_full || ""} onChange={str("scientific_name_full")} className="w-full border border-stone-200 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 rounded-xl px-3 py-2 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15 focus:outline-none" />
            </div>
            <div>
              <Label>{t("plants.form.common_names_pt")}</Label>
              <input value={(form.common_names_pt || []).join(", ")} onChange={(e) => set("common_names_pt", e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean))} className="w-full border border-stone-200 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 rounded-xl px-3 py-2 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15 focus:outline-none" />
            </div>
            <div>
              <Label>{t("plants.form.common_names_en")}</Label>
              <input value={(form.common_names_en || []).join(", ")} onChange={(e) => set("common_names_en", e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean))} className="w-full border border-stone-200 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 rounded-xl px-3 py-2 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15 focus:outline-none" />
            </div>
            <div>
              <Label>{t("plants.form.genus")}</Label>
              <input value={form.genus || ""} onChange={str("genus")} className="w-full border border-stone-200 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 rounded-xl px-3 py-2 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15 focus:outline-none" />
            </div>
            <div>
              <Label>{t("plants.form.family")}</Label>
              <input value={form.family || ""} onChange={str("family")} className="w-full border border-stone-200 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 rounded-xl px-3 py-2 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15 focus:outline-none" />
            </div>
            <div>
              <Label>{t("plants.form.order")}</Label>
              <input value={form.order_name || ""} onChange={str("order_name")} className="w-full border border-stone-200 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 rounded-xl px-3 py-2 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15 focus:outline-none" />
            </div>
            <div>
              <Label>{t("plants.form.growth_form")}</Label>
              <input value={form.growth_form || ""} onChange={str("growth_form")} className="w-full border border-stone-200 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 rounded-xl px-3 py-2 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15 focus:outline-none" />
            </div>
          </div>
        </fieldset>

        <fieldset className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/60 dark:border-stone-800 p-6 shadow-sm">
          <legend className="text-sm font-display font-semibold text-stone-800 dark:text-stone-100 bg-stone-100 dark:bg-stone-800 px-3 py-1 rounded-full border border-stone-200/60 dark:border-stone-700 -ml-1">{t("plants.form.classification")}</legend>
          <div className="grid md:grid-cols-2 gap-4 mt-2">
            <div>
              <Label>{t("plants.form.plant_type")}</Label>
              <select value={form.plant_type || "vegetable"} onChange={(e) => set("plant_type", e.target.value)} className="w-full border border-stone-200 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 rounded-xl px-3 py-2 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15 focus:outline-none">
                <option value="fruit_tree">{t("plants.form.plant_type_fruit_tree")}</option>
                <option value="vegetable">{t("plants.form.plant_type_vegetable")}</option>
                <option value="herb">{t("plants.form.plant_type_herb")}</option>
                <option value="flower">{t("plants.form.plant_type_flower")}</option>
                <option value="shrub">{t("plants.form.plant_type_shrub")}</option>
              </select>
            </div>
            <div>
              <Label>{t("plants.form.sun_requirement")}</Label>
              <select value={form.sun_requirement || ""} onChange={(e) => set("sun_requirement", e.target.value)} className="w-full border border-stone-200 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 rounded-xl px-3 py-2 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15 focus:outline-none">
                <option value="">—</option>
                <option value="full_sun">{t("plants.form.sun_full_sun")}</option>
                <option value="partial_shade">{t("plants.form.sun_partial_shade")}</option>
                <option value="shade">{t("plants.form.sun_shade")}</option>
              </select>
            </div>
            <div>
              <Label>{t("plants.form.soil_drainage")}</Label>
              <select value={form.soil_drainage || ""} onChange={(e) => set("soil_drainage", e.target.value)} className="w-full border border-stone-200 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 rounded-xl px-3 py-2 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15 focus:outline-none">
                <option value="">—</option>
                <option value="well_drained">{t("plants.form.drainage_well_drained")}</option>
                <option value="moist">{t("plants.form.drainage_moist")}</option>
                <option value="wet">{t("plants.form.drainage_wet")}</option>
                <option value="clay">{t("plants.form.drainage_clay")}</option>
              </select>
            </div>
            <div>
              <Label>{t("plants.form.soil_texture")}</Label>
              <input value={(form.soil_texture || []).join(", ")} onChange={(e) => set("soil_texture", e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean))} placeholder="sandy, loam, clay" className="w-full border border-stone-200 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 rounded-xl px-3 py-2 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15 focus:outline-none" />
            </div>
          </div>
        </fieldset>

        <fieldset className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/60 dark:border-stone-800 p-6 shadow-sm">
          <legend className="text-sm font-display font-semibold text-stone-800 dark:text-stone-100 bg-stone-100 dark:bg-stone-800 px-3 py-1 rounded-full border border-stone-200/60 dark:border-stone-700 -ml-1">{t("plants.form.phenology_ecology")}</legend>
          <div className="grid md:grid-cols-2 gap-4 mt-2">
            <div>
              <Label>{t("plants.form.flowering_start")}</Label>
              <input value={form.flowering_start || ""} onChange={str("flowering_start")} className="w-full border border-stone-200 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 rounded-xl px-3 py-2 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15 focus:outline-none" />
            </div>
            <div>
              <Label>{t("plants.form.flowering_end")}</Label>
              <input value={form.flowering_end || ""} onChange={str("flowering_end")} className="w-full border border-stone-200 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 rounded-xl px-3 py-2 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15 focus:outline-none" />
            </div>
            <div className="md:col-span-2">
              <Label>{t("plants.form.habitat")}</Label>
              <input value={form.habitat || ""} onChange={str("habitat")} className="w-full border border-stone-200 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 rounded-xl px-3 py-2 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15 focus:outline-none" />
            </div>
            <div className="md:col-span-2">
              <Label>{t("plants.form.general_distribution")}</Label>
              <textarea value={form.distribution_general || ""} onChange={str("distribution_general")} rows={2} className="w-full border border-stone-200 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 rounded-xl px-3 py-2 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15 focus:outline-none resize-none" />
            </div>
            <div className="md:col-span-2">
              <Label>{t("plants.form.portugal_distribution")}</Label>
              <input value={(form.distribution_portugal || []).join(", ")} onChange={(e) => set("distribution_portugal", e.target.value.split(",").map((s: string) => s.trim()).filter(Boolean))} placeholder="Minho, Algarve, Alentejo..." className="w-full border border-stone-200 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 rounded-xl px-3 py-2 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15 focus:outline-none" />
            </div>
          </div>
        </fieldset>

        <fieldset className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/60 dark:border-stone-800 p-6 shadow-sm">
          <legend className="text-sm font-display font-semibold text-stone-800 dark:text-stone-100 bg-stone-100 dark:bg-stone-800 px-3 py-1 rounded-full border border-stone-200/60 dark:border-stone-700 -ml-1">{t("plants.form.additional")}</legend>
          <div className="grid md:grid-cols-2 gap-4 mt-2">
            <div className="md:col-span-2">
              <Label>{t("plants.form.notes")}</Label>
              <textarea value={form.notes || ""} onChange={str("notes")} rows={3} className="w-full border border-stone-200 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 rounded-xl px-3 py-2 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15 focus:outline-none resize-none" />
            </div>
            <div className="md:col-span-2">
              <Label>{t("plants.form.image")}</Label>
              <ImageUpload label="" onUpload={(urls) => set("image_url", urls.large)} />
            </div>
          </div>
        </fieldset>

        <div className="flex items-center gap-3 pt-4 border-t border-stone-200 dark:border-stone-800">
          <Button type="submit" variant="primary" disabled={saving}>
            {saving ? t("plants.form.saving") : t("plants.form.save")}
          </Button>
          <Button type="button" variant="ghost" onClick={onCancel}>
            {t("plants.form.cancel")}
          </Button>
        </div>
      </form>
    </div>
  );
}
