"use client";

import { useState, useEffect } from "react";
import { Leaf, ExternalLink } from "lucide-react";
import { api } from "@/lib/api";
import { SidebarWidget } from "@/components/ui/DeFacto";

export function SpeciesWidget({ query }: { query: string }) {
  const [species, setSpecies] = useState<any>({ inaturalist: [], gbif: [] });

  useEffect(() => {
    if (!query || query.length < 2) { setSpecies({ inaturalist: [], gbif: [] }); return; }
    const timer = setTimeout(() => {
      api.external.species(query, 3).then(setSpecies).catch(() => {});
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  const hasData = (species.inaturalist?.length > 0) || (species.gbif?.length > 0);
  if (!hasData) return null;

  return (
    <SidebarWidget icon={Leaf} title="Species Data" iconColor="text-primary-500">
      {species.inaturalist?.length > 0 && (
        <div className="mb-3">
          <p className="text-[10px] text-stone-600 mb-1.5">iNaturalist</p>
          {species.inaturalist.map((t: any) => (
          <div key={t.id} className="flex items-center gap-2 py-1.5">
            {t.image_url && <img src={t.image_url} alt="" className="w-6 h-6 rounded object-cover" />}
            <div className="flex-1 min-w-0">
              <p className="text-xs text-stone-700 italic line-clamp-1">{t.name}</p>
              {t.common_name && <p className="text-[10px] text-stone-600 line-clamp-1">{t.common_name}</p>}
            </div>
            {t.wikipedia_url && (
              <a href={t.wikipedia_url} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="w-3 h-3 text-stone-600" />
              </a>
            )}
            </div>
          ))}
        </div>
      )}

      {species.gbif?.length > 0 && (
        <div>
          <p className="text-[10px] text-stone-600 mb-1.5">GBIF</p>
          {species.gbif.slice(0, 2).map((s: any) => (
            <div key={s.key} className="py-1.5">
              <p className="text-xs text-stone-700 italic line-clamp-1">{s.scientific_name}</p>
              {s.common_name && <p className="text-[10px] text-stone-600">{s.common_name}</p>}
            </div>
          ))}
        </div>
      )}
    </SidebarWidget>
  );
}
