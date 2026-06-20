"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { Tag, Gift, ArrowRightLeft, ShoppingCart, Search, Plus, X, MapPin } from "lucide-react";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/locale-context";
import { useToast } from "@/lib/toast-context";
import { useDirtyGuard } from "@/lib/use-dirty-guard";
import { Button } from "@/components/ui/Button";
import { ImageUpload } from "@/components/ui/ImageUpload";

const LISTING_TYPES = [
  { value: "sell", icon: Tag, labelKey: "marketplace.type_sell" },
  { value: "free", icon: Gift, labelKey: "marketplace.type_free" },
  { value: "swap", icon: ArrowRightLeft, labelKey: "marketplace.type_swap" },
  { value: "offer", icon: ShoppingCart, labelKey: "marketplace.type_offer" },
  { value: "want", icon: Search, labelKey: "marketplace.type_want" },
];

const CONDITIONS = [
  { value: "new", labelKey: "marketplace.condition_new" },
  { value: "like_new", labelKey: "marketplace.condition_like_new" },
  { value: "good", labelKey: "marketplace.condition_good" },
  { value: "fair", labelKey: "marketplace.condition_fair" },
  { value: "poor", labelKey: "marketplace.condition_poor" },
  { value: "n/a", labelKey: "marketplace.condition_na" },
];

export default function EditListingPage() {
  const router = useRouter();
  const params = useParams();
  const { t, locale } = useLocale();
  const { addToast } = useToast();

  const [families, setFamilies] = useState<any[]>([]);
  const [familyCategories, setFamilyCategories] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);
  const [loading, setLoading] = useState(true);

  const [listingType, setListingType] = useState("sell");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [family, setFamily] = useState("");
  const [category, setCategory] = useState("");
  const [condition, setCondition] = useState("good");
  const [priceCents, setPriceCents] = useState("");
  const [quantity, setQuantity] = useState("1");
  const [location, setLocation] = useState("");
  const [images, setImages] = useState<string[]>([]);
  const [swapPreferences, setSwapPreferences] = useState("");
  const [wasteDiverted, setWasteDiverted] = useState("");
  const [status, setStatus] = useState("active");

  const listingId = Number(params.id);
  const dirty = true;
  useDirtyGuard(dirty);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/auth/login");
      return;
    }
    Promise.all([
      api.taxonomy.families(),
      api.marketplace.get(listingId),
    ]).then(([fams, listing]) => {
      setFamilies(fams);
      setListingType(listing.listing_type);
      setTitle(listing.title);
      setDescription(listing.description || "");
      setFamily(listing.family || "");
      setCategory(listing.category || "");
      setCondition(listing.condition || "good");
      setPriceCents(listing.price_cents ? String(listing.price_cents / 100) : "");
      setQuantity(String(listing.quantity || 1));
      setLocation(listing.location || "");
      setImages(listing.images || []);
      setSwapPreferences(listing.swap_preferences || "");
      setWasteDiverted(listing.estimated_waste_diverted_kg ? String(listing.estimated_waste_diverted_kg) : "");
      setStatus(listing.status);

      if (listing.family) {
        api.taxonomy.categories(listing.family).then(setFamilyCategories).catch(() => {});
      }
    }).catch(() => {
      addToast("error", t("marketplace.not_found"));
      router.push("/marketplace");
    }).finally(() => setLoading(false));
  }, [listingId]);

  const handleFamilyChange = (famValue: string) => {
    setFamily(famValue);
    setCategory("");
    if (famValue) {
      api.taxonomy.categories(famValue).then(setFamilyCategories).catch(() => setFamilyCategories([]));
    } else {
      setFamilyCategories([]);
    }
  };

  const handleImageUpload = (urls: any) => {
    setImages([...images, urls.medium]);
  };

  const handleRemoveImage = (index: number) => {
    setImages(images.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim()) {
      addToast("error", t("marketplace.title_required"));
      return;
    }
    setSaving(true);
    try {
      const data: any = {
        title,
        description: description || undefined,
        family: family || undefined,
        category: category || undefined,
        condition: condition || undefined,
        location: location || undefined,
        images: images.length > 0 ? images : undefined,
        status,
      };
      if (listingType === "swap") {
        data.swap_preferences = swapPreferences || undefined;
      }
      if (listingType === "sell" || listingType === "offer") {
        data.price_cents = priceCents ? Math.round(parseFloat(priceCents) * 100) : 0;
        data.quantity = parseInt(quantity) || 1;
      }
      if (wasteDiverted) {
        data.estimated_waste_diverted_kg = parseFloat(wasteDiverted);
      }

      await api.marketplace.update(listingId, data);
      addToast("success", t("marketplace.listing_updated"));
      router.push(`/marketplace/${listingId}`);
    } catch (err: any) {
      addToast("error", err.message);
    }
    setSaving(false);
  };

  if (loading) return (
    <div className="max-w-2xl mx-auto px-4 py-12 space-y-6">
      <div className="h-8 bg-primary-100 rounded w-1/2 animate-pulse" />
      <div className="h-64 bg-primary-100/40 rounded-2xl animate-pulse" />
    </div>
  );

  const showPrice = listingType === "sell" || listingType === "offer";

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-8 py-12">
      <h1 className="text-2xl font-display font-bold text-stone-800 mb-6">{t("marketplace.edit_title")}</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Listing type (read-only on edit) */}
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-3">{t("marketplace.listing_type")}</label>
          <div className="grid grid-cols-5 gap-2">
            {LISTING_TYPES.map((lt) => {
              const Icon = lt.icon;
              return (
                <div
                  key={lt.value}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 ${
                    listingType === lt.value ? "border-primary-500 bg-primary-50/40" : "border-stone-200 opacity-50"
                  }`}
                >
                  <Icon className={`w-5 h-5 ${listingType === lt.value ? "text-primary-600" : "text-stone-400"}`} />
                  <span className={`text-[10px] font-medium ${listingType === lt.value ? "text-primary-700" : "text-stone-500"}`}>
                    {t(lt.labelKey)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">{t("marketplace.title_label")}</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required
            className="w-full px-4 py-2.5 rounded-xl border border-primary-100 bg-white text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15" />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">{t("marketplace.description_label")}</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4}
            className="w-full px-4 py-2.5 rounded-xl border border-primary-100 bg-white text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15" />
        </div>

        {/* Family + Category */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">{t("marketplace.family_label")}</label>
            <select value={family} onChange={(e) => handleFamilyChange(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-primary-100 bg-white text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15">
              <option value="">—</option>
              {families.map((f) => <option key={f.value} value={f.value}>{locale === "pt" ? f.label_pt : f.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">{t("marketplace.category_label")}</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} disabled={!family}
              className="w-full px-3 py-2 rounded-xl border border-primary-100 bg-white text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15 disabled:opacity-50">
              <option value="">—</option>
              {familyCategories.map((c) => <option key={c.value} value={c.value}>{locale === "pt" ? c.label_pt : c.label}</option>)}
            </select>
          </div>
        </div>

        {/* Condition + Price + Quantity */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">{t("marketplace.condition_label")}</label>
            <select value={condition} onChange={(e) => setCondition(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-primary-100 bg-white text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15">
              {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{t(c.labelKey)}</option>)}
            </select>
          </div>
          {showPrice && (
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">{t("marketplace.price_label")} (€)</label>
              <input type="number" step="0.01" min="0" value={priceCents} onChange={(e) => setPriceCents(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-primary-100 bg-white text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15" />
            </div>
          )}
          {showPrice && (
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">{t("marketplace.quantity_label")}</label>
              <input type="number" min="0" value={quantity} onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-primary-100 bg-white text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15" />
            </div>
          )}
        </div>

        {/* Status */}
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">{t("marketplace.status_label")}</label>
          <select value={status} onChange={(e) => setStatus(e.target.value)}
            className="w-full px-3 py-2 rounded-xl border border-primary-100 bg-white text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15">
            <option value="active">{t("marketplace.status_active")}</option>
            <option value="sold">{t("marketplace.status_sold")}</option>
            <option value="expired">{t("marketplace.status_expired")}</option>
          </select>
        </div>

        {/* Location */}
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">
            <MapPin className="w-3 h-3 inline mr-1" /> {t("marketplace.location_label")}
          </label>
          <input type="text" value={location} onChange={(e) => setLocation(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-primary-100 bg-white text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15" />
        </div>

        {/* Swap preferences */}
        {listingType === "swap" && (
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">{t("marketplace.swap_preferences")}</label>
            <input type="text" value={swapPreferences} onChange={(e) => setSwapPreferences(e.target.value)}
              className="w-full px-4 py-2.5 rounded-xl border border-primary-100 bg-white text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15" />
          </div>
        )}

        {/* Waste diverted */}
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">{t("marketplace.waste_diverted_label")} (kg)</label>
          <input type="number" step="0.1" min="0" value={wasteDiverted} onChange={(e) => setWasteDiverted(e.target.value)}
            className="w-full px-4 py-2.5 rounded-xl border border-primary-100 bg-white text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15" />
        </div>

        {/* Images */}
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-2">{t("marketplace.images")}</label>
          <div className="flex flex-wrap gap-3 mb-3">
            {images.map((img, i) => (
              <div key={i} className="relative w-24 h-24 rounded-xl overflow-hidden border border-primary-100">
                <img src={img} alt="" className="w-full h-full object-cover" />
                <button type="button" onClick={() => handleRemoveImage(i)}
                  className="absolute top-0.5 right-0.5 bg-black/60 text-white rounded-full p-0.5 hover:bg-black/80">
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            {images.length < 5 && (
              <ImageUpload onUpload={handleImageUpload} label="" maxSizeMb={5} />
            )}
          </div>
        </div>

        {/* Submit */}
        <div className="flex gap-3 pt-2">
          <Button type="submit" loading={saving} disabled={saving}>
            {saving ? t("marketplace.saving") : t("marketplace.save_changes")}
          </Button>
          <Button variant="secondary" type="button" onClick={() => router.push(`/marketplace/${listingId}`)}>
            {t("marketplace.cancel")}
          </Button>
        </div>
      </form>
    </div>
  );
}
