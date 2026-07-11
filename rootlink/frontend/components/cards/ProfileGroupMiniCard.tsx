"use client";

import Link from "next/link";
import { Users } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

export function ProfileGroupMiniCard({ group, t }: { group: any; t: (key: string, ...args: any[]) => string }) {
  return (
    <Link key={group.id} href={`/groups/${group.id}`} className="flex items-center gap-3 bg-primary-50/40 dark:bg-primary-900/10 rounded-xl p-3 hover:bg-primary-50 transition" data-rl-component="ProfileGroupMiniCard">
      <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-950/20 flex items-center justify-center shrink-0">
        <Users className="w-5 h-5 text-primary-600" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-stone-700 dark:text-stone-300 truncate">{group.name}</p>
        {group.role !== "member" && <Badge variant="sage" className="text-[9px] mt-0.5">{group.role}</Badge>}
      </div>
    </Link>
  );
}
