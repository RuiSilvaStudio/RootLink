"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/locale-context";

const CATEGORIES = ["gardening", "woodworking", "craft_trades", "homesteading"];
const DIFFICULTIES = ["beginner", "intermediate", "advanced"];

export default function NewCoursePage() {
  const { t } = useLocale();
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "",
    difficulty: "",
    estimated_hours: 0,
    image_url: "",
    published: false,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const course = await api.learning.courses.create({
        ...form,
        estimated_hours: form.estimated_hours || undefined,
      });
      router.push(`/learning/courses/${course.id}`);
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
      <h1 className="text-2xl font-bold text-stone-800 font-serif mb-6">{t("learning.create_course")}</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">{t("learning.title_required")}</label>
          <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm" />
        </div>
        <div>
          <label className="block text-sm font-medium text-stone-700 mb-1">{t("learning.description")}</label>
          <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm resize-none" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">{t("learning.category")}</label>
            <select value={form.category} onChange={(e) => setForm({ ...form, category: e.target.value })} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm">
              <option value="">{t("learning.select")}</option>
              {CATEGORIES.map((c) => <option key={c} value={c}>{t("learning.category_" + c)}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">{t("learning.difficulty_label")}</label>
            <select value={form.difficulty} onChange={(e) => setForm({ ...form, difficulty: e.target.value })} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm">
              <option value="">{t("learning.select")}</option>
              {DIFFICULTIES.map((d) => <option key={d} value={d}>{t("learning.option_" + d)}</option>)}
            </select>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">{t("learning.estimated_hours")}</label>
            <input type="number" min={0} value={form.estimated_hours} onChange={(e) => setForm({ ...form, estimated_hours: parseInt(e.target.value) || 0 })} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">{t("learning.image_url")}</label>
            <input value={form.image_url} onChange={(e) => setForm({ ...form, image_url: e.target.value })} className="w-full border border-stone-300 rounded-lg px-3 py-2 text-sm" />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-stone-700">
          <input type="checkbox" checked={form.published} onChange={(e) => setForm({ ...form, published: e.target.checked })} className="rounded" />
          {t("learning.publish_immediately")}
        </label>
        <button type="submit" disabled={saving} className="bg-primary-600 text-white px-6 py-2.5 rounded-lg hover:bg-primary-700 transition text-sm font-medium disabled:opacity-50">
          {saving ? t("common.creating") : t("learning.create_course")}
        </button>
      </form>
    </div>
  );
}
