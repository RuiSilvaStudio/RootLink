"use client";

/**
 * Content Studio — inline load-error notice.
 *
 * Rendered in place of a studio page's main content when the initial data
 * load fails (e.g. backend unreachable), so a dead server never looks like
 * deleted content. Presentational only — the parent owns the retry.
 */

import { AlertTriangle } from "lucide-react";

interface LoadErrorProps {
  message?: string;
  onRetry: () => void;
}

export function LoadError({ message, onRetry }: LoadErrorProps) {
  return (
    <div className="flex items-start gap-3 p-4 rounded-lg border border-red-200 bg-red-50 text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-300">
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
      <div className="flex-1 min-w-0">
        <p className="text-sm">
          {message || "Couldn't load this data. The server may be unreachable."}
        </p>
        <button
          onClick={onRetry}
          className="mt-2.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-red-200 dark:border-red-900 bg-white dark:bg-stone-900 text-red-700 dark:text-red-300 hover:bg-red-100 dark:hover:bg-red-950/60 transition"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
