"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { BookOpen, GraduationCap, Plus, Edit } from "lucide-react";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/locale-context";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { StatCounter } from "@/components/ui/StatCounter";
import { Text } from "@/components/ui/Text";
import { usePermission } from "@/lib/use-permission";
import { LearningCourseCard } from "@/components/cards/LearningCourseCard";
import { LearningEnrollmentCard } from "@/components/cards/LearningEnrollmentCard";
import { LearningAllCourseCard } from "@/components/cards/LearningAllCourseCard";
import { LearningPathCard } from "@/components/cards/LearningPathCard";
import { BlockRenderer, type BlockSectionData } from "@/components/blocks";

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
  const [heroSections, setHeroSections] = useState<BlockSectionData[] | null>(null);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) api.auth.me().then(setUser).catch(() => {});
    api.blocks.getPage("learning").then((p) => p?.sections?.length ? setHeroSections(p.sections) : setHeroSections([])).catch(() => setHeroSections([]));
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

  // Phase 3 (frontend half): wired onto the shared permissions registry
  // (see app/learning/courses/page.tsx's matching comment for why
  // "course.*" action keys cover both courses and paths here).
  const { can } = usePermission();
  const isStaff = user && can("course.create_edit_archive_own");

  if (loading) return <div className="flex items-center justify-center py-32 text-stone-00 dark:text-stone-500 font-light"><BookOpen className="w-5 h-5 animate-pulse mr-2" /> {t("common.loading")}</div>;

  return (
    <>
      {heroSections && heroSections.length > 0 && (
        <BlockRenderer sections={heroSections} />
      )}

      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-12">
        {/* Header */}
      <div className="flex flex-wrap justify-between items-start gap-4 mb-8">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-950/20 flex items-center justify-center">
              <BookOpen className="w-5 h-5 text-primary-600" />
            </div>
            <Text k="learning.title" as="h1" className="text-3xl font-bold text-stone-800 dark:text-stone-100 font-serif" />
          </div>
          <Text k="learning.subtitle" as="p" className="text-stone-500 mt-1 font-light" />
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
                <LearningCourseCard key={course.id} course={course} t={t} />
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
            {enrollments.map((enr: any) => (
              <LearningEnrollmentCard key={enr.id} enrollment={enr} t={t} />
            ))}
          </div>
        </section>
      )}

      {/* All Courses */}
      <section className="mb-12">
        <h2 className="text-xl font-bold text-stone-800 dark:text-stone-100 font-serif mb-4">{t("learning.all_courses")}</h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.slice(0, 6).map((course) => (
            <LearningAllCourseCard
              key={course.id}
              course={course}
              t={t}
              showEdit={isStaff && (can("course.manage_any") || course.created_by === user?.id)}
            />
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
            <LearningPathCard
              key={path.id}
              path={path}
              t={t}
              showEdit={isStaff && (can("course.manage_any") || path.created_by === user?.id)}
            />
          ))}
          {paths.length === 0 && (
            <p className="text-stone-00 dark:text-stone-500 col-span-3 text-center py-8 font-light">{t("learning.no_paths")}</p>
          )}
        </div>
      </section>
      </div>
    </>
  );
}
