"use client";

import { useState, useEffect } from "react";
import { useParams, useSearchParams, useRouter } from "next/navigation";
import Link from "next/link";
import { MapPin, CheckCircle, ArrowLeft, Tag, Gift, ArrowRightLeft, ShoppingCart, Search, Package, Clock, ShieldCheck, ExternalLink } from "lucide-react";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/locale-context";
import { useToast } from "@/lib/toast-context";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { CommentSection } from "@/components/CommentSection";

const typeIcons: Record<string, any> = {
  sell: Tag, free: Gift, swap: ArrowRightLeft, offer: ShoppingCart, want: Search,
};

export default function ListingDetailPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { t, locale } = useLocale();
  const { addToast } = useToast();

  const [listing, setListing] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [purchasing, setPurchasing] = useState(false);
  const [activeImage, setActiveImage] = useState(0);
  const [orderStatus, setOrderStatus] = useState<string | null>(null);

  const listingId = Number(params.id);
  const orderParam = searchParams.get("order");
  const statusParam = searchParams.get("status");

  useEffect(() => {
    if (statusParam === "success" && orderParam) {
      setOrderStatus("success");
      addToast("success", t("marketplace.payment_success"));
    } else if (statusParam === "cancel") {
      setOrderStatus("cancelled");
      addToast("error", t("marketplace.payment_cancelled"));
    }
  }, [statusParam, orderParam]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      api.auth.me().then(setCurrentUser).catch(() => {});
    }
    api.marketplace.get(listingId).then(setListing).catch(() => {}).finally(() => setLoading(false));
  }, [listingId]);

  const isOwner = currentUser && listing && currentUser.id === listing.seller_id;

  const handlePurchase = async () => {
    if (!currentUser) {
      router.push("/auth/login");
      return;
    }
    setPurchasing(true);
    try {
      const result = await api.marketplace.purchase(listingId);
      window.location.href = result.checkout_url;
    } catch (err: any) {
      addToast("error", err.message);
    }
    setPurchasing(false);
  };

  const handleClaim = async () => {
    if (!currentUser) {
      router.push("/auth/login");
      return;
    }
    try {
      await api.marketplace.claim(listingId);
      addToast("success", t("marketplace.claim_success"));
      setListing({ ...listing, status: "sold" });
    } catch (err: any) {
      addToast("error", err.message);
    }
  };

  if (loading) return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-12 space-y-6">
      <div className="h-8 bg-primary-100 dark:bg-primary-950/20 rounded w-3/4 animate-pulse" />
      <div className="h-80 bg-primary-100 dark:bg-primary-950/20 rounded-2xl animate-pulse" />
    </div>
  );
  if (!listing) return <div className="text-center py-20 text-stone-500 dark:text-stone-400">{t("marketplace.not_found")}</div>;

  const Icon = typeIcons[listing.listing_type] || Package;
  const images = listing.images || [];
  const formatPrice = () => {
    if (listing.listing_type === "free") return t("marketplace.free");
    if (listing.listing_type === "swap") return t("marketplace.swap");
    if (listing.listing_type === "want") return t("marketplace.wanted");
    if (listing.price_cents > 0) return `€${(listing.price_cents / 100).toFixed(2)}`;
    return t("marketplace.free");
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-12">
      <Link href="/marketplace" className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-primary-600 transition mb-6">
        <ArrowLeft className="w-4 h-4" /> {t("marketplace.back")}
      </Link>

      {orderStatus === "success" && (
        <Card variant="plain" className="p-6 mb-6 bg-green-50 border-green-200">
          <div className="flex items-center gap-3">
            <CheckCircle className="w-6 h-6 text-green-600" />
            <div>
              <p className="font-display font-semibold text-green-800">{t("marketplace.payment_success_title")}</p>
              <p className="text-sm text-green-600">{t("marketplace.payment_success_desc")}</p>
            </div>
          </div>
        </Card>
      )}

      <div className="grid md:grid-cols-2 gap-8">
        {/* Image gallery */}
        <div>
          {images.length > 0 ? (
            <>
              <div className="rounded-2xl overflow-hidden bg-primary-100 dark:bg-primary-900/30 mb-3">
                <img src={images[activeImage]} alt={listing.title} className="w-full h-80 object-cover" />
              </div>
              {images.length > 1 && (
                <div className="flex gap-2">
                  {images.map((img: string, i: number) => (
                    <button key={i} onClick={() => setActiveImage(i)}
                      className={`w-16 h-16 rounded-lg overflow-hidden border-2 transition ${activeImage === i ? "border-primary-500" : "border-stone-200 dark:border-stone-700 hover:border-primary-300 dark:hover:border-primary-600"}`}>
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}
            </>
          ) : (
            <div className="rounded-2xl bg-primary-100 dark:bg-primary-900/30 h-80 flex items-center justify-center">
              <Package className="w-16 h-16 text-primary-300 dark:text-primary-600" />
            </div>
          )}
        </div>

        {/* Details */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Badge variant="earth" className="flex items-center gap-1">
              <Icon className="w-3 h-3" /> {t(`marketplace.type_${listing.listing_type}`)}
            </Badge>
            {listing.condition && listing.condition !== "n/a" && (
              <Badge variant="stone">{t(`marketplace.condition_${listing.condition}`)}</Badge>
            )}
            {listing.status === "sold" && <Badge variant="red">{t("marketplace.sold")}</Badge>}
          </div>

          <h1 className="text-2xl font-display font-bold text-stone-800 dark:text-stone-100 mb-3">{listing.title}</h1>

          <p className="text-3xl font-display font-bold text-primary-700 mb-2">{formatPrice()}</p>

          {/* Stock indicator */}
          {(listing.listing_type === "sell" || listing.listing_type === "offer") && (
            <p className={`text-sm mb-4 ${listing.quantity > 0 ? "text-green-600" : "text-red-500"}`}>
              {listing.quantity > 0
                ? `${listing.quantity} ${t("marketplace.available")}`
                : t("marketplace.out_of_stock")}
            </p>
          )}
          {(listing.listing_type === "free" || listing.listing_type === "swap") && (
            <p className={`text-sm mb-4 ${listing.quantity > 0 ? "text-green-600" : "text-red-500"}`}>
              {listing.quantity > 0
                ? `${listing.quantity} ${t("marketplace.available")}`
                : t("marketplace.claimed")}
            </p>
          )}

          {listing.description && (
            <p className="text-stone-600 dark:text-stone-300 font-serif leading-relaxed mb-4">{listing.description}</p>
          )}

          {listing.swap_preferences && (
            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-xl p-4 mb-4">
              <p className="text-sm font-display font-semibold text-blue-800 dark:text-blue-300 mb-1">{t("marketplace.swap_preferences")}</p>
              <p className="text-sm text-blue-600 dark:text-blue-400 font-serif">{listing.swap_preferences}</p>
            </div>
          )}

          {listing.location && (
            <p className="text-sm text-stone-500 flex items-center gap-1.5 mb-4">
              <MapPin className="w-4 h-4" /> {listing.location}
            </p>
          )}

          {listing.estimated_waste_diverted_kg && (
            <p className="text-xs text-green-600 flex items-center gap-1.5 mb-4">
              <ShieldCheck className="w-3.5 h-3.5" /> {t("marketplace.waste_diverted")}: {listing.estimated_waste_diverted_kg}kg
            </p>
          )}

          {/* Seller card */}
          <Link href={`/profile?id=${listing.seller_id}`} className="flex items-center gap-3 bg-primary-50/40 dark:bg-primary-900/20 rounded-xl p-3 mb-4 hover:bg-primary-50 dark:hover:bg-primary-900/30 transition">
            <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-sm font-display font-semibold text-primary-600 dark:text-primary-400">
              {listing.seller_name?.[0]?.toUpperCase() || "?"}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-medium text-stone-700 dark:text-stone-200 truncate">{listing.seller_name}</span>
                {listing.seller_verified && <CheckCircle className="w-3.5 h-3.5 text-green-500 dark:text-green-400" />}
              </div>
              <span className="text-xs text-stone-500 dark:text-stone-400">{t("marketplace.view_seller")}</span>
            </div>
          </Link>

          {/* Action buttons */}
          {!isOwner && listing.status === "active" && listing.quantity > 0 && (
            <>
              {listing.listing_type === "sell" || listing.listing_type === "offer" ? (
                <Button onClick={handlePurchase} loading={purchasing} disabled={purchasing} className="w-full">
                  <Tag className="w-4 h-4" /> {t("marketplace.buy_now")} — {formatPrice()}
                </Button>
              ) : listing.listing_type === "free" || listing.listing_type === "swap" ? (
                <Button onClick={handleClaim} className="w-full">
                  {listing.listing_type === "free" ? <Gift className="w-4 h-4" /> : <ArrowRightLeft className="w-4 h-4" />}
                  {listing.listing_type === "free" ? t("marketplace.claim_free") : t("marketplace.offer_swap")}
                </Button>
              ) : null}
            </>
          )}
          {!isOwner && listing.status === "active" && listing.quantity <= 0 && (
            <Card variant="plain" className="p-4 bg-stone-50 dark:bg-stone-800/50 text-center">
              <p className="text-sm text-stone-500 dark:text-stone-400 font-serif">{t("marketplace.no_longer_available")}</p>
            </Card>
          )}
          {isOwner && (
            <Card variant="plain" className="p-4 bg-primary-50/30 dark:bg-primary-900/20">
              <p className="text-sm text-stone-500 dark:text-stone-400 font-serif">{t("marketplace.your_listing")}</p>
              <div className="flex gap-2 mt-2">
                <Button variant="secondary" size="sm" onClick={() => router.push(`/marketplace/edit/${listing.id}`)}>
                  {t("marketplace.edit")}
                </Button>
                <Button variant="danger" size="sm" onClick={async () => {
                  if (confirm(t("marketplace.delete_confirm"))) {
                    await api.marketplace.delete(listing.id);
                    router.push("/marketplace");
                  }
                }}>
                  {t("marketplace.delete")}
                </Button>
              </div>
            </Card>
          )}

          {/* Meta */}
          <div className="flex items-center gap-3 mt-4 text-xs text-stone-500 dark:text-stone-400">
            <span className="flex items-center gap-1"><Clock className="w-3 h-3" /> {listing.created_at ? new Date(listing.created_at).toLocaleDateString() : ""}</span>
            <span>·</span>
            <span>{listing.view_count} {t("marketplace.views")}</span>
          </div>
        </div>
      </div>

      {/* Comments */}
      <CommentSection entityType="listing" entityId={listingId} className="mt-12" />
    </div>
  );
}
