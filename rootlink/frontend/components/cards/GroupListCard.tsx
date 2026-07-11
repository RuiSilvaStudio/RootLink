"use client";

import { Badge } from "@/components/ui/Badge";
import { safeImageUrl } from "@/lib/image-url";
import { Hash } from "lucide-react";

export function GroupListCard({ group, noDescriptionText }: { group: any; noDescriptionText: string }) {
  return (
    <a key={group.id} href={`/groups/${group.id}`} className="card-lift p-5 group" data-rl-component="GroupListCard">
      {group.image_url ? (
        <div className="w-full h-32 rounded-xl overflow-hidden mb-4 bg-primary-50 dark:bg-primary-950/20">
          <img src={safeImageUrl(group.image_url, "/images/placeholder-card.svg")} alt={group.name} className="w-full h-full object-cover group-hover:scale-105 transition-transform" />
        </div>
      ) : (
        <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-950/20 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
          <Hash className="w-5 h-5 text-primary-500" />
        </div>
      )}
      <h3 className="font-semibold text-stone-800 dark:text-stone-100 group-hover:text-primary-700 transition">{group.name}</h3>
      <p className="text-sm text-stone-500 mt-1 line-clamp-2 font-light">
        {group.description || noDescriptionText}
      </p>
      <div className="mt-3">
        <Badge variant="sage">{group.category}</Badge>
      </div>
    </a>
  );
}
