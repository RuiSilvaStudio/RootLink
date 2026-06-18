"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { ArrowLeft, Droplets, Ruler, Sun, ChevronLeft, ChevronRight, Sprout, Shovel, Apple, ExternalLink, Notebook, Clock, Hash } from "lucide-react";
import { useLocale } from "@/lib/locale-context";
import { api } from "@/lib/api";
import { useSearchParams, useRouter } from "next/navigation";
import { ShareButton } from "@/components/ShareButton";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

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

function GardeningCalendarContent() {
  const { t, locale } = useLocale();
  const isPt = locale === "pt";
  const searchParams = useSearchParams();
  const router = useRouter();
  const inited = useRef(false);

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

  useEffect(() => {
    if (inited.current) return;
    inited.current = true;
    const m = searchParams.get("month");
    if (m) setCurrentMonth(parseInt(m));
    const z = searchParams.get("zone");
    if (z) setZone(z);
    const t = searchParams.get("type");
    if (t) setPlantType(t);
  }, [searchParams]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("zone", zone);
    params.set("month", String(currentMonth));
    if (plantType) params.set("type", plantType);
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [zone, plantType, currentMonth, router]);

  const plantTypes = Array.from(new Set(plants.map(p => p.plant_type).filter(Boolean))) as string[];

  const currentActive = plants.filter(p =>
    monthActive(p.sow_month_start, p.sow_month_end, currentMonth) ||
    monthActive(p.transplant_month_start, p.transplant_month_end, currentMonth) ||
    monthActive(p.harvest_month_start, p.harvest_month_end, currentMonth)
  );

  const countSow = currentActive.filter(p => monthActive(p.sow_month_start, p.sow_month_end, currentMonth)).length;
  const countTransplant = currentActive.filter(p => monthActive(p.transplant_month_start, p.transplant_month_end, currentMonth)).length;
  const countHarvest = currentActive.filter(p => monthActive(p.harvest_month_start, p.harvest_month_end, currentMonth)).length;

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-8 py-12">
      <a href="/tools" className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-primary-700 mb-6 transition">
        <ArrowLeft className="w-4 h-4" /> {t("tools.back")}
      </a>

      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center">
            <Sprout className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <h1 className="text-3xl font-serif font-bold text-stone-800">{t("tools.calendar_title")}</h1>
            <p className="text-stone-500 font-light">{t("tools.calendar_desc")}</p>
          </div>
        </div>
        <ShareButton url={typeof window !== "undefined" ? window.location.href : ""} title="Gardening Calendar" />
      </div>

      <div className="bg-stone-100/50 border border-stone-200/40 rounded-2xl px-4 py-2.5 mb-8 text-xs text-stone-400 flex items-center justify-end gap-2">
        <span className="text-[10px]">🇵🇹</span>
        <span className="font-light">{t("calc.portugal_disclaimer")}</span>
      </div>

      <div className="flex flex-wrap gap-3 mb-6">
        <select value={zone} onChange={(e) => setZone(e.target.value)}
          className="px-3 py-2 rounded-xl border border-primary-100 bg-white text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15">
          {ZONES.map(z => <option key={z.value} value={z.value}>{z.label}</option>)}
        </select>
        <select value={plantType} onChange={(e) => setPlantType(e.target.value)}
          className="px-3 py-2 rounded-xl border border-primary-100 bg-white text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15">
          <option value="">{t("calc.filter_type_all")}</option>
          {plantTypes.map(pt => (
            <option key={pt} value={pt}>{t(`calc.type_${pt}`)}</option>
          ))}
        </select>
      </div>

      {/* Month navigation */}
      <Card variant="plain" className="flex items-center justify-between mb-4 p-2">
        <button onClick={() => setCurrentMonth(m => m === 1 ? 12 : m - 1)}
          className="p-1.5 hover:bg-primary-50 rounded-lg transition">
          <ChevronLeft className="w-5 h-5 text-stone-600" />
        </button>
        <div className="flex gap-1 overflow-x-auto">
          {MONTHS.map(m => (
            <button key={m} onClick={() => setCurrentMonth(m)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                m === currentMonth ? "bg-primary-500 text-white shadow-sm" : "hover:bg-primary-50 text-stone-600"
              }`}
            >
              {t(`month.${m}`)}
            </button>
          ))}
        </div>
        <button onClick={() => setCurrentMonth(m => m === 12 ? 1 : m + 1)}
          className="p-1.5 hover:bg-primary-50 rounded-lg transition">
          <ChevronRight className="w-5 h-5 text-stone-600" />
        </button>
      </Card>

      {/* Summary badges */}
      {!loading && (
        <div className="flex gap-3 mb-6 text-sm">
          {countSow > 0 && (
            <Badge variant="green" className="flex items-center gap-1.5 px-3 py-1.5">
              <Sprout className="w-3.5 h-3.5" /> {countSow} {t("calendar.to_sow")}
            </Badge>
          )}
          {countTransplant > 0 && (
            <Badge variant="blue" className="flex items-center gap-1.5 px-3 py-1.5">
              <Shovel className="w-3.5 h-3.5" /> {countTransplant} {t("calendar.to_transplant")}
            </Badge>
          )}
          {countHarvest > 0 && (
            <Badge variant="earth" className="flex items-center gap-1.5 px-3 py-1.5">
              <Apple className="w-3.5 h-3.5" /> {countHarvest} {t("calendar.to_harvest")}
            </Badge>
          )}
          {currentActive.length === 0 && (
            <span className="text-stone-400 font-light">{t("calendar.nothing_this_month")}</span>
          )}
        </div>
      )}

      {/* Recommendations */}
      {!loading && currentActive.length > 0 && (
        <Card variant="plain" className="p-4 mb-4">
          <div className="flex items-start gap-3">
            <Clock className="w-5 h-5 text-stone-400 mt-0.5 shrink-0" />
            <div className="text-sm text-stone-600 space-y-1 font-light">
              <p>{t("calendar.tip_timing")}</p>
              <p>{zone === "cool" ? t("calendar.tip_cool") : zone === "hot" ? t("calendar.tip_hot") : t("calendar.tip_temperate")}</p>
              {countSow > 0 && <p>{t("calendar.tip_sow")}</p>}
              {countTransplant > 0 && <p>{t("calendar.tip_transplant")}</p>}
              {countHarvest > 0 && <p>{t("calendar.tip_harvest")}</p>}
            </div>
          </div>
          <div className="border-t border-primary-50 mt-3 pt-3">
            <a href="/tools/monthly-checklist"
              className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 font-medium"
            >
              <Notebook className="w-4 h-4" />
              {t("calendar.to_do_link")}
            </a>
            <span className="text-xs text-stone-400 ml-2 font-light">{t("calendar.to_do_desc")}</span>
          </div>
        </Card>
      )}

      {/* Loading */}
      {loading && (
        <div className="text-center text-stone-400 py-16 font-light">
          <Sprout className="w-8 h-8 mx-auto mb-3 text-stone-300 animate-pulse" />
          {t("common.loading")}
        </div>
      )}

      {/* Plant list */}
      {!loading && (
        <div className="space-y-1.5">
          {currentActive.map(p => (
            <Card key={p.id} variant="plain" className={`overflow-hidden ${expandedId === p.id ? "border-primary-200" : ""}`}>
              <button
                onClick={() => setExpandedId(expandedId === p.id ? null : p.id)}
                className="w-full text-left p-4 flex items-center gap-4 hover:bg-primary-50/30 transition"
              >
                {p.image_url && (
                  <img src={p.image_url} alt={p.scientific_name} loading="lazy"
                    className="w-10 h-10 object-cover rounded-lg shrink-0 bg-stone-100"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-stone-800 truncate">
                    {p.common_names_pt?.[0] || p.scientific_name}
                  </div>
                  <div className="text-xs text-stone-400 italic truncate font-light">{p.scientific_name}</div>
                </div>
                <div className="flex gap-1.5 text-xs shrink-0">
                  {monthActive(p.sow_month_start, p.sow_month_end, currentMonth) && (
                    <Badge variant="green" className="flex items-center gap-1">
                      <Sprout className="w-3 h-3" /> {t("calendar.sow")}
                    </Badge>
                  )}
                  {monthActive(p.transplant_month_start, p.transplant_month_end, currentMonth) && (
                    <Badge variant="blue" className="flex items-center gap-1">
                      <Shovel className="w-3 h-3" /> {t("calendar.transplant")}
                    </Badge>
                  )}
                  {monthActive(p.harvest_month_start, p.harvest_month_end, currentMonth) && (
                    <Badge variant="earth" className="flex items-center gap-1">
                      <Apple className="w-3 h-3" /> {t("calendar.harvest")}
                    </Badge>
                  )}
                </div>
              </button>

              {/* Expanded card */}
              {expandedId === p.id && (
                <div className="border-t border-primary-50 px-4 py-4 bg-stone-50">
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                    <div className="md:col-span-2">
                      <div className="text-xs text-stone-500 mb-2 font-medium">{t("calendar.month_bar")}</div>
                      {[
                        { key: "sow", start: p.sow_month_start, end: p.sow_month_end, color: "bg-green-400", label: t("calendar.sow") },
                        { key: "transplant", start: p.transplant_month_start, end: p.transplant_month_end, color: "bg-blue-400", label: t("calendar.transplant") },
                        { key: "harvest", start: p.harvest_month_start, end: p.harvest_month_end, color: "bg-amber-400", label: t("calendar.harvest") },
                      ].map(row => (
                        <div key={row.key} className="flex items-center gap-2 mb-1.5">
                          <span className="w-20 text-xs text-stone-500 shrink-0">{row.label}</span>
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
                      <div className="text-xs text-stone-500 mb-1 font-medium">{t("calendar.spacing")}</div>
                      <div className="font-medium text-sm">
                        {p.row_spacing_cm && p.plant_spacing_cm
                          ? `${p.row_spacing_cm} × ${p.plant_spacing_cm} cm`
                          : "—"}
                      </div>
                      {p.sowing_depth_cm != null && (
                        <div className="text-xs text-stone-500 mt-1 font-light">{t("calendar.sowing_depth")}: <strong className="font-medium">{p.sowing_depth_cm} cm</strong></div>
                      )}
                    </div>
                    <div>
                      {p.sowing_method && (
                        <div className="mb-1">
                          <div className="text-xs text-stone-500 mb-1 font-medium">{t("calendar.method")}</div>
                          <div className="font-medium text-sm">{p.sowing_method === "transplant" ? t("calendar.method_transplant") : t("calendar.method_direct")}</div>
                        </div>
                      )}
                      {p.sun_requirement && (
                        <div className="text-xs text-stone-500 flex items-center gap-1 mt-1">
                          <Sun className="w-3 h-3" />
                          {p.sun_requirement === "full_sun" ? t("calendar.full_sun") : p.sun_requirement === "part_shade" ? t("calendar.part_shade") : p.sun_requirement}
                        </div>
                      )}
                    </div>
                    <div>
                      <div className="text-xs text-stone-500 mb-1 font-medium">{t("calendar.maturity")}</div>
                      <div className="font-medium text-sm">
                        {p.days_to_maturity_min ? `${p.days_to_maturity_min}–${p.days_to_maturity_max ?? ""} ${t("calendar.days")}` : "—"}
                      </div>
                      {p.family && (
                        <div className="text-xs text-stone-400 mt-1 font-light">{p.genus} · {p.family}</div>
                      )}
                    </div>
                    <div className="md:col-span-4">
                      <div className="flex flex-wrap gap-2">
                        {p.kc_mid != null && <Badge variant="blue" className="text-[11px]">Kc = {p.kc_mid}</Badge>}
                        {p.drought_tolerance && <Badge variant="stone" className="text-[11px]">{t(`calc.tol_${p.drought_tolerance}`)}</Badge>}
                      </div>
                    </div>
                  </div>
                  <a
                    href={`/tools/irrigation-calculator?plant_id=${p.id}`}
                    className="inline-flex items-center gap-1.5 text-xs bg-primary-100 text-primary-700 hover:bg-primary-200 px-3 py-1.5 rounded-lg transition font-medium"
                  >
                    <Droplets className="w-3.5 h-3.5" />
                    {t("calendar.calc_irrigation")}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
              )}
            </Card>
          ))}
        </div>
      )}

      {/* Empty state */}
      {!loading && currentActive.length === 0 && (
        <Card variant="plain" className="p-12 text-center">
          <Sprout className="w-12 h-12 mx-auto mb-3 text-stone-300" />
          <p className="text-stone-400 font-light">{t("calendar.nothing_this_month")}</p>
        </Card>
      )}
    </div>
  );
}

export default function GardeningCalendarPage() {
  return (
    <Suspense fallback={<div className="max-w-7xl mx-auto px-4 sm:px-8 py-12 space-y-4"><div className="h-8 bg-primary-100 rounded w-96 animate-pulse" /><div className="h-4 bg-primary-100 rounded w-64 animate-pulse" /><div className="h-64 bg-primary-100 rounded-xl animate-pulse" /></div>}>
      <GardeningCalendarContent />
    </Suspense>
  );
}
