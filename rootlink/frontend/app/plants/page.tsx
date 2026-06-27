"use client";

import { useState, useEffect } from "react";
import { Sprout, Search, Leaf } from "lucide-react";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/locale-context";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";

const plantTypes = [
  { label: "All", value: "" },
  { label: "Vegetable", value: "vegetable" },
  { label: "Fruit", value: "fruit" },
  { label: "Herb", value: "herb" },
  { label: "Flower", value: "flower" },
  { label: "Tree", value: "tree" },
  { label: "Shrub", value: "shrub" },
];

export default function PlantsPage() {
  const { t } = useLocale();
  const [plants, setPlants] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [plantType, setPlantType] = useState("");

  useEffect(() => {
    loadPlants();
  }, [plantType]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadPlants = async (q?: string) => {
    setLoading(true);
    try {
      const data = await api.plants.search({
        q: q || query || undefined,
        plant_type: plantType || undefined,
        limit: 100,
      });
      setPlants(data);
    } catch {
      setPlants([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    loadPlants(query);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-12">
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-950/20 flex items-center justify-center">
          <Sprout className="w-5 h-5 text-primary-500" />
        </div>
        <div>
          <h1 className="text-2xl font-serif font-bold text-stone-800">{t("plants.title") || "Plant Encyclopedia"}</h1>
          <p className="text-sm text-stone-500 font-light">{t("plants.subtitle") || "Explore our botanical database with detailed growing information"}</p>
        </div>
      </div>

      <form onSubmit={handleSearch} className="mt-6 flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 dark:text-stone-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("plants.search_placeholder") || "Search by name, genus, or family..."}
            className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-primary-200/60 dark:border-stone-700 bg-white/80 dark:bg-stone-900/80 backdrop-blur-sm text-stone-800 dark:text-stone-100 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15 focus:outline-none transition-all font-serif"
          />
        </div>
        <Button type="submit" size="md">{t("plants.search") || "Search"}</Button>
      </form>

      <div className="flex flex-wrap gap-2 mt-4">
        {plantTypes.map((pt) => (
          <button
            key={pt.value}
            onClick={() => setPlantType(pt.value)}
            className={`px-3 py-1.5 text-sm rounded-xl border transition-all ${
              plantType === pt.value
                ? "bg-primary-500 text-white border-primary-500 shadow-sm"
                : "bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 border-primary-100 dark:border-stone-700 hover:border-primary-300 dark:hover:border-primary-600"
            }`}
          >
            {pt.label}
          </button>
        ))}
      </div>

      <div className="mt-8">
        {loading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <CardSkeleton key={i} />
            ))}
          </div>
        ) : plants.length === 0 ? (
          <EmptyState
            icon={<Leaf className="w-7 h-7" />}
            title={t("plants.no_results") || "No plants found"}
            message={t("plants.try_different") || "Try a different search term"}
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {plants.map((p) => (
              <a
                key={p.id}
                href={`/plants/${p.id}`}
                className="group rounded-2xl border border-primary-100/40 dark:border-stone-700 bg-white dark:bg-stone-900 p-4 transition-all hover:shadow-md hover:border-primary-200/60 dark:hover:border-primary-700"
              >
                <div className="flex items-start gap-3">
                  <div className="w-14 h-14 rounded-xl bg-primary-50 dark:bg-primary-900/30 shrink-0 flex items-center justify-center overflow-hidden">
                    {p.image_url ? (
                      <img src={p.image_url} alt="" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.style.display = "none"; }} />
                    ) : (
                      <Sprout className="w-6 h-6 text-primary-400 dark:text-primary-500" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="text-sm font-display font-semibold text-stone-800 dark:text-stone-100 group-hover:text-primary-700 dark:group-hover:text-primary-400 transition italic truncate">{p.scientific_name}</h3>
                    {p.common_names_en && p.common_names_en.length > 0 && (
                      <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5 truncate">{p.common_names_en.slice(0, 2).join(", ")}</p>
                    )}
                    <div className="flex gap-1.5 mt-2 flex-wrap">
                      {p.plant_type && <Badge variant="sage" className="text-[10px]">{p.plant_type}</Badge>}
                      {p.family && <Badge variant="stone" className="text-[10px]">{p.family}</Badge>}
                    </div>
                  </div>
                </div>
              </a>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
