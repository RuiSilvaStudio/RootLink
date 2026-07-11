"use client";

import { Badge } from "@/components/ui/Badge";

const typeColors: Record<string, string> = {
  talk: "bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800",
  workshop: "bg-earth-50 dark:bg-earth-900/20 border-earth-200 dark:border-earth-800",
  break: "bg-stone-50 dark:bg-stone-800/50 border-stone-200 dark:border-stone-700",
  meal: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800",
  networking: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800",
  activity: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800",
};

export function EventScheduleItem({ item, canManage, onDelete, t }: {
  item: any;
  canManage: boolean;
  onDelete: (id: number) => void;
  t: (key: string, ...args: any[]) => string;
}) {
  const start = new Date(item.start_time);
  const end = item.end_time ? new Date(item.end_time) : null;
  return (
    <div className={`rounded-xl border p-4 ${typeColors[item.type] || "bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800"}`} data-rl-component="EventScheduleItem">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <Badge variant="sage">{t(`events.schedule_type_${item.type}`)}</Badge>
            {item.location && <span className="text-xs text-stone-500 dark:text-stone-400">{item.location}</span>}
          </div>
          <h4 className="font-semibold text-stone-800 dark:text-stone-100 mt-1">{item.title}</h4>
          {item.speaker_name && <p className="text-sm text-stone-500 dark:text-stone-400">{item.speaker_name}</p>}
          {item.description && <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">{item.description}</p>}
        </div>
        <div className="text-right text-sm text-stone-500 dark:text-stone-400 shrink-0 ml-4">
          <p>{start.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</p>
          {end && <p>— {end.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</p>}
        </div>
      </div>
      {canManage && (
        <button onClick={() => onDelete(item.id)} className="text-xs text-red-400 hover:text-red-600 mt-2">Remove</button>
      )}
    </div>
  );
}
