"use client";

import { FileText, ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

export function ArticleCard({ item }: { item: any }) {
  const c = item.content;
  const hostname = c.source_url ? new URL(c.source_url).hostname.replace("www.", "") : null;

  return (
    <a
      href={c.url || `/content/${c.id}`}
      target="_blank"
      rel="noopener noreferrer"
      className="group block rounded-2xl border border-stone-200/60 bg-white p-5 transition-all hover:shadow-md hover:border-stone-300/60"
    >
      <div className="flex items-start gap-4">
        <div className="w-14 h-14 rounded-xl bg-stone-100 shrink-0 flex items-center justify-center overflow-hidden">
          {c.image_url ? (
            <img src={c.image_url} alt="" className="w-full h-full object-cover" onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
          ) : (
            <FileText className="w-6 h-6 text-stone-400" />
          )}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-display font-semibold text-stone-800 group-hover:text-primary-700 transition line-clamp-1">{c.title}</h3>
            <ExternalLink className="w-3.5 h-3.5 text-stone-400 shrink-0 opacity-0 group-hover:opacity-100 transition" />
          </div>
          {c.summary && (
            <p className="text-sm text-stone-500 mt-1.5 line-clamp-2 font-serif leading-relaxed">{c.summary.slice(0, 200)}</p>
          )}
          <div className="flex items-center gap-2 mt-3 flex-wrap">
            {c.verification_status === "community_reviewed" && <Badge variant="green" className="text-[10px]">Reviewed</Badge>}
            {c.verification_status === "cross_referenced" && <Badge variant="blue" className="text-[10px]">Cross-ref</Badge>}
            {c.category && <Badge variant="sage" className="text-[10px]">{c.category}</Badge>}
            {hostname && <span className="text-[10px] text-stone-400 ml-auto">{hostname}</span>}
          </div>
        </div>
      </div>
    </a>
  );
}
