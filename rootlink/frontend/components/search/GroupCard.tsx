"use client";

import { Badge } from "@/components/ui/Badge";

export function GroupCard({ item }: { item: any }) {
  const c = item.content;

  return (
    <a
      href={c.url || `/groups`}
      className="group block rounded-2xl border border-green-200/60 bg-white p-5 transition-all hover:shadow-md hover:border-green-300/60"
    >
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-xl bg-green-50 shrink-0 flex items-center justify-center overflow-hidden">
          <img
            src={c.image_url || "/images/placeholder-card.svg"}
            alt={c.title}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Badge variant="green" className="text-[10px]">Group</Badge>
          </div>
          <h3 className="text-base font-display font-semibold text-stone-800 group-hover:text-green-700 transition mt-1.5 line-clamp-1">{c.title}</h3>
          {c.summary && (
            <p className="text-sm text-stone-500 mt-1 line-clamp-2 font-serif leading-relaxed">{c.summary.slice(0, 150)}</p>
          )}
          {c.category && (
            <div className="mt-2">
              <Badge variant="sage" className="text-[10px]">{c.category}</Badge>
            </div>
          )}
        </div>
      </div>
    </a>
  );
}
