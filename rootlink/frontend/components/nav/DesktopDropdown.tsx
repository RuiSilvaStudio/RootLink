"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { useLocale } from "@/lib/locale-context";
import type { NavGroup } from "./NavConfig";

export function DesktopDropdown({ group }: { group: NavGroup }) {
  const { t } = useLocale();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isActive = group.items.some((item) => pathname === item.href || pathname.startsWith(item.href + "/"));

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const openMenu = () => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    setOpen(true);
  };

  const closeMenu = () => {
    timeoutRef.current = setTimeout(() => setOpen(false), 150);
  };

  return (
    <div
      ref={ref}
      className="relative"
      onMouseEnter={openMenu}
      onMouseLeave={closeMenu}
    >
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1 px-3 py-1.5 text-sm font-serif transition-colors rounded-lg ${
          isActive
            ? "text-primary-700 dark:text-primary-300 font-medium"
            : "text-stone-500 dark:text-stone-300 hover:text-primary-700 dark:hover:text-primary-400"
        }`}
        aria-expanded={open}
        aria-haspopup="true"
      >
        {t(group.labelKey)}
        <ChevronDown
          className={`w-3 h-3 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
        />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.98 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            className="absolute left-0 mt-1 w-56 bg-white dark:bg-stone-900 rounded-xl shadow-lg border border-primary-200/40 dark:border-primary-800/40 z-50 overflow-hidden"
            onMouseEnter={openMenu}
            onMouseLeave={closeMenu}
          >
            <div className="py-1">
              {group.items.map((item) => {
                const Icon = item.icon;
                const active = pathname === item.href;
                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    onClick={() => setOpen(false)}
                    className={`flex items-center gap-3 px-4 py-2.5 text-sm font-serif transition ${
                      active
                        ? "bg-primary-50/50 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 font-medium"
                        : "text-stone-600 dark:text-stone-200 hover:bg-primary-50/30 dark:hover:bg-primary-900/20 hover:text-primary-700 dark:hover:text-primary-400"
                    }`}
                  >
                    <Icon className={`w-4 h-4 shrink-0 ${active ? "text-primary-600 dark:text-primary-400" : "text-stone-400 dark:text-stone-500"}`} />
                    {t(item.labelKey)}
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
