"use client";

import { Building, Eye, EyeOff, X } from "lucide-react";

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
  confirmed: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",
  cancelled: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
};

export function EventVendorRow({ vendor, canManage, onDelete, t }: {
  vendor: any;
  canManage: boolean;
  onDelete: (id: number) => void;
  t: (key: string, ...args: any[]) => string;
}) {
  return (
    <div className="flex items-center gap-3 bg-primary-50 dark:bg-primary-900/20 rounded-xl p-3" data-rl-component="EventVendorRow">
      <div className="w-8 h-8 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center">
        <Building className="w-4 h-4 text-primary-600 dark:text-primary-400" />
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-stone-700 dark:text-stone-200">{vendor.name}</p>
          <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[vendor.status] || ""}`}>{t(`events.vendor_status_${vendor.status}`)}</span>
          {vendor.visible_to_attendees && <Eye className="w-3 h-3 text-stone-500 dark:text-stone-400" />}
          {!vendor.visible_to_attendees && <EyeOff className="w-3 h-3 text-stone-300 dark:text-stone-600" />}
        </div>
        {vendor.service_type && <p className="text-xs text-stone-500 dark:text-stone-400">{vendor.service_type}</p>}
      </div>
      {canManage && (
        <button onClick={() => onDelete(vendor.id)} className="text-stone-300 dark:text-stone-600 hover:text-red-500 dark:hover:text-red-400"><X className="w-3 h-3" /></button>
      )}
    </div>
  );
}
