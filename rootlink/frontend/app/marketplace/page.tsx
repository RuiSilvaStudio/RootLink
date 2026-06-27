"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Search, Plus, MapPin, CheckCircle, RefreshCw, Gift, ArrowRightLeft, Tag, ShoppingCart, Package } from "lucide-react";
import { api } from "@/lib/api";
import { safeImageUrl } from "@/lib/image-url";
import { useLocale } from "@/lib/locale-context";
import { useToast } from "@/lib/toast-context";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";

const LISTING_TYPES = [
  { value: "", icon: Package, labelKey: "marketplace.all_types" },
  { value: "sell", icon: Tag, labelKey: "marketplace.type_sell" },
  { value: "free", icon: Gift, labelKey: "marketplace.type_free" },
  { value: "swap", icon: ArrowRightLeft, labelKey: "marketplace.type_swap" },
  { value: "offer", icon: ShoppingCart, labelKey: "marketplace.type_offer" },
  { value: "want", icon: Search, labelKey: "marketplace.type_want" },
];

const CONDITIONS = ["", "new", "like_new", "good", "fair", "poor"];

const typeBadgeVariant = (type: string): "sage" | "green" | "blue" | "earth" | "amber" | "stone" => {
  if (type === "free") return "green";
  if (type === "swap") return "blue";
  if (type === "sell") return "earth";
  if (type === "offer") return "amber";
  if (type === "want") return "stone";
  return "sage";
};

export default function MarketplacePage() {
  const { t, locale } = useLocale();
  const { addToast } = useToast();
  const [listings, setListings] = useState<any[]>([]);
  const [families, setFamilies] = useState<any[]>([]);
  const [familyCategories, setFamilyCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);

  // Filters
  const [query, setQuery] = useState("");
  const [listingType, setListingType] = useState("");
  const [family, setFamily] = useState("");
  const [category, setCategory] = useState("");
  const [condition, setCondition] = useState("");
  const [sort, setSort] = useState("newest");

  useEffect(() => {
    setToken(localStorage.getItem("token"));
    api.taxonomy.families().then(setFamilies).catch(() => {});
  }, []);

  const fetchListings = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.marketplace.list({
        q: query || undefined,
        listing_type: listingType || undefined,
        family: family || undefined,
        category: category || undefined,
        condition: condition || undefined,
        sort,
        limit: 100,
      });
      setListings(data);
    } catch {
      setListings([]);
    } finally {
      setLoading(false);
    }
  }, [query, listingType, family, category, condition, sort]);

  useEffect(() => {
    fetchListings();
  }, [fetchListings]);

  const handleFamilyChange = (famValue: string) => {
    setFamily(famValue);
    setCategory("");
    if (famValue) {
      api.taxonomy.categories(famValue).then(setFamilyCategories).catch(() => setFamilyCategories([]));
    } else {
      setFamilyCategories([]);
    }
  };

  const formatPrice = (listing: any) => {
    if (listing.listing_type === "free") return t("marketplace.free");
    if (listing.listing_type === "swap") return t("marketplace.swap");
    if (listing.listing_type === "want") return t("marketplace.wanted");
    if (listing.price_cents > 0) return `€${(listing.price_cents / 100).toFixed(2)}`;
    return t("marketplace.free");
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-12">
      <PageHeader
        icon={<RefreshCw className="w-5 h-5 text-primary-500" />}
        title={t("marketplace.title")}
        subtitle={t("marketplace.subtitle")}
        action={token && (
          <Button variant="primary" size="sm" onClick={() => window.location.href = "/marketplace/create"}>
            <Plus className="w-4 h-4" /> {t("marketplace.list_item")}
          </Button>
        )}
      />

      <div className="flex flex-col lg:flex-row gap-8 mt-8">
        {/* Filter sidebar */}
        <aside className="lg:w-60 shrink-0 space-y-5">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 dark:text-stone-500" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("marketplace.search_placeholder")}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-primary-200/60 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm font-serif focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15"
            />
          </div>

          {/* Listing type */}
          <div>
            <p className="text-xs font-display font-semibold text-stone-500 uppercase tracking-wider mb-2">{t("marketplace.filter_type")}</p>
            <div className="flex gap-1.5 flex-wrap">
              {LISTING_TYPES.map((lt) => {
                const Icon = lt.icon;
                return (
                  <button
                    key={lt.value}
                    onClick={() => setListingType(lt.value)}
                    className={`px-2.5 py-1.5 text-xs rounded-lg border transition flex items-center gap-1 ${
                      listingType === lt.value ? "bg-primary-600 text-white border-primary-600" : "bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 border-primary-100 dark:border-stone-700 hover:border-primary-300 dark:hover:border-primary-600"
                    }`}
                  >
                    <Icon className="w-3 h-3" /> {t(lt.labelKey)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Family */}
          <div>
            <p className="text-xs font-display font-semibold text-stone-500 uppercase tracking-wider mb-2">{t("marketplace.filter_family")}</p>
            <select value={family} onChange={(e) => handleFamilyChange(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm font-serif focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15">
              <option value="">{t("marketplace.all_families")}</option>
              {families.map((f) => <option key={f.value} value={f.value}>{locale === "pt" ? f.label_pt : f.label}</option>)}
            </select>
          </div>

          {/* Category */}
          {family && familyCategories.length > 0 && (
            <div>
              <p className="text-xs font-display font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-2">{t("marketplace.filter_category")}</p>
              <select value={category} onChange={(e) => setCategory(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm font-serif focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15">
                <option value="">{t("marketplace.all_categories")}</option>
                {familyCategories.map((c) => <option key={c.value} value={c.value}>{locale === "pt" ? c.label_pt : c.label}</option>)}
              </select>
            </div>
          )}

          {/* Condition */}
          <div>
            <p className="text-xs font-display font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-2">{t("marketplace.filter_condition")}</p>
            <select value={condition} onChange={(e) => setCondition(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm font-serif focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15">
              {CONDITIONS.map((c) => <option key={c} value={c}>{c ? t(`marketplace.condition_${c}`) : t("marketplace.all_conditions")}</option>)}
            </select>
          </div>

          {/* Sort */}
          <div>
            <p className="text-xs font-display font-semibold text-stone-500 dark:text-stone-400 uppercase tracking-wider mb-2">{t("marketplace.sort_by")}</p>
            <select value={sort} onChange={(e) => setSort(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm font-serif focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15">
              <option value="newest">{t("marketplace.sort_newest")}</option>
              <option value="price_low">{t("marketplace.sort_price_low")}</option>
              <option value="price_high">{t("marketplace.sort_price_high")}</option>
            </select>
          </div>
        </aside>

        {/* Listings grid */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {[1, 2, 3, 4, 5, 6].map((i) => <CardSkeleton key={i} />)}
            </div>
          ) : listings.length === 0 ? (
            <EmptyState
              icon={<Package className="w-7 h-7" />}
              title={t("marketplace.no_listings")}
              message={t("marketplace.no_listings_desc")}
            />
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {listings.map((listing) => (
                <Link
                  key={listing.id}
                  href={`/marketplace/${listing.id}`}
                  className="card-lift overflow-hidden group"
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
                      <span className="text-lg font-display font-bold text-primary-700">{formatPrice(listing)}</span>
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
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
