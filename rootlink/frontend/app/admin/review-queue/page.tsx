"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ExternalLink, ChevronDown, ChevronUp, Check } from "lucide-react";
import { useLocale } from "@/lib/locale-context";

const CATEGORIES = [
  { value: "gardening", label: "Gardening" },
  { value: "woodworking", label: "Woodworking" },
  { value: "craft_trades", label: "Craft & Trades" },
  { value: "homesteading", label: "Homesteading" },
];

const CATEGORY_TEMPLATES: Record<string, string[]> = {
  gardening: ["/images/templates/gardening.svg"],
  woodworking: ["/images/templates/woodworking.svg"],
  craft_trades: ["/images/templates/craft_trades.svg"],
  homesteading: ["/images/templates/homesteading.svg"],
};

export default function ReviewQueue() {
  const { t } = useLocale();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [pendingCategory, setPendingCategory] = useState<Record<number, string>>({});
  const [selectedImage, setSelectedImage] = useState<Record<number, string>>({});

  const fetchQueue = async () => {
    setLoading(true);
    try {
      const data = await api.admin.reviewQueue();
      setItems(data);
    } catch {
      setItems([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchQueue(); }, []);

  const handleApprove = async (id: number) => {
    await api.admin.approveContent(id);
    fetchQueue();
  };

  const handleReject = async (id: number) => {
    await api.admin.rejectContent(id);
    fetchQueue();
  };

  const handleCategoryChange = async (id: number, category: string) => {
    await api.admin.updateContent(id, { category });
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, category } : i)));
    setPendingCategory((prev) => ({ ...prev, [id]: category }));
  };

  const handleImageSelect = async (id: number, image_url: string) => {
    await api.admin.updateContentImage(id, image_url);
    setItems((prev) => prev.map((i) => (i.id === id ? { ...i, image_url } : i)));
    setSelectedImage((prev) => ({ ...prev, [id]: image_url }));
  };

  const toggleExpand = (id: number) => {
    setExpanded((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const fetchFullText = async (id: number) => {
    if (items.find((i) => i.id === id)?.full_text) return;
    try {
      const detail = await api.content.get(id);
      setItems((prev) => prev.map((i) => (i.id === id ? { ...i, full_text: detail.full_text } : i)));
    } catch {
      // ignore
    }
  };

  const handleExpand = (id: number) => {
    if (!expanded[id]) {
      fetchFullText(id);
    }
    toggleExpand(id);
  };

  const allImages = (c: any): string[] => {
    const urls: string[] = [];
    if (c.image_url && c.image_url !== "null") urls.push(c.image_url);
    const templates = CATEGORY_TEMPLATES[c.category] || CATEGORY_TEMPLATES.gardening;
    urls.push(...templates);
    return urls;
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-stone-800 mb-2">{t("admin.review_queue_title")}</h1>
      <p className="text-stone-500 text-sm mb-6">
        {t("admin.review_queue_desc")}
      </p>

      {loading && <p className="text-stone-400">{t("admin.loading")}</p>}

      {!loading && items.length === 0 && (
        <p className="text-stone-400 text-center py-12">{t("admin.no_content")}</p>
      )}

      <div className="space-y-4">
        {items.map((c: any) => {
          const isExpanded = expanded[c.id];
          const images = allImages(c);
          return (
            <div key={c.id} className="bg-white border border-stone-200 rounded-lg overflow-hidden">
              {/* Header */}
              <div className="p-4 flex items-start gap-4">
                <div className="flex-1 min-w-0">
                  <h3 className="font-semibold text-stone-800">{c.title}</h3>
                  <p className="text-sm text-stone-500 mt-1 line-clamp-2">{c.summary || t("admin.no_summary")}</p>
                  <div className="flex gap-2 mt-2 text-xs text-stone-400 flex-wrap items-center">
                    <span className="text-stone-500 text-xs">{t("admin.category")}</span>
                    <select
                      value={pendingCategory[c.id] || c.category}
                      onChange={(e) => handleCategoryChange(c.id, e.target.value)}
                      className="text-xs border border-stone-300 rounded px-1.5 py-0.5 bg-white text-stone-700"
                    >
                      {CATEGORIES.map((cat) => (
                        <option key={cat.value} value={cat.value}>{cat.label}</option>
                      ))}
                    </select>
                    <span className="bg-stone-100 text-stone-600 px-2 py-0.5 rounded">{c.content_type}</span>
                    <span className="bg-stone-100 text-stone-600 px-2 py-0.5 rounded">{c.source}</span>
                    {c.source_url && (
                      <a href={c.source_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary-600 hover:underline truncate max-w-[200px]">
                        {new URL(c.source_url).hostname}
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-end gap-2 shrink-0">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleApprove(c.id)}
                      className="px-3 py-1.5 text-sm bg-green-100 text-green-700 rounded-lg hover:bg-green-200 font-medium"
                    >
                      {t("admin.approve")}
                    </button>
                    <button
                      onClick={() => handleReject(c.id)}
                      className="px-3 py-1.5 text-sm bg-red-100 text-red-700 rounded-lg hover:bg-red-200 font-medium"
                    >
                      {t("admin.unreview")}
                    </button>
                  </div>
                  <button
                    onClick={() => handleExpand(c.id)}
                    className="text-xs text-stone-400 hover:text-stone-600 flex items-center gap-1"
                  >
                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {isExpanded ? t("admin.hide_content") : t("admin.preview_content")}
                  </button>
                </div>
              </div>

              {/* Expanded: content preview + image selector */}
              {isExpanded && (
                <div className="border-t border-stone-100">
                  {/* Image selector */}
                  <div className="px-4 py-3 bg-stone-50 border-b border-stone-100">
                    <p className="text-xs font-medium text-stone-500 mb-2">{t("admin.select_image")}</p>
                    <div className="flex gap-3 flex-wrap">
                      {images.map((img, idx) => {
                        const isSelected = (selectedImage[c.id] || c.image_url || images[0]) === img;
                        const isTemplate = img.includes("/images/templates/");
                        return (
                          <button
                            key={idx}
                            onClick={() => handleImageSelect(c.id, img)}
                            className={`relative w-24 h-16 rounded-lg overflow-hidden border-2 transition shrink-0 ${
                              isSelected ? "border-primary-500 ring-2 ring-primary-200" : "border-stone-200 hover:border-stone-300"
                            }`}
                          >
                            <img src={img} alt="" className="w-full h-full object-cover" />
                            {isTemplate && (
                              <span className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[9px] text-center leading-4">
                                {t("admin.template")}
                              </span>
                            )}
                            {isSelected && (
                              <span className="absolute top-0.5 right-0.5 bg-primary-500 text-white rounded-full p-0.5">
                                <Check className="w-3 h-3" />
                              </span>
                            )}
                          </button>
                        );
                      })}
                      <div className="flex items-center">
                        <label className="text-xs text-stone-400 cursor-pointer hover:text-stone-600">
                          <span className="bg-white border border-stone-300 rounded px-2 py-1.5 text-xs text-stone-500 hover:border-primary-400 transition">
                            {t("admin.upload")}
                          </span>
                          <input type="file" accept="image/*" className="hidden" />
                        </label>
                      </div>
                    </div>
                  </div>

                  {/* Full text */}
                  <div className="px-4 py-3">
                    {c.full_text ? (
                      <div className="text-sm text-stone-700 whitespace-pre-wrap max-h-96 overflow-y-auto leading-relaxed">
                        {c.full_text.slice(0, 10000)}
                        {c.full_text.length > 10000 && (
                          <p className="text-stone-400 mt-2 italic">{t("admin.text_truncated")}</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-stone-400 italic">{t("admin.no_full_text")}</p>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
