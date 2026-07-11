"use client";

import { Building } from "lucide-react";

const tierColors: Record<string, string> = {
  platinum: "from-slate-100 dark:from-slate-900/40 to-slate-50 dark:to-slate-800/40 border-slate-200 dark:border-slate-700",
  gold: "from-amber-50 dark:from-amber-900/20 to-yellow-50 dark:to-yellow-900/20 border-amber-200 dark:border-amber-800",
  silver: "from-gray-50 dark:from-gray-900/40 to-slate-50 dark:to-slate-800/40 border-gray-200 dark:border-gray-700",
  bronze: "from-orange-50 dark:from-orange-900/20 to-amber-50 dark:to-amber-900/20 border-orange-200 dark:border-orange-800",
  media: "from-blue-50 dark:from-blue-900/20 to-indigo-50 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800",
  community: "from-primary-50 dark:from-primary-900/20 to-earth-50 dark:to-earth-900/20 border-primary-200 dark:border-primary-800",
};

export function EventSponsorCard({ sponsor, canManage, onDelete }: {
  sponsor: any;
  canManage: boolean;
  onDelete: (id: number) => void;
}) {
  return (
    <div className={`bg-gradient-to-br ${tierColors[sponsor.tier]} border rounded-xl p-4 text-center`} data-rl-component="EventSponsorCard">
      {sponsor.logo_url ? (
        <img src={sponsor.logo_url} alt={sponsor.name} className="h-12 mx-auto mb-2 object-contain" />
      ) : (
        <div className="h-12 flex items-center justify-center text-stone-300 dark:text-stone-600"><Building className="w-6 h-6" /></div>
      )}
      <p className="font-medium text-stone-700 dark:text-stone-200 text-sm">{sponsor.name}</p>
      {canManage && (
        <button onClick={() => onDelete(sponsor.id)} className="text-xs text-red-400 hover:text-red-600 mt-1">Remove</button>
      )}
    </div>
  );
}
