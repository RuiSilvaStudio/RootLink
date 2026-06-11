"use client";

import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Check, Plus, Trash2, Loader2, Notebook, RefreshCw, BookOpen, LogIn } from "lucide-react";
import { useLocale } from "@/lib/locale-context";
import { api } from "@/lib/api";

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

export default function MonthlyChecklistPage() {
  const { t, locale } = useLocale();
  const isPt = locale === "pt";

  const [currentMonth, setCurrentMonth] = useState(new Date().getMonth() + 1);
  const [zone, setZone] = useState("moderate");

  // Farmers guide state
  const [guideTasks, setGuideTasks] = useState<any[]>([]);
  const [guideLoading, setGuideLoading] = useState(true);
  const [guideExpanded, setGuideExpanded] = useState(true);
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());

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
  const [generating, setGenerating] = useState(false);
  const [generatedMsg, setGeneratedMsg] = useState("");
  const [mounted, setMounted] = useState(false);

  useEffect(() => { setMounted(true); }, []);

  const isAuthenticated = mounted && !!localStorage.getItem("token");

  // Fetch farmers guide (public, no auth)
  useEffect(() => {
    setGuideLoading(true);
    api.farmersGuide.get(currentMonth, locale)
      .then(res => setGuideTasks(res.tasks || []))
      .catch(() => setGuideTasks([]))
      .finally(() => setGuideLoading(false));
  }, [currentMonth, locale]);

  // Fetch personal checklist (auth only)
  const fetchItems = useCallback(async () => {
    if (!mounted) return;
    if (!isAuthenticated) {
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const res = await api.checklist.list(currentMonth);
      setItems(res);
    } catch {} finally {
      setLoading(false);
    }
  }, [currentMonth, isAuthenticated, mounted]);

  useEffect(() => { fetchItems(); }, [fetchItems]);

  const handleToggle = async (item: any) => {
    const updated = await api.checklist.update(item.id, { is_completed: !item.is_completed });
    setItems(prev => prev.map(i => i.id === item.id ? updated : i));
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
        sort_order: items.length,
      });
      setItems(prev => [...prev, item]);
      setNewTask("");
    } finally {
      setSubmitting(false);
    }
  };

  const handleGeneratePresets = async () => {
    setGenerating(true);
    setGeneratedMsg("");
    try {
      const res = await api.checklist.presets(currentMonth, zone);
      setGeneratedMsg(
        res.generated > 0
          ? `${res.generated} ${isPt ? "tarefas geradas" : "tasks generated"}`
          : t("tools.checklist_already_exists")
      );
      await fetchItems();
    } catch (err: any) {
      setGeneratedMsg(err.message || "Error");
    } finally {
      setGenerating(false);
    }
  };

  const completedCount = items.filter(i => i.is_completed).length;

  // Group guide tasks by category
  const groupedTasks: Record<string, any[]> = {};
  guideTasks.forEach(t => {
    if (!groupedTasks[t.category]) groupedTasks[t.category] = [];
    groupedTasks[t.category].push(t);
  });
  const categoryEntries = Object.entries(groupedTasks);

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <a href="/tools" className="flex items-center gap-1 text-sm text-stone-500 hover:text-primary-700 mb-6">
        <ArrowLeft className="w-4 h-4" /> {t("tools.back")}
      </a>

      <h1 className="text-3xl font-bold text-stone-800 font-serif mb-2">{t("tools.checklist_title")}</h1>
      <p className="text-stone-600 mb-4">{t("tools.checklist_desc")}</p>

      <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-2 mb-6 text-xs text-amber-700 flex items-center gap-2">
        <span>🇵🇹</span>
        <span>{t("calc.portugal_disclaimer")}</span>
      </div>

      {/* Month + Zone selector */}
      <div className="flex flex-wrap gap-3 mb-6">
        <div className="flex gap-1 bg-white border border-stone-200 rounded-xl p-1 overflow-x-auto">
          {MONTHS.map(m => (
            <button key={m} onClick={() => setCurrentMonth(m)}
              className={`px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition ${
                m === currentMonth ? "bg-primary-600 text-white" : "hover:bg-stone-100 text-stone-600"
              }`}
            >
              {t(`month.${m}`)}
            </button>
          ))}
        </div>
        <select value={zone} onChange={(e) => setZone(e.target.value)}
          className="border border-stone-300 rounded-lg px-3 py-2 text-sm bg-white">
          {ZONES.map(z => <option key={z.value} value={z.value}>{z.label}</option>)}
        </select>
      </div>

      {/* ==================== FARMERS GUIDE SECTION ==================== */}
      <div className="mb-10">
        <button onClick={() => setGuideExpanded(!guideExpanded)}
          className="flex items-center justify-between w-full bg-emerald-50 border border-emerald-200 rounded-xl px-4 py-3 text-left"
        >
          <div className="flex items-center gap-2">
            <BookOpen className="w-5 h-5 text-emerald-600" />
            <span className="font-semibold text-emerald-800">{t("tools.farmers_guide_title")}</span>
          </div>
          <span className="text-emerald-500 text-sm">{guideExpanded ? "▼" : "▶"}</span>
        </button>

        {guideExpanded && (
          <div className="mt-2">
            <p className="text-xs text-stone-500 mb-3 px-1">{t("tools.farmers_guide_desc")}</p>

            {/* Loading state */}
            {guideLoading && (
              <div className="text-center text-stone-400 py-8 flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" /> {t("tools.farmers_guide_loading")}
              </div>
            )}

            {/* Category cards grid */}
            {!guideLoading && (
              <div>
                {categoryEntries.length === 0 && (
                  <div className="bg-white border border-stone-200 rounded-xl p-8 text-center text-stone-400">
                    <BookOpen className="w-10 h-10 mx-auto mb-2 text-stone-300" />
                    <p className="text-sm">{t("tools.farmers_guide_empty")}</p>
                  </div>
                )}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {categoryEntries.map(([cat, tasks]) => {
                    const isOpen = expandedCats.has(cat);
                    const label = tasks[0]?.category_label || cat;
                    const icon = CATEGORY_ICONS[cat] || "•";
                    return (
                      <div key={cat}
                        className="bg-white border border-stone-200 rounded-xl overflow-hidden"
                      >
                        <button onClick={() => toggleCat(cat)}
                          className="flex items-center gap-2 w-full px-3 py-2 text-left hover:bg-stone-50 transition"
                        >
                          <span className="text-sm">{icon}</span>
                          <span className="flex-1 text-sm font-medium text-stone-700">{label}</span>
                          <span className="text-xs text-stone-400 bg-stone-100 px-1.5 py-0.5 rounded-full">{tasks.length}</span>
                          <span className={`text-stone-400 text-xs transition-transform ${isOpen ? "rotate-180" : ""}`}>▼</span>
                        </button>
                        {isOpen && (
                          <div className="border-t border-stone-100 divide-y divide-stone-50">
                            {tasks.map((task: any, idx: number) => (
                              <div key={task.key || idx}
                                className="flex items-start gap-2 px-3 py-1.5 text-xs text-stone-600"
                              >
                                <span className="mt-0.5 text-stone-300">•</span>
                                <span>{task.text}</span>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ==================== PERSONAL CHECKLIST SECTION ==================== */}
      <div className="border-t border-stone-200 pt-8">
        <div className="flex items-center gap-2 mb-1">
          <Notebook className="w-5 h-5 text-stone-500" />
          <h2 className="text-xl font-bold text-stone-800 font-serif">{t("tools.farmers_guide_personal")}</h2>
        </div>
        <p className="text-xs text-stone-500 mb-4">{t("tools.farmers_guide_personal_desc")}</p>

        {!isAuthenticated ? (
          <div className="bg-stone-50 border border-stone-200 rounded-xl p-8 text-center">
            <LogIn className="w-10 h-10 mx-auto mb-2 text-stone-300" />
            <p className="text-sm text-stone-500">{t("tools.farmers_guide_sign_in")}</p>
          </div>
        ) : (
          <>
            {/* Progress summary */}
            {!loading && items.length > 0 && (
              <div className="flex items-center gap-3 mb-4 text-sm text-stone-500">
                <Check className="w-4 h-4 text-green-600" />
                <span>{completedCount} / {items.length} {t("tools.checklist_progress")}</span>
                <div className="flex-1 h-2 bg-stone-100 rounded-full overflow-hidden">
                  <div className="h-full bg-green-500 rounded-full transition-all"
                    style={{ width: `${(completedCount / Math.max(items.length, 1)) * 100}%` }}
                  />
                </div>
              </div>
            )}

            {/* Generate presets */}
            <div className="bg-white border border-stone-200 rounded-xl p-4 mb-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 text-sm text-stone-600">
                  <Notebook className="w-4 h-4 text-stone-400" />
                  <span>{t("tools.checklist_gen_suggestions")}</span>
                </div>
                <button onClick={handleGeneratePresets} disabled={generating}
                  className="flex items-center gap-1.5 text-sm bg-primary-100 text-primary-700 hover:bg-primary-200 px-3 py-1.5 rounded-lg transition disabled:opacity-50"
                >
                  {generating ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
                  {generating ? t("tools.checklist_generating") : t("tools.checklist_generate")}
                </button>
              </div>
              {generatedMsg && (
                <p className="text-xs text-stone-500 mt-2">{generatedMsg}</p>
              )}
            </div>

            {/* New task input */}
            <form onSubmit={handleAdd} className="flex gap-2 mb-6">
              <input
                type="text"
                value={newTask}
                onChange={(e) => setNewTask(e.target.value)}
                placeholder={t("tools.checklist_placeholder")}
                className="flex-1 border border-stone-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button type="submit" disabled={submitting || !newTask.trim()}
                className="flex items-center gap-1.5 bg-primary-600 text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-primary-700 transition disabled:opacity-50"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                {t("tools.checklist_add")}
              </button>
            </form>

            {/* Checklist items */}
            {loading && (
              <div className="text-center text-stone-400 py-12 flex items-center justify-center gap-2">
                <Loader2 className="w-5 h-5 animate-spin" /> {t("common.loading")}
              </div>
            )}

            {!loading && (
              <div className="space-y-1">
                {items.length === 0 && (
                  <div className="bg-white border border-stone-200 rounded-xl p-12 text-center text-stone-400">
                    <Notebook className="w-12 h-12 mx-auto mb-3 text-stone-300" />
                    <p>{t("tools.checklist_no_tasks")}</p>
                  </div>
                )}
                {items.map(item => (
                  <div key={item.id}
                    className={`bg-white border rounded-xl flex items-center gap-3 px-4 py-3 transition ${
                      item.is_completed ? "border-green-200 bg-green-50" : "border-stone-200 hover:border-stone-300"
                    }`}
                  >
                    <button onClick={() => handleToggle(item)}
                      className={`w-6 h-6 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition ${
                        item.is_completed
                          ? "bg-green-500 border-green-500 text-white"
                          : "border-stone-300 hover:border-primary-400"
                      }`}
                    >
                      {item.is_completed && <Check className="w-3.5 h-3.5" />}
                    </button>
                    <span className={`flex-1 text-sm ${item.is_completed ? "line-through text-stone-400" : "text-stone-700"}`}>
                      {item.task}
                    </span>
                    <button onClick={() => handleDelete(item.id)}
                      className="p-1 text-stone-400 hover:text-red-600 transition flex-shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
