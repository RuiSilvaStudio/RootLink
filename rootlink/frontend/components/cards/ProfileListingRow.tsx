"use client";

import { Package } from "lucide-react";
import { safeImageUrl } from "@/lib/image-url";

export function ProfileListingRow({ listing, t }: { listing: any; t: (key: string, ...args: any[]) => string }) {
  return (
    <a key={listing.id} href={`/marketplace/${listing.id}`} className="flex items-center gap-3 bg-white dark:bg-stone-900 rounded-xl border border-primary-100/40 dark:border-stone-700/40 p-3 hover:shadow-md transition" data-rl-component="ProfileListingRow">
      <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-950/20 flex items-center justify-center shrink-0">
        {safeImageUrl(listing.images?.[0]) ? (
          <img src={safeImageUrl(listing.images?.[0])} alt="" className="w-full h-full object-cover rounded-lg" />
        ) : (
          <Package className="w-5 h-5 text-primary-600" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-stone-700 dark:text-stone-300 truncate">{listing.title}</p>
        <div className="flex items-center gap-2 mt-0.5">
          <span className="text-xs text-stone-400 dark:text-stone-500">
            {listing.listing_type === "free" ? t("marketplace.free") :
             listing.listing_type === "swap" ? t("marketplace.swap") :
             listing.listing_type === "want" ? t("marketplace.wanted") :
             `€${(listing.price_cents / 100).toFixed(2)}`}
          </span>
          <span className={`text-[10px] px-1.5 py-0.5 rounded ${
            listing.status === "active" ? "bg-green-100 text-green-700" :
            listing.status === "sold" ? "bg-stone-100 text-stone-500" :
            "bg-amber-100 text-amber-700"
          }`}>{listing.status}</span>
          {listing.quantity > 0 && listing.listing_type !== "want" && (
            <span className="text-[10px] text-stone-400 dark:text-stone-500">{listing.quantity} {t("marketplace.available")}</span>
          )}
        </div>
      </div>
    </a>
  );
}
