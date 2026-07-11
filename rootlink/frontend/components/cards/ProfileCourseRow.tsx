"use client";

import Link from "next/link";
import { BookOpen } from "lucide-react";

export function ProfileCourseRow({ course, t }: { course: any; t: (key: string, ...args: any[]) => string }) {
  return (
    <Link key={course.id} href={`/learning/courses/${course.id}`} className="flex items-center gap-3 bg-white dark:bg-stone-900 rounded-xl border border-primary-100/40 dark:border-stone-700/40 p-3 hover:shadow-md transition" data-rl-component="ProfileCourseRow">
      <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
        <BookOpen className="w-5 h-5 text-green-600" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-stone-700 dark:text-stone-300 truncate">{course.title}</p>
        <span className={`text-[10px] px-1.5 py-0.5 rounded ${course.published ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
          {course.published ? t("learning.published") : t("learning.draft")}
        </span>
      </div>
    </Link>
  );
}
