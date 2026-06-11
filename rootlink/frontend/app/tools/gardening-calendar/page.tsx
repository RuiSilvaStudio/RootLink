"use client";

import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Droplets, Ruler, Sun, ChevronLeft, ChevronRight, Sprout, Shovel, Apple, ExternalLink, Notebook, Clock } from "lucide-react";
import { useLocale } from "@/lib/locale-context";
import { api } from "@/lib/api";

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

const ZONES = [
  { value: "cool", label: "Fria (Norte / Serras)" },
  { value: "moderate", label: "Temperada (Centro / Litoral)" },
  { value: "warm", label: "Quente (Sul / Interior)" },
  { value: "hot", label: "Muito quente (Algarve / Vale do Tejo)" },
];

function monthActive(start: number | null, end: number | null, month: number): boolean {
  if (start == null || end == null) return false;
  if (start <= end) return month >= start && month <= end;
  return month >= start || month <= end;
}

export default function GardeningCalendarPage() {
  const { t, locale } = useLocale();
  const isPt = locale === "pt";

  const [zone, setZone] = useState("moderate");
  const [plantType, setPlantType] = useState("");
  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [plants, setPlants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<number | null>(null);

  const fetchCalendar = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.plants.calendar({ zone, plant_type: plantType || undefined });
      setPlants(res);
    } catch {} finally {
      setLoading(false);
    }
  }, [zone, plantType]);

  useEffect(() => { fetchCalendar(); }, [fetchCalendar]);

  const plantTypes = Array.from(new Set(plants.map(p => p.plant_type).filter(Boolean))).sort() as string[];

  const currentActive = plants.filter(p =>
    monthActive(p.sow_month_start, p.sow_month_end, currentMonth) ||
    monthActive(p.transplant_month_start, p.transplant_month_end, currentMonth) ||
    monthActive(p.harvest_month_start, p.harvest_month_end, currentMonth)
  );

  const countSow = currentActive.filter(p => monthActive(p.sow_month_start, p.sow_month_end, currentMonth)).length;
  const countTransplant = currentActive.filter(p => monthActive(p.transplant_month_start, p.transplant_month_end, currentMonth)).length;
  const countHarvest = currentActive.filter(p => monthActive(p.harvest_month_start, p.harvest_month_end, currentMonth)).length;

  return (
    <div className="max-w-7xl mx-auto px-4 py-12">
      <a href="/tools" className="flex items-center gap-1 text-sm text-stone-500 hover:text-primary-700 mb-6">
        <ArrowLeft className="w-4 h-4" /> {t("tools.back")}
      </a>

      <h1 className="text-3xl font-bold text-stone-800 font-serif mb-2">{t("tools.calendar_title")}</h1>
      <p className="text-stone-600 mb-4">{t("tools.calendar_desc")}</p>

      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 mb-6 text-xs text-amber-700 flex items-center gap-2">
        <span>🇵🇹</span>
        <span>{t("calc.portugal_disclaimer")}</span>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <select value={zone} onChange={(e) => setZone(e.target.value)}
          className="border border-stone-300 rounded-lg px-3 py-2 text-sm bg-white">
          {ZONES.map(z => <option key={z.value} value={z.value}>{z.label}</option>)}
        </select>
        <select value={plantType} onChange={(e) => setPlantType(e.target.value)}
          className="border border-stone-300 rounded-lg px-3 py-2 text-sm bg-white">
          <option value="">{t("calc.filter_type_all")}</option>
          {plantTypes.map(pt => (
            <option key={pt} value={pt}>{t(`calc.type_${pt}`)}</option>
          ))}
        </select>
      </div>

      {/* Month navigation */}
      <div className="flex items-center justify-between mb-4 bg-white border border-stone-200 rounded-xl p-3">
        <button onClick={() => setCurrentMonth(m => m === 1 ? 12 : m - 1)}
          className="p-1.5 hover:bg-stone-100 rounded-lg">
          <ChevronLeft className="w-5 h-5 text-stone-600" />
        </button>
        <div className="flex gap-1 overflow-x-auto">
          {MONTHS.map(m => (
            <button key={m} onClick={() => setCurrentMonth(m)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                m === currentMonth ? "bg-primary-600 text-white" : "hover:bg-stone-100 text-stone-600"
              }`}
            >
              {t(`month.${m}`)}
            </button>
          ))}
        </div>
        <button onClick={() => setCurrentMonth(m => m === 12 ? 1 : m + 1)}
          className="p-1.5 hover:bg-stone-100 rounded-lg">
          <ChevronRight className="w-5 h-5 text-stone-600" />
        </button>
      </div>

      {/* Summary */}
      {!loading && (
        <div className="flex gap-3 mb-6 text-sm">
          {countSow > 0 && (
            <span className="bg-green-100 text-green-700 px-3 py-1.5 rounded-full flex items-center gap-1.5">
              <Sprout className="w-4 h-4" /> {countSow} {t("calendar.to_sow")}
            </span>
          )}
          {countTransplant > 0 && (
            <span className="bg-blue-100 text-blue-700 px-3 py-1.5 rounded-full flex items-center gap-1.5">
              <Shovel className="w-4 h-4" /> {countTransplant} {t("calendar.to_transplant")}
            </span>
          )}
          {countHarvest > 0 && (
            <span className="bg-orange-100 text-orange-700 px-3 py-1.5 rounded-full flex items-center gap-1.5">
              <Apple className="w-4 h-4" /> {countHarvest} {t("calendar.to_harvest")}
            </span>
          )}
          {currentActive.length === 0 && (
            <span className="text-stone-400">{t("calendar.nothing_this_month")}</span>
          )}
        </div>
      )}

      {/* Recommendations */}
      {!loading && currentActive.length > 0 && (
        <div className="bg-white border border-stone-200 rounded-xl p-4 mb-4">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-stone-400 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-stone-600 space-y-1">
              <p>{t("calendar.tip_timing")}</p>
              <p>{zone === "cool" ? t("calendar.tip_cool") : zone === "hot" ? t("calendar.tip_hot") : t("calendar.tip_temperate")}</p>
              {countSow > 0 && <p>{t("calendar.tip_sow")}</p>}
              {countTransplant > 0 && <p>{t("calendar.tip_transplant")}</p>}
              {countHarvest > 0 && <p>{t("calendar.tip_harvest")}</p>}
            </div>
          </div>
          <div className="border-t border-stone-100 mt-3 pt-3">
            <a href="/tools/monthly-checklist"
              className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              <Notebook className="w-4 h-4" />
              {t("calendar.to_do_link")}
            </a>
            <span className="text-xs text-stone-400 ml-2">{t("calendar.to_do_desc")}</span>
          </div>
        </div>
      )}

      {/* Plant list */}
      {loading && <div className="text-center text-stone-400 py-12">{t("common.loading")}</div>}

      {!loading && (
        <div className="space-y-1.5">
          {currentActive.map(p => (
            <div key={p.id} className="bg-white border border-stone-200 rounded-xl overflow-hidden">
              <button
                onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                className="w-full text-left p-4 flex items-center gap-4 hover:bg-stone-50 transition"
              >
                {p.image_url && (
                  <img src={p.image_url} alt={p.scientific_name}
                    className="w-10 h-10 object-cover rounded-lg flex-shrink-0 bg-stone-100"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-stone-800 truncate">
                    {p.common_names_pt?.[0] || p.scientific_name}
                  </div>
                  <div className="text-xs text-stone-400 italic truncate">{p.scientific_name}</div>
                </div>
                <div className="flex gap-2 text-xs">
                  {monthActive(p.sow_month_start, p.sow_month_end, currentMonth) && (
                    <span className="bg-green-100 text-green-700 px-2 py-1 rounded-md flex items-center gap-1">
                      <Sprout className="w-3 h-3" /> {t("calendar.sow")}
                    </span>
                  )}
                  {monthActive(p.transplant_month_start, p.transplant_month_end, currentMonth) && (
                    <span className="bg-blue-100 text-blue-700 px-2 py-1 rounded-md flex items-center gap-1">
                      <Shovel className="w-3 h-3" /> {t("calendar.transplant")}
                    </span>
                  )}
                  {monthActive(p.harvest_month_start, p.harvest_month_end, currentMonth) && (
                    <span className="bg-orange-100 text-orange-700 px-2 py-1 rounded-md flex items-center gap-1">
                      <Apple className="w-3 h-3" /> {t("calendar.harvest")}
                    </span>
                  )}
                </div>
              </button>

              {/* Expanded card */}
              {expandedId === p.id && (
                <div className="border-t border-stone-100 px-4 py-4 bg-stone-50">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="md:col-span-2">
                      <div className="text-xs text-stone-500 mb-2">{t("calendar.month_bar")}</div>
                      {[
                        { key: "sow", start: p.sow_month_start, end: p.sow_month_end, color: "bg-green-400", label: t("calendar.sow") },
                        { key: "transplant", start: p.transplant_month_start, end: p.transplant_month_end, color: "bg-blue-400", label: t("calendar.transplant") },
                        { key: "harvest", start: p.harvest_month_start, end: p.harvest_month_end, color: "bg-orange-400", label: t("calendar.harvest") },
                      ].map(row => (
                        <div key={row.key} className="flex items-center gap-2 mb-1.5">
                          <span className="w-20 text-xs text-stone-500 flex-shrink-0">{row.label}</span>
                          <div className="flex gap-0.5 flex-1">
                            {MONTHS.map(m => (
                              <div key={m} className={`w-3 h-4 rounded-sm ${monthActive(row.start, row.end, m) ? row.color : "bg-stone-100"}`}
                                title={`${t(`month.${m}`)}: ${monthActive(row.start, row.end, m) ? row.label : "—"}`}
                              />
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div>
                      <div className="text-xs text-stone-500 mb-1">{t("calendar.spacing")}</div>
                      <div className="font-medium text-sm">
                        {p.row_spacing_cm && p.plant_spacing_cm
                          ? `${p.row_spacing_cm} × ${p.plant_spacing_cm} cm`
                          : "—"}
                      </div>
                      {p.sowing_depth_cm != null && (
                        <div className="text-xs text-stone-500 mt-1">{t("calendar.sowing_depth")}: <strong>{p.sowing_depth_cm} cm</strong></div>
                      )}
                    </div>
                    <div>
                      {p.sowing_method && (
                        <div className="mb-1">
                          <div className="text-xs text-stone-500 mb-1">{t("calendar.method")}</div>
                          <div className="font-medium text-sm">{p.sowing_method === "transplant" ? t("calendar.method_transplant") : t("calendar.method_direct")}</div>
                        </div>
                      )}
                      {p.sun_requirement && (
                        <div className={`text-xs text-stone-500 flex items-center gap-1 ${p.sowing_method ? '' : ''}`}>
                          <Sun className="w-3 h-3" />
                          {p.sun_requirement === "full_sun" ? t("calendar.full_sun") : p.sun_requirement === "part_shade" ? t("calendar.part_shade") : p.sun_requirement}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-xs text-stone-500 mb-1">{t("calendar.maturity")}</div>
                      <div className="font-medium text-sm">
                        {p.days_to_maturity_min ? `${p.days_to_maturity_min}–${p.days_to_maturity_max ?? ""} ${t("calendar.days")}` : "—"}
                      </div>
                      {p.family && (
                        <div className="text-xs text-stone-500 mt-1">{p.genus} · {p.family}</div>
                      )}
                    </div>
                  </div>
                  <a
                    href={`/tools/irrigation-calculator?plant_id=${p.id}`}
                    className="inline-flex items-center gap-1.5 text-xs bg-primary-100 text-primary-700 hover:bg-primary-200 px-3 py-1.5 rounded-lg transition"
                  >
                    <Droplets className="w-3.5 h-3.5" />
                    {t("calendar.calc_irrigation")}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {!loading && currentActive.length === 0 && (
        <div className="bg-white border border-stone-200 rounded-xl p-12 text-center text-stone-400">
          <Sprout className="w-12 h-12 mx-auto mb-3 text-stone-300" />
          <p>{t("calendar.nothing_this_month")}</p>
        </div>
      )}
    </div>
  );
}
