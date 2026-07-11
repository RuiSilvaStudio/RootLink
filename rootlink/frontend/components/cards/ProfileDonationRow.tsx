"use client";

import Link from "next/link";
import { Heart } from "lucide-react";

export function ProfileDonationRow({ donation, t }: { donation: any; t: (key: string, ...args: any[]) => string }) {
  return (
    <Link key={donation.id} href={`/events/${donation.event_id}`} className="flex items-center gap-3 bg-white dark:bg-stone-900 rounded-xl border border-primary-100/40 dark:border-stone-700/40 p-3 hover:shadow-md transition" data-rl-component="ProfileDonationRow">
      <div className="w-10 h-10 rounded-lg bg-rust-100 flex items-center justify-center shrink-0">
        <Heart className="w-5 h-5 text-rust-600" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-stone-700 dark:text-stone-300 truncate">{donation.event_title}</p>
        <p className="text-xs text-stone-400 dark:text-stone-500">{donation.created_at ? new Date(donation.created_at).toLocaleDateString() : ""}{donation.is_anonymous ? ` · ${t("profile.anonymous")}` : ""}</p>
      </div>
      <span className="text-sm font-bold text-rust-600">€{(donation.amount / 100).toFixed(0)}</span>
    </Link>
  );
}
