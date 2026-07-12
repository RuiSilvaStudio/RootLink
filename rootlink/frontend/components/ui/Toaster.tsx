"use client";

/**
 * RootLink-themed Sonner Toaster.
 *
 * Mount once per surface (root layout for the whole app, studio layout for
 * the studio, overlay shell for the editor). Sonner deduplicates by position.
 *
 * Theming: uses RootLink's earth palette (cream/stone/primary/rust) instead
 * of Sonner's default neutral grays. Dark-mode aware via the .dark class.
 */

import { Toaster as SonnerToaster } from "sonner";

export function Toaster() {
  return (
    <SonnerToaster
      position="bottom-right"
      richColors={false}
      closeButton
      duration={4000}
      toastOptions={{
        classNames: {
          toast:
            "group rounded-xl2 border font-serif text-sm shadow-lg " +
            "bg-white dark:bg-stone-900 " +
            "border-primary-200/60 dark:border-stone-700 " +
            "text-stone-800 dark:text-stone-100 " +
            "[&[data-type=success]]:border-emerald-300/60 dark:[&[data-type=success]]:border-emerald-800/50 " +
            "[&[data-type=error]]:border-rust-300/60 dark:[&[data-type=error]]:border-rust-800/50",
          title: "font-display font-semibold text-stone-800 dark:text-stone-100",
          description: "text-stone-500 dark:text-stone-400",
          actionButton: "bg-primary-600 text-cream rounded-lg font-medium",
          cancelButton: "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 rounded-lg",
          closeButton:
            "bg-stone-100 dark:bg-stone-800 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200",
        },
      }}
    />
  );
}
