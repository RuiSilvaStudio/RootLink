"use client";

import { Users } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

export function GroupMemberChip({ member }: { member: any }) {
  return (
    <div
      data-rl-component="GroupMemberChip"
      className="flex items-center gap-2 bg-primary-50 px-3 py-1.5 rounded-full text-sm text-stone-600 dark:text-stone-300"
    >
      <div className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-950/20 flex items-center justify-center">
        <Users className="w-3 h-3 text-primary-500" />
      </div>
      User #{member.user_id}
      {member.role !== "member" && (
        <Badge variant="sage" className="text-[10px]">{member.role}</Badge>
      )}
    </div>
  );
}
