"use client";

import Link from "next/link";
import { CheckCircle } from "lucide-react";

export function MarketplaceSellerCard({ listing, viewSellerText }: { listing: any; viewSellerText: string }) {
  return (
    <Link
      href={`/profile?id=${listing.seller_id}`}
      data-rl-component="MarketplaceSellerCard"
      className="flex items-center gap-3 bg-primary-50/40 dark:bg-primary-900/20 rounded-xl p-3 mb-4 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition"
    >
      <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-sm font-display font-semibold text-primary-600 dark:text-primary-400">
        {listing.seller_name?.[0]?.toUpperCase() || "?"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-stone-700 dark:text-stone-200 truncate">{listing.seller_name}</span>
          {listing.seller_verified && <CheckCircle className="w-3.5 h-3.5 text-green-500 dark:text-green-400" />}
        </div>
        <span className="text-xs text-stone-500 dark:text-stone-400">{viewSellerText}</span>
      </div>
    </Link>
  );
}
