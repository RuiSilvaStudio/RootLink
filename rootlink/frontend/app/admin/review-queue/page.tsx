"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { ExternalLink, ChevronDown, ChevronUp, Check, AlertTriangle, Eye } from "lucide-react";
import { toast } from "sonner";
import { useLocale } from "@/lib/locale-context";
import { Collapsible } from "@/components/Collapsible";
import { Badge } from "@/components/ui/Badge";
import { Button, EmptyState } from "@/components/ui";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { ListSkeleton } from "@/components/ui/LoadingSkeleton";
import { LoadError } from "@/components/studio/LoadError";

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
  const [loadError, setLoadError] = useState(false);
  const [expanded, setExpanded] = useState<Record<number, boolean>>({});
  const [pendingCategory, setPendingCategory] = useState<Record<number, string>>({});
  const [selectedImage, setSelectedImage] = useState<Record<number, string>>({});
  const [families, setFamilies] = useState<any[]>([]);
  const [familyCategoriesMap, setFamilyCategoriesMap] = useState<Record<string, any[]>>({});

  const fetchQueue = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const data = await api.admin.reviewQueue();
      setItems(data);
    } catch {
      setLoadError(true);
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
    try {
      await api.admin.reviewContent(id, comment);
      fetchQueue();
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    }
  };

  const handleApprove = async (id: number) => {
    await api.admin.approveContent(id);
    fetchQueue();
  };

  const handleReject = async (id: number) => {
    const reason = window.prompt(t("admin.reject_reason_prompt")) || undefined;
    try {
      await api.admin.rejectContent(id, reason);
      fetchQueue();
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    }
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

  if (loading) return <div className="p-6"><ListSkeleton rows={6} /></div>;
  if (loadError) return <div className="p-6 max-w-xl"><LoadError onRetry={fetchQueue} /></div>;

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 px-6 py-4 border-b border-primary-200/40 dark:border-stone-800">
        <h1 className="font-display text-xl font-semibold text-stone-800 dark:text-stone-100">Review Queue</h1>
        <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">Moderate submitted content awaiting approval</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {items.length === 0 && (
          <EmptyState title="No results" message={t("admin.no_content")} />
        )}

        <div className="space-y-3">
          {items.map((c: any) => {
            const isExpanded = expanded[c.id];
            const images = allImages(c);
            return (
              <div
                key={c.id}
                className={`bg-white dark:bg-stone-900 rounded-2xl border overflow-hidden border-l-4 ${
                  c.status === "reviewed" ? "border-l-sky-400 border-stone-200/60 dark:border-stone-800" : "border-l-stone-200 dark:border-l-stone-700 border-stone-200/60 dark:border-stone-800"
                }`}
              >
                <div className="p-4 sm:p-5 flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <h3 className="font-display font-semibold text-stone-800 dark:text-stone-100 text-base">{c.title}</h3>
                      <Badge variant="stone" className="text-[10px]">{c.content_type}</Badge>
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${c.status === "reviewed" ? "text-sky-600" : "text-stone-400 dark:text-stone-500"}`}>
                        <span className={`w-1.5 h-1.5 rounded-full ${c.status === "reviewed" ? "bg-sky-400" : "bg-stone-300"}`} />
                        {c.status === "reviewed" ? t("admin.status_reviewed_pending") : t("admin.status_awaiting_review")}
                      </span>
                    </div>
                    <p className="text-sm text-stone-500 dark:text-stone-300 font-serif line-clamp-2">{c.summary || t("admin.no_summary")}</p>
                    <div className="flex items-center gap-2 mt-2 flex-wrap">
                      <span className="text-stone-400 dark:text-stone-500 text-xs font-serif">{t("admin.category")}</span>
                      <select
                        value={pendingCategory[c.id] || c.category || ""}
                        onChange={(e) => {
                          const val = e.target.value;
                          handleCategoryChange(c.id, val);
                          if (val) loadFamilyCategories(val);
                        }}
                        className="text-xs border border-stone-200 dark:border-stone-700 rounded-lg px-2 py-1 bg-stone-50 dark:bg-stone-800 text-stone-600 dark:text-stone-300 font-serif focus:outline-none focus:ring-1 focus:ring-primary-400"
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
                        <Button size="sm" variant="ghost" onClick={() => handleMarkReviewed(c.id)}>
                          <Eye className="w-3.5 h-3.5" />
                          {t("admin.mark_reviewed")}
                        </Button>
                      )}
                      <Button size="sm" variant="primary" onClick={() => handleApprove(c.id)}>
                        <Check className="w-3.5 h-3.5" />
                        {t("admin.approve")}
                      </Button>
                      <Button size="sm" variant="danger" onClick={() => handleReject(c.id)}>
                        <AlertTriangle className="w-3.5 h-3.5" />
                        {t("admin.reject")}
                      </Button>
                    </div>
                    <button
                      onClick={() => handleExpand(c.id)}
                      className="flex items-center gap-1 text-xs text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 transition font-serif"
                    >
                      {isExpanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
                      {isExpanded ? t("admin.hide_content") : t("admin.preview_content")}
                    </button>
                  </div>
                </div>

                <Collapsible open={isExpanded}>
                  <div className="border-t border-stone-100 dark:border-stone-800">
                    <div className="px-4 py-3 bg-stone-50/50 dark:bg-stone-800/30 border-b border-stone-100 dark:border-stone-800">
                      <p className="text-xs font-display font-medium text-stone-400 dark:text-stone-500 uppercase tracking-wider mb-2">{t("admin.select_image")}</p>
                      <div className="flex gap-3 flex-wrap">
                        {images.map((img, idx) => {
                          const isSelected = (selectedImage[c.id] || c.image_url || images[0]) === img;
                          const isTemplate = img.includes("/images/templates/");
                          return (
                            <button
                              key={idx}
                              onClick={() => handleImageSelect(c.id, img)}
                              className={`relative w-24 h-16 rounded-xl overflow-hidden border-2 transition shrink-0 ${
                                isSelected ? "border-primary-500 ring-2 ring-primary-200" : "border-stone-200 dark:border-stone-700 hover:border-stone-300 dark:hover:border-stone-600"
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
                        <div className="text-sm text-stone-700 dark:text-stone-200 whitespace-pre-wrap max-h-96 overflow-y-auto leading-relaxed font-serif">
                          {c.full_text.slice(0, 10000)}
                          {c.full_text.length > 10000 && (
                            <p className="text-stone-400 dark:text-stone-500 mt-2 italic">{t("admin.text_truncated")}</p>
                          )}
                        </div>
                      ) : (
                        <p className="text-sm text-stone-400 dark:text-stone-500 italic font-serif">{t("admin.no_full_text")}</p>
                      )}
                    </div>
                  </div>
                </Collapsible>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
