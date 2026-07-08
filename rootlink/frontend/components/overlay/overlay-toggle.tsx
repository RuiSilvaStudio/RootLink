"use client";

/**
 * Content Studio — Edit Mode toggle button.
 *
 * A floating button visible only to super_admin on desktop, when the overlay
 * is NOT active. Clicking it enters edit mode (activates the overlay).
 *
 * Spec: docs/content-studio/CONTENT_STUDIO.md §3.2 (activation).
 */

import { PenLine } from "lucide-react";
import { usePathname } from "next/navigation";
import { useOverlay } from "./overlay-provider";

export function OverlayToggle() {
  const { canEdit, active, toggle } = useOverlay();
  const pathname = usePathname();

  // Only show when: super_admin + desktop + overlay not active + not on /studio or /admin or /auth
  if (!canEdit || active) return null;
  if (pathname.startsWith("/studio") || pathname.startsWith("/admin") || pathname.startsWith("/auth")) return null;

  return (
    <button
      onClick={toggle}
      className="fixed bottom-6 right-6 z-[140] inline-flex items-center gap-2.5 px-5 py-3 rounded-full
        bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-cream
        font-display font-medium tracking-wide text-sm
        transition-all duration-200 hover:-translate-y-0.5
        focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40
        shadow-sm hover:shadow-md"
      aria-label="Enter edit mode"
    >
      <PenLine className="w-4 h-4" />
      Edit page
    </button>
  );
}
