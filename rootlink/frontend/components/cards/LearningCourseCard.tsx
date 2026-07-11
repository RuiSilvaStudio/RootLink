"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";

export function LearningCourseCard({ course, t }: { course: any; t: (key: string, ...args: any[]) => string }) {
  return (
    <Link
      href={`/learning/courses/${course.id}/edit`}
      className="card-lift p-5"
      data-rl-component="LearningCourseCard"
    >
      <h3 className="font-semibold text-stone-800">{course.title}</h3>
      <p className="text-sm text-stone-500 mt-1 line-clamp-2 font-light">{course.description}</p>
      <div className="flex gap-2 mt-3 text-xs">
        <Badge variant={course.published ? "green" : "earth"}>
          {course.published ? t("learning.published") : t("learning.draft")}
        </Badge>
        {course.lesson_count > 0 && <span className="text-stone-00 dark:text-stone-500 font-light">{t("learning.lessons_count", { count: course.lesson_count })}</span>}
      </div>
    </Link>
  );
}
