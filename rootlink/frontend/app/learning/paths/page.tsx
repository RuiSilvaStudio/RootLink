"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Library, Plus, Edit } from "lucide-react";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/locale-context";

export default function LearningPathsPage() {
  const { t } = useLocale();
  const [paths, setPaths] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) api.auth.me().then(setUser).catch(() => {});
  }, []);

  useEffect(() => {
    api.learning.paths.list().then(setPaths).finally(() => setLoading(false));
  }, []);

  const isStaff = user && (user.role === "admin" || user.role === "moderator" || user.role === "contributor");

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-stone-800 dark:text-stone-100 font-serif">{t("learning.learning_paths_title")}</h1>
          <p className="text-stone-500 mt-1">{t("learning.learning_paths_subtitle")}</p>
        </div>
        {isStaff && (
          <Link href="/learning/paths/new" className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition text-sm">
            <Plus className="w-4 h-4" /> {t("learning.new_path")}
          </Link>
        )}
      </div>

      {loading ? (
        <p className="text-stone-500">{t("common.loading")}</p>
      ) : paths.length === 0 ? (
        <div className="text-center py-20 text-stone-500 dark:text-stone-400">
          <Library className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>{t("learning.no_paths_empty")}</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {paths.map((path) => {
            const canEditPath = user && (user.role === "admin" || user.role === "moderator" || path.created_by === user?.id);
            return (
              <Link key={path.id} href={`/learning/paths/${path.id}`} className="bg-white dark:bg-stone-900 p-6 rounded-xl border border-stone-200 dark:border-stone-700 hover:shadow-md transition group">
                <div className="flex items-start justify-between">
                  <Library className="w-10 h-10 text-primary-600 dark:text-primary-400 mb-4" />
                  {canEditPath && (
                    <Link href={`/learning/paths/${path.id}/edit`} onClick={(e) => e.stopPropagation()} className="p-1 text-stone-400 dark:text-stone-500 hover:text-primary-600 dark:hover:text-primary-400 opacity-0 group-hover:opacity-100 transition">
                      <Edit className="w-4 h-4" />
                    </Link>
                  )}
                </div>
                <h3 className="font-semibold text-stone-800 dark:text-stone-100 text-lg">{path.title}</h3>
                <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">{path.description}</p>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}
