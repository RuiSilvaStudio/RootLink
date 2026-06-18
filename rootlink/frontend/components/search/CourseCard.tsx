"use client";

import { BookOpen } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

export function CourseCard({ item }: { item: any }) {
  const c = item.content;

  return (
    <a
      href={`/learning`}
      className="group block rounded-2xl border border-blue-200/60 bg-white p-5 transition-all hover:shadow-md hover:border-blue-300/60"
    >
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-xl bg-blue-50 shrink-0 flex items-center justify-center overflow-hidden">
          {c.image_url ? (
            <img src={c.image_url} alt="" className="w-full h-full object-cover" />
          ) : (
            <BookOpen className="w-6 h-6 text-blue-400" />
          )}
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
