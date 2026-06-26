"use client";

import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

export function ExternalCard({ item }: { item: any }) {
  const c = item.content;

  return (
    <div className="rounded-2xl border border-stone-200/60 bg-stone-50/50 p-4">
      <div className="flex items-center gap-2 mb-2">
        <Badge variant="stone" className="text-[10px]">External Data</Badge>
        <span className="text-[10px] text-stone-600">iNaturalist</span>
      </div>
      <h4 className="text-sm font-display font-semibold text-stone-700 italic">{c.title}</h4>
      {c.summary && (
        <p className="text-xs text-stone-500 mt-1 line-clamp-2">{c.summary.slice(0, 100)}</p>
      )}
    </div>
  );
}
