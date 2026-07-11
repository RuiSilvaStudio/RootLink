"use client";

import Link from "next/link";
import { Award } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

export function LearningEnrollmentCard({ enrollment, t }: { enrollment: any; t: (key: string, ...args: any[]) => string }) {
  const done = enrollment.lesson_progress?.filter((p: any) => p.completed).length || 0;
  const total = enrollment.lesson_progress?.length || 0;
  const pct = total > 0 ? Math.round((done / total) * 100) : 0;
  return (
    <Link
      href={`/learning/courses/${enrollment.course_id}`}
      className="card-lift p-5"
      data-rl-component="LearningEnrollmentCard"
    >
      <h3 className="font-semibold text-stone-800">{enrollment.course_title || `Course #${enrollment.course_id}`}</h3>
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
      {enrollment.completed && (
        <Badge variant="green" className="mt-2">
          <Award className="w-3.5 h-3.5" /> {t("learning.completed")}
        </Badge>
      )}
    </Link>
  );
}
