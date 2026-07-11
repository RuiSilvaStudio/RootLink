"use client";

import { Badge } from "@/components/ui/Badge";
import { Sprout } from "lucide-react";

export function PlantListCard({ plant }: { plant: any }) {
  const p = plant;
  return (
    <a
      href={`/plants/${p.id}`}
      className="group rounded-2xl border border-primary-100/40 dark:border-stone-700 bg-white dark:bg-stone-900 p-4 transition-all hover:shadow-md hover:border-primary-200/60 dark:hover:border-primary-700"
      data-rl-component="PlantListCard"
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
  );
}
