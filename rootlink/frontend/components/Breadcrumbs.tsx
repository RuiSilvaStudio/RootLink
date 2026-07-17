"use client";

import { ReactNode } from "react";
import Link from "next/link";
import { ChevronRight, Home } from "lucide-react";

// label: string -> ReactNode: purely additive (a string is a valid ReactNode).
// Lets pages pass `<Text k="x" as="span" defaultText="..." />` for a crumb so
// the Content Studio overlay can edit it (data-rl-text on the rendered child).
export type Crumb = { label: ReactNode; href?: string };

export function Breadcrumbs({ items }: { items: Crumb[] }) {
  return (
    <nav aria-label="breadcrumb" className="flex items-center gap-1 text-sm text-stone-400 mb-6">
      <Link href="/" className="hover:text-primary-600 transition">
        <Home className="w-4 h-4" />
      </Link>
      {items.map((item, i) => (
        <span key={i} className="flex items-center gap-1">
          <ChevronRight className="w-3.5 h-3.5" />
          {item.href ? (
            <Link href={item.href} className="hover:text-primary-600 transition">
              {item.label}
            </Link>
          ) : (
            <span className="text-stone-600">{item.label}</span>
          )}
        </span>
      ))}
    </nav>
  );
}
