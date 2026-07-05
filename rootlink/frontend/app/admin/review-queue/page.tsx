"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ExternalLink, ChevronDown, ChevronUp, Check, AlertTriangle, Eye } from "lucide-react";
import { useLocale } from "@/lib/locale-context";
import { Collapsible } from "@/components/Collapsible";
import { Badge } from "@/components/ui/Badge";
import { ImageUpload } from "@/components/ui/ImageUpload";

const CATEGORY_TEMPLATES: Record<string, string[]> = {
  gardening: ["/images/templates/gardening.svg"],
  woodworking: ["/images/templates/woodworking.svg"],
  craft_trades: ["/images/templates/craft_trades.svg"],
  homesteading: ["/images/templates/homesteading.svg"],
};

export default function ReviewQueue() {
  const { t, locale } = useLocale();
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [pendingCategory, setPendingCategory] = useState<Record<number, string>>({});
  const [selectedImage, setSelectedImage] = useState<Record<number, string>>({});
  const [families, setFamilies] = useState<any[]>([]);
  const [familyCategoriesMap, setFamilyCategoriesMap] = useState<Record<string, any[]>>({});

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

  useEffect(() => {
    fetchQueue();
    api.taxonomy.families().then(setFamilies).catch(() => {});
  }, []);

  const loadFamilyCategories = async (familyValue: string) => {
    if (familyCategoriesMap[familyValue]) return;
    try {
      const cats = await api.taxonomy.categories(familyValue);
      setFamilyCategoriesMap((prev) => ({ ...prev, [familyValue]: cats }));
    } catch {}
  };

  const handleMarkReviewed = async (id: number) => {
    const comment = window.prompt(t("admin.review_comment_prompt")) || undefined;
    await api.admin.reviewContent(id, comment);
    fetchQueue();
  };

  const handleApprove = async (id: number) => {
    await api.admin.approveContent(id);
    fetchQueue();
  };

  const handleReject = async (id: number) => {
    const reason = window.prompt(t("admin.reject_reason_prompt")) || undefined;
    await api.admin.rejectContent(id, reason);
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
      <div className="mb-6">
        <Badge variant="sage" className="mb-3">{t("admin.review_queue")}</Badge>
        <h1 className="text-3xl sm:text-4xl font-display font-semibold text-stone-800 dark:text-stone-100 leading-[1.08]">
          {t("admin.review_queue_title")}
        </h1>
        <p className="text-stone-500 text-sm mt-2 font-serif">{t("admin.review_queue_desc")}</p>
      </div>

      {loading && (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl bg-stone-200/40 animate-pulse h-24" />
          ))}
        </div>
      )}

      {!loading && items.length === 0 && (
        <div className="text-center py-16">
          <p className="text-stone-400 font-serif">{t("admin.no_content")}</p>
        </div>
      )}

      <div className="space-y-3">
        {items.map((c: any) => {
          const isExpanded = expanded[c.id];
          const images = allImages(c);
          return (
            <div
              key={c.id}
              className={`bg-white rounded-2xl border overflow-hidden border-l-4 ${
                c.status === "reviewed" ? "border-l-sky-400 border-stone-200/60" : "border-l-stone-200 border-stone-200/60"
              }`}
            >
              <div className="p-4 sm:p-5 flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <h3 className="font-display font-semibold text-stone-800 dark:text-stone-100 text-base">{c.title}</h3>
                    <Badge variant="stone" className="text-[10px]">{c.content_type}</Badge>
                    <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${c.status === "reviewed" ? "text-sky-600" : "text-stone-400"}`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${c.status === "reviewed" ? "bg-sky-400" : "bg-stone-300"}`} />
                      {c.status === "reviewed" ? t("admin.status_reviewed_pending") : t("admin.status_awaiting_review")}
                    </span>
                  </div>
                  <p className="text-sm text-stone-500 font-serif line-clamp-2">{c.summary || t("admin.no_summary")}</p>
                  <div className="flex items-center gap-2 mt-2 flex-wrap">
                    <span className="text-stone-400 text-xs font-serif">{t("admin.category")}</span>
                    <select
                      value={pendingCategory[c.id] || c.category || ""}
                      onChange={(e) => {
                        const val = e.target.value;
                        handleCategoryChange(c.id, val);
                        if (val) loadFamilyCategories(val);
                      }}
                      className="text-xs border border-stone-200 rounded-lg px-2 py-1 bg-stone-50 text-stone-600 font-serif focus:outline-none focus:ring-1 focus:ring-primary-400"
                    >
                      <option value="">—</option>
                      {families.flatMap((fam) => {
                        const famCats = familyCategoriesMap[fam.value] || [];
                        return [
                          <option key={fam.value} value={fam.value} disabled>
                            {locale === "pt" ? fam.label_pt : fam.label}
                          </option>,
                          ...famCats.map((cat) => (
                            <option key={cat.value} value={cat.value}>
                              {"  "}{locale === "pt" ? cat.label_pt : cat.label}
                            </option>
                          )),
                        ];
                      })}
                    </select>
                    <Badge variant="stone" className="text-[10px]">{c.source}</Badge>
                    {c.source_url && (
                      <a href={c.source_url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-primary-600 hover:underline text-xs font-serif truncate max-w-[200px]">
                        {new URL(c.source_url).hostname}
                        <ExternalLink className="w-3 h-3 shrink-0" />
                      </a>
                    )}
                  </div>
                </div>
                <div className="flex flex-col items-start sm:items-end gap-2 shrink-0 w-full sm:w-auto">
                  <div className="flex items-center gap-2 flex-wrap">
                    {c.status === "in_review" && (
                      <button
                        onClick={() => handleMarkReviewed(c.id)}
                        className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-stone-600 border border-stone-200 rounded-xl hover:bg-stone-50 hover:border-stone-300 font-display font-medium transition"
                      >
                        <Eye className="w-3.5 h-3.5" />
                        {t("admin.mark_reviewed")}
                      </button>
                    )}
                    <button
                      onClick={() => handleApprove(c.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-emerald-600 text-cream hover:bg-emerald-700 rounded-xl font-display font-medium transition shadow-sm"
                    >
                      <Check className="w-3.5 h-3.5" />
                      {t("admin.approve")}
                    </button>
                    <button
                      onClick={() => handleReject(c.id)}
                      className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-stone-600 border border-stone-200 rounded-xl hover:bg-stone-50 hover:border-stone-300 font-display font-medium transition"
                    >
                      <AlertTriangle className="w-3.5 h-3.5" />
                      {t("admin.reject")}
                    </button>
                  </div>
                  <button
                    onClick={() => handleExpand(c.id)}
                    className="flex items-center gap-1 text-xs text-stone-400 hover:text-stone-600 transition font-serif"
                  >
                    {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                    {isExpanded ? t("admin.hide_content") : t("admin.preview_content")}
                  </button>
                </div>
              </div>

              <Collapsible open={isExpanded}>
                <div className="border-t border-stone-100">
                  <div className="px-4 py-3 bg-stone-50/50 border-b border-stone-100">
                    <p className="text-xs font-display font-medium text-stone-400 uppercase tracking-wider mb-2">{t("admin.select_image")}</p>
                    <div className="flex gap-3 flex-wrap">
                      {images.map((img, idx) => {
                        const isSelected = (selectedImage[c.id] || c.image_url || images[0]) === img;
                        const isTemplate = img.includes("/images/templates/");
                        return (
                          <button
                            key={idx}
                            onClick={() => handleImageSelect(c.id, img)}
                            className={`relative w-24 h-16 rounded-xl overflow-hidden border-2 transition shrink-0 ${
                              isSelected ? "border-primary-500 ring-2 ring-primary-200" : "border-stone-200 hover:border-stone-300"
                            }`}
                          >
                            <img src={img} alt="" loading="lazy" className="w-full h-full object-cover" />
                            {isTemplate && (
                              <span className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[9px] text-center leading-4 font-serif">
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
                        <ImageUpload
                          onUpload={(urls) => handleImageSelect(c.id, urls.thumb)}
                          label=""
                          maxSizeMb={10}
                        />
                      </div>
                    </div>
                  </div>

                  <div className="px-4 py-3">
                    {c.full_text ? (
                      <div className="text-sm text-stone-700 whitespace-pre-wrap max-h-96 overflow-y-auto leading-relaxed font-serif">
                        {c.full_text.slice(0, 10000)}
                        {c.full_text.length > 10000 && (
                          <p className="text-stone-400 mt-2 italic">{t("admin.text_truncated")}</p>
                        )}
                      </div>
                    ) : (
                      <p className="text-sm text-stone-400 italic font-serif">{t("admin.no_full_text")}</p>
                    )}
                  </div>
                </div>
              </Collapsible>
            </div>
          );
        })}
      </div>
    </div>
  );
}
