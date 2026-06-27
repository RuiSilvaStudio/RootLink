"use client";

import { Badge } from "@/components/ui/Badge";

export function PlantCard({ item }: { item: any }) {
  const c = item.content;

  return (
    <a
      href={c.url || `/plants`}
      className="group block rounded-2xl border border-primary-200/60 bg-white p-5 transition-all hover:shadow-md hover:border-primary-300/60"
    >
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-xl bg-primary-50 shrink-0 flex items-center justify-center overflow-hidden">
          <img
            src={c.image_url || "/images/placeholder-card.svg"}
            alt={c.title}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Badge variant="sage" className="text-[10px]">Plant</Badge>
          </div>
          <h3 className="text-base font-display font-semibold text-stone-800 group-hover:text-primary-700 transition mt-1.5 italic line-clamp-1">{c.title}</h3>
          {c.summary && (
            <p className="text-sm text-stone-500 mt-1 line-clamp-1 font-serif">{c.summary}</p>
          )}
          {c.category && (
            <div className="mt-2">
              <Badge variant="stone" className="text-[10px]">{c.category}</Badge>
            </div>
          )}
        </div>
      </div>
    </a>
  );
}
