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
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        className="flex items-center gap-1.5 pl-2.5 pr-3 py-1.5 rounded-full bg-primary-600 hover:bg-primary-700 text-white text-sm font-medium font-serif transition-colors shadow-sm"
      >
        <Plus className="w-4 h-4" />
        <span className="hidden sm:inline">{t("create.button")}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute right-0 mt-2 w-80 bg-white dark:bg-stone-900 rounded-xl shadow-lg border border-primary-200/40 dark:border-primary-800/40 z-50 overflow-hidden"
          >
            <div className="px-4 pt-3 pb-1">
              <p className="font-display font-semibold text-stone-800 dark:text-stone-100">{t("create.heading")}</p>
              <p className="text-xs text-stone-500 dark:text-stone-400">{t("create.subheading")}</p>
            </div>
            <div className="py-1">
              {ITEMS.map((item) => {
                const Icon = item.icon;
                const locked = item.requiresContributor && !isContributor;
                const inner = (
                  <div className={`flex items-start gap-3 px-4 py-2.5 ${locked ? "opacity-60" : "hover:bg-primary-50/40 dark:hover:bg-primary-900/20"}`}>
                    <span className={`mt-0.5 grid place-items-center w-8 h-8 rounded-lg shrink-0 ${item.accent ? "bg-rust-100 dark:bg-rust-900/30 text-rust-600 dark:text-rust-300" : "bg-primary-100/70 dark:bg-primary-900/30 text-primary-600 dark:text-primary-300"}`}>
                      <Icon className="w-4 h-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-stone-800 dark:text-stone-100 flex items-center gap-1.5">
                        {t(item.labelKey)}
                        {locked && <Lock className="w-3 h-3 text-stone-400" />}
                      </p>
                      <p className="text-xs text-stone-500 dark:text-stone-400 leading-snug">
                        {locked ? t("create.requires_contributor") : t(item.descKey)}
                      </p>
                    </div>
                  </div>
                );
                if (locked) {
                  return <div key={item.href}>{inner}</div>;
                }
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                  >
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
