"use client";

import { useEffect, useState, useRef } from "react";
import { api } from "@/lib/api";
import { Check, X } from "lucide-react";
import { toast } from "sonner";
import { useLocale } from "@/lib/locale-context";
import { Badge } from "@/components/ui/Badge";
import { Button, EmptyState } from "@/components/ui";
import { ListSkeleton } from "@/components/ui/LoadingSkeleton";
import { LoadError } from "@/components/studio/LoadError";

const CATEGORIES = [
  { value: "gardening", label: "Gardening" },
  { value: "woodworking", label: "Woodworking" },
  { value: "craft_trades", label: "Craft & Trades" },
  { value: "homesteading", label: "Homesteading" },
];

const CONTENT_TYPES = [
  { value: "article", label: "Article" },
  { value: "event", label: "Event" },
  { value: "course", label: "Course" },
  { value: "forum", label: "Forum" },
  { value: "video", label: "Video" },
];

const STATUS_LABELS = (t: (key: string, vars?: any) => string): Record<string, string> => ({
  all: t("admin.filter_all"),
  unreviewed: t("admin.filter_unreviewed"),
  cross_referenced: t("admin.filter_cross_referenced"),
  community_reviewed: t("admin.filter_reviewed"),
});

function InlineInput({ value, onSave, className, t }: { value: string; onSave: (v: string) => Promise<void>; className?: string; t: (key: string, vars?: any) => string }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [saving, setSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const save = async () => {
    if (draft === value || saving) return;
    setSaving(true);
    try {
      await onSave(draft);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  const cancel = () => {
    setDraft(value);
    setEditing(false);
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <input
          ref={inputRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") save();
            if (e.key === "Escape") cancel();
          }}
          onBlur={save}
          className={`border border-primary-400 rounded-lg px-2 py-1 text-sm bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 focus:outline-none focus:ring-1 focus:ring-primary-400 font-serif ${className || ""}`}
        />
        {saving && <span className="text-xs text-stone-400 dark:text-stone-500">...</span>}
        <button onClick={cancel} className="p-0.5 text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300"><X className="w-3 h-3" /></button>
        <button onClick={save} className="p-0.5 text-emerald-600 hover:text-emerald-800"><Check className="w-3 h-3" /></button>
      </div>
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className={`cursor-pointer hover:bg-primary-50/50 dark:hover:bg-primary-900/30 rounded px-1 -mx-1 border border-transparent hover:border-primary-200 dark:hover:border-stone-800 transition font-serif ${className || ""}`}
    >
      {value || <span className="text-stone-300 dark:text-stone-500 italic">{t("admin.empty")}</span>}
    </span>
  );
}

function InlineSelect({ value, options, onSave }: { value: string; options: { value: string; label: string }[]; onSave: (v: string) => Promise<void> }) {
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState(value);
  const selectRef = useRef<HTMLSelectElement>(null);

  useEffect(() => {
    if (editing && selectRef.current) selectRef.current.focus();
  }, [editing]);

  const save = async () => {
    if (draft === value || saving) return;
    setSaving(true);
    try {
      await onSave(draft);
    } finally {
      setSaving(false);
      setEditing(false);
    }
  };

  if (editing) {
    return (
      <div className="flex items-center gap-1">
        <select
          ref={selectRef}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={save}
          className="border border-primary-400 rounded-lg px-2 py-1 text-sm bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 font-serif focus:outline-none focus:ring-1 focus:ring-primary-400"
        >
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {saving && <span className="text-xs text-stone-400 dark:text-stone-500">...</span>}
      </div>
    );
  }

  const label = options.find((o) => o.value === value)?.label || value;
  return (
    <span
      onClick={() => setEditing(true)}
      className="cursor-pointer hover:bg-primary-50/50 dark:hover:bg-primary-900/30 rounded px-1 -mx-1 border border-transparent hover:border-primary-200 dark:hover:border-stone-800 transition font-serif"
    >
      {label}
    </span>
  );
}

export default function AdminContent() {
  const { t } = useLocale();
  const [content, setContent] = useState<any[]>([]);
  const [filter, setFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const fetchContent = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const params: any = {};
      if (filter !== "all") params.verification_status = filter;
      if (search) params.q = search;
      const data = await api.admin.listContent(params);
      setContent(data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  // Intentionally auto-refetch only when `filter` changes; `search` applies on submit (handleSearch).
  useEffect(() => { fetchContent(); }, [filter]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchContent();
  };

  const handleApprove = async (id: number) => {
    await api.admin.approveContent(id);
    fetchContent();
  };

  const handleRevertApproval = async (id: number) => {
    const reason = window.prompt(t("admin.revert_reason_prompt")) || undefined;
    try {
      await api.admin.revertApproval(id, reason);
      fetchContent();
    } catch (e: any) {
      toast.error(e?.message || "Failed");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t("admin.delete_confirm"))) return;
    await api.admin.deleteContent(id);
    fetchContent();
  };

  const handleUpdate = async (id: number, field: string, value: string) => {
    await api.admin.updateContent(id, { [field]: value });
    fetchContent();
  };

  const statusBadge = (status: string) => {
    if (status === "community_reviewed") return <Badge variant="green" className="text-[10px]">{t("admin.status_reviewed")}</Badge>;
    if (status === "cross_referenced") return <Badge variant="blue" className="text-[10px]">{t("admin.status_cross_ref")}</Badge>;
    return <Badge variant="stone" className="text-[10px]">{t("admin.status_unreviewed")}</Badge>;
  };

  if (loading) return <div className="p-6"><ListSkeleton rows={6} /></div>;
  if (loadError) return <div className="p-6 max-w-xl"><LoadError onRetry={fetchContent} /></div>;

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 px-6 py-4 border-b border-primary-200/40 dark:border-stone-800">
        <h1 className="font-display text-xl font-semibold text-stone-800 dark:text-stone-100">Content</h1>
        <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">Manage site copy and content overrides</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {/* Filters */}
        <div className="flex gap-3 mb-5 items-center flex-wrap">
          <div className="flex gap-1 bg-stone-100/60 dark:bg-stone-800/60 rounded-xl p-1 border border-stone-200/40 dark:border-stone-800">
            {["all", "unreviewed", "cross_referenced", "community_reviewed"].map((f) => (
              <button
                key={f}
                onClick={() => setFilter(f)}
                className={`px-3 py-1.5 rounded-lg text-sm font-display font-medium transition ${
                  filter === f ? "bg-white dark:bg-stone-900 shadow-sm text-primary-700 dark:text-primary-300" : "text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
                }`}
              >
                {STATUS_LABELS(t)[f] || f}
              </button>
            ))}
          </div>
          <form onSubmit={handleSearch} className="flex gap-2">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("admin.search_title_placeholder")}
              className="border border-stone-200/60 dark:border-stone-800 rounded-xl px-3 py-2 text-sm bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 font-serif focus:outline-none focus:ring-2 focus:ring-primary-500/15 focus:border-primary-400 transition w-48"
            />
            <Button type="submit" size="sm" variant="primary">{t("admin.search")}</Button>
          </form>
        </div>

        {/* Content list */}
        <div className="space-y-2">
          {content.map((c: any) => (
            <div key={c.id} className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/60 dark:border-stone-800 p-4">
              <div className="flex items-start gap-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1 flex-wrap">
                    <InlineInput
                      value={c.title}
                      onSave={(v) => handleUpdate(c.id, "title", v)}
                      className="font-display font-semibold text-stone-800 dark:text-stone-100 text-base"
                      t={t}
                    />
                    {statusBadge(c.verification_status)}
                  </div>
                  <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400 mb-1">
                    <InlineSelect
                      value={c.content_type}
                      options={CONTENT_TYPES}
                      onSave={(v) => handleUpdate(c.id, "content_type", v)}
                    />
                    <span className="text-stone-300 dark:text-stone-500">·</span>
                    <InlineSelect
                      value={c.category}
                      options={CATEGORIES}
                      onSave={(v) => handleUpdate(c.id, "category", v)}
                    />
                  </div>
                  <div className="text-xs">
                    <InlineInput
                      value={c.summary || ""}
                      onSave={(v) => handleUpdate(c.id, "summary", v)}
                      className="text-stone-400 dark:text-stone-500"
                      t={t}
                    />
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 mt-1">
                  {c.verification_status === "community_reviewed" ? (
                    <Button size="xs" variant="ghost" onClick={() => handleRevertApproval(c.id)}>
                      {t("admin.revert_approval")}
                    </Button>
                  ) : (
                    <Button size="xs" variant="primary" onClick={() => handleApprove(c.id)}>
                      {t("admin.approve")}
                    </Button>
                  )}
                  <Button size="xs" variant="danger" onClick={() => handleDelete(c.id)}>
                    {t("admin.delete")}
                  </Button>
                </div>
              </div>
            </div>
          ))}
          {content.length === 0 && (
            <EmptyState title="No results" message={t("admin.no_content")} />
          )}
        </div>
      </div>
    </div>
  );
}
