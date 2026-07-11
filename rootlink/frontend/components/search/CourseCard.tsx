"use client";

import { Badge } from "@/components/ui/Badge";
import { safeImageUrl } from "@/lib/image-url";

export function CourseCard({ item }: { item: any }) {
  const c = item.content;

  return (
    <a
      data-rl-component="ResultCard"
      href={`/learning`}
      className="group block rounded-2xl border border-blue-200/60 bg-white p-5 transition-all hover:shadow-md hover:border-blue-300/60"
    >
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-xl bg-blue-50 shrink-0 flex items-center justify-center overflow-hidden">
          <img
            src={safeImageUrl(c.image_url, "/images/placeholder-card.svg")}
            alt={c.title}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <Badge variant="blue" className="text-[10px]">Course</Badge>
          </div>
          <h3 className="text-base font-display font-semibold text-stone-800 group-hover:text-blue-700 transition mt-1.5 line-clamp-1">{c.title}</h3>
          {c.summary && (
            <p className="text-sm text-stone-500 mt-1 line-clamp-2 font-serif leading-relaxed">{c.summary.slice(0, 150)}</p>
          )}
        </div>
      </div>
    </a>
  );
}
