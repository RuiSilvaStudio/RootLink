"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useLocale } from "@/lib/locale-context";
import { Tooltip } from "@/components/ui";
import type { LucideIcon } from "lucide-react";

export interface AdminSectionItem {
  href: string;
  label: string;
  icon: LucideIcon;
}

export interface AdminSection {
  labelKey: string;
  items: AdminSectionItem[];
}

export function AdminSidebarSection({
  section,
  defaultExpanded = false,
  pathname,
  collapsed = false,
}: {
  section: AdminSection;
  defaultExpanded?: boolean;
  pathname: string;
  collapsed?: boolean;
}) {
  const { t } = useLocale();
  const [expanded, setExpanded] = useState(defaultExpanded);

  useEffect(() => {
    if (section.items.some((item) => pathname === item.href)) {
      setExpanded(true);
    }
  }, [pathname, section.items]);

  useEffect(() => {
    const saved = localStorage.getItem(`admin-section-${section.labelKey}`);
    if (saved !== null) {
      setExpanded(saved === "true");
    } else if (defaultExpanded) {
      setExpanded(true);
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    localStorage.setItem(`admin-section-${section.labelKey}`, String(expanded));
  }, [expanded, section.labelKey]);

  // Collapsed mode: show items as icon-only with tooltips, no section header.
  if (collapsed) {
    return (
      <div className="flex flex-col gap-0.5 items-center">
        {section.items.map((item) => {
          const Icon = item.icon;
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-label={item.label}
              aria-current={active ? "page" : undefined}
              className="block px-1"
            >
              <Tooltip content={item.label} side="right">
                <span
                  className={`flex items-center justify-center w-10 h-9 rounded-lg text-sm transition ${
                    active
                      ? "bg-primary-600 text-cream"
                      : "text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800"
                  }`}
                >
                  <Icon className="w-4 h-4 shrink-0" />
                </span>
              </Tooltip>
            </Link>
          );
        })}
      </div>
    );
  }

  return (
    <div className="mb-1">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-1.5 text-xs font-display font-semibold text-stone-400 uppercase tracking-wider hover:text-stone-600 dark:hover:text-stone-200 transition"
      >
        <span>{t(section.labelKey)}</span>
        <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ type: "spring" as const, stiffness: 500, damping: 35 }}>
          <ChevronDown className="w-3 h-3" />
        </motion.div>
      </button>
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className="overflow-hidden"
          >
            {section.items.map((item) => {
              const Icon = item.icon;
              const active = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
                    active
                      ? "bg-primary-600 text-cream"
                      : "text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800"
                  }`}
                >
                  <Icon className={`w-4 h-4 shrink-0 ${active ? "text-cream" : "text-stone-400"}`} />
                  <span className="truncate">{item.label}</span>
                </Link>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
