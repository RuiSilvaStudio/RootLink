"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Tag, Gift, ArrowRightLeft, ShoppingCart, Search, Plus, X, MapPin } from "lucide-react";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/locale-context";
import { useToast } from "@/lib/toast-context";
import { useDirtyGuard } from "@/lib/use-dirty-guard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ImageUpload } from "@/components/ui/ImageUpload";

const LISTING_TYPES = [
  { value: "sell", icon: Tag, labelKey: "marketplace.type_sell", descKey: "marketplace.type_sell_desc" },
  { value: "free", icon: Gift, labelKey: "marketplace.type_free", descKey: "marketplace.type_free_desc" },
  { value: "swap", icon: ArrowRightLeft, labelKey: "marketplace.type_swap", descKey: "marketplace.type_swap_desc" },
  { value: "offer", icon: ShoppingCart, labelKey: "marketplace.type_offer", descKey: "marketplace.type_offer_desc" },
  { value: "want", icon: Search, labelKey: "marketplace.type_want", descKey: "marketplace.type_want_desc" },
];

const CONDITIONS = [
  { value: "new", labelKey: "marketplace.condition_new" },
  { value: "like_new", labelKey: "marketplace.condition_like_new" },
  { value: "good", labelKey: "marketplace.condition_good" },
  { value: "fair", labelKey: "marketplace.condition_fair" },
  { value: "poor", labelKey: "marketplace.condition_poor" },
  { value: "n/a", labelKey: "marketplace.condition_na" },
];

export default function CreateListingPage() {
  const router = useRouter();
  const { t, locale } = useLocale();
  const { addToast } = useToast();

  const [families, setFamilies] = useState<any[]>([]);
  const [familyCategories, setFamilyCategories] = useState<any[]>([]);
  const [saving, setSaving] = useState(false);

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

  const dirty = !!(title || description || location || priceCents);
  useDirtyGuard(dirty);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/auth/login");
      return;
    }
    api.taxonomy.families().then(setFamilies).catch(() => {});
  }, []);

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
        listing_type: listingType,
        title,
        description: description || undefined,
        family: family || undefined,
        category: category || undefined,
        condition: condition || undefined,
        location: location || undefined,
        images: images.length > 0 ? images : undefined,
        swap_preferences: listingType === "swap" ? swapPreferences || undefined : undefined,
        estimated_waste_diverted_kg: wasteDiverted ? parseFloat(wasteDiverted) : undefined,
      };
      if (listingType === "sell" || listingType === "offer") {
        data.price_cents = priceCents ? Math.round(parseFloat(priceCents) * 100) : 0;
        data.quantity = parseInt(quantity) || 1;
      }

      const listing = await api.marketplace.create(data);
      addToast("success", t("marketplace.listing_created"));
      router.push(`/marketplace/${listing.id}`);
    } catch (err: any) {
      addToast("error", err.message);
    }
    setSaving(false);
  };

  const showPrice = listingType === "sell" || listingType === "offer";

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-8 py-12">
      <h1 className="text-2xl font-display font-bold text-stone-800 dark:text-stone-100 mb-6">{t("marketplace.create_title")}</h1>

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Listing type selector */}
        <div>
          <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-3">{t("marketplace.listing_type")}</label>
          <div className="grid grid-cols-5 gap-2">
            {LISTING_TYPES.map((lt) => {
              const Icon = lt.icon;
              return (
                <button
                  key={lt.value}
                  type="button"
                  onClick={() => setListingType(lt.value)}
                  className={`flex flex-col items-center gap-1.5 p-3 rounded-xl border-2 transition ${
                    listingType === lt.value ? "border-primary-500 bg-primary-50/40 dark:bg-primary-900/20" : "border-stone-200 dark:border-stone-700 hover:border-primary-300 dark:hover:border-primary-600"
                  }`}
                >
                  <Icon className={`w-5 h-5 ${listingType === lt.value ? "text-primary-600 dark:text-primary-400" : "text-stone-400 dark:text-stone-500"}`} />
                  <span className={`text-[10px] font-medium ${listingType === lt.value ? "text-primary-700 dark:text-primary-300" : "text-stone-500 dark:text-stone-400"}`}>
                    {t(lt.labelKey)}
                  </span>
                </button>
              );
            })}
          </div>
          <p className="text-xs text-stone-400 dark:text-stone-500 mt-2 font-serif">{t(LISTING_TYPES.find(lt => lt.value === listingType)?.descKey || "")}</p>
        </div>

        {/* Title */}
        <div>
          <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">{t("marketplace.title_label")}</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required
            placeholder={t("marketplace.title_placeholder")}
            className="w-full px-4 py-2.5 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15" />
        </div>

        {/* Description */}
        <div>
          <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">{t("marketplace.description_label")}</label>
          <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4}
            placeholder={t("marketplace.description_placeholder")}
            className="w-full px-4 py-2.5 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15" />
        </div>

        {/* Family + Category */}
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">{t("marketplace.family_label")}</label>
            <select value={family} onChange={(e) => handleFamilyChange(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15">
              <option value="">—</option>
              {families.map((f) => <option key={f.value} value={f.value}>{locale === "pt" ? f.label_pt : f.label}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">{t("marketplace.category_label")}</label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} disabled={!family}
              className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15 disabled:opacity-50">
              <option value="">—</option>
              {familyCategories.map((c) => <option key={c.value} value={c.value}>{locale === "pt" ? c.label_pt : c.label}</option>)}
            </select>
          </div>
        </div>

        {/* Condition + Price + Quantity */}
        <div className="grid grid-cols-3 gap-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">{t("marketplace.condition_label")}</label>
            <select value={condition} onChange={(e) => setCondition(e.target.value)}
              className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15">
              {CONDITIONS.map((c) => <option key={c.value} value={c.value}>{t(c.labelKey)}</option>)}
            </select>
          </div>
          {showPrice && (
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">{t("marketplace.price_label")} (€)</label>
              <input type="number" step="0.01" min="0" value={priceCents} onChange={(e) => setPriceCents(e.target.value)}
                placeholder="0.00"
                className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15" />
            </div>
          )}
          {showPrice && (
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">{t("marketplace.quantity_label")}</label>
              <input type="number" min="1" value={quantity} onChange={(e) => setQuantity(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15" />
            </div>
          )}
        </div>

        {/* Location */}
        <div>
          <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
            <MapPin className="w-3 h-3 inline mr-1" /> {t("marketplace.location_label")}
          </label>
          <input type="text" value={location} onChange={(e) => setLocation(e.target.value)}
            placeholder={t("marketplace.location_placeholder")}
            className="w-full px-4 py-2.5 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15" />
        </div>

        {/* Swap preferences */}
        {listingType === "swap" && (
          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">{t("marketplace.swap_preferences")}</label>
            <input type="text" value={swapPreferences} onChange={(e) => setSwapPreferences(e.target.value)}
              placeholder={t("marketplace.swap_preferences_placeholder")}
              className="w-full px-4 py-2.5 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15" />
          </div>
        )}

        {/* Waste diverted */}
        <div>
          <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">{t("marketplace.waste_diverted_label")} (kg)</label>
          <input type="number" step="0.1" min="0" value={wasteDiverted} onChange={(e) => setWasteDiverted(e.target.value)}
            placeholder={t("marketplace.waste_diverted_placeholder")}
            className="w-full px-4 py-2.5 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15" />
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
          <p className="text-xs text-stone-400">{t("marketplace.images_hint")}</p>
        </div>

        {/* Submit */}
        <div className="flex gap-3 pt-2">
          <Button type="submit" loading={saving} disabled={saving}>
            <Plus className="w-4 h-4" /> {saving ? t("marketplace.creating") : t("marketplace.create_listing")}
          </Button>
          <Button variant="secondary" type="button" onClick={() => router.push("/marketplace")}>
            {t("marketplace.cancel")}
          </Button>
        </div>
      </form>
    </div>
  );
}
