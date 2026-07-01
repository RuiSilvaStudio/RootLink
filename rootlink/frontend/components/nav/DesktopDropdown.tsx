"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { useLocale } from "@/lib/locale-context";
import type { NavGroup } from "./NavConfig";

export function DesktopDropdown({ group }: { group: NavGroup }) {
  const { t } = useLocale();
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const isActive = group.items.some(
    (item) => pathname === item.href || pathname.startsWith(item.href + "/")
  );

  // Close on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpen(false); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Whether grid should be 2-col or 1-col (3 items = 1 col pair + 1 full)
  const twoCol = group.items.length > 2;

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        aria-haspopup="true"
        className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium rounded-lg transition-colors duration-150 ${
          isActive || open
            ? "text-primary-700 dark:text-primary-300 bg-primary-50/60 dark:bg-primary-900/20"
            : "text-stone-600 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 hover:bg-primary-50/40 dark:hover:bg-primary-900/15"
        }`}
      >
        {t(group.labelKey)}
        <ChevronDown
          className={`w-3.5 h-3.5 opacity-60 transition-transform duration-200 ${open ? "rotate-180 opacity-100" : ""}`}
        />
      </button>

      {open && (
        <div
          className="absolute top-full left-0 mt-2 z-50 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl shadow-xl dark:shadow-2xl dark:shadow-black/40 overflow-hidden animate-fade-in"
          style={{ width: twoCol ? "440px" : "220px" }}
        >
          <div className="p-3">
            {twoCol ? (
              <div className="grid grid-cols-2 gap-0.5">
                {group.items.map((item, i) => {
                  const Icon = item.icon;
                  const active = pathname === item.href;
                  // Last item spans full width if count is odd
                  const isLast = i === group.items.length - 1;
                  const spanFull = isLast && group.items.length % 2 !== 0;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={`flex items-start gap-3 px-3 py-2.5 rounded-xl transition-colors ${
                        spanFull ? "col-span-2" : ""
                      } ${
                        active
                          ? "bg-primary-50/60 dark:bg-primary-900/20"
                          : "hover:bg-primary-50/50 dark:hover:bg-primary-900/15"
                      }`}
                    >
                      <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                        active
                          ? "bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400"
                          : "bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400"
                      }`}>
                        <Icon className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <p className={`text-[0.875rem] font-medium leading-snug ${
                          active ? "text-primary-700 dark:text-primary-300" : "text-stone-700 dark:text-stone-200"
                        }`}>
                          {t(item.labelKey)}
                        </p>
                        {item.descriptionKey && (
                          <p className="text-[0.75rem] text-stone-500 dark:text-stone-400 mt-0.5 leading-snug">
                            {t(item.descriptionKey)}
                          </p>
                        )}
                      </div>
                    </Link>
                  );
                })}
              </div>
            ) : (
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-xl text-sm transition-colors ${
                        active
                          ? "bg-primary-50/60 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300 font-medium"
                          : "text-stone-600 dark:text-stone-200 hover:bg-primary-50/50 dark:hover:bg-primary-900/15 hover:text-primary-700 dark:hover:text-primary-400"
                      }`}
                    >
                      <Icon className="w-4 h-4 shrink-0 text-stone-400 dark:text-stone-500" />
                      {t(item.labelKey)}
                    </Link>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
