"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { Info } from "lucide-react";
import { useGSAPToggle } from "@/lib/gsap";

export function InfoPopover({
  children,
  label = "More information",
  align = "right",
}: {
  children: ReactNode;
  label?: string;
  align?: "left" | "right";
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const { ref: animRef, shouldRender } = useGSAPToggle(open, { duration: 0.15 });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <span data-rl-component="InfoPopover" ref={ref} className="relative inline-flex">
      <button
        type="button"
        aria-label={label}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
        className="inline-grid place-items-center w-5 h-5 rounded-full bg-primary-100/70 dark:bg-primary-900/40 text-primary-600 dark:text-primary-300 hover:bg-primary-200/70 dark:hover:bg-primary-800/50 transition-colors"
      >
        <Info className="w-3 h-3" />
      </button>
      {shouldRender && (
        <span
          ref={animRef as any}
          className={`absolute z-[60] top-full mt-2 ${align === "right" ? "right-0" : "left-0"} w-64 rounded-xl bg-white dark:bg-stone-900 p-3 text-xs leading-relaxed text-stone-600 dark:text-stone-300 shadow-lg border border-primary-200/40 dark:border-primary-800/40`}
        >
          {children}
        </span>
      )}
    </span>
  );
}
