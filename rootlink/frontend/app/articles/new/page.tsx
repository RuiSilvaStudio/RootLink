"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Save, Send, ArrowLeft, ImagePlus } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/lib/locale-context";
import { useToast } from "@/lib/toast-context";
import { Button } from "@/components/ui";
import { Input } from "@/components/ui";
import ArticleEditor from "@/components/editor/ArticleEditor";

export default function NewArticlePage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const { t } = useLocale();
  const { addToast } = useToast();
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState<any>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [articleId, setArticleId] = useState<number | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);
  const hasChanges = useRef(false);

  useEffect(() => {
    if (loading) return;
    if (!token) router.push("/auth/login");
  }, [token, router, loading]);

  const autoSave = useCallback(async () => {
    if (!title.trim()) return;
    setAutoSaveStatus("saving");
    try {
      if (articleId) {
        await api.articles.update(articleId, { title, summary, body });
      } else {
        const created = await api.articles.create({ title, summary, body });
        setArticleId(created.id);
      }
      setAutoSaveStatus("saved");
      hasChanges.current = false;
    } catch {
      setAutoSaveStatus("idle");
    }
  }, [articleId, title, summary, body]);

  const scheduleAutoSave = useCallback(() => {
    hasChanges.current = true;
    if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    autoSaveTimer.current = setTimeout(autoSave, 5000);
  }, [autoSave]);

  useEffect(() => {
    return () => {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
    };
  }, []);

  const handleEditorChange = (data: any) => {
    setBody(data);
    scheduleAutoSave();
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      await autoSave();
      addToast("success", "Draft saved");
    } catch (err: any) {
      addToast("error", err.message);
    }
    setSaving(false);
  };

  const handlePublish = async () => {
    if (!title.trim()) {
      addToast("error", "Title is required");
      return;
    }
    setPublishing(true);
    try {
      if (autoSaveTimer.current) clearTimeout(autoSaveTimer.current);
      if (!articleId) {
        const created = await api.articles.create({ title, summary, body });
        setArticleId(created.id);
        await api.articles.publish(created.id);
      } else {
        await api.articles.update(articleId, { title, summary, body });
        await api.articles.publish(articleId);
      }
      addToast("success", "Article published! It will appear after community review.");
      router.push("/articles/my");
    } catch (err: any) {
      addToast("error", err.message);
    }
    setPublishing(false);
  };

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <button
          onClick={() => router.push("/articles/my")}
          className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200 transition-colors"
        >
          <ArrowLeft size={16} />
          My Articles
        </button>

        <div className="flex items-center gap-3">
          <span className="text-xs text-stone-400 dark:text-stone-500">
            {autoSaveStatus === "saving" ? "Saving..." : autoSaveStatus === "saved" ? "Saved" : ""}
          </span>
          <Button variant="secondary" size="sm" onClick={handleSave} disabled={saving}>
            <Save size={14} className="mr-1" />
            Save Draft
          </Button>
          <Button variant="primary" size="sm" onClick={handlePublish} disabled={publishing}>
            <Send size={14} className="mr-1" />
            Publish
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        <div>
          <input
            type="text"
            value={title}
            onChange={(e) => { setTitle(e.target.value); scheduleAutoSave(); }}
            placeholder="Article title"
            className="w-full text-3xl font-display font-bold bg-transparent border-none outline-none
              text-stone-900 dark:text-stone-100 placeholder:text-stone-300 dark:placeholder:text-stone-600"
          />
        </div>

        <div>
          <textarea
            value={summary}
            onChange={(e) => { setSummary(e.target.value); scheduleAutoSave(); }}
            placeholder="Brief summary (optional, helps with search discovery)"
            rows={2}
            className="w-full text-base bg-transparent border-none outline-none resize-none
              text-stone-600 dark:text-stone-400 placeholder:text-stone-300 dark:placeholder:text-stone-600"
          />
        </div>

        <div className="border-t border-stone-200 dark:border-stone-700 pt-6">
          <ArticleEditor data={body} onChange={handleEditorChange} onError={(m) => addToast("error", m)} />
        </div>
      </div>
    </div>
  );
}
