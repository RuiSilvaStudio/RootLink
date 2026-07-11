"use client";

import Link from "next/link";
import { MapPin, CheckCircle, Package } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { safeImageUrl } from "@/lib/image-url";

const typeBadgeVariant = (type: string): "sage" | "green" | "blue" | "earth" | "amber" | "stone" => {
  if (type === "free") return "green";
  if (type === "swap") return "blue";
  if (type === "sell") return "earth";
  if (type === "offer") return "amber";
  if (type === "want") return "stone";
  return "sage";
};

const formatPrice = (listing: any, t: (key: string, ...args: any[]) => string) => {
  if (listing.listing_type === "free") return t("marketplace.free");
  if (listing.listing_type === "swap") return t("marketplace.swap");
  if (listing.listing_type === "want") return t("marketplace.wanted");
  if (listing.price_cents > 0) return `€${(listing.price_cents / 100).toFixed(2)}`;
  return t("marketplace.free");
};

export function MarketplaceListCard({ listing, t }: { listing: any; t: (key: string, ...args: any[]) => string }) {
  return (
    <Link
      href={`/marketplace/${listing.id}`}
      className="card-lift overflow-hidden group"
      data-rl-component="MarketplaceListCard"
    >
      {/* Image */}
      <div className="h-40 bg-primary-100 dark:bg-primary-900/30 overflow-hidden">
        {safeImageUrl(listing.images?.[0]) ? (
          <img src={safeImageUrl(listing.images?.[0])} alt={listing.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Package className="w-10 h-10 text-primary-300 dark:text-primary-600" />
          </div>
        )}
      </div>
      {/* Content */}
      <div className="p-4">
        <div className="flex items-center gap-2 mb-2">
          <Badge variant={typeBadgeVariant(listing.listing_type)} className="text-[9px]">
            {t(`marketplace.type_${listing.listing_type}`)}
          </Badge>
          {listing.condition && listing.condition !== "n/a" && (
            <Badge variant="stone" className="text-[9px]">{t(`marketplace.condition_${listing.condition}`)}</Badge>
          )}
        </div>
        <h3 className="font-display font-semibold text-stone-800 dark:text-stone-100 text-sm group-hover:text-primary-700 transition line-clamp-2">{listing.title}</h3>
        <div className="flex items-center justify-between mt-3">
          <span className="text-lg font-display font-bold text-primary-700">{formatPrice(listing, t)}</span>
          <div className="flex items-center gap-2">
            {listing.quantity > 0 && listing.listing_type !== "want" && (
              <span className={`text-xs ${listing.quantity <= 3 ? "text-amber-600 dark:text-amber-400" : "text-stone-500 dark:text-stone-400"}`}>
                {listing.quantity} {t("marketplace.available")}
              </span>
            )}
            {listing.location && (
              <span className="text-xs text-stone-500 dark:text-stone-400 flex items-center gap-0.5">
                <MapPin className="w-3 h-3" /> {listing.location}
              </span>
            )}
          </div>
        </div>
        {/* Seller */}
        <div className="flex items-center gap-2 mt-3 pt-3 border-t border-primary-50 dark:border-stone-800">
          <div className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-[10px] font-display font-semibold text-primary-600 dark:text-primary-400 shrink-0">
            {listing.seller_name?.[0]?.toUpperCase() || "?"}
          </div>
          <span className="text-xs text-stone-500 dark:text-stone-400 truncate">{listing.seller_name}</span>
          {listing.seller_verified && <CheckCircle className="w-3 h-3 text-green-500 dark:text-green-400 shrink-0" />}
        </div>
      </div>
    </Link>
  );
}
