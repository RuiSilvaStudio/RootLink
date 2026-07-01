"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Plus, PenLine, CalendarDays, Tag, Users, Link as LinkIcon, GraduationCap, Route, Lock } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/lib/locale-context";

type CreateItem = {
  href: string;
  labelKey: string;
  descKey: string;
  icon: typeof PenLine;
  requiresContributor?: boolean;
  accent?: boolean;
};

const ITEMS: CreateItem[] = [
  { href: "/articles/new", labelKey: "create.article", descKey: "create.article_desc", icon: PenLine },
  { href: "/events?new=1", labelKey: "create.event", descKey: "create.event_desc", icon: CalendarDays },
  { href: "/marketplace/create", labelKey: "create.listing", descKey: "create.listing_desc", icon: Tag, accent: true },
  { href: "/groups?new=1", labelKey: "create.group", descKey: "create.group_desc", icon: Users },
  { href: "/submit", labelKey: "create.submit", descKey: "create.submit_desc", icon: LinkIcon },
  { href: "/learning/courses/new", labelKey: "create.course", descKey: "create.course_desc", icon: GraduationCap, requiresContributor: true },
  { href: "/learning/paths/new", labelKey: "create.path", descKey: "create.path_desc", icon: Route, requiresContributor: true },
];

const CONTRIBUTOR_ROLES = ["super_admin", "admin", "moderator", "contributor"];

export function CreateMenu() {
  const { user, token } = useAuth();
  const { t } = useLocale();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  if (!token) return null;

  const isContributor = !!user && CONTRIBUTOR_ROLES.includes(user.role);

  return (
    <div ref={ref} className="relative">
      {/* Circle + button */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        title={t("create.button")}
        className="w-8 h-8 rounded-full bg-primary-500 hover:bg-primary-400 active:scale-95 text-cream flex items-center justify-center shadow-sm shadow-primary-500/40 transition-all duration-150"
      >
        <Plus className="w-4 h-4" strokeWidth={2.5} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 mt-2 w-[340px] bg-white dark:bg-stone-900 rounded-xl shadow-xl border border-primary-200/40 dark:border-primary-800/40 z-50 overflow-hidden"
          >
            {/* Header */}
            <div className="px-4 pt-4 pb-3 border-b border-stone-100 dark:border-stone-800">
              <p className="font-display font-semibold text-stone-800 dark:text-stone-100 text-[0.9375rem]">{t("create.heading")}</p>
              <p className="text-[0.8125rem] text-primary-500 dark:text-primary-400 mt-0.5 leading-snug">{t("create.subheading")}</p>
            </div>
            {/* 2-col grid */}
            <div className="p-3 grid grid-cols-2 gap-0.5">
              {ITEMS.map((item, i) => {
                const Icon = item.icon;
                const locked = item.requiresContributor && !isContributor;
                const isLastOdd = i === ITEMS.length - 1 && ITEMS.length % 2 !== 0;
                const inner = (
                  <div className={`flex items-center gap-2.5 px-3 py-2.5 rounded-xl transition-colors ${
                    locked
                      ? "opacity-50 cursor-not-allowed"
                      : "hover:bg-primary-50/60 dark:hover:bg-primary-900/20"
                  }`}>
                    <span className={`grid place-items-center w-7 h-7 rounded-lg shrink-0 ${
                      item.accent
                        ? "bg-rust-100 dark:bg-rust-900/30 text-rust-600 dark:text-rust-300"
                        : "bg-primary-100/70 dark:bg-primary-900/30 text-primary-600 dark:text-primary-300"
                    }`}>
                      <Icon className="w-3.5 h-3.5" />
                    </span>
                    <span className="text-[0.8125rem] font-medium text-stone-700 dark:text-stone-200 flex items-center gap-1">
                      {t(item.labelKey)}
                      {locked && <Lock className="w-3 h-3 text-stone-400 shrink-0" />}
                    </span>
                  </div>
                );
                if (locked) return <div key={item.href} className={isLastOdd ? "col-span-2" : ""}>{inner}</div>;
                return (
                  <Link key={item.href} href={item.href} onClick={() => setOpen(false)} className={isLastOdd ? "col-span-2" : ""}>
                    {inner}
                  </Link>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
