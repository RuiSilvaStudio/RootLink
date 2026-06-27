"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { RefreshCw, Plus, Search, MapPin, Clock, CheckCircle, Package, Wrench } from "lucide-react";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/locale-context";
import { useToast } from "@/lib/toast-context";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { useDirtyGuard } from "@/lib/use-dirty-guard";

const DIFFICULTIES = [
  { value: "", labelKey: "waste.all_difficulties" },
  { value: "easy", labelKey: "waste.difficulty_easy" },
  { value: "intermediate", labelKey: "waste.difficulty_intermediate" },
  { value: "advanced", labelKey: "waste.difficulty_advanced" },
];

export default function UpcyclingPage() {
  const { t, locale } = useLocale();
  const { addToast } = useToast();
  const [projects, setProjects] = useState<any[]>([]);
  const [families, setFamilies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [difficulty, setDifficulty] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  // Form
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [materials, setMaterials] = useState("");
  const [difficultyForm, setDifficultyForm] = useState("easy");
  const [hours, setHours] = useState("");
  const [wasteKg, setWasteKg] = useState("");
  const [beforeImages, setBeforeImages] = useState<string[]>([]);
  const [afterImages, setAfterImages] = useState<string[]>([]);

  const dirty = !!(title || description);
  useDirtyGuard(dirty);

  useEffect(() => {
    setToken(localStorage.getItem("token"));
    api.taxonomy.families().then(setFamilies).catch(() => {});
    fetchProjects();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.waste.upcycling({ q: query || undefined, difficulty: difficulty || undefined });
      setProjects(data);
    } catch {
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, [query, difficulty]);

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.waste.upcyclingCreate({
        title,
        description,
        materials_used: materials ? materials.split(",").map((s) => s.trim()).filter(Boolean) : undefined,
        difficulty: difficultyForm,
        time_spent_hours: hours ? parseFloat(hours) : undefined,
        estimated_waste_diverted_kg: wasteKg ? parseFloat(wasteKg) : undefined,
        before_images: beforeImages.length > 0 ? beforeImages : undefined,
        after_images: afterImages.length > 0 ? afterImages : undefined,
        family: "economia_circular",
        category: "upcycling",
      });
      addToast("success", t("waste.project_created"));
      setShowForm(false);
      setTitle(""); setDescription(""); setMaterials(""); setHours(""); setWasteKg("");
      setBeforeImages([]); setAfterImages([]);
      fetchProjects();
    } catch (err: any) {
      addToast("error", err.message);
    }
  };

  const difficultyBadge = (d: string) => {
    if (d === "easy") return "green";
    if (d === "intermediate") return "amber";
    if (d === "advanced") return "red";
    return "stone";
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-12">
      <PageHeader
        icon={<RefreshCw className="w-5 h-5 text-primary-500" />}
        title={t("waste.upcycling_title")}
        subtitle={t("waste.upcycling_subtitle")}
        action={token && (
          <Button variant="primary" size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="w-4 h-4" /> {t("waste.share_project")}
          </Button>
        )}
      />

      {/* Filters */}
      <div className="flex gap-3 mt-6 mb-6 items-center flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 dark:text-stone-500" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("waste.search_projects")}
            className="w-full pl-9 pr-3 py-2 rounded-xl border border-primary-200/60 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm font-serif focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15"
          />
        </div>
        <select value={difficulty} onChange={(e) => setDifficulty(e.target.value)}
          className="px-3 py-2 rounded-xl border border-primary-200/60 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm font-serif focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15">
          {DIFFICULTIES.map((d) => <option key={d.value} value={d.value}>{t(d.labelKey)}</option>)}
        </select>
      </div>

      {/* Create form */}
      {showForm && (
        <Card variant="plain" className="p-6 mb-6 space-y-4">
          <h3 className="font-display font-bold text-stone-800 dark:text-stone-100">{t("waste.share_project")}</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">{t("waste.project_title")}</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required
                className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15" />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">{t("waste.project_description")}</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4}
                className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15" />
            </div>
            <div className="grid md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">{t("waste.materials_used")}</label>
                <input type="text" value={materials} onChange={(e) => setMaterials(e.target.value)}
                  placeholder="pallets, tires, bottles..."
                  className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">{t("waste.difficulty")}</label>
                <select value={difficultyForm} onChange={(e) => setDifficultyForm(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15">
                  <option value="easy">{t("waste.difficulty_easy")}</option>
                  <option value="intermediate">{t("waste.difficulty_intermediate")}</option>
                  <option value="advanced">{t("waste.difficulty_advanced")}</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">{t("waste.time_spent")} (h)</label>
                <input type="number" step="0.5" value={hours} onChange={(e) => setHours(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">{t("waste.waste_diverted")} (kg)</label>
              <input type="number" step="0.1" value={wasteKg} onChange={(e) => setWasteKg(e.target.value)}
                className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15" />
            </div>
            {/* Before/After images */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">{t("waste.before_images")}</label>
                <div className="flex flex-wrap gap-2">
                  {beforeImages.map((img, i) => (
                    <div key={i} className="w-20 h-20 rounded-lg overflow-hidden border border-primary-100">
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                  {beforeImages.length < 3 && <ImageUpload onUpload={(urls) => setBeforeImages([...beforeImages, urls.medium])} label="" maxSizeMb={5} />}
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 mb-2">{t("waste.after_images")}</label>
                <div className="flex flex-wrap gap-2">
                  {afterImages.map((img, i) => (
                    <div key={i} className="w-20 h-20 rounded-lg overflow-hidden border border-primary-100">
                      <img src={img} alt="" className="w-full h-full object-cover" />
                    </div>
                  ))}
                  {afterImages.length < 3 && <ImageUpload onUpload={(urls) => setAfterImages([...afterImages, urls.medium])} label="" maxSizeMb={5} />}
                </div>
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit">{t("waste.share_project")}</Button>
              <Button variant="secondary" type="button" onClick={() => setShowForm(false)}>{t("marketplace.cancel")}</Button>
            </div>
          </form>
        </Card>
      )}

      {/* Projects grid */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => <CardSkeleton key={i} />)}
        </div>
      ) : projects.length === 0 ? (
        <EmptyState
          icon={<RefreshCw className="w-7 h-7" />}
          title={t("waste.no_projects")}
          message={t("waste.no_projects_desc")}
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => (
            <Card key={p.id} variant="default" className="overflow-hidden group">
              {/* After image (result) */}
              <div className="h-40 bg-primary-100 dark:bg-primary-900/30 overflow-hidden">
                {p.after_images?.length > 0 ? (
                  <img src={p.after_images[0]} alt={p.title} className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" loading="lazy" />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <Wrench className="w-10 h-10 text-primary-300 dark:text-primary-600" />
                  </div>
                )}
              </div>
              <div className="p-4">
                <div className="flex items-center gap-2 mb-2">
                  {p.difficulty && <Badge variant={difficultyBadge(p.difficulty) as any} className="text-[9px]">{t(`waste.difficulty_${p.difficulty}`)}</Badge>}
                  {p.estimated_waste_diverted_kg && (
                    <Badge variant="green" className="text-[9px]">{p.estimated_waste_diverted_kg}kg {t("waste.diverted")}</Badge>
                  )}
                </div>
                <h3 className="font-display font-semibold text-stone-800 dark:text-stone-100 text-sm group-hover:text-primary-700 transition line-clamp-2">{p.title}</h3>
                {p.description && <p className="text-xs text-stone-500 font-serif mt-1 line-clamp-2">{p.description}</p>}
                    {p.materials_used?.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-2">
                        {p.materials_used.slice(0, 3).map((m: string) => (
                          <span key={m} className="text-[10px] bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 px-2 py-0.5 rounded-full">{m}</span>
                        ))}
                      </div>
                    )}
                    <div className="flex items-center justify-between mt-3 pt-3 border-t border-primary-50 dark:border-stone-800">
                      <span className="text-xs text-stone-400 dark:text-stone-500 truncate">{p.creator_name}</span>
                      {p.creator_verified && <CheckCircle className="w-3 h-3 text-green-500 dark:text-green-400" />}
                    </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
