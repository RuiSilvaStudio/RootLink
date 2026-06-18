"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { Sprout, Sun, Droplets, Ruler, Calendar, MapPin, Bug, BookOpen, ExternalLink, ArrowLeft, Loader2 } from "lucide-react";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/locale-context";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function Section({ icon: Icon, title, children }: { icon: any; title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-primary-100/40 bg-white p-5">
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-primary-500" />
        <h3 className="text-sm font-display font-semibold text-stone-700 uppercase tracking-wider">{title}</h3>
      </div>
      {children}
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: React.ReactNode }) {
  if (!value) return null;
  return (
    <div className="flex justify-between py-1.5 border-b border-stone-100 last:border-0">
      <span className="text-xs text-stone-500">{label}</span>
      <span className="text-sm text-stone-700 font-medium text-right">{value}</span>
    </div>
  );
}

function MonthBar({ start, end, label, color }: { start?: number | null; end?: number | null; label: string; color: string }) {
  if (!start || !end) return null;
  return (
    <div className="flex items-center gap-2">
      <span className="text-[10px] text-stone-400 w-16 shrink-0">{label}</span>
      <div className="flex gap-0.5 flex-1">
        {MONTHS.map((_, i) => {
          const month = i + 1;
          let active = false;
          if (start <= end) {
            active = month >= start && month <= end;
          } else {
            active = month >= start || month <= end;
          }
          return (
            <div
              key={i}
              className={`h-4 flex-1 rounded-sm transition-colors ${active ? color : "bg-stone-100"}`}
              title={MONTHS[i]}
            />
          );
        })}
      </div>
    </div>
  );
}

export default function PlantDetailPage() {
  const { id } = useParams();
  const { t } = useLocale();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setError(false);
    api.plants.getDetail(Number(id))
      .then((d) => { if (!cancelled) setData(d); })
      .catch(() => { if (!cancelled) setError(true); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [id]);

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-8 py-20 flex items-center justify-center">
        <Loader2 className="w-6 h-6 text-primary-400 animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-8 py-20 text-center">
        <p className="text-stone-500">Plant not found</p>
        <a href="/plants" className="text-primary-600 text-sm mt-2 inline-block hover:underline">Back to plants</a>
      </div>
    );
  }

  const p = data.plant;
  const external = data.external || {};

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-12">
      <a href="/plants" className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-primary-700 mb-6 transition">
        <ArrowLeft className="w-4 h-4" />
        {t("plants.back") || "Back to plants"}
      </a>

      {/* Hero */}
      <div className="flex flex-col sm:flex-row gap-6 mb-8">
        <div className="w-full sm:w-48 h-48 rounded-2xl bg-primary-50 flex items-center justify-center overflow-hidden shrink-0">
          {p.image_url ? (
            <img src={p.image_url} alt={p.scientific_name} className="w-full h-full object-cover" />
          ) : (
            <Sprout className="w-12 h-12 text-primary-300" />
          )}
        </div>
        <div className="flex-1">
          <h1 className="text-3xl font-display font-bold text-stone-800 italic">{p.scientific_name}</h1>
          {p.scientific_name_full && p.scientific_name_full !== p.scientific_name && (
            <p className="text-sm text-stone-400 italic mt-1">{p.scientific_name_full}</p>
          )}
          <div className="flex flex-wrap gap-2 mt-3">
            {p.common_names_en && p.common_names_en.map((n: string) => (
              <Badge key={n} variant="sage">{n}</Badge>
            ))}
            {p.common_names_pt && p.common_names_pt.map((n: string) => (
              <Badge key={n} variant="earth">{n}</Badge>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {p.plant_type && <Badge variant="sage">{p.plant_type}</Badge>}
            {p.growth_form && <Badge variant="stone">{p.growth_form}</Badge>}
            {p.sun_requirement && <Badge variant="blue">{p.sun_requirement}</Badge>}
          </div>
        </div>
      </div>

      {/* Content grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Taxonomy */}
        <Section icon={BookOpen} title={t("plants.taxonomy") || "Taxonomy"}>
          <DataRow label="Family" value={p.family} />
          <DataRow label="Genus" value={p.genus} />
          <DataRow label="Order" value={p.order_name} />
          <DataRow label="Class" value={p.class_name} />
          <DataRow label="Division" value={p.division} />
        </Section>

        {/* Growth */}
        <Section icon={Sprout} title={t("plants.growth") || "Growth"}>
          <DataRow label="Height" value={p.height_cm ? `${p.height_cm} cm` : null} />
          <DataRow label="Growth habit" value={p.growth_habit} />
          <DataRow label="Days to maturity" value={p.days_to_maturity_min && p.days_to_maturity_max ? `${p.days_to_maturity_min}–${p.days_to_maturity_max} days` : null} />
        </Section>

        {/* Sowing Calendar */}
        <Section icon={Calendar} title={t("plants.sowing_calendar") || "Sowing Calendar"}>
          <div className="space-y-2">
            <MonthBar start={p.sow_month_start} end={p.sow_month_end} label="Sow" color="bg-primary-500" />
            <MonthBar start={p.transplant_month_start} end={p.transplant_month_end} label="Transplant" color="bg-blue-400" />
            <MonthBar start={p.harvest_month_start} end={p.harvest_month_end} label="Harvest" color="bg-amber-500" />
          </div>
          <div className="mt-3">
            <DataRow label="Flowering" value={p.flowering_start && p.flowering_end ? `${p.flowering_start} – ${p.flowering_end}` : null} />
          </div>
        </Section>

        {/* Sun & Soil */}
        <Section icon={Sun} title={t("plants.sun_soil") || "Sun & Soil"}>
          <DataRow label="Sun" value={p.sun_requirement} />
          <DataRow label="Soil pH" value={p.soil_ph_min && p.soil_ph_max ? `${p.soil_ph_min} – ${p.soil_ph_max}` : null} />
          <DataRow label="Soil texture" value={p.soil_texture ? p.soil_texture.join(", ") : null} />
          <DataRow label="Drainage" value={p.soil_drainage} />
        </Section>

        {/* Water & Irrigation */}
        <Section icon={Droplets} title={t("plants.water") || "Water & Irrigation"}>
          <DataRow label="Root depth" value={p.root_depth_cm ? `${p.root_depth_cm} cm` : null} />
          <DataRow label="Drought tolerance" value={p.drought_tolerance} />
          <DataRow label="Water frequency" value={p.water_frequency_days ? `Every ${p.water_frequency_days} days` : null} />
        </Section>

        {/* Spacing */}
        <Section icon={Ruler} title={t("plants.spacing") || "Spacing & Sowing"}>
          <DataRow label="Row spacing" value={p.row_spacing_cm ? `${p.row_spacing_cm} cm` : null} />
          <DataRow label="Plant spacing" value={p.plant_spacing_cm ? `${p.plant_spacing_cm} cm` : null} />
          <DataRow label="Sowing depth" value={p.sowing_depth_cm ? `${p.sowing_depth_cm} cm` : null} />
          <DataRow label="Sowing method" value={p.sowing_method} />
        </Section>

        {/* Climate */}
        <Section icon={Sun} title={t("plants.climate") || "Climate"}>
          <DataRow label="USDA zones" value={p.usda_zone_min && p.usda_zone_max ? `${p.usda_zone_min} – ${p.usda_zone_max}` : null} />
          <DataRow label="Chill hours" value={p.chill_hours ? `${p.chill_hours}h` : null} />
        </Section>

        {/* Distribution */}
        <Section icon={MapPin} title={t("plants.distribution") || "Distribution"}>
          <DataRow label="Habitat" value={p.habitat} />
          <DataRow label="Portugal" value={p.distribution_portugal ? p.distribution_portugal.join(", ") : null} />
          <DataRow label="General" value={p.distribution_general} />
        </Section>
      </div>

      {/* Pests */}
      {p.pests && p.pests.length > 0 && (
        <div className="mt-4">
          <Section icon={Bug} title={t("plants.pests") || "Pests"}>
            <div className="flex flex-wrap gap-2">
              {p.pests.map((pest: any, i: number) => (
                <Badge key={i} variant="stone">{typeof pest === "string" ? pest : pest.name || JSON.stringify(pest)}</Badge>
              ))}
            </div>
          </Section>
        </div>
      )}

      {/* Notes */}
      {p.notes && (
        <div className="mt-4">
          <Section icon={BookOpen} title={t("plants.notes") || "Notes"}>
            <p className="text-sm text-stone-600 leading-relaxed whitespace-pre-line">{p.notes}</p>
          </Section>
        </div>
      )}

      {/* External Data */}
      {(external.inaturalist?.taxa?.length > 0 || external.gbif?.species?.length > 0) && (
        <div className="mt-4">
          <Section icon={ExternalLink} title={t("plants.external_data") || "External Data"}>
            {/* iNaturalist */}
            {external.inaturalist?.taxa?.length > 0 && (
              <div className="mb-4">
                <p className="text-xs text-stone-400 uppercase tracking-wider mb-2">iNaturalist</p>
                {external.inaturalist.taxa.map((taxon: any) => (
                  <div key={taxon.id} className="flex items-center gap-3 py-2 border-b border-stone-100 last:border-0">
                    {taxon.image_url && (
                      <img src={taxon.image_url} alt="" className="w-8 h-8 rounded-lg object-cover" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-stone-700 italic">{taxon.name}</p>
                      {taxon.common_name && <p className="text-xs text-stone-500">{taxon.common_name}</p>}
                    </div>
                    <span className="text-[10px] text-stone-400">{taxon.observations_count?.toLocaleString()} obs</span>
                  </div>
                ))}
              </div>
            )}

            {/* GBIF */}
            {external.gbif?.occurrences_pt?.occurrences?.length > 0 && (
              <div>
                <p className="text-xs text-stone-400 uppercase tracking-wider mb-2">
                  GBIF Portugal — {external.gbif.occurrences_pt.total.toLocaleString()} occurrences
                </p>
                {external.gbif.occurrences_pt.occurrences.slice(0, 5).map((occ: any) => (
                  <div key={occ.key} className="py-2 border-b border-stone-100 last:border-0">
                    <p className="text-sm text-stone-700">{occ.locality || occ.county || occ.state_province || "Portugal"}</p>
                    <p className="text-[10px] text-stone-400">{occ.date || "Unknown date"} — {occ.basis_of_record}</p>
                  </div>
                ))}
              </div>
            )}
          </Section>
        </div>
      )}

      {/* Sources */}
      {p.sources && Object.keys(p.sources).length > 0 && (
        <div className="mt-4">
          <Section icon={ExternalLink} title={t("plants.sources") || "Sources"}>
            <div className="space-y-1">
              {Object.entries(p.sources).map(([key, url]) => (
                <a
                  key={key}
                  href={url as string}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-800 transition"
                >
                  <ExternalLink className="w-3 h-3" />
                  {key}
                </a>
              ))}
            </div>
          </Section>
        </div>
      )}
    </div>
  );
}
