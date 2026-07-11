"use client";

import Link from "next/link";
import { Type, Palette, Boxes, Library, Search, BookOpen, AlertTriangle, ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export default function StudioOverview() {
  const { user } = useAuth();

  const modules = [
    {
      label: "Content",
      href: "/studio/content",
      icon: Type,
      description: "Marketing copy, labels, buttons, menus, and warnings — PT + EN, with live preview.",
    },
    {
      label: "Theming",
      href: "/studio/theming",
      icon: Palette,
      description: "Colors, fonts, radii, dark mode — global theme and per-element CSS adjustments.",
    },
    {
      label: "Blocks",
      href: "/studio/blocks",
      icon: Boxes,
      description: "Sections, blocks, and elements — compose and rearrange page structure.",
    },
    {
      label: "Catalog",
      href: "/studio/catalog",
      icon: Library,
      description: "The element type registry — which settings each element offers in the inspector.",
    },
    {
      label: "Audit",
      href: "/studio/audit",
      icon: Search,
      description: "Every component side by side — spot look-alikes and see where each one is used.",
    },
    {
      label: "Fonts",
      href: "/studio/fonts",
      icon: BookOpen,
      description: "The font library — browse, preview, and choose the platform's typefaces.",
    },
    {
      label: "Overrides",
      href: "/studio/overrides",
      icon: AlertTriangle,
      description: "Every deviation from the theme defaults, with warnings when one goes stale.",
    },
  ];

  return (
    <div className="h-full overflow-y-auto p-6 lg:p-10 max-w-5xl">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-wider text-stone-400 font-medium mb-2">
          Content Studio
        </p>
        <h1 className="font-display text-3xl lg:text-4xl font-bold text-stone-800 dark:text-stone-100 leading-tight">
          Welcome back, {user?.name?.split(" ")[0] || "admin"}
        </h1>
        <p className="mt-2 text-stone-500 dark:text-stone-400 font-serif leading-relaxed max-w-xl">
          Manage the RootLink platform&apos;s UI and content from one place — copy, theme,
          page blocks, and the tools that keep them consistent.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((mod) => {
          const Icon = mod.icon;
          return (
            <Link
              key={mod.label}
              href={mod.href}
              className="group rounded-xl2 border p-5 transition border-primary-200/60 dark:border-stone-800 hover:border-primary-300 dark:hover:border-primary-700 bg-white dark:bg-stone-900"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-primary-50 dark:bg-stone-800 flex items-center justify-center text-primary-600 dark:text-primary-400">
                  <Icon className="w-5 h-5" />
                </div>
              </div>
              <h3 className="font-display font-semibold text-stone-800 dark:text-stone-100 mb-1">
                {mod.label}
              </h3>
              <p className="text-sm text-stone-500 dark:text-stone-400 leading-relaxed">
                {mod.description}
              </p>
              <div className="mt-3 flex items-center gap-1 text-xs font-medium text-primary-600 dark:text-primary-400 group-hover:gap-2 transition-all">
                Open <ArrowRight className="w-3 h-3" />
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
