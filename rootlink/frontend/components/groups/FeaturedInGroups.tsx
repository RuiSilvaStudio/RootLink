"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { GroupBadge } from "@/lib/groups-types";
import { useLocale } from "@/lib/locale-context";
import { safeImageUrl } from "@/lib/image-url";
import { Layers } from "lucide-react";

interface FeaturedInGroupsProps {
  contentType: "event" | "article" | "course" | "waste_hub";
  contentId: number;
}

export function FeaturedInGroups({ contentType, contentId }: FeaturedInGroupsProps) {
  const { t } = useLocale();
  const [groups, setGroups] = useState<GroupBadge[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Auxiliary widget: on failure it simply doesn't render (nothing lost),
    // so no error surface — but we don't lie with an empty state either.
    api.groups.getGroupsForContent(contentType, contentId)
      .then(setGroups)
      .catch(() => setGroups([]))
      .finally(() => setLoading(false));
  }, [contentType, contentId]);

  if (loading || groups.length === 0) return null;

  return (
    <div className="mt-6 p-5 rounded-2xl border border-primary-200/60 dark:border-stone-700 bg-primary-50/30 dark:bg-primary-900/10">
      <p className="text-xs font-display font-medium tracking-widest uppercase text-earth-500 mb-3 flex items-center gap-1.5">
        <Layers className="w-3.5 h-3.5" aria-hidden /> {t("groups.featured_in", { count: groups.length })}
      </p>
      <div className="flex flex-wrap gap-3">
        {groups.map(g => (
          <Link key={g.id} href={`/groups/${g.slug}`} className="flex items-center gap-2.5 px-3.5 py-2 rounded-xl bg-white dark:bg-stone-900 border border-primary-200/60 dark:border-stone-700 hover:border-primary-300 hover:shadow-sm transition group">
            {g.logo_url && <img src={safeImageUrl(g.logo_url)} alt="" className="w-8 h-8 rounded-lg object-cover" />}
            <div>
              <p className="text-sm font-medium text-stone-700 dark:text-stone-200 group-hover:text-primary-600 dark:group-hover:text-primary-300 transition">{g.name}</p>
              <p className="text-xs text-stone-400">
                {g.group_type === "structured" ? t("groups.type_structured") : t("groups.type_organic")}
              </p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
