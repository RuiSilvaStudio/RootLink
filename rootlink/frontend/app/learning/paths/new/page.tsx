"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/locale-context";

export default function NewPathPage() {
  const { t } = useLocale();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({ title: "", description: "", image_url: "" });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const path = await api.learning.paths.create(form);
      router.push(`/learning/paths/${path.id}`);
    } catch (err: any) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-stone-500 hover:text-primary-700 mb-6">
        <ArrowLeft className="w-4 h-4" /> {t("common.back")}
      </button>
      <h1 className="text-2xl font-bold text-stone-800 dark:text-stone-100 font-serif mb-6">{t("learning.create_learning_path")}</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">{t("learning.title_asterisk")}</label>
          <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">{t("learning.description")}</label>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} className="w-full border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 rounded-lg px-3 py-2 text-sm resize-none" />
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">{t("learning.image_url")}</label>
          <input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} className="w-full border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 rounded-lg px-3 py-2 text-sm" />
        </div>
        <button type="submit" disabled={saving} className="bg-primary-600 text-white px-6 py-2.5 rounded-lg hover:bg-primary-700 transition text-sm font-medium disabled:opacity-50">
          {saving ? t("common.creating") : t("learning.create_learning_path")}
        </button>
      </form>
    </div>
  );
}
