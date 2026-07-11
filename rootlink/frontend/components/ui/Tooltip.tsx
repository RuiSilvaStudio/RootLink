"use client";

import { useState, type ReactNode } from "react";
import { AnimatePresence, motion } from "framer-motion";

type Side = "top" | "bottom" | "left" | "right";

const sidePos: Record<Side, string> = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  left: "right-full top-1/2 -translate-y-1/2 mr-2",
  right: "left-full top-1/2 -translate-y-1/2 ml-2",
};

/**
 * Lightweight hover/focus tooltip. Replaces ad-hoc native `title=` usage so help
 * text is consistent and accessible (CONTENT_PLATFORM.md §9.4).
 */
export function Tooltip({
  content,
  side = "top",
  children,
}: {
  content: ReactNode;
  side?: Side;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <span
      data-rl-component="Tooltip"
      className="relative inline-flex"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
      onFocus={() => setOpen(true)}
      onBlur={() => setOpen(false)}
    >
      {children}
      <AnimatePresence>
        {open && (
          <motion.span
            role="tooltip"
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.96 }}
            transition={{ duration: 0.12, ease: "easeOut" }}
            className={`absolute z-[60] ${sidePos[side]} w-max max-w-[220px] rounded-lg bg-stone-900 dark:bg-stone-700 px-2.5 py-1.5 text-xs leading-snug text-stone-50 shadow-lg pointer-events-none`}
          >
            {content}
          </motion.span>
        )}
      </AnimatePresence>
    </span>
  );
}
