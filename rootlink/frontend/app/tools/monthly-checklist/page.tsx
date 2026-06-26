"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { ArrowLeft, Check, Plus, Trash2, Loader2, Notebook, BookOpen, LogIn, Pencil, Save, X, CheckCircle } from "lucide-react";
import { useLocale } from "@/lib/locale-context";
import { api } from "@/lib/api";
import { useSearchParams, useRouter } from "next/navigation";
import { ShareButton } from "@/components/ShareButton";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { ProgressBar } from "@/components/ui/ProgressBar";

const MONTHS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];

const ZONES = [
  { value: "cool", label: "Fria (Norte / Serras)" },
  { value: "moderate", label: "Temperada (Centro / Litoral)" },
  { value: "warm", label: "Quente (Sul / Interior)" },
  { value: "hot", label: "Muito quente (Algarve / Vale do Tejo)" },
];

const CATEGORY_ICONS: Record<string, string> = {
  soil: "🌱",
  pruning: "✂️",
  fertilizing: "🧪",
  irrigation: "💧",
  pest: "🐛",
  composting: "♻️",
  mulching: "🌾",
  greenhouse: "🏠",
  tools: "🔧",
  sowing: "🌰",
  harvesting: "🍎",
};

function MonthlyChecklistContent() {
  const { t, locale } = useLocale();
  const isPt = locale === "pt";
  const searchParams = useSearchParams();
  const router = useRouter();
  const inited = useRef(false);

  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [zone, setZone] = useState("moderate");

  // Farmers guide state
  const [guideTasks, setGuideTasks] = useState<any[]>([]);
  const [guideLoading, setGuideLoading] = useState(true);
  const [guideExpanded, setGuideExpanded] = useState(true);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [addedTasks, setAddedTasks] = useState<Set<string>>(new Set());

  const toggleCat = (cat: string) => {
    setExpandedCats(prev => {
      const next = new Set(prev);
      if (next.has(cat)) next.delete(cat); else next.add(cat);
      return next;
    });
  };

  // Personal checklist state
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [newTask, setNewTask] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editText, setEditText] = useState("");

  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (inited.current) return;
    inited.current = true;
    const m = searchParams.get("month");
    if (m) setCurrentMonth(parseInt(m));
    const z = searchParams.get("zone");
    if (z) setZone(z);
  }, [searchParams]);

  useEffect(() => {
    const params = new URLSearchParams();
    params.set("zone", zone);
    params.set("month", String(currentMonth));
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [zone, currentMonth, router]);

  const isAuthenticated = mounted && !!localStorage.getItem("token");

  // Fetch farmers guide (public, no auth)
  useEffect(() => {
    setGuideLoading(true);
    api.farmersGuide.get(currentMonth, locale)
      .then(res => setGuideTasks(res.tasks || []))
      .catch(() => setGuideTasks([]))
      .finally(() => setGuideLoading(false));
  }, [currentMonth, locale]);

  // Fetch personal checklist (auth only) — sorted: non-done newest first, done at bottom
  const fetchItems = useCallback(async () => {
    if (!mounted) return;
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await api.checklist.list(currentMonth);
      const sorted = [...res].sort((a: any, b: any) => {
        if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
      setItems(sorted);
    } catch {} finally {
      setLoading(false);
    }
  }, [currentMonth, isAuthenticated, mounted]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleToggle = async (item: any) => {
    const updated = await api.checklist.update(item.id, { is_completed: !item.is_completed });
    setItems(prev => {
      const next = prev.map(i => i.id === item.id ? { ...i, ...updated } : i);
      return next.sort((a: any, b: any) => {
        if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1;
        return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      });
    });
  };

  const handleDelete = async (id: number) => {
    await api.checklist.delete(id);
    setItems(prev => prev.filter(i => i.id !== id));
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTask.trim()) return;
    setSubmitting(true);
    try {
      const item = await api.checklist.create({
        month: currentMonth,
        task: newTask.trim(),
        sort_order: 0,
      });
      setItems(prev => {
        const next = [item, ...prev];
        return next.sort((a: any, b: any) => {
          if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
      });
      setNewTask("");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAddFromGuide = async (task: any) => {
    if (!isAuthenticated) return;
    try {
      const item = await api.checklist.create({
        month: currentMonth,
        task: task.text,
        sort_order: 0,
      });
      setItems(prev => {
        const next = [item, ...prev];
        return next.sort((a: any, b: any) => {
          if (a.is_completed !== b.is_completed) return a.is_completed ? 1 : -1;
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
        });
      });
      setAddedTasks(prev => new Set(prev).add(task.key));
    } catch {}
  };

  const handleStartEdit = (item: any) => {
    setEditingId(item.id);
    setEditText(item.task);
  };

  const handleSaveEdit = async (id: number) => {
    if (!editText.trim()) return;
    const updated = await api.checklist.update(id, { task: editText.trim() });
    setItems(prev => prev.map(i => i.id === id ? { ...i, ...updated } : i));
    setEditingId(null);
    setEditText("");
  };

  const handleCancelEdit = () => {
    setEditingId(null);
    setEditText("");
  };

  const completedCount = items.filter(i => i.is_completed).length;

  // Group guide tasks by category
  const groupedTasks: Record<string, any[]> = {};
  guideTasks.forEach(task => {
    if (!groupedTasks[task.category]) groupedTasks[task.category] = [];
    groupedTasks[task.category].push(task);
  });
  const categoryEntries = Object.entries(groupedTasks);

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-12">
      <a href="/tools" className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-primary-700 mb-6 transition">
        <ArrowLeft className="w-4 h-4" /> {t("tools.back")}
      </a>

      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-purple-100 flex items-center justify-center">
            <Notebook className="w-5 h-5 text-purple-600" />
          </div>
          <div>
            <h1 className="text-3xl font-serif font-bold text-stone-800">{t("tools.checklist_title")}</h1>
            <p className="text-stone-500 font-light">{t("tools.checklist_desc")}</p>
          </div>
        </div>
        <ShareButton url={typeof window !== "undefined" ? window.location.href : ""} title="Monthly Checklist" />
      </div>

      <div className="bg-stone-100/50 dark:bg-stone-800/50 border border-stone-200/40 dark:border-stone-700/40 rounded-2xl px-4 py-2.5 mb-8 text-xs text-stone-500 dark:text-stone-400 flex items-center justify-end gap-2">
        <span className="text-[10px]">🇹</span>
        <span className="font-light">{t("calc.portugal_disclaimer")}</span>
      </div>

      {/* Month + Zone selector */}
      <div className="flex flex-wrap gap-3 mb-6">
        <Card variant="plain" className="flex gap-1 p-1 overflow-x-auto">
          {MONTHS.map(m => (
            <button key={m} onClick={() => setCurrentMonth(m)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                m === currentMonth ? "bg-primary-500 text-white shadow-sm" : "hover:bg-primary-50 dark:hover:bg-primary-900/20 text-stone-600 dark:text-stone-300"
              }`}
            >
              {t(`month.${m}`)}
            </button>
          ))}
        </Card>
        <div className="flex flex-col gap-1">
          <label className="text-[10px] font-medium text-stone-500 dark:text-stone-400 uppercase tracking-wider px-1">{t("calc.zone")}</label>
          <select value={zone} onChange={(e) => setZone(e.target.value)}
            className="px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15">
            {ZONES.map(z => <option key={z.value} value={z.value}>{z.label}</option>)}
          </select>
        </div>
      </div>

      {/* ==================== FARMERS GUIDE SECTION ==================== */}
      <div className="mb-10">
        <button onClick={() => setGuideExpanded(!guideExpanded)}
          className="flex items-center justify-between w-full bg-emerald-50 border border-emerald-200 rounded-2xl px-5 py-4 text-left"
        >
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-lg bg-emerald-100 flex items-center justify-center">
              <BookOpen className="w-4 h-4 text-emerald-600" />
            </div>
            <div>
              <span className="font-semibold text-emerald-800">{t("tools.farmers_guide_title")}</span>
              <p className="text-xs text-emerald-600 font-light">{t("tools.farmers_guide_desc")}</p>
            </div>
          </div>
          <span className={`text-emerald-500 text-sm transition-transform ${guideExpanded ? "" : "rotate-180"}`}>▼</span>
        </button>

        {guideExpanded && (
          <div className="mt-3">
            {guideLoading && (
              <div className="text-center text-stone-500 dark:text-stone-400 py-12 flex items-center justify-center gap-2 font-light">
                <Loader2 className="w-5 h-5 animate-spin" /> {t("tools.farmers_guide_loading")}
              </div>
            )}

            {!guideLoading && (
              <div>
                {categoryEntries.length === 0 && (
                  <Card variant="plain" className="p-8 text-center">
                    <BookOpen className="w-10 h-10 mx-auto mb-2 text-stone-300 dark:text-stone-600" />
                    <p className="text-sm text-stone-500 dark:text-stone-400 font-light">{t("tools.farmers_guide_empty")}</p>
                  </Card>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {categoryEntries.map(([cat, tasks]) => {
                    const isOpen = expandedCats.has(cat);
                    const label = tasks[0]?.category_label || cat;
                    const icon = CATEGORY_ICONS[cat] || "•";
                    return (
                      <Card key={cat} variant="plain" className="overflow-hidden">
                        <button onClick={() => toggleCat(cat)}
                          className="flex items-center gap-2 w-full px-4 py-3 text-left hover:bg-primary-50/30 transition"
                        >
                          <span className="text-base">{icon}</span>
                          <span className="flex-1 text-sm font-medium text-stone-700">{label}</span>
                          <Badge variant="stone" className="text-[11px]">{tasks.length}</Badge>
                          <span className={`text-stone-500 dark:text-stone-400 text-xs transition-transform ${isOpen ? "rotate-180" : ""}`}>▼</span>
                        </button>
                        {isOpen && (
                          <div className="border-t border-primary-50 divide-y divide-primary-50">
                            {tasks.map((task: any, idx: number) => {
                              const isAdded = addedTasks.has(task.key);
                              return (
                                <div key={task.key || idx}
                                  className="flex items-start gap-2 px-4 py-2 text-xs text-stone-600 dark:text-stone-300 font-light leading-relaxed"
                                >
                                  <span className="mt-1 w-1.5 h-1.5 rounded-full bg-primary-300 shrink-0" />
                                  <span className="flex-1">{task.text}</span>
                                  {isAuthenticated ? (
                                    <button
                                      onClick={() => !isAdded && handleAddFromGuide(task)}
                                      disabled={isAdded}
                                      className={`shrink-0 mt-0.5 flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full transition ${
                                        isAdded
                                          ? "bg-green-100 text-green-600"
                                          : "bg-primary-50 text-primary-600 hover:bg-primary-100"
                                      }`}
                                    >
                                      {isAdded ? (
                                        <><CheckCircle className="w-3 h-3" /> {t("tools.checklist_added")}</>
                                      ) : (
                                        <><Plus className="w-3 h-3" /> {t("tools.checklist_add_to_list")}</>
                                      )}
                                    </button>
                                  ) : null}
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </Card>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ==================== PERSONAL CHECKLIST SECTION ==================== */}
      <div className="border-t border-primary-50 pt-8">
        <div className="flex items-center gap-2 mb-1">
          <Notebook className="w-5 h-5 text-stone-500" />
          <h2 className="text-xl font-bold text-stone-800 dark:text-stone-100 font-serif">{t("tools.farmers_guide_personal")}</h2>
        </div>
        <p className="text-xs text-stone-500 mb-4 font-light">{t("tools.farmers_guide_personal_desc")}</p>

        {!isAuthenticated ? (
          <Card variant="plain" className="p-8 text-center">
            <LogIn className="w-10 h-10 mx-auto mb-2 text-stone-300" />
            <p className="text-sm text-stone-500 font-light">{t("tools.farmers_guide_sign_in")}</p>
          </Card>
        ) : (
          <>
            {/* Progress bar */}
            {!loading && items.length > 0 && (
              <div className="flex items-center gap-3 mb-4 text-sm text-stone-500">
                <Check className="w-4 h-4 text-green-600 shrink-0" />
                <span className="font-light">{completedCount} / {items.length} {t("tools.checklist_progress")}</span>
                <ProgressBar value={completedCount} max={items.length} size="sm" className="flex-1" />
              </div>
            )}

            {/* New task input */}
            <form onSubmit={handleAdd} className="flex gap-2 mb-4">
                <input
                  type="text"
                  value={newTask}
                  onChange={(e) => setNewTask(e.target.value)}
                  placeholder={t("tools.checklist_placeholder")}
                  className="flex-1 px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15"
                />
              <Button type="submit" disabled={submitting || !newTask.trim()} loading={submitting}>
                <Plus className="w-4 h-4" />
                {t("tools.checklist_add")}
              </Button>
            </form>

            {/* Checklist items */}
            {loading && (
              <div className="text-center text-stone-500 dark:text-stone-400 py-12 flex items-center justify-center gap-2 font-light">
                <Loader2 className="w-5 h-5 animate-spin" /> {t("common.loading")}
              </div>
            )}

            {!loading && (
              <div className="space-y-1.5">
                {items.length === 0 && (
                  <Card variant="plain" className="p-12 text-center">
                    <Notebook className="w-12 h-12 mx-auto mb-3 text-stone-300 dark:text-stone-600" />
                    <p className="text-stone-500 dark:text-stone-400 font-light">{t("tools.checklist_no_tasks")}</p>
                  </Card>
                )}
                {items.map(item => (
                  <Card key={item.id} variant="plain"
                    className={`flex items-center gap-3 px-4 py-3 transition ${
                      item.is_completed ? "border-green-200 dark:border-green-800 bg-green-50 dark:bg-green-900/20" : "hover:border-primary-100 dark:hover:border-primary-800"
                    }`}
                  >
                    <button onClick={() => handleToggle(item)}
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center shrink-0 transition ${
                        item.is_completed
                          ? "bg-green-500 border-green-500 text-white"
                          : "border-stone-300 hover:border-primary-400"
                      }`}
                    >
                      {item.is_completed && <Check className="w-3.5 h-3.5" />}
                    </button>

                    {editingId === item.id ? (
                      <div className="flex-1 flex items-center gap-2">
                        <input
                          type="text"
                          value={editText}
                          onChange={(e) => setEditText(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleSaveEdit(item.id);
                            if (e.key === "Escape") handleCancelEdit();
                          }}
                          className="flex-1 px-2 py-1 rounded-lg border border-primary-300 dark:border-primary-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15"
                          autoFocus
                        />
                        <button onClick={() => handleSaveEdit(item.id)}
                          className="p-1 text-green-600 hover:text-green-700 transition">
                          <Save className="w-4 h-4" />
                        </button>
                        <button onClick={handleCancelEdit}
                          className="p-1 text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 transition">
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <>
                        <span className={`flex-1 text-sm ${item.is_completed ? "line-through text-stone-500 dark:text-stone-400" : "text-stone-700 dark:text-stone-300"}`}>
                          {item.task}
                        </span>
                        <button onClick={() => handleStartEdit(item)}
                          className="p-1 text-stone-400 dark:text-stone-500 hover:text-primary-600 dark:hover:text-primary-400 transition shrink-0">
                          <Pencil className="w-3.5 h-3.5" />
                        </button>
                        <button onClick={() => handleDelete(item.id)}
                          className="p-1 text-stone-400 dark:text-stone-500 hover:text-red-600 dark:hover:text-red-400 transition shrink-0"
                        >
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </>
                    )}
                  </Card>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function MonthlyChecklistPage() {
  return (
    <Suspense fallback={<div className="max-w-4xl mx-auto px-4 sm:px-8 py-12 space-y-4"><div className="h-8 bg-primary-100 dark:bg-primary-950/20 rounded w-96 animate-pulse" /><div className="h-4 bg-primary-100 dark:bg-primary-950/20 rounded w-64 animate-pulse" /><div className="h-64 bg-primary-100 dark:bg-primary-950/20 rounded-xl animate-pulse" /></div>}>
      <MonthlyChecklistContent />
    </Suspense>
  );
}
