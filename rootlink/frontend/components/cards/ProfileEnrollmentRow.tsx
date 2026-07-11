"use client";

import Link from "next/link";
import { GraduationCap } from "lucide-react";

export function ProfileEnrollmentRow({ enrollment }: { enrollment: any }) {
  return (
    <Link className="flex items-center gap-3 bg-white dark:bg-stone-900 rounded-xl border border-primary-100/40 dark:border-stone-700/40 p-3 hover:shadow-md transition" data-rl-component="ProfileEnrollmentRow" href={`/learning/courses/${enrollment.course_id}`}>
      <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
        <GraduationCap className="w-5 h-5 text-green-600" />
      </div>
      <div className="min-w-0">
        <p className="text-sm font-medium text-stone-700 dark:text-stone-300 truncate">{enrollment.course_title}</p>
      </div>
    </Link>
  );
}
