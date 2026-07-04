"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Library, BookOpen, Plus, Edit, Trash2, X } from "lucide-react";
import { api } from "@/lib/api";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { useLocale } from "@/lib/locale-context";
import { usePermission } from "@/lib/use-permission";

export default function LearningPathDetailPage() {
  const { t } = useLocale();
  const params = useParams();
  const router = useRouter();
  const [path, setPath] = useState<any>(null);
  const [courses, setCourses] = useState<any[]>([]);
  const [allCourses, setAllCourses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [showAdd, setShowAdd] = useState(false);
  const [selectedCourseId, setSelectedCourseId] = useState("");

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) api.auth.me().then(setUser).catch(() => {});
  }, []);

  const fetchData = async () => {
    const id = Number(params.id);
    const [p, c] = await Promise.all([
      api.learning.paths.get(id),
      api.learning.paths.getCourses(id),
    ]);
    setPath(p);
    setCourses(c);
  };

  useEffect(() => {
    if (!params.id) return;
    setLoading(true);
    fetchData().finally(() => setLoading(false));
  }, [params.id]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!showAdd) return;
    api.learning.courses.list("").then(setAllCourses);
  }, [showAdd]);

  // Phase 3 (frontend half): reuses "course.manage_any" (backend treats
  // courses/paths identically today — see app/learning/paths/page.tsx's
  // matching comment for the full reasoning).
  const { can } = usePermission();
  const canEdit = user && (can("course.manage_any") || path?.created_by === user?.id);

  const handleAddCourse = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.learning.paths.addCourse(path.id, { course_id: Number(selectedCourseId), order: courses.length + 1 });
      const updated = await api.learning.paths.getCourses(path.id);
      setCourses(updated);
      setShowAdd(false);
      setSelectedCourseId("");
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRemoveCourse = async (courseId: number) => {
    if (!confirm(t("learning.remove_course_confirm"))) return;
    await api.learning.paths.removeCourse(path.id, courseId);
    const updated = await api.learning.paths.getCourses(path.id);
    setCourses(updated);
  };

  const handleDeletePath = async () => {
    if (!confirm(t("learning.delete_path_confirm"))) return;
    await api.learning.paths.delete(path.id);
    router.push("/learning");
  };

  if (loading) return <div className="text-center py-20 text-stone-500">{t("common.loading")}</div>;
  if (!path) return <div className="text-center py-20 text-stone-00 dark:text-stone-500">{t("learning.path_not_found")}</div>;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <Breadcrumbs items={[
        { label: t("nav.learning"), href: "/learning" },
        { label: t("learning.learning_paths_title"), href: "/learning/paths" },
        { label: path.title }
      ]} />

      <div className="flex items-start justify-between gap-4 mb-8">
        <div className="flex items-start gap-4">
          <Library className="w-12 h-12 text-primary-600 shrink-0" />
          <div>
            <h1 className="text-3xl font-bold text-stone-800 dark:text-stone-100 font-serif">{path.title}</h1>
            <p className="text-stone-500 mt-1">{path.description}</p>
          </div>
        </div>
        {canEdit && (
          <div className="flex gap-2 shrink-0">
            <Link href={`/learning/paths/${path.id}/edit`} className="flex items-center gap-1 text-sm bg-stone-100 text-stone-600 dark:text-stone-300 px-3 py-1.5 rounded-lg hover:bg-stone-200">
              <Edit className="w-4 h-4" /> {t("common.edit")}
            </Link>
            <button onClick={handleDeletePath} className="flex items-center gap-1 text-sm bg-red-100 text-red-700 px-3 py-1.5 rounded-lg hover:bg-red-200">
              <Trash2 className="w-4 h-4" /> {t("common.delete")}
            </button>
          </div>
        )}
      </div>

      {canEdit && (
        <button onClick={() => setShowAdd(!showAdd)} className="flex items-center gap-2 text-sm text-primary-600 hover:text-primary-700 mb-4">
          <Plus className="w-4 h-4" /> {showAdd ? t("common.cancel") : t("learning.add_course")}
        </button>
      )}

      {showAdd && (
        <form onSubmit={handleAddCourse} className="bg-white p-4 rounded-xl border border-stone-200 mb-6 flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs text-stone-500 mb-1">{t("learning.course_select")}</label>
            <select value={selectedCourseId} onChange={(e) => setSelectedCourseId(e.target.value)} required className="w-full px-3 py-2 rounded-lg border border-stone-300 text-sm">
              <option value="">{t("learning.select_course_placeholder")}</option>
              {allCourses.filter((ac) => !courses.find((c) => c.id === ac.id)).map((ac) => (
                <option key={ac.id} value={ac.id}>{ac.title}</option>
              ))}
            </select>
          </div>
          <button type="submit" className="bg-primary-600 text-white px-4 py-2 rounded-lg text-sm">{t("learning.add")}</button>
        </form>
      )}

      <h2 className="text-xl font-bold text-stone-800 dark:text-stone-100 font-serif mb-4">{t("learning.courses_in_path", { count: courses.length })}</h2>

      <div className="space-y-3">
        {courses.length === 0 ? (
          <p className="text-stone-00 dark:text-stone-500 py-8 text-center">{t("learning.no_courses_in_path")}</p>
        ) : (
          courses.map((course, idx) => (
            <div key={course.id} className="flex items-center gap-4 bg-white p-4 rounded-xl border border-stone-200 hover:shadow-md transition group">
              <span className="w-8 h-8 bg-primary-100 dark:bg-primary-950/20 text-primary-700 rounded-full flex items-center justify-center text-sm font-medium shrink-0">
                {idx + 1}
              </span>
              <Link href={`/learning/courses/${course.id}`} className="flex-1 min-w-0">
                <h3 className="font-semibold text-stone-800">{course.title}</h3>
                <p className="text-sm text-stone-500 line-clamp-1">{course.description}</p>
              </Link>
              <span className="text-xs text-stone-00 dark:text-stone-500 flex items-center gap-1 shrink-0"><BookOpen className="w-3 h-3" />{course.lesson_count}</span>
              {canEdit && (
                <button onClick={() => handleRemoveCourse(course.id)} className="p-1 text-stone-300 hover:text-red-600 opacity-0 group-hover:opacity-100 transition" title={t("learning.remove_tooltip")}>
                  <X className="w-4 h-4" />
                </button>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
