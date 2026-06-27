"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronDown } from "lucide-react";
import { useLocale } from "@/lib/locale-context";
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
}: {
  section: AdminSection;
  defaultExpanded?: boolean;
  pathname: string;
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

  return (
    <div className="mb-1">
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-center justify-between px-3 py-1.5 text-[10px] font-display font-semibold text-cream/50 uppercase tracking-[0.12em] hover:text-cream/70 transition"
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
                  className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-serif transition ${
                    active
                      ? "bg-primary-400/20 text-cream font-medium"
                      : "text-cream/60 hover:text-cream hover:bg-white/5"
                  }`}
                >
                  <Icon className={`w-5 h-5 shrink-0 ${active ? "text-cream" : "text-cream/50"}`} />
                  <span className="whitespace-nowrap">{item.label}</span>
                </Link>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
