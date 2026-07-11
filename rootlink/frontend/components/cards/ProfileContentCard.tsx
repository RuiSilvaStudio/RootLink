"use client";

import Link from "next/link";
import { safeImageUrl } from "@/lib/image-url";

export function ProfileContentCard({ item }: { item: any }) {
  return (
    <Link key={item.id} href={`/content/${item.id}`} className="card-lift p-4 group" data-rl-component="ProfileContentCard">
      <img src={safeImageUrl(item.image_url, "/images/placeholder-card.svg")} alt={item.title} className="w-full h-24 object-cover rounded-lg mb-3" />
      <p className="text-sm font-medium text-stone-700 dark:text-stone-300 group-hover:text-primary-700 transition line-clamp-2">{item.title}</p>
      {item.created_at && <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">{new Date(item.created_at).toLocaleDateString()}</p>}
    </Link>
  );
}
