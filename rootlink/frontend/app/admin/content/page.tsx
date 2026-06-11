"use client";

import { useEffect, useState, useRef } from "react";
import { api } from "@/lib/api";
import { Check, X } from "lucide-react";
import { useLocale } from "@/lib/locale-context";

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
          className={`border border-primary-400 rounded px-1.5 py-0.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-primary-400 ${className || ""}`}
        />
        {saving && <span className="text-xs text-stone-400">...</span>}
        <button onClick={cancel} className="p-0.5 text-stone-400 hover:text-stone-600"><X className="w-3 h-3" /></button>
        <button onClick={save} className="p-0.5 text-green-600 hover:text-green-800"><Check className="w-3 h-3" /></button>
      </div>
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      className={`cursor-pointer hover:bg-primary-50 rounded px-1 -mx-1 border border-transparent hover:border-primary-200 transition ${className || ""}`}
    >
      {value || <span className="text-stone-300 italic">{t("admin.empty")}</span>}
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
          className="border border-primary-400 rounded px-1.5 py-0.5 text-sm bg-white focus:outline-none focus:ring-1 focus:ring-primary-400"
        >
          {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        {saving && <span className="text-xs text-stone-400">...</span>}
      </div>
    );
  }

  const label = options.find((o) => o.value === value)?.label || value;
  return (
    <span
      onClick={() => setEditing(true)}
      className="cursor-pointer hover:bg-primary-50 rounded px-1 -mx-1 border border-transparent hover:border-primary-200 transition"
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

  const fetchContent = async () => {
    const params: any = {};
    if (filter !== "all") params.verification_status = filter;
    if (search) params.q = search;
    const data = await api.admin.listContent(params);
    setContent(data);
  };

  useEffect(() => { fetchContent(); }, [filter]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchContent();
  };

  const handleApprove = async (id: number) => {
    await api.admin.approveContent(id);
    fetchContent();
  };

  const handleReject = async (id: number) => {
    await api.admin.rejectContent(id);
    fetchContent();
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
    if (status === "community_reviewed") return <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded-full font-medium shrink-0">{t("admin.status_reviewed")}</span>;
    if (status === "cross_referenced") return <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium shrink-0">{t("admin.status_cross_ref")}</span>;
    return <span className="text-xs bg-stone-100 text-stone-500 px-2 py-0.5 rounded-full shrink-0">{t("admin.status_unreviewed")}</span>;
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-stone-800 mb-6">{t("admin.content_management")}</h1>

      <div className="flex gap-3 mb-4 items-center flex-wrap">
        <div className="flex gap-1 bg-stone-100 rounded-lg p-1">
          {["all", "unreviewed", "cross_referenced", "community_reviewed"].map((f) => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`px-3 py-1.5 rounded-md text-sm font-medium transition ${
                filter === f ? "bg-white shadow text-primary-700" : "text-stone-500 hover:text-stone-700"
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
            className="border border-stone-300 rounded-lg px-3 py-1.5 text-sm w-48"
          />
          <button type="submit" className="bg-primary-600 text-white px-3 py-1.5 rounded-lg text-sm">
            {t("admin.search")}
          </button>
        </form>
      </div>

      <div className="space-y-2">
        {content.map((c: any) => (
          <div key={c.id} className="bg-stone-50 rounded-lg p-3 border border-stone-200">
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <InlineInput
                    value={c.title}
                    onSave={(v) => handleUpdate(c.id, "title", v)}
                    className="font-medium text-stone-800 text-base"
                    t={t}
                  />
                  {statusBadge(c.verification_status)}
                </div>
                <div className="flex items-center gap-2 text-xs text-stone-500 mb-1">
                  <InlineSelect
                    value={c.content_type}
                    options={CONTENT_TYPES}
                    onSave={(v) => handleUpdate(c.id, "content_type", v)}
                  />
                  <span className="text-stone-300">·</span>
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
                    className="text-stone-400"
                    t={t}
                  />
                </div>
              </div>
              <div className="flex items-center gap-1 shrink-0 mt-1">
                {c.verification_status === "community_reviewed" ? (
                  <button onClick={() => handleReject(c.id)} className="text-xs bg-amber-100 text-amber-700 px-2 py-1 rounded hover:bg-amber-200">
                    {t("admin.unreview")}
                  </button>
                ) : (
                  <button onClick={() => handleApprove(c.id)} className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded hover:bg-green-200">
                    {t("admin.approve")}
                  </button>
                )}
                <button onClick={() => handleDelete(c.id)} className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200">
                  {t("admin.delete")}
                </button>
              </div>
            </div>
          </div>
        ))}
        {content.length === 0 && (
          <p className="text-stone-400 text-sm py-8 text-center">{t("admin.no_content")}</p>
        )}
      </div>
    </div>
  );
}
