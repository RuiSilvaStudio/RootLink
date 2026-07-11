"use client";

import Link from "next/link";
import { Library, Edit } from "lucide-react";
import { safeImageUrl } from "@/lib/image-url";

export function LearningPathCard({ path, t, showEdit }: { path: any; t: (key: string, ...args: any[]) => string; showEdit: boolean }) {
  return (
    <Link
      href={`/learning/paths/${path.id}`}
      className="card-lift p-5 group"
      data-rl-component="LearningPathCard"
    >
      {path.image_url ? (
        <img src={safeImageUrl(path.image_url, "/images/placeholder-card.svg")} alt="" loading="lazy" className="w-full h-32 object-cover rounded-lg mb-3" />
      ) : (
        <Library className="w-8 h-8 text-primary-600 mb-3" />
      )}
      <h3 className="font-semibold text-stone-800">{path.title}</h3>
      <p className="text-sm text-stone-500 mt-1 line-clamp-2 font-light">{path.description}</p>
      {showEdit && (
        <Link href={`/learning/paths/${path.id}/edit`} className="inline-flex items-center gap-1 text-xs text-primary-600 mt-2 opacity-0 group-hover:opacity-100 transition font-medium"><Edit className="w-3 h-3" /> {t("learning.edit")}</Link>
      )}
    </Link>
  );
}
