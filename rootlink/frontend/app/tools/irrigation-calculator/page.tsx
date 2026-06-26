"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Search, Droplets, Ruler, ThermometerSun, ToggleLeft, ToggleRight, Leaf, ChevronRight } from "lucide-react";
import { useLocale } from "@/lib/locale-context";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { Section } from "@/components/ui/Section";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { ShareButton } from "@/components/ShareButton";
import { api } from "@/lib/api";

const GROWTH_STAGES = ["initial", "mid", "late"] as const;

const CLIMATES = (t: (key: string) => string) => [
  { value: "cool", label: t("calc.climate_cool"), eto: 2.5 },
  { value: "moderate", label: t("calc.climate_moderate"), eto: 4.0 },
  { value: "warm", label: t("calc.climate_warm"), eto: 6.0 },
  { value: "hot", label: t("calc.climate_hot"), eto: 7.5 },
];

const SEASONS = (t: (key: string) => string) => [
  { value: "spring", label: t("calc.season_spring"), factor: 1.0 },
  { value: "summer", label: t("calc.season_summer"), factor: 1.4 },
  { value: "fall", label: t("calc.season_fall"), factor: 0.7 },
  { value: "winter", label: t("calc.season_winter"), factor: 0.35 },
];

const SOILS = (t: (key: string) => string) => [
  { value: "sandy", label: t("calc.soil_sandy"), factor: 0.5 },
  { value: "loamy", label: t("calc.soil_loamy"), factor: 0.8 },
  { value: "clay", label: t("calc.soil_clay"), factor: 0.95 },
  { value: "stony", label: t("calc.soil_stony"), factor: 0.55 },
];

const RAIN = (t: (key: string) => string) => [
  { value: "none", label: t("calc.rain_none"), factor: 1.0 },
  { value: "light", label: t("calc.rain_light"), factor: 0.8 },
  { value: "heavy", label: t("calc.rain_heavy"), factor: 0.5 },
];

const IRRIGATIONS = (t: (key: string) => string) => [
  { value: "drip", label: t("calc.irrigation_drip"), efficiency: 0.9 },
  { value: "sprinkler", label: t("calc.irrigation_sprinkler"), efficiency: 0.7 },
  { value: "flood", label: t("calc.irrigation_flood"), efficiency: 0.5 },
  { value: "manual", label: t("calc.irrigation_manual"), efficiency: 0.6 },
  { value: "none", label: t("calc.irrigation_none"), efficiency: 1.0 },
];

function estimateETo(t: (key: string, vars?: any) => string, climate: string, season: string): number {
  const c = CLIMATES(t).find((x: any) => x.value === climate);
  const s = SEASONS(t).find((x: any) => x.value === season);
  if (!c) return 4;
  return Math.round((c.eto * (s?.factor ?? 1.0)) * 10) / 10;
}

function waterAdvice(t: (key: string, vars?: any) => string, efficiency: number, stony: boolean): string {
  if (efficiency >= 0.9) return t("calc.water_advice_efficient");
  if (stony) return t("calc.water_advice_stony");
  if (efficiency <= 0.6) return t("calc.water_advice_inefficient");
  return t("calc.water_advice_ok");
}

function irrigationTime(totalLiters: number, flowLh: number): number {
  if (!flowLh || flowLh <= 0) return 0;
  return Math.round((totalLiters / flowLh) * 60 * 10) / 10;
}

function IrrigationCalculatorContent() {
  const { t, locale } = useLocale();
  const isPt = locale === "pt";

  const [simple, setSimple] = useState(true);
  const [query, setQuery] = useState("");
  const [plants, setPlants] = useState<any[]>([]);
  const [selected, setSelected] = useState<any | null>(null);
  const [filterType, setFilterType] = useState("");
  const [filterGenus, setFilterGenus] = useState("");
  const [filterFamily, setFilterFamily] = useState("");
  const [stage, setStage] = useState("mid");
  const [climate, setClimate] = useState("moderate");
  const [season, setSeason] = useState("summer");
  const [soil, setSoil] = useState("loamy");
  const [irrigation, setIrrigation] = useState("drip");
  const [rain, setRain] = useState("none");
  const [etoManual, setEtoManual] = useState("5.0");
  const [area, setArea] = useState("");
  const [count, setCount] = useState("");
  const [flowRate, setFlowRate] = useState("");
  const [result, setResult] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [searching, setSearching] = useState(false);
  const searchParams = useSearchParams();
  const loadedRef = useRef(false);

  useEffect(() => {
    if (loadedRef.current) return;
    const pid = searchParams.get("plant_id");
    if (!pid) return;
    loadedRef.current = true;
    api.plants.get(parseInt(pid)).then(p => {
      if (p) { setSelected(p); setQuery(p.common_names_pt?.[0] || p.scientific_name); setResult(null); }
    }).catch(() => {});
  }, [searchParams]);

  const search = useCallback(async (q: string, type?: string, genus?: string, family?: string) => {
    setSearching(true);
    try {
      const res = await api.plants.search({ q, plant_type: type || undefined, genus: genus || undefined, family: family || undefined, has_kc: true, limit: 200 });
      setPlants(res);
    } catch {} finally {
      setSearching(false);
    }
  }, []);

  useEffect(() => { search("", filterType, filterGenus, filterFamily); }, [filterType, filterGenus, filterFamily, search]);

  const handleSelect = (p: any) => {
    setSelected(p);
    setResult(null);
  };

  const etoValue = simple ? estimateETo(t, climate, season) : parseFloat(etoManual) || 0;

  const handleCalc = async () => {
    if (!selected) return;
    const eto = etoValue;
    if (!eto) return;
    setLoading(true);
    try {
      const res = await api.plants.irrigation({
        plant_id: selected.id,
        eto_mm: eto,
        growth_stage: stage,
        area_sqm: area ? parseFloat(area) : undefined,
        plants_count: count ? parseInt(count) : undefined,
      });
      setResult({ ...res, climate, season, soil, irrigation, rain, flowRate: flowRate ? parseFloat(flowRate) : null });
    } catch {} finally {
      setLoading(false);
    }
  };

  const kcVal = selected
    ? stage === "initial" ? selected.kc_initial
      : stage === "mid" ? selected.kc_mid
      : selected.kc_late
    : null;

  const soils = SOILS(t);
  const irrigations = IRRIGATIONS(t);
  const soilObj = soils.find((s: any) => s.value === soil);
  const irrObj = irrigations.find((i: any) => i.value === irrigation);
  const soilFactor = soilObj?.factor ?? 0.8;
  const irrEfficiency = irrObj?.efficiency ?? 1.0;
  const isStony = soil === "stony";

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-12">
      <a href="/tools" className="inline-flex items-center gap-1 text-sm text-stone-500 dark:text-stone-400 hover:text-primary-700 dark:hover:text-primary-400 mb-6 transition">
        <ArrowLeft className="w-4 h-4" /> {t("tools.back")}
      </a>

      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-blue-100 dark:bg-blue-900/30 flex items-center justify-center">
            <Droplets className="w-5 h-5 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h1 className="text-3xl font-serif font-bold text-stone-800 dark:text-stone-100">{t("tools.irrigation_title")}</h1>
            <p className="text-stone-500 dark:text-stone-400 font-light">{t("tools.irrigation_desc")}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <ShareButton url={typeof window !== "undefined" ? window.location.href : ""} title="Irrigation Calculator" />
          <button
            onClick={() => setSimple(!simple)}
            className="flex items-center gap-1.5 text-xs text-stone-500 dark:text-stone-400 hover:text-primary-600 dark:hover:text-primary-400 bg-primary-50 dark:bg-primary-900/20 hover:bg-primary-100 dark:bg-primary-950/20 dark:hover:bg-primary-900/40 px-3 py-1.5 rounded-full transition"
          >
            {simple ? <ToggleLeft className="w-4 h-4" /> : <ToggleRight className="w-4 h-4" />}
            {simple ? t("calc.simple_mode") : t("calc.advanced_mode")}
          </button>
        </div>
      </div>

      <div className="bg-stone-100/50 dark:bg-stone-800/50 border border-stone-200/40 dark:border-stone-700/40 rounded-2xl px-4 py-2.5 mb-8 text-xs text-stone-400 dark:text-stone-500 flex items-center justify-end gap-2">
        <span className="text-[10px]">🇵🇹</span>
        <span className="font-light">{t("calc.portugal_disclaimer")}</span>
      </div>

      <div className="grid lg:grid-cols-5 gap-6">
        {/* Plant selector */}
        <div className="lg:col-span-2 space-y-4">
          <Card variant="plain" className="p-5">
            <h2 className="font-semibold text-stone-700 dark:text-stone-300 mb-3 flex items-center gap-2 text-sm">
              <Search className="w-4 h-4" /> {t("calc.plant_search")}
            </h2>
            <input
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); search(e.target.value, filterType, filterGenus, filterFamily); }}
              placeholder={t("calc.search_placeholder")}
              className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15"
            />
          </Card>

          <div className="flex gap-2 flex-wrap">
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
              className="flex-1 min-w-0 px-3 py-1.5 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15">
              <option value="">{t("calc.filter_type_all")}</option>
              {Array.from(new Set(plants.filter(p => p.plant_type).map(p => p.plant_type))).sort().map(ptype => (
                <option key={ptype} value={ptype}>{t(`calc.type_${ptype}`)}</option>
              ))}
            </select>
            <select value={filterGenus} onChange={(e) => setFilterGenus(e.target.value)}
              className="flex-1 min-w-0 px-3 py-1.5 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15">
              <option value="">{t("calc.filter_genus_all")}</option>
              {Array.from(new Set(plants.filter(p => p.genus).map(p => p.genus))).sort().map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
            <select value={filterFamily} onChange={(e) => setFilterFamily(e.target.value)}
              className="flex-1 min-w-0 px-3 py-1.5 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15">
              <option value="">{t("calc.filter_family_all")}</option>
              {Array.from(new Set(plants.filter(p => p.family).map(p => p.family))).sort().map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          <Card variant="plain" className="max-h-96 overflow-y-auto">
            {searching && <p className="p-4 text-sm text-stone-400 dark:text-stone-500 text-center font-light">{t("common.loading")}</p>}
            {!searching && plants.length === 0 && (
              <p className="p-4 text-sm text-stone-400 dark:text-stone-500 text-center font-light">{t("calc.no_plants")}</p>
            )}
            {plants.map((p) => (
              <button
                key={p.id}
                onClick={() => handleSelect(p)}
                className={`w-full text-left p-3 border-b border-primary-50 dark:border-primary-900/20 hover:bg-primary-50/50 dark:hover:bg-primary-900/20 transition flex gap-3 ${
                  selected?.id === p.id ? "bg-primary-50 dark:bg-primary-900/30 border-l-[3px] border-l-primary-500" : ""
                }`}
              >
                {p.image_url && (
                  <img src={p.image_url} alt={p.scientific_name} loading="lazy"
                    className="w-12 h-12 object-cover rounded-xl shrink-0 bg-stone-100 dark:bg-stone-800"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm text-stone-800 dark:text-stone-100 truncate">
                    {p.common_names_pt?.[0] || p.scientific_name}
                  </div>
                  <div className="text-xs text-stone-400 dark:text-stone-500 italic truncate">{p.scientific_name}</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {p.plant_type && <Badge variant="sage" className="text-[10px]">{t(`calc.type_${p.plant_type}`)}</Badge>}
                  </div>
                </div>
              </button>
            ))}
          </Card>
        </div>

        {/* Calculator panel */}
        <div className="lg:col-span-3 space-y-4">
          {selected && (
            <Card variant="plain" className="p-5 sm:p-6">
              {/* Plant header */}
              <div className="flex gap-4 mb-5">
                {selected.image_url && (
                  <img src={selected.image_url} alt={selected.scientific_name} loading="lazy"
                    className="w-20 h-20 object-cover rounded-xl shrink-0 bg-stone-100 border border-primary-100"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                )}
                <div>
                  <h2 className="font-semibold text-stone-800 dark:text-stone-100 text-lg">
                    {selected.common_names_pt?.[0] || selected.scientific_name}
                  </h2>
                  <p className="text-sm text-stone-400 italic font-light">{selected.scientific_name_full || selected.scientific_name}</p>
                  <div className="flex gap-2 mt-1">
                    {selected.genus && <Badge variant="stone" className="text-[11px]">{selected.genus}</Badge>}
                    {selected.family && <Badge variant="stone" className="text-[11px]">{selected.family}</Badge>}
                  </div>
                </div>
              </div>

              {/* Plant stats */}
              <div className="grid grid-cols-3 gap-2 mb-5">
                <div className="bg-earth-50 dark:bg-earth-900/20 rounded-xl p-3 text-center">
                  <div className="text-[10px] text-stone-500 dark:text-stone-400 font-medium">{t("calc.root_depth")}</div>
                  <div className="font-bold text-stone-800 dark:text-stone-100 text-lg">{selected.root_depth_cm ?? "—"}</div>
                  <div className="text-[9px] text-stone-400 dark:text-stone-500">cm</div>
                </div>
                <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-3 text-center">
                  <div className="text-[10px] text-stone-500 dark:text-stone-400 font-medium">{t("calc.drought_tolerance")}</div>
                  <div className="text-xs font-bold text-stone-800 dark:text-stone-100">{t(`calc.tol_${selected.drought_tolerance || "medium"}`)}</div>
                </div>
                <div className="bg-stone-50 dark:bg-stone-800/50 rounded-xl p-3 text-center">
                  <div className="text-[10px] text-stone-500 dark:text-stone-400 font-medium">{t("calc.spacing")}</div>
                  <div className="text-xs font-bold text-stone-800 dark:text-stone-100">
                    {selected.row_spacing_cm && selected.plant_spacing_cm
                      ? `${selected.row_spacing_cm}×${selected.plant_spacing_cm}`
                      : "—"}
                  </div>
                </div>
              </div>

              {/* Growth stage */}
              <div className="mb-5">
                <label className="block text-sm font-medium text-stone-700 mb-2">{t("calc.growth_stage")}</label>
                <div className="flex gap-2">
                  {GROWTH_STAGES.map((s) => (
                    <button key={s} onClick={() => setStage(s)}
                      className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                        stage === s ? "bg-primary-500 text-white shadow-sm" : "bg-primary-50 text-stone-600 hover:bg-primary-100"
                      }`}
                    >
                      {t(`calc.stage_${s}`)}
                    </button>
                  ))}
                </div>
                {kcVal !== null && <p className="text-xs text-stone-400 mt-1.5">Kc = <strong>{kcVal}</strong></p>}
              </div>

              {/* SIMPLE mode */}
              {simple && (
                  <div className="space-y-4 mb-5 p-5 bg-blue-50/50 dark:bg-blue-900/10 rounded-2xl border border-blue-100 dark:border-blue-800">
                    <h3 className="font-semibold text-sm text-blue-800 dark:text-blue-300">{t("calc.simple_title")}</h3>
                    <div className="grid grid-cols-2 gap-3">
                      {[
                        { label: t("calc.climate_region"), value: climate, set: setClimate, opts: CLIMATES(t) },
                        { label: t("calc.season"), value: season, set: setSeason, opts: SEASONS(t) },
                        { label: t("calc.soil_type"), value: soil, set: setSoil, opts: soils },
                        { label: t("calc.irrigation_system"), value: irrigation, set: setIrrigation, opts: irrigations },
                        { label: t("calc.rain_question"), value: rain, set: setRain, opts: RAIN(t) },
                      ].map((field) => (
                        <div key={field.label}>
                          <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">{field.label}</label>
                          <select value={field.value} onChange={(e) => field.set(e.target.value)}
                            className="w-full px-3 py-1.5 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15">
                            {field.opts.map((o: any) => <option key={o.value} value={o.value}>{o.label}</option>)}
                          </select>
                        </div>
                      ))}
                    </div>
                    <div className="text-xs text-blue-600 dark:text-blue-400 bg-blue-100/50 dark:bg-blue-900/20 rounded-xl px-4 py-2.5 font-light">
                    {t("calc.eto_estimated", { value: etoValue, climate: CLIMATES(t).find((c: any) => c.value === climate)?.label ?? "", season: SEASONS(t).find((s: any) => s.value === season)?.label ?? "" })}
                  </div>
                </div>
              )}

              {/* EXPERT mode */}
              {!simple && (
                <div className="mb-5">
                  <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                    {t("calc.eto")} <span className="text-xs text-stone-400 dark:text-stone-500 font-light">(mm/day)</span>
                  </label>
                  <input type="number" step="0.1" value={etoManual}
                    onChange={(e) => setEtoManual(e.target.value)}
                    placeholder="e.g. 5.0"
                    className="w-full max-w-xs px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15" />
                </div>
              )}

              {/* Area / count / flow */}
              <div className="grid grid-cols-3 gap-3 mb-5">
                <div>
                  <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">{t("calc.area")}</label>
                  <input type="number" step="0.1" value={area} onChange={(e) => setArea(e.target.value)}
                    placeholder="m²" className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">{t("calc.plants_count")}</label>
                  <input type="number" value={count} onChange={(e) => setCount(e.target.value)}
                    placeholder={t("calc.count_placeholder")} className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">{t("calc.flow_rate") || "Flow rate (L/h)"}</label>
                  <input type="number" step="0.1" value={flowRate} onChange={(e) => setFlowRate(e.target.value)}
                    placeholder="ex: 24" className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15" />
                </div>
              </div>

              <Button onClick={handleCalc} disabled={loading || !etoValue} loading={loading} className="w-full">
                {t("calc.calculate")}
              </Button>

              {/* Results */}
              {result && (
                <div className="mt-6 space-y-4 animate-fade-in">
                  <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-2xl p-5">
                    <h3 className="font-semibold text-green-800 dark:text-green-300 mb-4">{t("calc.results")}</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white dark:bg-stone-900 rounded-xl p-4">
                        <div className="text-xs text-stone-500 dark:text-stone-400 font-medium">{t("calc.etc")}</div>
                        <div className="text-2xl font-bold text-green-700 dark:text-green-300 mt-1">{result.etc_mm} <span className="text-sm font-normal text-stone-400 dark:text-stone-500">mm/day</span></div>
                      </div>
                      <div className="bg-white dark:bg-stone-900 rounded-xl p-4">
                        <div className="text-xs text-stone-500 dark:text-stone-400 font-medium">{t("calc.water_per_plant")}</div>
                        <div className="text-2xl font-bold text-blue-700 dark:text-blue-300 mt-1">
                          {result.water_per_plant_liters != null ? `${result.water_per_plant_liters}` : "—"}
                          <span className="text-sm font-normal text-stone-400 dark:text-stone-500"> L/day</span>
                        </div>
                      </div>
                      <div className="bg-white dark:bg-stone-900 rounded-xl p-4 col-span-2">
                        <div className="text-xs text-stone-500 dark:text-stone-400 font-medium">{t("calc.total_water")}</div>
                        <div className="text-2xl font-bold text-primary-700 dark:text-primary-300 mt-1">
                          {result.total_water_liters != null ? `${result.total_water_liters}` : "—"}
                          <span className="text-sm font-normal text-stone-400 dark:text-stone-500"> L/day</span>
                        </div>
                        <ProgressBar value={result.total_water_liters} max={result.total_water_liters * 1.5} size="sm" className="mt-2" />
                      </div>
                    </div>
                    <div className="flex gap-3 mt-3 text-xs text-stone-500">
                      <span>Kc: {result.kc_used}</span>
                      <span>Root: {result.root_depth_cm ?? "—"} cm</span>
                    </div>
                  </div>

                  {/* Practical advice */}
                  <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-2xl p-5">
                    <h3 className="font-semibold text-amber-800 dark:text-amber-300 mb-3">{t("calc.advice_title")}</h3>
                    <ul className="text-sm text-amber-700 dark:text-amber-300 space-y-2 font-light">
                      <li className="flex items-start gap-2"><ChevronRight className="w-4 h-4 shrink-0 mt-0.5" />{waterAdvice(t, irrEfficiency, isStony)}</li>
                      {isStony && <li className="flex items-start gap-2"><ChevronRight className="w-4 h-4 shrink-0 mt-0.5" />{t("calc.advice_stony")}</li>}
                      {irrEfficiency < 0.8 && <li className="flex items-start gap-2"><ChevronRight className="w-4 h-4 shrink-0 mt-0.5" />{t("calc.advice_drip")}</li>}
                      {rain !== "none" && (
                        <li className="flex items-start gap-2"><ChevronRight className="w-4 h-4 shrink-0 mt-0.5" />
                          {t("calc.advice_rain_adjust", { rain_label: RAIN(t).find((r: any) => r.value === rain)?.label ?? "", factor: ((RAIN(t).find((r: any) => r.value === rain)?.factor ?? 1) * 100) })}
                        </li>
                      )}
                      {result.total_water_liters != null && parseFloat(flowRate) > 0 && (
                        <li className="flex items-start gap-2"><ChevronRight className="w-4 h-4 shrink-0 mt-0.5" />
                          {t("calc.advice_irrigation_time", { flow_rate: flowRate, minutes: irrigationTime(result.total_water_liters * (isStony ? 0.7 : soilFactor) / irrEfficiency * (RAIN(t).find((r: any) => r.value === rain)?.factor ?? 1), parseFloat(flowRate)) })}
                        </li>
                      )}
                      {selected.root_depth_cm && (
                        <li className="flex items-start gap-2"><ChevronRight className="w-4 h-4 shrink-0 mt-0.5" />{t("calc.advice_root_depth", { depth: selected.root_depth_cm })}</li>
                      )}
                    </ul>
                  </div>

                  {/* Technical details */}
                  <details className="text-xs text-stone-400 group">
                    <summary className="cursor-pointer hover:text-stone-600 font-medium transition">{t("calc.technical_details")}</summary>
                    <div className="mt-2 space-y-1.5 p-4 bg-primary-50 rounded-xl">
                      <p>{t("calc.tech_eto", { value: etoValue })}</p>
                      <p>{t("calc.tech_soil_factor", { label: soilObj?.label ?? "", factor: soilFactor })}</p>
                      <p>{t("calc.tech_irr_efficiency", { label: irrObj?.label ?? "", factor: irrEfficiency })}</p>
                      {rain !== "none" && <p>{t("calc.tech_rain_adjust", { factor: RAIN(t).find((r: any) => r.value === rain)?.factor ?? 1 })}</p>}
                      <p>{t("calc.tech_etc", { value: result.etc_mm })}</p>
                      {result.water_per_plant_liters != null && <p>{t("calc.tech_water_per_plant", { value: result.water_per_plant_liters, factor: soilFactor })}</p>}
                      {result.total_water_liters != null && <p>{t("calc.tech_total", { value: result.total_water_liters, factor: soilFactor })}</p>}
                    </div>
                  </details>
                </div>
              )}
            </Card>
          )}

          {!selected && (
            <Card variant="plain" className="p-8 text-center">
              <div className="w-16 h-16 rounded-2xl bg-primary-50 flex items-center justify-center mx-auto mb-4">
                <Droplets className="w-8 h-8 text-primary-300" />
              </div>
              <p className="text-stone-500 font-light">{t("calc.select_plant")}</p>
              <p className="text-xs text-stone-400 mt-1.5 font-light">{t("calc.select_plant_hint")}</p>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

export default function IrrigationCalculatorPage() {
  return (
    <Suspense fallback={<div className="max-w-6xl mx-auto px-4 sm:px-8 py-12 space-y-4"><div className="h-8 bg-primary-100 dark:bg-primary-950/20 rounded w-96 animate-pulse" /><div className="h-4 bg-primary-100 dark:bg-primary-950/20 rounded w-64 animate-pulse" /><div className="grid lg:grid-cols-5 gap-8"><div className="lg:col-span-2 h-64 bg-primary-100 dark:bg-primary-950/20 rounded-xl animate-pulse" /><div className="lg:col-span-3 h-96 bg-primary-100 dark:bg-primary-950/20 rounded-xl animate-pulse" /></div></div>}>
      <IrrigationCalculatorContent />
    </Suspense>
  );
}
