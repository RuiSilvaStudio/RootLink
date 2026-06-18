"use client";

import { Calendar, MapPin, Globe } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

export function EventCard({ item }: { item: any }) {
  const c = item.content;
  const date = c.published_at ? new Date(c.published_at) : null;

  return (
    <a
      href={`/events`}
      className="group block rounded-2xl border border-earth-200/60 bg-white p-5 transition-all hover:shadow-md hover:border-earth-300/60"
    >
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-xl bg-earth-50 shrink-0 flex items-center justify-center overflow-hidden">
          {c.image_url ? (
            <img src={c.image_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <Calendar className="w-6 h-6 text-earth-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Badge variant="earth" className="text-[10px]">Event</Badge>
            {date && (
              <span className="text-[10px] text-stone-400">
                {date.toLocaleDateString("en", { month: "short", day: "numeric" })}
              </span>
            )}
          </div>
          <h3 className="text-base font-display font-semibold text-stone-800 group-hover:text-earth-700 transition mt-1.5 line-clamp-1">{c.title}</h3>
          {c.summary && (
            <p className="text-sm text-stone-500 mt-1 line-clamp-2 font-serif leading-relaxed">{c.summary.slice(0, 150)}</p>
          )}
          <div className="flex items-center gap-2 mt-2">
            {c.category && <Badge variant="sage" className="text-[10px]">{c.category}</Badge>}
          </div>
        </div>
      </div>
    </a>
  );
}
