"use client";

import { useState, useEffect } from "react";
import { Sprout, Search, Leaf } from "lucide-react";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/locale-context";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { PlantListCard } from "@/components/cards/PlantListCard";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";
import { Text } from "@/components/ui/Text";
import { BlockRenderer, type BlockSectionData } from "@/components/blocks";

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
  const [heroSections, setHeroSections] = useState<BlockSectionData[] | null>(null);

  useEffect(() => {
    loadPlants();
    api.blocks.getPage("plants").then((p) => p?.sections?.length ? setHeroSections(p.sections) : setHeroSections([])).catch(() => setHeroSections([]));
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
      {heroSections && heroSections.length > 0 && (
        <BlockRenderer sections={heroSections} />
      )}

      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-950/20 flex items-center justify-center">
          <Sprout className="w-5 h-5 text-primary-500" />
        </div>
        <div>
          <Text k="plants.title" as="h1" defaultText="Plant Encyclopedia" className="text-2xl font-serif font-bold text-stone-800" />
          <Text k="plants.subtitle" as="p" defaultText="Explore our botanical database with detailed growing information" className="text-sm text-stone-500 font-light" />
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
              <PlantListCard key={p.id} plant={p} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
