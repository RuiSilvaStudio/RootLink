"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";

export function ProfileCommentRow({ comment }: { comment: any }) {
  const linkMap: Record<string, string> = {
    content: `/content/${comment.entity_id}`,
    event: `/events/${comment.entity_id}`,
    group: `/groups/${comment.entity_id}`,
    plant: `/plants/${comment.entity_id}`,
    course: `/learning/courses/${comment.entity_id}`,
  };
  return (
    <Link key={comment.id} href={linkMap[comment.entity_type] || "#"} className="block bg-white dark:bg-stone-900 rounded-xl border border-primary-100/40 dark:border-stone-700/40 p-4 hover:shadow-md transition" data-rl-component="ProfileCommentRow">
      <div className="flex items-center gap-2 mb-2">
        <Badge variant="stone" className="text-[9px] capitalize">{comment.entity_type}</Badge>
        <span className="text-xs text-stone-400 dark:text-stone-500">{comment.created_at ? new Date(comment.created_at).toLocaleDateString() : ""}</span>
      </div>
      <p className="text-sm text-stone-600 dark:text-stone-400 dark:text-stone-500 font-serif italic line-clamp-2">&quot;{comment.body}&quot;</p>
    </Link>
  );
}
