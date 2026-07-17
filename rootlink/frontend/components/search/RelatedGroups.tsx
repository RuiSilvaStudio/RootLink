"use client";

import { useState, useEffect } from "react";
import { Users } from "lucide-react";
import { api } from "@/lib/api";
import { Badge } from "@/components/ui/Badge";
import { SidebarWidget } from "@/components/ui/DeFacto";

export function RelatedGroups({ query }: { query: string }) {
  const [groups, setGroups] = useState<any[]>([]);

  useEffect(() => {
    if (!query || query.length < 2) { setGroups([]); return; }
    const timer = setTimeout(() => {
      api.groups.search(query, 3).then(setGroups).catch(() => {});
    }, 400);
    return () => clearTimeout(timer);
  }, [query]);

  if (groups.length === 0) return null;

  return (
    <SidebarWidget icon={Users} title="Related Groups" iconColor="text-green-500">
      <div className="space-y-2">
        {groups.map((g) => (
          <a
            key={g.id}
            href={`/groups/${g.slug}`}
            className="block p-2 rounded-lg hover:bg-stone-50 transition"
          >
            <p className="text-sm font-display font-semibold text-stone-700 line-clamp-1">{g.name}</p>
            {g.description && (
              <p className="text-[10px] text-stone-600 line-clamp-1 mt-0.5">{g.description.slice(0, 60)}</p>
            )}
            {g.category && <Badge variant="sage" className="text-[9px] mt-1">{g.category}</Badge>}
          </a>
        ))}
      </div>
    </SidebarWidget>
  );
}
