"use client";

/**
 * Fixed editor-mode toggle + save/reset controls.
 *
 * Visual language: reuses the platform's real design tokens (Fraunces
 * font-display, primary/rust palette, Button.tsx's shadow/hover-lift
 * treatment) rather than a generic floating-action-button look — see
 * discovery/mockups/content-ui-editor/briefing-to-build-local.md for why.
 * "Edit page" uses the same primary CTA styling as any other Button;
 * "Exit editor" switches to rust (already used elsewhere for emphasis, e.g.
 * the unread-notification dot) to signal the distinct active state without
 * introducing an off-palette color.
 *
 * Placement note: the existing toast stack already occupies `bottom-4
 * right-4` on every viewport (lib/toast-context.tsx) and `MobileBottomBar`
 * occupies the full bottom edge on mobile (z-50). This chrome sits at
 * `bottom-20 right-4` with a higher z-index so it never collides with either.
 */

import { useEffect, useState } from "react";
import { PenLine, Eye, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { useEditorMode } from "./editor-mode-provider";

export function EditorModeChrome() {
  const { mode, isSuperAdmin, toggleMode, dirtyCount, saving, saveChanges, resetPage } = useEditorMode();
  const [scanKey, setScanKey] = useState(0);
  const [reducedMotion, setReducedMotion] = useState(false);

  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReducedMotion(mq.matches);
    const onChange = () => setReducedMotion(mq.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);

  useEffect(() => {
    if (mode === "editor") setScanKey((k) => k + 1);
  }, [mode]);

  if (!isSuperAdmin) return null;

  const isEditing = mode === "editor";

  return (
    <>
      {/* Signature scan-line: a single rust sweep confirming the admin layer
          just activated. Purely cosmetic, respects reduced-motion. */}
      {isEditing && !reducedMotion && (
        <div
          key={scanKey}
          aria-hidden="true"
          className="animate-editor-scan z-[9998] h-1 left-0 right-0 pointer-events-none bg-gradient-to-r from-transparent via-rust-500 to-transparent shadow-[0_0_18px_4px_rgba(168,100,61,0.3)]"
        />
      )}

      <div className="fixed bottom-20 right-4 z-[140] flex flex-col items-end gap-2">
        {isEditing && dirtyCount > 0 && (
          <div className="flex items-center gap-2">
            <Button variant="danger" size="sm" onClick={resetPage} disabled={saving}>
              Reset page
            </Button>
            <Button variant="primary" size="sm" onClick={saveChanges} disabled={saving}>
              {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              {saving ? "Saving…" : "Save changes"}
            </Button>
          </div>
        )}

        <button
          onClick={toggleMode}
          className={`
            inline-flex items-center gap-2.5 px-6 py-3 rounded-full
            font-display font-medium tracking-wide text-sm
            transition-all duration-200 hover:-translate-y-0.5
            focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40
            shadow-sm hover:shadow-md
            ${isEditing
              ? "bg-rust-600 hover:bg-rust-700 active:bg-rust-800 text-cream"
              : "bg-primary-600 hover:bg-primary-700 active:bg-primary-800 text-cream"}
          `}
        >
          {isEditing ? <Eye className="w-4 h-4" /> : <PenLine className="w-4 h-4" />}
          {isEditing ? "Exit editor" : "Edit page"}
          {isEditing && dirtyCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[20px] rounded-full bg-white/25 px-1.5 py-0.5 text-[11px] font-semibold">
              {dirtyCount}
            </span>
          )}
        </button>
      </div>
    </>
  );
}
