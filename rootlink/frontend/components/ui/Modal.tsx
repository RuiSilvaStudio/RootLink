"use client";

/**
 * Shared accessible modal dialog.
 *
 * Replaces the bespoke fixed-overlay modals (theming/blocks/fonts pages) with
 * one implementation that gets the accessibility contract right:
 *   - rendered via createPortal(document.body) — never a DOM descendant of a
 *     link/card that could swallow clicks (LESSONS.md #16)
 *   - Esc closes; backdrop click closes; focus is trapped inside while open
 *   - `role="dialog"` + `aria-modal` + `aria-labelledby` wired to the title
 *   - focus moves into the dialog on open and returns to the opener on close
 *
 * Usage:
 *   <Modal open={open} onClose={() => setOpen(false)} title="New theme">
 *     ...fields...
 *   </Modal>
 */

import { ReactNode, useCallback, useEffect, useId, useRef } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

type Props = {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  /** Optional footer row (action buttons). */
  footer?: ReactNode;
  /** Max-width utility class for the panel. Default: max-w-md */
  widthClassName?: string;
};

export function Modal({ open, onClose, title, children, footer, widthClassName = "max-w-md" }: Props) {
  const panelRef = useRef<HTMLDivElement>(null);
  const openerRef = useRef<HTMLElement | null>(null);
  const titleId = useId();

  // Esc to close + Tab focus trap.
  const onKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !panelRef.current) return;
      const focusables = Array.from(panelRef.current.querySelectorAll<HTMLElement>(FOCUSABLE));
      if (focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const activeEl = document.activeElement as HTMLElement | null;
      if (e.shiftKey && (activeEl === first || !panelRef.current.contains(activeEl))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && activeEl === last) {
        e.preventDefault();
        first.focus();
      }
    },
    [onClose]
  );

  // Focus management — keyed on `open` ONLY. This effect must never re-run on
  // ordinary re-renders: it used to depend on `onKeyDown` (recreated whenever
  // the caller passed an inline `onClose`), so every keystroke inside the
  // dialog re-ran it and yanked focus to the first focusable control — making
  // it impossible to type in a modal's text field.
  useEffect(() => {
    if (!open) return;
    openerRef.current = document.activeElement as HTMLElement | null;
    // Move focus to the first focusable control inside the panel.
    const t = window.setTimeout(() => {
      const first = panelRef.current?.querySelector<HTMLElement>(FOCUSABLE);
      (first ?? panelRef.current)?.focus();
    }, 0);
    return () => {
      window.clearTimeout(t);
      openerRef.current?.focus?.();
    };
  }, [open]);

  // Keyboard handling (Esc + Tab trap) — safe to re-bind on handler identity
  // changes; it has no focus side effects.
  useEffect(() => {
    if (!open) return;
    document.addEventListener("keydown", onKeyDown, true);
    return () => document.removeEventListener("keydown", onKeyDown, true);
  }, [open, onKeyDown]);

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-stone-950/50 backdrop-blur-sm"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`w-full ${widthClassName} rounded-xl2 border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 shadow-xl animate-scale-in outline-none`}
      >
        <div className="flex items-center justify-between gap-4 px-5 py-4 border-b border-stone-200/60 dark:border-stone-700/60">
          <h2 id={titleId} className="font-display text-base font-semibold text-stone-800 dark:text-stone-100">
            {title}
          </h2>
          <button
            onClick={onClose}
            aria-label="Close dialog"
            className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 dark:hover:text-stone-200 dark:hover:bg-stone-800 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="px-5 py-4">{children}</div>
        {footer && (
          <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-stone-200/60 dark:border-stone-700/60">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
