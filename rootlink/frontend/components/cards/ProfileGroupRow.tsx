"use client";

import Link from "next/link";
import { Users } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

export function ProfileGroupRow({ group, t }: { group: any; t: (key: string, ...args: any[]) => string }) {
  return (
    <Link key={group.id} href={`/groups/${group.id}`} className="flex items-center gap-3 bg-white dark:bg-stone-900 rounded-xl border border-primary-100/40 dark:border-stone-700/40 p-3 hover:shadow-md transition" data-rl-component="ProfileGroupRow">
      <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
        <Users className="w-5 h-5 text-blue-600" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-stone-700 dark:text-stone-300 truncate">{group.name}</p>
        {group.family && <Badge variant="stone" className="text-[9px] mt-0.5">{group.family}</Badge>}
      </div>
    </Link>
  );
}
