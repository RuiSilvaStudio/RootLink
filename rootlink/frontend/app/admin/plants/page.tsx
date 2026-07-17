"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Search, Plus, Pencil, Trash2, Upload, Sprout, Flower2, ChevronDown } from "lucide-react";
import { useLocale } from "@/lib/locale-context";
import Link from "next/link";
import { Collapsible } from "@/components/Collapsible";
import { Button, EmptyState } from "@/components/ui";
import { ListSkeleton } from "@/components/ui/LoadingSkeleton";
import { LoadError } from "@/components/studio/LoadError";

export default function AdminPlantsPage() {
  const { t } = useLocale();
  const [plants, setPlants] = useState<any[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<number | null>(null);
  const [crawlName, setCrawlName] = useState("");
  const [crawling, setCrawling] = useState(false);
  const [crawlingAll, setCrawlingAll] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const loadPlants = async (q?: string) => {
    setLoading(true);
    setLoadError(false);
    try {
      const res = await api.plants.search({ q: q || "", limit: 100 });
      setPlants(res);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadPlants(); }, []);

  const handleSearch = () => loadPlants(query);

  const handleDelete = async (id: number) => {
    if (!confirm(t("admin.delete_plant_confirm"))) return;
    try {
      await api.plants.delete(id);
      toast.success("Plant deleted.");
      loadPlants();
    } catch (err: any) {
      toast.error(err?.message || "Delete failed");
    }
  };

  const handleCrawlAll = async () => {
    if (!confirm("Crawl all plants from UTAD? This may take a while.")) return;
    setCrawlingAll(true);
    ;
    try {
      const res = await api.plants.crawlUtadAll();
      const updated = res.results?.filter((r: any) => r.status === "updated").length || 0;
      const notFound = res.results?.filter((r: any) => r.status === "not_found").length || 0;
      loadPlants();
      toast.success(`Crawl complete: ${updated} updated, ${notFound} not found (${res.total} total).`);
    } catch (err: any) {
      toast.error(err?.message || "Batch crawl failed");
    } finally {
      setCrawlingAll(false);
    }
  };

  const handleCrawl = async () => {
    if (!crawlName.trim()) return;
    setCrawling(true);
    ;
    try {
      const result = await api.plants.crawlUtad(crawlName.trim());
      loadPlants();
      setCrawlName("");
      toast.success(`"${result.scientific_name || crawlName.trim()}" imported from UTAD.`);
    } catch (err: any) {
      toast.error(err?.message || "Crawl failed");
    } finally {
      setCrawling(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 px-6 py-4 border-b border-primary-200/40 dark:border-stone-800">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="font-display text-xl font-semibold text-stone-800 dark:text-stone-100">{t("admin.plants_title")}</h1>
            <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">Manage the plant database and UTAD crawl</p>
          </div>
          <Link href="/admin/plants/new">
            <Button size="sm" variant="primary">
              <Plus className="w-4 h-4" /> {t("admin.plant_add")}
            </Button>
          </Link>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
      {/* UTAD crawl */}
      <div className="bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 rounded-xl p-4 mb-6">
        <div className="flex items-center gap-3">
          <Sprout className="w-5 h-5 text-amber-600 shrink-0" />
          <input
            type="text"
            value={crawlName}
            onChange={(e) => setCrawlName(e.target.value)}
            placeholder={t("admin.crawl_placeholder")}
            className="flex-1 border border-amber-300 dark:border-amber-800 rounded-xl2 px-3 py-2 text-sm"
          />
          <button
            onClick={handleCrawl}
            disabled={crawling || !crawlName.trim()}
            className="flex items-center gap-1 bg-amber-600 text-cream px-3 py-2 rounded-xl2 text-sm hover:bg-amber-700 disabled:opacity-50"
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
          className="flex-1 border border-primary-200/60 dark:border-stone-700 dark:bg-stone-900 dark:text-stone-100 rounded-xl2 px-3 py-2 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15 focus:outline-none"
        />
        <Button size="sm" variant="ghost" onClick={handleSearch}>
          <Search className="w-4 h-4" />
        </Button>
      </div>

      {/* Plant list */}
      {loading ? (
        <ListSkeleton rows={6} />
      ) : loadError ? (
        <div className="max-w-xl"><LoadError onRetry={() => loadPlants()} /></div>
      ) : plants.length === 0 ? (
        <EmptyState title="No plants found" message={t("admin.no_plants")} />
      ) : (
        <div className="space-y-2">
          {plants.map((p) => (
            <PlantCard
              key={p.id}
              plant={p}
              expanded={expanded === p.id}
              onToggle={() => setExpanded(expanded === p.id ? null : p.id)}
              onDelete={() => handleDelete(p.id)}
            />
          ))}
        </div>
      )}

      </div>
    </div>
  );
}

function PlantCard({ plant, expanded, onToggle, onDelete }: {
  plant: any;
  expanded: boolean;
  onToggle: () => void;
  onDelete: () => void;
}) {
  const cn = (v: string | null | undefined, fallback?: string) => v ?? fallback ?? "—";
  const names = plant.common_names_pt?.join(", ") || "";
  const flowering = [plant.flowering_start, plant.flowering_end].filter(Boolean).join(" – ") || null;
  const hasDetail = plant.habitat || flowering || plant.distribution_general || plant.image_url;

  return (
    <div className="bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-xl overflow-hidden">
      <div className="flex items-start gap-3 p-3">
        {plant.image_url ? (
          <img
            src={plant.image_url}
            alt={plant.scientific_name}
            loading="lazy"
            className="w-14 h-14 rounded-lg object-cover border border-stone-200 dark:border-stone-700 shrink-0"
          />
        ) : (
          <div className="w-14 h-14 rounded-lg bg-stone-100 dark:bg-stone-800 flex items-center justify-center text-stone-300 dark:text-stone-600 shrink-0">
            <Sprout className="w-6 h-6" />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-stone-800 dark:text-stone-100 text-sm">{cn(plant.common_names_pt?.[0], plant.scientific_name)}</span>
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
          <Link href={`/admin/plants/edit/${plant.id}`} className="p-1.5 text-stone-400 hover:text-primary-600 rounded-lg hover:bg-stone-100">
            <Pencil className="w-4 h-4" />
          </Link>
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

