"use client";

import { useState, useRef, useCallback, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Save, Send, ArrowLeft, ImagePlus } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/lib/locale-context";
import { useToast } from "@/lib/toast-context";
import { useDirtyGuard } from "@/lib/use-dirty-guard";
import { Button, InfoPopover } from "@/components/ui";
import { ImageUpload } from "@/components/ui/ImageUpload";
import ArticleEditor from "@/components/editor/ArticleEditor";
import { TemplatePicker, type Template } from "@/components/editor/TemplatePicker";
import { safeImageUrl } from "@/lib/image-url";
import { X } from "lucide-react";

export default function NewArticlePage() {
  const router = useRouter();
  const { user, token, loading } = useAuth();
  const { t } = useLocale();
  const { addToast } = useToast();
  const [title, setTitle] = useState("");
  const [summary, setSummary] = useState("");
  const [body, setBody] = useState<any>(null);
  const [coverUrl, setCoverUrl] = useState("");
  const [templateChosen, setTemplateChosen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [articleId, setArticleId] = useState<number | null>(null);
  const [autoSaveStatus, setAutoSaveStatus] = useState<"idle" | "saving" | "saved">("idle");
  const [dirty, setDirty] = useState(false);
  const autoSaveTimer = useRef<NodeJS.Timeout | null>(null);
  const hasChanges = useRef(false);
  const { confirmLeave } = useDirtyGuard(dirty);

  useEffect(() => {
    if (loading) return;
    if (!token) router.push("/auth/login");
  }, [token, router, loading]);

  const autoSave = useCallback(async () => {
    if (!title.trim()) return;
    setAutoSaveStatus("saving");
    try {
      if (articleId) {
        await api.articles.update(articleId, { title, summary, body, image_url: coverUrl || undefined });
      } else {
        const created = await api.articles.create({ title, summary, body, image_url: coverUrl || undefined });
        setArticleId(created.id);
      }
      setAutoSaveStatus("saved");
      hasChanges.current = false;
      setDirty(false);
    } catch {
      setAutoSaveStatus("idle");
    }
  }, [articleId, title, summary, body, coverUrl]);

  const scheduleAutoSave = useCallback(() => {
    hasChanges.current = true;
    setDirty(true);
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

  const handleTemplate = (tpl: Template) => {
    setBody(tpl.body || null);
    setTemplateChosen(true);
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
        const created = await api.articles.create({ title, summary, body, image_url: coverUrl || undefined });
        setArticleId(created.id);
        await api.articles.publish(created.id);
      } else {
        await api.articles.update(articleId, { title, summary, body, image_url: coverUrl || undefined });
        await api.articles.publish(articleId);
      }
      setDirty(false);
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
          onClick={() => { if (confirmLeave()) router.push("/articles/my"); }}
          className="flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200 transition-colors"
        >
          <ArrowLeft size={16} />
          My Articles
        </button>

        {templateChosen && (
          <div className="flex items-center gap-3">
            <span className="text-xs text-stone-400 dark:text-stone-500">
              {autoSaveStatus === "saving" ? "Saving..." : autoSaveStatus === "saved" ? "Saved" : ""}
            </span>
            <Button variant="secondary" size="sm" onClick={handleSave} disabled={saving}>
              <Save size={14} className="mr-1" />
              Save Draft
            </Button>
            <span className="flex items-center gap-1.5">
              <Button variant="primary" size="sm" onClick={handlePublish} disabled={publishing}>
                <Send size={14} className="mr-1" />
                Publish
              </Button>
              <InfoPopover label="What happens when you publish?">
                {t("create.publish_help")}
              </InfoPopover>
            </span>
          </div>
        )}
      </div>

      {!templateChosen ? (
        <TemplatePicker onSelect={handleTemplate} />
      ) : (
        <div className="space-y-6">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <label className="text-xs font-display font-medium text-stone-400 uppercase tracking-wider">Cover image</label>
              <InfoPopover label="Cover image">
                Shown on cards and at the top of your article. If you don&apos;t add one, we&apos;ll use the first image in your article, or a default cover.
              </InfoPopover>
            </div>
            {coverUrl ? (
              <div className="relative inline-block">
                <img src={safeImageUrl(coverUrl)} alt="Cover" className="max-h-48 rounded-xl object-cover border border-stone-200 dark:border-stone-700" />
                <button
                  type="button"
                  onClick={() => { setCoverUrl(""); scheduleAutoSave(); }}
                  className="absolute top-2 right-2 p-1 rounded-full bg-stone-900/70 text-white hover:bg-stone-900"
                  aria-label="Remove cover"
                >
                  <X size={14} />
                </button>
              </div>
            ) : (
              <ImageUpload label="" requireLicense onUpload={(urls) => { setCoverUrl(urls.large); scheduleAutoSave(); }} onError={(m) => addToast("error", m)} />
            )}
          </div>

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
            <ArticleEditor key="article-editor" data={body} onChange={handleEditorChange} onError={(m) => addToast("error", m)} />
          </div>
        </div>
      )}
    </div>
  );
}
