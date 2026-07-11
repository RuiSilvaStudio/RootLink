"use client";

import Link from "next/link";
import { BookOpen, Edit } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { safeImageUrl } from "@/lib/image-url";

export function LearningAllCourseCard({ course, t, showEdit }: { course: any; t: (key: string, ...args: any[]) => string; showEdit: boolean }) {
  return (
    <Link
      href={`/learning/courses/${course.id}`}
      className="card-lift p-5 group"
      data-rl-component="LearningAllCourseCard"
    >
      {course.image_url && <img src={safeImageUrl(course.image_url, "/images/placeholder-card.svg")} alt="" loading="lazy" className="w-full h-32 object-cover rounded-lg mb-3" />}
      <h3 className="font-semibold text-stone-800">{course.title}</h3>
      <p className="text-sm text-stone-500 mt-1 line-clamp-2 font-light">{course.description}</p>
      <div className="flex gap-2 mt-3 text-xs text-stone-500 items-center flex-wrap">
        {course.category && <Badge variant="sage" className="text-[10px]">{t("learning.category_" + course.category)}</Badge>}
        {course.difficulty && <Badge variant="stone" className="text-[10px]">{course.difficulty}</Badge>}
        {course.lesson_count > 0 && <span className="flex items-center gap-1 font-light"><BookOpen className="w-3 h-3" />{course.lesson_count}</span>}
        {showEdit && (
          <Link href={`/learning/courses/${course.id}/edit`} className="ml-auto text-primary-600 opacity-0 group-hover:opacity-100 transition"><Edit className="w-3.5 h-3.5" /></Link>
        )}
      </div>
    </Link>
  );
}
