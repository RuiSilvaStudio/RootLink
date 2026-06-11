"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { BookOpen, GraduationCap, Library, Plus, Edit } from "lucide-react";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/locale-context";

export default function LearningPage() {
  const { t } = useLocale();
  const [courses, setCourses] = useState<any[]>([]);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [paths, setPaths] = useState<any[]>([]);
  const [myCourses, setMyCourses] = useState<any[]>([]);
  const [myPaths, setMyPaths] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) api.auth.me().then(setUser).catch(() => {});
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("token");
    Promise.all([
      api.learning.courses.list(),
      api.learning.paths.list(),
      token ? api.learning.myEnrollments().catch(() => []) : Promise.resolve([]),
      user ? api.learning.courses.my().catch(() => []) : Promise.resolve([]),
      user ? api.learning.paths.my().catch(() => []) : Promise.resolve([]),
    ]).then(([c, p, e, mc, mp]) => {
      setCourses(c);
      setPaths(p);
      setEnrollments(e);
      setMyCourses(mc);
      setMyPaths(mp);
    }).finally(() => setLoading(false));
  }, [user]);

  const isStaff = user && (user.role === "admin" || user.role === "moderator" || user.role === "contributor");

  if (loading) return <div className="text-center py-20 text-stone-500">{t("common.loading")}</div>;

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-stone-800 font-serif">{t("learning.title")}</h1>
          <p className="text-stone-500 mt-1">{t("learning.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          {isStaff && (
            <>
              <Link href="/learning/courses/new" className="flex items-center gap-1 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition text-sm">
                <Plus className="w-4 h-4" /> {t("learning.new_course")}
              </Link>
              <Link href="/learning/paths/new" className="flex items-center gap-1 bg-earth-500 text-white px-4 py-2 rounded-lg hover:bg-earth-600 transition text-sm">
                <Plus className="w-4 h-4" /> {t("learning.new_path")}
              </Link>
            </>
          )}
          <Link href="/learning/courses" className="flex items-center gap-2 bg-white border border-stone-300 text-stone-700 px-4 py-2 rounded-lg hover:bg-stone-50 transition text-sm">
            <BookOpen className="w-4 h-4" /> {t("learning.browse_courses")}
          </Link>
        </div>
      </div>

      {isStaff && (
        <section className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-stone-800 font-serif flex items-center gap-2">
              <Edit className="w-5 h-5 text-primary-600" /> {t("learning.my_courses")}
            </h2>
            <Link href="/learning/courses?mine=1" className="text-sm text-primary-600 hover:underline">{t("learning.view_all")}</Link>
          </div>
          {myCourses.length === 0 ? (
            <p className="text-stone-400 text-sm">{t("learning.no_courses_created")}</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {myCourses.map((course) => (
                <Link key={course.id} href={`/learning/courses/${course.id}/edit`} className="bg-white p-5 rounded-xl border border-stone-200 hover:shadow-md transition">
                  <h3 className="font-semibold text-stone-800">{course.title}</h3>
                  <p className="text-sm text-stone-500 mt-1 line-clamp-2">{course.description}</p>
                  <div className="flex gap-2 mt-3 text-xs">
                    <span className={`px-2 py-0.5 rounded ${course.published ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                      {course.published ? t("learning.published") : t("learning.draft")}
                    </span>
                    {course.lesson_count > 0 && <span className="text-stone-400">{t("learning.lessons_count", { count: course.lesson_count })}</span>}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {enrollments.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xl font-bold text-stone-800 font-serif mb-4 flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-primary-600" /> {t("learning.my_learning")}
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {enrollments.map((enr: any) => {
              const done = enr.lesson_progress?.filter((p: any) => p.completed).length || 0;
              const total = enr.lesson_progress?.length || 0;
              const pct = total > 0 ? Math.round((done / total) * 100) : 0;
              return (
                <Link key={enr.id} href={`/learning/courses/${enr.course_id}`} className="bg-white p-5 rounded-xl border border-stone-200 hover:shadow-md transition">
                  <h3 className="font-semibold text-stone-800">{enr.course_title || `Course #${enr.course_id}`}</h3>
                  {total > 0 && (
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-stone-500 mb-1">
                        <span>{t("learning.lessons_progress", { done, total })}</span>
                        <span>{t("learning.percent", { pct })}</span>
                      </div>
                      <div className="w-full bg-stone-200 rounded-full h-2">
                        <div className="bg-primary-600 h-2 rounded-full" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )}
                  {enr.completed && (
                    <span className="inline-flex items-center gap-1 text-xs text-green-600 mt-2">✓ {t("learning.completed")}</span>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      <section className="mb-12">
        <h2 className="text-xl font-bold text-stone-800 font-serif mb-4">{t("learning.all_courses")}</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.slice(0, 6).map((course) => (
            <Link key={course.id} href={`/learning/courses/${course.id}`} className="bg-white p-5 rounded-xl border border-stone-200 hover:shadow-md transition group">
              {course.image_url && <img src={course.image_url} alt="" className="w-full h-32 object-cover rounded-lg mb-3" />}
              <h3 className="font-semibold text-stone-800">{course.title}</h3>
              <p className="text-sm text-stone-500 mt-1 line-clamp-2">{course.description}</p>
              <div className="flex gap-2 mt-3 text-xs text-stone-500 items-center">
                {course.category && <span className="bg-primary-100 text-primary-700 px-2 py-0.5 rounded">{t("learning.category_" + course.category)}</span>}
                {course.difficulty && <span className="bg-stone-100 px-2 py-0.5 rounded">{course.difficulty}</span>}
                {course.lesson_count > 0 && <span className="flex items-center gap-1"><BookOpen className="w-3 h-3" />{course.lesson_count}</span>}
                {isStaff && (user?.role === "admin" || user?.role === "moderator" || course.created_by === user?.id) && (
                  <Link href={`/learning/courses/${course.id}/edit`} className="ml-auto text-primary-600 opacity-0 group-hover:opacity-100 transition"><Edit className="w-3.5 h-3.5" /></Link>
                )}
              </div>
            </Link>
          ))}
          {courses.length === 0 && (
            <p className="text-stone-400 col-span-3 text-center py-8">{t("learning.no_courses")}</p>
          )}
        </div>
      </section>

      <section>
        <h2 className="text-xl font-bold text-stone-800 font-serif mb-4">{t("learning.learning_paths")}</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {paths.map((path) => (
            <Link key={path.id} href={`/learning/paths/${path.id}`} className="bg-white p-5 rounded-xl border border-stone-200 hover:shadow-md transition group">
              <Library className="w-8 h-8 text-primary-600 mb-3" />
              <h3 className="font-semibold text-stone-800">{path.title}</h3>
              <p className="text-sm text-stone-500 mt-1 line-clamp-2">{path.description}</p>
              {isStaff && (user?.role === "admin" || user?.role === "moderator" || path.created_by === user?.id) && (
                <Link href={`/learning/paths/${path.id}/edit`} className="inline-flex items-center gap-1 text-xs text-primary-600 mt-2 opacity-0 group-hover:opacity-100 transition"><Edit className="w-3 h-3" /> {t("learning.edit")}</Link>
              )}
            </Link>
          ))}
          {paths.length === 0 && (
            <p className="text-stone-400 col-span-3 text-center py-8">{t("learning.no_paths")}</p>
          )}
        </div>
      </section>
    </div>
  );
}
