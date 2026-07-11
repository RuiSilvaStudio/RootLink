"use client";

import { Coffee, X } from "lucide-react";

export function EventAmenityCard({ amenity, canManage, onDelete }: {
  amenity: any;
  canManage: boolean;
  onDelete: (id: number) => void;
}) {
  return (
    <div className="flex items-center gap-3 bg-primary-50 dark:bg-primary-900/20 rounded-xl p-3" data-rl-component="EventAmenityCard">
      <div className="w-8 h-8 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center">
        <Coffee className="w-4 h-4 text-primary-600 dark:text-primary-400" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-stone-700 dark:text-stone-200 truncate">{amenity.name}</p>
        {amenity.time_start && <p className="text-xs text-stone-500 dark:text-stone-400">{amenity.time_start}{amenity.time_end ? ` — ${amenity.time_end}` : ""}</p>}
      </div>
      {canManage && (
        <button onClick={() => onDelete(amenity.id)} className="text-stone-300 dark:text-stone-600 hover:text-red-500 dark:hover:text-red-400"><X className="w-3 h-3" /></button>
      )}
    </div>
  );
}
