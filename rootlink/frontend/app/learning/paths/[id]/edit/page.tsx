"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, X } from "lucide-react";
import { api } from "@/lib/api";
import { safeImageUrl } from "@/lib/image-url";
import { useLocale } from "@/lib/locale-context";
import { useToast } from "@/lib/toast-context";
import { ImageUpload } from "@/components/ui/ImageUpload";

export default function EditPathPage() {
  const { t } = useLocale();
  const { addToast } = useToast();
  const params = useParams();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", image_url: "" });

  useEffect(() => {
    api.learning.paths.get(Number(params.id)).then((path) => {
      setForm({
        title: path.title,
        description: path.description || "",
        image_url: path.image_url || "",
      });
    }).finally(() => setLoading(false));
  }, [params.id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      await api.learning.paths.update(Number(params.id), form);
      router.push(`/learning/paths/${params.id}`);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <div className="text-center py-20 text-stone-400">{t("common.loading")}</div>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-stone-500 hover:text-primary-700 mb-6">
        <ArrowLeft className="w-4 h-4" /> {t("common.back")}
      </button>
      <h1 className="text-2xl font-bold text-stone-800 dark:text-stone-100 font-serif mb-6">{t("learning.edit_path")}</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">{t("learning.title_asterisk")}</label>
          <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">{t("learning.description")}</label>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm resize-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">{t("learning.cover_image") || "Cover image"}</label>
          {form.image_url ? (
            <div className="relative inline-block">
              <img src={safeImageUrl(form.image_url)} alt="Cover" className="max-h-40 rounded-xl object-cover border border-stone-200 dark:border-stone-700" />
              <button type="button" onClick={() => setForm({ ...form, image_url: "" })} className="absolute top-2 right-2 p-1 rounded-full bg-stone-900/70 text-white hover:bg-stone-900" aria-label="Remove cover">
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <ImageUpload label="" requireLicense onUpload={(urls) => setForm({ ...form, image_url: urls.large })} onError={(m) => addToast("error", m)} />
          )}
        </div>
        <button type="submit" disabled={saving} className="bg-primary-600 text-white px-6 py-2.5 rounded-lg hover:bg-primary-700 transition text-sm font-medium disabled:opacity-50">
          {saving ? t("common.saving") : t("learning.save_changes")}
        </button>
      </form>
    </div>
  );
}
