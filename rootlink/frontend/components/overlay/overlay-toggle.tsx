"use client";

/**
 * Content Studio — Edit Mode toggle button.
 *
 * A floating button visible only to super_admin on desktop, when the overlay
 * is NOT active. Clicking it enters edit mode (activates the overlay).
 *
 * Spec: docs/content-studio/CONTENT_STUDIO.md §3.2 (activation).
 */

import { useEffect } from "react";
import { PenLine } from "lucide-react";
import { usePathname } from "next/navigation";
import { useOverlay } from "./overlay-provider";
import { Tooltip } from "@/components/ui/Tooltip";

export function OverlayToggle() {
  const { canEdit, active, toggle } = useOverlay();
  const pathname = usePathname();

  // Only show when: super_admin + desktop + overlay not active + not on /studio or /admin or /auth
  const shown =
    canEdit && !active &&
    !pathname.startsWith("/studio") && !pathname.startsWith("/admin") && !pathname.startsWith("/auth");

  // Ctrl/Cmd+Shift+E enters edit mode — only while the toggle is shown (the
  // same conditions that render the button), so it can never fire mid-edit.
  useEffect(() => {
    if (!shown) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.shiftKey && e.key.toLowerCase() === "e") {
        e.preventDefault();
        toggle();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [shown, toggle]);

  if (!shown) return null;

  return (
    <div className="fixed bottom-6 right-6 z-[140]">
      <Tooltip content="Edit page (Ctrl+Shift+E)" side="left">
        <button
          onClick={toggle}
          className="inline-flex items-center gap-2.5 px-5 py-3 rounded-full
            bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-cream
            font-display font-medium tracking-wide text-sm
            transition-all duration-200 hover:-translate-y-0.5
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40
            shadow-sm hover:shadow-md"
          aria-label="Edit page (Ctrl+Shift+E)"
        >
          <PenLine className="w-4 h-4" />
          Edit page
        </button>
      </Tooltip>
    </div>
  );
}
