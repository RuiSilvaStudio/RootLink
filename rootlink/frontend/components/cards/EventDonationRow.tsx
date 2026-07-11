"use client";

export function EventDonationRow({ donation }: { donation: any }) {
  return (
    <div className="flex items-center gap-3 bg-primary-50 dark:bg-primary-900/20 rounded-xl p-3" data-rl-component="EventDonationRow">
      <div className="w-8 h-8 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center text-primary-700 dark:text-primary-400 text-xs font-bold">
        {donation.is_anonymous ? "?" : (donation.donor_name?.[0]?.toUpperCase() || "?")}
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-stone-700 dark:text-stone-200">{donation.is_anonymous ? "Anonymous" : donation.donor_name}</p>
        {donation.message && <p className="text-xs text-stone-500 dark:text-stone-400 truncate">{donation.message}</p>}
      </div>
      <span className="text-sm font-bold text-primary-700 dark:text-primary-400">€{(donation.amount / 100).toFixed(0)}</span>
    </div>
  );
}
