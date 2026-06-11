"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { ArrowLeft, Search, Droplets, Ruler, ThermometerSun, ToggleLeft, ToggleRight } from "lucide-react";
import { useLocale } from "@/lib/locale-context";
import { api } from "@/lib/api";

const GROWTH_STAGES = ["initial", "mid", "late"] as const;

const CLIMATES = [
  { value: "cool", label: "Fria (Norte / Serras)", eto: 2.5 },
  { value: "moderate", label: "Temperada (Centro / Litoral)", eto: 4.0 },
  { value: "warm", label: "Quente (Sul / Interior)", eto: 6.0 },
  { value: "hot", label: "Muito quente (Algarve / Vale do Tejo)", eto: 7.5 },
];

const SEASONS = [
  { value: "spring", label: "Primavera", factor: 1.0 },
  { value: "summer", label: "Verão", factor: 1.4 },
  { value: "fall", label: "Outono", factor: 0.7 },
  { value: "winter", label: "Inverno", factor: 0.35 },
];

const SOILS = [
  { value: "sandy", label: "Areia (drena muito rápido)", factor: 0.5 },
  { value: "loamy", label: "Terra vegetal / limosa (equilibrada)", factor: 0.8 },
  { value: "clay", label: "Argila (retenção alta)", factor: 0.95 },
  { value: "stony", label: "Pedregosa (drena rápido)", factor: 0.55 },
];

const RAIN = [
  { value: "none", label: "Não", factor: 1.0 },
  { value: "light", label: "Pouco (chuvisco ocasional)", factor: 0.8 },
  { value: "heavy", label: "Bastante (chuvas nos últimos dias)", factor: 0.5 },
];

const IRRIGATIONS = [
  { value: "drip", label: "Gota-a-gota", efficiency: 0.9 },
  { value: "sprinkler", label: "Aspersão", efficiency: 0.7 },
  { value: "flood", label: "Inundação / sulcos", efficiency: 0.5 },
  { value: "manual", label: "Mangueira manual", efficiency: 0.6 },
  { value: "none", label: "Nenhum (apenas chuva)", efficiency: 1.0 },
];

function estimateETo(climate: string, season: string): number {
  const c = CLIMATES.find((x) => x.value === climate);
  const s = SEASONS.find((x) => x.value === season);
  if (!c) return 4;
  return Math.round((c.eto * (s?.factor ?? 1.0)) * 10) / 10;
}

function waterAdvice(efficiency: number, stony: boolean): string {
  if (efficiency >= 0.9) return "Sistema eficiente — pouca perda de água.";
  if (stony) return "Solo pedregoso: a água drena depressa — regue com mais frequência mas menor quantidade.";
  if (efficiency <= 0.6) return "Perdas por evaporação elevadas — considere regar de manhã cedo ou ao final da tarde.";
  return "Rega moderadamente eficiente.";
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

  const etoValue = simple ? estimateETo(climate, season) : parseFloat(etoManual) || 0;

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

  const soilObj = SOILS.find((s) => s.value === soil);
  const irrObj = IRRIGATIONS.find((i) => i.value === irrigation);
  const soilFactor = soilObj?.factor ?? 0.8;
  const irrEfficiency = irrObj?.efficiency ?? 1.0;
  const isStony = soil === "stony";

  return (
    <div className="max-w-6xl mx-auto px-4 py-12">
      <a href="/tools" className="flex items-center gap-1 text-sm text-stone-500 hover:text-primary-700 mb-6">
        <ArrowLeft className="w-4 h-4" /> {t("tools.back")}
      </a>

      <div className="flex items-center justify-between mb-2">
        <h1 className="text-3xl font-bold text-stone-800 font-serif">{t("tools.irrigation_title")}</h1>
        <button
          onClick={() => setSimple(!simple)}
          className="flex items-center gap-1.5 text-xs text-stone-500 hover:text-primary-600 bg-stone-100 hover:bg-primary-50 px-3 py-1.5 rounded-full transition"
        >
          {simple ? <ToggleLeft className="w-4 h-4" /> : <ToggleRight className="w-4 h-4" />}
          {simple ? "Modo simples" : "Modo avançado"}
        </button>
      </div>
      <p className="text-stone-600 mb-2">{t("tools.irrigation_desc")}</p>
      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 mb-6 text-xs text-amber-700 flex items-center gap-2">
        <span>🇵🇹</span>
        <span>{t("calc.portugal_disclaimer")}</span>
      </div>

      <div className="grid lg:grid-cols-5 gap-8">
        {/* Plant selector */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white border border-stone-200 rounded-xl p-5">
            <h2 className="font-semibold text-stone-700 mb-3 flex items-center gap-2">
              <Search className="w-4 h-4" /> {t("calc.plant_search")}
            </h2>
            <input
              type="text"
              value={query}
              onChange={(e) => { setQuery(e.target.value); search(e.target.value, filterType, filterGenus, filterFamily); }}
              placeholder={t("calc.search_placeholder")}
              className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          <div className="flex gap-2">
            <select value={filterType} onChange={(e) => setFilterType(e.target.value)}
              className="flex-1 border border-stone-300 rounded-lg px-2 py-1.5 text-xs bg-white">
              <option value="">{t("calc.filter_type_all")}</option>
              {Array.from(new Set(plants.filter(p => p.plant_type).map(p => p.plant_type))).sort().map(ptype => (
                <option key={ptype} value={ptype}>{ptype === "tree" ? "🌳" : ptype === "shrub" ? "🌿" : ptype === "herb" ? "🌱" : ptype === "climber" ? "🌿" : "🌱"} {t(`calc.type_${ptype}`)}</option>
              ))}
            </select>
            <select value={filterGenus} onChange={(e) => setFilterGenus(e.target.value)}
              className="flex-1 border border-stone-300 rounded-lg px-2 py-1.5 text-xs bg-white">
              <option value="">{t("calc.filter_genus_all")}</option>
              {Array.from(new Set(plants.filter(p => p.genus).map(p => p.genus))).sort().map(g => (
                <option key={g} value={g}>{g}</option>
              ))}
            </select>
            <select value={filterFamily} onChange={(e) => setFilterFamily(e.target.value)}
              className="flex-1 border border-stone-300 rounded-lg px-2 py-1.5 text-xs bg-white">
              <option value="">{t("calc.filter_family_all")}</option>
              {Array.from(new Set(plants.filter(p => p.family).map(p => p.family))).sort().map(f => (
                <option key={f} value={f}>{f}</option>
              ))}
            </select>
          </div>

          <div className="bg-white border border-stone-200 rounded-xl max-h-96 overflow-y-auto">
            {searching && <p className="p-4 text-sm text-stone-400 text-center">{t("common.loading")}</p>}
            {!searching && plants.length === 0 && (
              <p className="p-4 text-sm text-stone-400 text-center">{t("calc.no_plants")}</p>
            )}
            {plants.map((p) => (
              <button
                key={p.id}
                onClick={() => handleSelect(p)}
                className={`w-full text-left p-3 border-b border-stone-100 hover:bg-primary-50 transition flex gap-3 ${
                  selected?.id === p.id ? "bg-primary-100 border-l-4 border-l-primary-600" : ""
                }`}
              >
                {p.image_url && (
                  <img src={p.image_url} alt={p.scientific_name}
                    className="w-12 h-12 object-cover rounded-lg flex-shrink-0 bg-stone-100"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-sm text-stone-800 truncate">
                    {p.common_names_pt?.[0] || p.scientific_name}
                  </div>
                  <div className="text-xs text-stone-400 italic truncate">{p.scientific_name}</div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {p.kc_mid && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded">Kc: {p.kc_mid}</span>
                    )}
                    {p.plant_type && (
                      <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">{t(`calc.type_${p.plant_type}`)}</span>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>

        {/* Calculator panel */}
        <div className="lg:col-span-3 space-y-4">
          {selected && (
            <div className="bg-white border border-stone-200 rounded-xl p-5">
              {/* Plant header */}
              <div className="flex gap-4 mb-4">
                {selected.image_url && (
                  <img src={selected.image_url} alt={selected.scientific_name}
                    className="w-24 h-24 object-cover rounded-xl flex-shrink-0 bg-stone-100 border border-stone-200"
                    onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
                  />
                )}
                <div>
                  <h2 className="font-semibold text-stone-700 text-lg">
                    {selected.common_names_pt?.[0] || selected.scientific_name}
                  </h2>
                  <p className="text-sm text-stone-400 italic">{selected.scientific_name_full || selected.scientific_name}</p>
                  <div className="flex gap-2 mt-1">
                    {selected.genus && <span className="text-xs bg-stone-100 text-stone-500 px-2 py-0.5 rounded">{selected.genus}</span>}
                    {selected.family && <span className="text-xs bg-stone-100 text-stone-500 px-2 py-0.5 rounded">{selected.family}</span>}
                  </div>
                </div>
              </div>

              {/* Kc cards */}
              <div className="grid grid-cols-3 gap-3 mb-5">
                <div className="bg-stone-50 rounded-lg p-3 text-center">
                  <Droplets className="w-5 h-5 text-blue-500 mx-auto mb-1" />
                  <div className="text-xs text-stone-500">{t("calc.kc_initial")}</div>
                  <div className="font-semibold">{selected.kc_initial ?? "—"}</div>
                </div>
                <div className="bg-stone-50 rounded-lg p-3 text-center">
                  <Droplets className="w-5 h-5 text-blue-600 mx-auto mb-1" />
                  <div className="text-xs text-stone-500">{t("calc.kc_mid")}</div>
                  <div className="font-semibold">{selected.kc_mid ?? "—"}</div>
                </div>
                <div className="bg-stone-50 rounded-lg p-3 text-center">
                  <Droplets className="w-5 h-5 text-blue-700 mx-auto mb-1" />
                  <div className="text-xs text-stone-500">{t("calc.kc_late")}</div>
                  <div className="font-semibold">{selected.kc_late ?? "—"}</div>
                </div>
                <div className="bg-stone-50 rounded-lg p-3 text-center">
                  <Ruler className="w-5 h-5 text-amber-500 mx-auto mb-1" />
                  <div className="text-xs text-stone-500">{t("calc.root_depth")}</div>
                  <div className="font-semibold">{selected.root_depth_cm ?? "—"} cm</div>
                </div>
                <div className="bg-stone-50 rounded-lg p-3 text-center">
                  <ThermometerSun className="w-5 h-5 text-orange-500 mx-auto mb-1" />
                  <div className="text-xs text-stone-500">{t("calc.drought_tolerance")}</div>
                  <div className="font-semibold text-sm">{t(`calc.tol_${selected.drought_tolerance || "medium"}`)}</div>
                </div>
                <div className="bg-stone-50 rounded-lg p-3 text-center">
                  <span className="text-lg mb-1 block">↔</span>
                  <div className="text-xs text-stone-500">{t("calc.spacing")}</div>
                  <div className="font-semibold text-sm">
                    {selected.row_spacing_cm && selected.plant_spacing_cm
                      ? `${selected.row_spacing_cm}×${selected.plant_spacing_cm} cm`
                      : "—"}
                  </div>
                </div>
              </div>

              {/* Growth stage */}
              <div className="mb-4">
                <label className="block text-sm font-medium text-stone-700 mb-2">{t("calc.growth_stage")}</label>
                <div className="flex gap-2">
                  {GROWTH_STAGES.map((s) => (
                    <button
                      key={s}
                      onClick={() => setStage(s)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                        stage === s ? "bg-primary-600 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"
                      }`}
                    >
                      {t(`calc.stage_${s}`)}
                    </button>
                  ))}
                </div>
                {kcVal !== null && <p className="text-xs text-stone-400 mt-1">Kc = {kcVal}</p>}
              </div>

              {/* SIMPLE mode */}
              {simple && (
                <div className="space-y-4 mb-4 p-4 bg-blue-50 rounded-xl border border-blue-100">
                  <h3 className="font-semibold text-sm text-blue-800">🌤️ Descreva o seu clima e solo</h3>

                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-stone-600 mb-1">Clima da sua região</label>
                      <select value={climate} onChange={(e) => setClimate(e.target.value)} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm">
                        {CLIMATES.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-stone-600 mb-1">Época do ano</label>
                      <select value={season} onChange={(e) => setSeason(e.target.value)} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm">
                        {SEASONS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-stone-600 mb-1">Tipo de solo</label>
                      <select value={soil} onChange={(e) => setSoil(e.target.value)} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm">
                        {SOILS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-stone-600 mb-1">Sistema de rega</label>
                      <select value={irrigation} onChange={(e) => setIrrigation(e.target.value)} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm">
                        {IRRIGATIONS.map((i) => <option key={i.value} value={i.value}>{i.label}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-stone-600 mb-1">Choveu nos últimos dias?</label>
                      <select value={rain} onChange={(e) => setRain(e.target.value)} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm">
                        {RAIN.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="text-xs text-blue-600 bg-blue-100 rounded-lg px-3 py-2">
                    ETo estimado: <strong>{etoValue} mm/dia</strong> — baseado no clima e estação ({CLIMATES.find((c) => c.value === climate)?.label}, {SEASONS.find((s) => s.value === season)?.label})
                  </div>
                </div>
              )}

              {/* EXPERT mode */}
              {!simple && (
                <div className="mb-4">
                  <label className="block text-sm font-medium text-stone-700 mb-1">
                    {t("calc.eto")} <span className="text-xs text-stone-400">(mm/day)</span>
                  </label>
                  <input
                    type="number" step="0.1" value={etoManual}
                    onChange={(e) => setEtoManual(e.target.value)}
                    placeholder="e.g. 5.0"
                    className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
                  />
                </div>
              )}

              {/* Area / count / flow */}
              <div className="grid grid-cols-3 gap-3 mb-4">
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">{t("calc.area")}</label>
                  <input type="number" step="0.1" value={area} onChange={(e) => setArea(e.target.value)}
                    placeholder={`m²`} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">{t("calc.plants_count")}</label>
                  <input type="number" value={count} onChange={(e) => setCount(e.target.value)}
                    placeholder={t("calc.count_placeholder")} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm" />
                </div>
                <div>
                  <label className="block text-xs font-medium text-stone-600 mb-1">Caudal (L/h)</label>
                  <input type="number" step="0.1" value={flowRate} onChange={(e) => setFlowRate(e.target.value)}
                    placeholder="ex: 24" className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm" />
                </div>
              </div>

              {/* Calculate */}
              <button onClick={handleCalc} disabled={loading || !etoValue}
                className="w-full bg-primary-600 text-white py-2.5 rounded-lg hover:bg-primary-700 transition font-medium disabled:opacity-50">
                {loading ? t("common.loading") : t("calc.calculate")}
              </button>

              {/* Results */}
              {result && (
                <div className="mt-5 space-y-3">
                  <div className="bg-green-50 border border-green-200 rounded-xl p-5">
                    <h3 className="font-semibold text-green-800 mb-3">{t("calc.results")}</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="bg-white rounded-lg p-3">
                        <div className="text-xs text-stone-500">{t("calc.etc")}</div>
                        <div className="text-xl font-bold text-green-700">{result.etc_mm} <span className="text-sm font-normal">mm/day</span></div>
                      </div>
                      <div className="bg-white rounded-lg p-3">
                        <div className="text-xs text-stone-500">{t("calc.water_per_plant")}</div>
                        <div className="text-xl font-bold text-blue-700">
                          {result.water_per_plant_liters != null ? `${result.water_per_plant_liters} L/day` : "—"}
                        </div>
                      </div>
                      <div className="bg-white rounded-lg p-3 col-span-2">
                        <div className="text-xs text-stone-500">{t("calc.total_water")}</div>
                        <div className="text-xl font-bold text-primary-700">
                          {result.total_water_liters != null ? `${result.total_water_liters} L/day` : "—"}
                        </div>
                      </div>
                      <div className="bg-white rounded-lg p-3">
                        <div className="text-xs text-stone-500">{t("calc.kc_used")}</div>
                        <div className="text-lg font-semibold">{result.kc_used}</div>
                      </div>
                      <div className="bg-white rounded-lg p-3">
                        <div className="text-xs text-stone-500">{t("calc.root_depth_used")}</div>
                        <div className="text-lg font-semibold">{result.root_depth_cm != null ? `${result.root_depth_cm} cm` : "—"}</div>
                      </div>
                    </div>
                  </div>

                  {/* Practical advice */}
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-5">
                    <h3 className="font-semibold text-amber-800 mb-2">💡 Conselhos práticos</h3>
                    <ul className="text-sm text-amber-700 space-y-1.5">
                      <li>{waterAdvice(irrEfficiency, isStony)}</li>
                      {isStony && <li>⚠️ Solo pedregoso: a água escorre mais depressa. Aplique <strong>mulch</strong> (palha/composto) à volta da planta para reter humidade.</li>}
                      {irrEfficiency < 0.8 && <li>💧 Considere regar <strong>gota-a-gota</strong> para reduzir evaporação e poupar água.</li>}
                      {rain !== "none" && (
                        <li>☔ Registou {RAIN.find((r) => r.value === rain)?.label.toLowerCase()}. Reduza a rega para <strong>{(RAIN.find((r) => r.value === rain)?.factor ?? 1) * 100}%</strong> do valor calculado esta semana.</li>
                      )}
                      {result.total_water_liters != null && parseFloat(flowRate) > 0 && (
                        <li>
                          ⏱️ Com o seu sistema ({flowRate} L/h), precisa de deixar a rega ligada <strong>{irrigationTime(result.total_water_liters * (isStony ? 0.7 : soilFactor) / irrEfficiency * (RAIN.find((r) => r.value === rain)?.factor ?? 1), parseFloat(flowRate))} minutos/dia</strong>.
                        </li>
                      )}
                      {selected.root_depth_cm && (
                        <li>🌱 Regue de forma a humedecer até {selected.root_depth_cm} cm de profundidade (raízes). Regas curtas e frequentes favorecem raízes superficiais.</li>
                      )}
                    </ul>
                  </div>

                  {/* Technical details */}
                  <details className="text-xs text-stone-400">
                    <summary className="cursor-pointer hover:text-stone-600">Ver detalhes técnicos</summary>
                    <div className="mt-2 space-y-1 p-3 bg-stone-50 rounded-lg">
                      <p>ETo estimado: <strong>{etoValue} mm/dia</strong></p>
                      <p>Fator do solo ({soilObj?.label}): ×{soilFactor}</p>
                      <p>Eficiência da rega ({irrObj?.label}): ×{irrEfficiency}</p>
                      {rain !== "none" && <p>Ajuste por chuva: ×{RAIN.find((r) => r.value === rain)?.factor ?? 1}</p>}
                      <p>ETc (necessidade base): {result.etc_mm} mm/dia</p>
                      {result.water_per_plant_liters != null && <p>Água/planta: {result.water_per_plant_liters} L/dia (ajustado ao solo)</p>}
                      {result.total_water_liters != null && <p>Total: {result.total_water_liters} L/dia (ajustado ao solo × {soilFactor})</p>}
                    </div>
                  </details>
                </div>
              )}
            </div>
          )}

          {!selected && (
            <div className="bg-white border border-stone-200 rounded-xl p-8 text-center text-stone-400">
              <Droplets className="w-12 h-12 mx-auto mb-3 text-stone-300" />
              <p>{t("calc.select_plant")}</p>
              <p className="text-xs mt-2 text-stone-300">Selecione uma planta na lista ao lado para começar</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function IrrigationCalculatorPage() {
  return (
    <Suspense fallback={<div className="max-w-6xl mx-auto px-4 py-12 text-stone-400">A carregar...</div>}>
      <IrrigationCalculatorContent />
    </Suspense>
  );
}
