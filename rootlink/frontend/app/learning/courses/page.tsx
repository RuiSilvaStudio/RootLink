"use client";

import { Suspense, useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { BookOpen, Clock, Plus, Edit } from "lucide-react";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/locale-context";

function CoursesContent() {
  const { t, locale } = useLocale();
  const searchParams = useSearchParams();
  const [courses, setCourses] = useState<any[]>([]);
  const [category, setCategory] = useState("");
  const [family, setFamily] = useState("");
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [mine, setMine] = useState(searchParams.get("mine") === "1");
  const [families, setFamilies] = useState<any[]>([]);
  const [familyCategories, setFamilyCategories] = useState<any[]>([]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) api.auth.me().then(setUser).catch(() => {});
    api.taxonomy.families().then(setFamilies).catch(() => {});
  }, []);

  useEffect(() => {
    setMine(searchParams.get("mine") === "1");
  }, [searchParams]);

  useEffect(() => {
    setLoading(true);
    const fetch = mine && user
      ? api.learning.courses.my()
      : api.learning.courses.list(category || undefined, family || undefined);
    fetch.then(setCourses).finally(() => setLoading(false));
  }, [category, family, mine, user]);

  const handleFamilyChange = (famValue: string) => {
    setFamily(famValue);
    setCategory("");
    if (famValue) {
      api.taxonomy.categories(famValue).then(setFamilyCategories).catch(() => setFamilyCategories([]));
    } else {
      setFamilyCategories([]);
    }
  };

  const isStaff = user && (user.role === "admin" || user.role === "moderator" || user.role === "contributor");

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-3xl font-bold text-stone-800 dark:text-stone-100 font-serif">{t("learning.course_title")}</h1>
          <p className="text-stone-500 dark:text-stone-400 mt-1">{mine ? t("learning.mine_subtitle") : t("learning.browse_subtitle")}</p>
        </div>
        {isStaff && (
          <Link href="/learning/courses/new" className="flex items-center gap-1 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition text-sm">
            <Plus className="w-4 h-4" /> {t("learning.new_course")}
          </Link>
        )}
      </div>

      <div className="flex gap-2 mb-6 flex-wrap">
        {isStaff && (
          <>
            <Link href="/learning/courses"
              className={`px-3 py-1.5 rounded-lg text-sm border transition ${!mine ? "bg-primary-600 text-white border-primary-600" : "bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 border-stone-300 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800"}`}
            >{t("learning.browse")}</Link>
            <Link href="/learning/courses?mine=1"
              className={`px-3 py-1.5 rounded-lg text-sm border transition ${mine ? "bg-primary-600 text-white border-primary-600" : "bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 border-stone-300 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800"}`}
            >{t("learning.my_courses_tab")}</Link>
          </>
        )}
        {!mine && (
          <>
            <button
              onClick={() => handleFamilyChange("")}
              className={`px-3 py-1.5 rounded-lg text-sm border transition ${!family ? "bg-primary-600 text-white border-primary-600" : "bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 border-stone-300 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800"}`}
            >{t("learning.all") || "All"}</button>
            {families.map((fam) => (
              <button
                key={fam.value}
                onClick={() => handleFamilyChange(fam.value)}
                className={`px-3 py-1.5 rounded-lg text-sm border transition ${family === fam.value ? "bg-primary-600 text-white border-primary-600" : "bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 border-stone-300 dark:border-stone-700 hover:bg-stone-50 dark:hover:bg-stone-800"}`}
              >{locale === "pt" ? fam.label_pt : fam.label}</button>
            ))}
            {family && familyCategories.length > 0 && (
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="px-3 py-1.5 text-sm rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 focus:outline-none focus:ring-1 focus:ring-primary-400"
              >
                <option value="">{t("search.all_categories") || "All categories"}</option>
                {familyCategories.map((cat) => (
                  <option key={cat.value} value={cat.value}>{locale === "pt" ? cat.label_pt : cat.label}</option>
                ))}
              </select>
            )}
          </>
        )}
      </div>

      {loading ? (
        <p className="text-stone-500">{t("common.loading")}</p>
      ) : courses.length === 0 ? (
        <div className="text-center py-20 text-stone-500 dark:text-stone-400">
          <BookOpen className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>{mine ? t("learning.no_courses_created") : t("learning.no_courses")}</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          {courses.map((course) => {
            const canEditCourse = user && (user.role === "admin" || user.role === "moderator" || course.created_by === user?.id);
            return (
              <Link key={course.id} href={`/learning/courses/${course.id}`} className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-700 hover:shadow-md transition overflow-hidden group">
                {course.image_url && <img src={course.image_url} alt="" loading="lazy" className="w-full h-40 object-cover" />}
                <div className="p-5">
                  <div className="flex items-center justify-between gap-2">
                    <h3 className="font-semibold text-stone-800 dark:text-stone-100 text-lg truncate">{course.title}</h3>
                    {canEditCourse && (
                      <Link href={`/learning/courses/${course.id}/edit`} onClick={(e) => e.stopPropagation()} className="p-1 text-stone-400 dark:text-stone-500 hover:text-primary-600 opacity-0 group-hover:opacity-100 transition shrink-0">
                        <Edit className="w-4 h-4" />
                      </Link>
                    )}
                  </div>
                    <span className="text-sm text-stone-500 dark:text-stone-400 mt-1 line-clamp-2">{course.description}</span>
                  <div className="flex flex-wrap gap-2 mt-3 text-xs items-center">
                    {course.published !== undefined && (
                      <span className={`px-2 py-0.5 rounded font-medium ${course.published ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                        {course.published ? t("learning.published") : t("learning.draft")}
                      </span>
                    )}
                    {course.category && <span className="bg-primary-100 dark:bg-primary-950/20 text-primary-700 px-2 py-0.5 rounded">{course.category}</span>}
                    {course.family && <span className="bg-earth-100 text-earth-700 px-2 py-0.5 rounded">{course.family}</span>}
                    {course.difficulty && <span className="bg-stone-100 text-stone-600 dark:text-stone-300 px-2 py-0.5 rounded">{t("learning.option_" + course.difficulty)}</span>}
                    {course.estimated_hours && <span className="flex items-center gap-1 text-stone-500"><Clock className="w-3 h-3" />{t("learning.hours", { hours: course.estimated_hours })}</span>}
                    <span className="flex items-center gap-1 text-stone-500"><BookOpen className="w-3 h-3" />{t("learning.lessons_count", { count: course.lesson_count })}</span>
                  </div>
                </div>
              </Link>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function CoursesPage() {
  return <Suspense><CoursesContent /></Suspense>;
}
