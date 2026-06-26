"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { BookOpen, GraduationCap, Library, Plus, Edit, Users, Clock, Award, TrendingUp } from "lucide-react";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/locale-context";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { StatCounter } from "@/components/ui/StatCounter";

export default function LearningPage() {
  const { t } = useLocale();
  const [courses, setCourses] = useState<any[]>([]);
  const [enrollments, setEnrollments] = useState<any[]>([]);
  const [paths, setPaths] = useState<any[]>([]);
  const [myCourses, setMyCourses] = useState<any[]>([]);
  const [myPaths, setMyPaths] = useState<any[]>([]);
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState<any>(null);
  const [statsError, setStatsError] = useState(false);
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
      api.content.publicStats().catch((e: Error) => {
        console.warn("publicStats failed:", e);
        setStatsError(true);
        return null;
      }),
    ]).then(([c, p, e, mc, mp, s]) => {
      setCourses(c);
      setPaths(p);
      setEnrollments(e);
      setMyCourses(mc);
      setMyPaths(mp);
      setStats(s);
    }).finally(() => setLoading(false));
  }, [user]);

  const isStaff = user && (user.role === "admin" || user.role === "moderator" || user.role === "contributor");

  if (loading) return <div className="flex items-center justify-center py-32 text-stone-00 dark:text-stone-500 font-light"><BookOpen className="w-5 h-5 animate-pulse mr-2" /> {t("common.loading")}</div>;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-12">
      {/* Header */}
      <div className="flex flex-wrap justify-between items-start gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-950/20 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-primary-600" />
            </div>
            <h1 className="text-3xl font-bold text-stone-800 dark:text-stone-100 font-serif">{t("learning.title")}</h1>
          </div>
          <p className="text-stone-500 mt-1 font-light">{t("learning.subtitle")}</p>
        </div>
        <div className="flex gap-2">
          {isStaff && (
            <>
              <Link href="/learning/courses/new">
                <Button variant="primary" size="sm">
                  <Plus className="w-4 h-4" /> {t("learning.new_course")}
                </Button>
              </Link>
              <Link href="/learning/paths/new">
                <Button variant="secondary" size="sm">
                  <Plus className="w-4 h-4" /> {t("learning.new_path")}
                </Button>
              </Link>
            </>
          )}
          <Link href="/learning/courses">
            <Button variant="secondary" size="sm">
              <BookOpen className="w-4 h-4" /> {t("learning.browse_courses")}
            </Button>
          </Link>
        </div>
      </div>

      {/* Stats dashboard */}
      {stats && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
          <Card variant="plain" className="p-4 text-center">
            <StatCounter value={stats.courses || 0} label={t("learning.stat_courses") || "Courses"} />
          </Card>
          <Card variant="plain" className="p-4 text-center">
            <StatCounter value={enrollments.length || 0} label={t("learning.stat_enrolled") || "Enrolled"} />
          </Card>
          <Card variant="plain" className="p-4 text-center">
            <StatCounter value={stats.users || 0} label={t("learning.stat_learners") || "Learners"} />
          </Card>
          <Card variant="plain" className="p-4 text-center">
            <StatCounter value={paths.length || 0} label={t("learning.stat_paths") || "Learning Paths"} />
          </Card>
        </div>
      )}

      {/* My Courses (staff) */}
      {isStaff && (
        <section className="mb-12">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold text-stone-800 dark:text-stone-100 font-serif flex items-center gap-2">
              <Edit className="w-5 h-5 text-primary-600" /> {t("learning.my_courses")}
            </h2>
            <Link href="/learning/courses?mine=1" className="text-sm text-primary-600 hover:underline font-medium">{t("learning.view_all")}</Link>
          </div>
          {myCourses.length === 0 ? (
            <p className="text-stone-00 dark:text-stone-500 text-sm font-light">{t("learning.no_courses_created")}</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {myCourses.map((course) => (
                <Link key={course.id} href={`/learning/courses/${course.id}/edit`} className="card-lift p-5">
                  <h3 className="font-semibold text-stone-800">{course.title}</h3>
                  <p className="text-sm text-stone-500 mt-1 line-clamp-2 font-light">{course.description}</p>
                  <div className="flex gap-2 mt-3 text-xs">
                    <Badge variant={course.published ? "green" : "earth"}>
                      {course.published ? t("learning.published") : t("learning.draft")}
                    </Badge>
                    {course.lesson_count > 0 && <span className="text-stone-00 dark:text-stone-500 font-light">{t("learning.lessons_count", { count: course.lesson_count })}</span>}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      )}

      {/* My Enrollments */}
      {enrollments.length > 0 && (
        <section className="mb-12">
          <h2 className="text-xl font-bold text-stone-800 dark:text-stone-100 font-serif mb-4 flex items-center gap-2">
            <GraduationCap className="w-5 h-5 text-primary-600" /> {t("learning.my_learning")}
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {enrollments.map((enr: any) => {
              const done = enr.lesson_progress?.filter((p: any) => p.completed).length || 0;
              const total = enr.lesson_progress?.length || 0;
              const pct = total > 0 ? Math.round((done / total) * 100) : 0;
              return (
                <Link key={enr.id} href={`/learning/courses/${enr.course_id}`} className="card-lift p-5">
                  <h3 className="font-semibold text-stone-800">{enr.course_title || `Course #${enr.course_id}`}</h3>
                  {total > 0 && (
                    <div className="mt-3">
                      <div className="flex justify-between text-xs text-stone-500 mb-1">
                        <span className="font-light">{t("learning.lessons_progress", { done, total })}</span>
                        <span className="font-medium">{t("learning.percent", { pct })}</span>
                      </div>
                      <div className="w-full bg-stone-200 rounded-full h-2">
                        <div className="bg-primary-500 h-2 rounded-full transition-all" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  )}
                  {enr.completed && (
                    <span className="inline-flex items-center gap-1 text-xs text-green-600 mt-2 font-medium">
                      <Award className="w-3.5 h-3.5" /> {t("learning.completed")}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        </section>
      )}

      {/* All Courses */}
      <section className="mb-12">
        <h2 className="text-xl font-bold text-stone-800 dark:text-stone-100 font-serif mb-4">{t("learning.all_courses")}</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.slice(0, 6).map((course) => (
            <Link key={course.id} href={`/learning/courses/${course.id}`} className="card-lift p-5 group">
              {course.image_url && <img src={course.image_url} alt="" loading="lazy" className="w-full h-32 object-cover rounded-lg mb-3" />}
              <h3 className="font-semibold text-stone-800">{course.title}</h3>
              <p className="text-sm text-stone-500 mt-1 line-clamp-2 font-light">{course.description}</p>
              <div className="flex gap-2 mt-3 text-xs text-stone-500 items-center flex-wrap">
                {course.category && <Badge variant="sage" className="text-[10px]">{t("learning.category_" + course.category)}</Badge>}
                {course.difficulty && <Badge variant="stone" className="text-[10px]">{course.difficulty}</Badge>}
                {course.lesson_count > 0 && <span className="flex items-center gap-1 font-light"><BookOpen className="w-3 h-3" />{course.lesson_count}</span>}
                {isStaff && (user?.role === "admin" || user?.role === "moderator" || course.created_by === user?.id) && (
                  <Link href={`/learning/courses/${course.id}/edit`} className="ml-auto text-primary-600 opacity-0 group-hover:opacity-100 transition"><Edit className="w-3.5 h-3.5" /></Link>
                )}
              </div>
            </Link>
          ))}
          {courses.length === 0 && (
            <p className="text-stone-00 dark:text-stone-500 col-span-3 text-center py-8 font-light">{t("learning.no_courses")}</p>
          )}
        </div>
      </section>

      {/* Learning Paths */}
      <section>
        <h2 className="text-xl font-bold text-stone-800 dark:text-stone-100 font-serif mb-4">{t("learning.learning_paths")}</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {paths.map((path) => (
            <Link key={path.id} href={`/learning/paths/${path.id}`} className="card-lift p-5 group">
              <Library className="w-8 h-8 text-primary-600 mb-3" />
              <h3 className="font-semibold text-stone-800">{path.title}</h3>
              <p className="text-sm text-stone-500 mt-1 line-clamp-2 font-light">{path.description}</p>
              {isStaff && (user?.role === "admin" || user?.role === "moderator" || path.created_by === user?.id) && (
                <Link href={`/learning/paths/${path.id}/edit`} className="inline-flex items-center gap-1 text-xs text-primary-600 mt-2 opacity-0 group-hover:opacity-100 transition font-medium"><Edit className="w-3 h-3" /> {t("learning.edit")}</Link>
              )}
            </Link>
          ))}
          {paths.length === 0 && (
            <p className="text-stone-00 dark:text-stone-500 col-span-3 text-center py-8 font-light">{t("learning.no_paths")}</p>
          )}
        </div>
      </section>
    </div>
  );
}
