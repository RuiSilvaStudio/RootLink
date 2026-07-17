"use client";

import { useState, type ReactNode } from "react";
import { useGSAPToggle } from "@/lib/gsap";

type Side = "top" | "bottom" | "left" | "right";

const sidePos: Record<Side, string> = {
  top: "bottom-full left-1/2 -translate-x-1/2 mb-2",
  bottom: "top-full left-1/2 -translate-x-1/2 mt-2",
  left: "right-full top-1/2 -translate-y-1/2 mr-2",
  right: "left-full top-1/2 -translate-y-1/2 ml-2",
};

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
  const { ref, shouldRender } = useGSAPToggle(open, { duration: 0.12 });
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
      {shouldRender && (
        <span
          ref={ref as any}
          role="tooltip"
          className={`absolute z-[60] ${sidePos[side]} w-max max-w-[220px] rounded-lg bg-stone-900 dark:bg-stone-700 px-2.5 py-1.5 text-xs leading-snug text-stone-50 shadow-lg pointer-events-none`}
        >
          {content}
        </span>
      )}
    </span>
  );
}
