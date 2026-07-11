"use client";

import Link from "next/link";
import { Badge } from "@/components/ui/Badge";
import { safeImageUrl } from "@/lib/image-url";

export function PopularContentCard({ item }: { item: any }) {
  const isExternal = Boolean(item.url);
  const Tag = isExternal ? "a" : Link;
  const extraProps = isExternal ? { target: "_blank", rel: "noopener noreferrer" as const } : {};

  return (
    <Tag
      href={isExternal ? item.url : `/articles/${item.slug!}`}
      {...extraProps}
      data-rl-component="PopularContentCard"
      className="rounded-2xl border border-primary-100/40 dark:border-stone-700 bg-white dark:bg-stone-900 p-4 flex items-start gap-3 transition-all hover:shadow-md hover:border-primary-200/60 dark:hover:border-primary-700"
    >
      <div className="w-12 h-12 rounded-xl shrink-0 flex items-center justify-center overflow-hidden">
        <img
          src={safeImageUrl(item.image_url, "/images/placeholder-card.svg")}
          alt={item.title}
          className="w-full h-full object-cover"
        />
      </div>
      <div className="min-w-0 flex-1">
        <h3 className="font-medium text-sm text-stone-800 dark:text-stone-100 line-clamp-2">{item.title}</h3>
        <div className="flex gap-1 mt-1">
          <Badge variant="sage" className="text-[10px]">{item.category}</Badge>
        </div>
      </div>
    </Tag>
  );
}
