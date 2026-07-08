"use client";

import Link from "next/link";
import { Type, Palette, Boxes, ArrowRight } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export default function StudioOverview() {
  const { user } = useAuth();

  const modules = [
    {
      label: "Content",
      href: "/studio/content",
      icon: Type,
      description: "Marketing copy, labels, buttons, menus, and warnings — PT + EN, with live preview.",
      status: "active",
    },
    {
      label: "Theming",
      href: "/studio/theming",
      icon: Palette,
      description: "Colors, fonts, radii, dark mode — global theme and per-element CSS adjustments.",
      status: "active",
    },
    {
      label: "Blocks",
      href: "/studio/blocks",
      icon: Boxes,
      description: "Sections, blocks, and elements — compose and rearrange page structure.",
      status: "active",
    },
  ];

  return (
    <div className="p-6 lg:p-10 max-w-5xl">
      <div className="mb-8">
        <p className="text-xs uppercase tracking-wider text-stone-400 font-medium mb-2">
          Content Studio
        </p>
        <h1 className="font-display text-3xl lg:text-4xl font-bold text-stone-800 dark:text-stone-100 leading-tight">
          Welcome back, {user?.name?.split(" ")[0] || "admin"}
        </h1>
        <p className="mt-2 text-stone-500 dark:text-stone-400 font-serif leading-relaxed max-w-xl">
          Manage the RootLink platform&apos;s UI and content from one place. Start with content copy,
          then move to theming and blocks as they come online.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {modules.map((mod) => {
          const Icon = mod.icon;
          const isSoon = mod.status === "soon";
          return (
            <Link
              key={mod.label}
              href={isSoon ? "#" : mod.href}
              className={`group rounded-xl2 border p-5 transition ${
                isSoon
                  ? "border-stone-200/50 dark:border-stone-800 opacity-60 cursor-not-allowed"
                  : "border-primary-200/60 dark:border-stone-800 hover:border-primary-300 dark:hover:border-primary-700 bg-white dark:bg-stone-900"
              }`}
              onClick={isSoon ? (e) => e.preventDefault() : undefined}
            >
              <div className="flex items-center justify-between mb-3">
                <div className="w-10 h-10 rounded-lg bg-primary-50 dark:bg-stone-800 flex items-center justify-center text-primary-600 dark:text-primary-400">
                  <Icon className="w-5 h-5" />
                </div>
                {isSoon && (
                  <span className="text-[10px] uppercase tracking-wide text-stone-400 px-2 py-0.5 rounded-full bg-stone-100 dark:bg-stone-800">
                    Soon
                  </span>
                )}
              </div>
              <h3 className="font-display font-semibold text-stone-800 dark:text-stone-100 mb-1">
                {mod.label}
              </h3>
              <p className="text-sm text-stone-500 dark:text-stone-400 leading-relaxed">
                {mod.description}
              </p>
              {!isSoon && (
                <div className="mt-3 flex items-center gap-1 text-xs font-medium text-primary-600 dark:text-primary-400 group-hover:gap-2 transition-all">
                  Open <ArrowRight className="w-3 h-3" />
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
