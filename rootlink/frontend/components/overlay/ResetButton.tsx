"use client";

import { RotateCcw } from "lucide-react";
import { Tooltip } from "@/components/ui/Tooltip";

/** The per-property "reset" button — appears next to overridden properties in
 *  the inspector. Clicking it removes the inline override so the element
 *  reverts to its Tailwind class (theme) default. */
export function ResetButton({ property, onClick }: { property: string; onClick: () => void }) {
  return (
    <Tooltip content="Revert to theme default" side="left">
      <button
        onClick={onClick}
        className="flex items-center gap-1 text-xs text-stone-400 hover:text-primary-300 transition rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
      >
        <RotateCcw className="w-3 h-3" aria-hidden="true" /> reset
      </button>
    </Tooltip>
  );
}
