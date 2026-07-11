"use client";

/**
 * ResizableSplit — a lightweight horizontal two-panel split with a drag handle.
 *
 * No external dependency. Uses pointer events for cross-device dragging,
 * keyboard arrows for accessibility, and double-click to reset.
 *
 * Each panel scrolls independently — the inner content divs keep their own
 * overflow-y-auto. The split itself only manages width.
 *
 * On mobile (below `lg`) it collapses to a stacked layout with no handle,
 * so pages that already have responsive stacking patterns keep working.
 *
 * Tailwind v4 note: `min-w-0` on both panels is essential — without it,
 * flex children refuse to shrink below content width and overflow breaks.
 */

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

interface ResizableSplitProps {
  left: ReactNode;
  right: ReactNode;
  defaultWidth: number;
  minWidth: number;
  maxWidth: number;
  className?: string;
  leftClassName?: string;
}

export function ResizableSplit({
  left,
  right,
  defaultWidth,
  minWidth,
  maxWidth,
  className = "",
  leftClassName = "",
}: ResizableSplitProps) {
  const [width, setWidth] = useState(defaultWidth);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const startXRef = useRef(0);
  const startWidthRef = useRef(0);

  const onPointerMove = useCallback(
    (e: PointerEvent) => {
      const delta = e.clientX - startXRef.current;
      const next = Math.min(maxWidth, Math.max(minWidth, startWidthRef.current + delta));
      setWidth(next);
    },
    [minWidth, maxWidth]
  );

  const onPointerUp = useCallback(() => {
    setIsDragging(false);
    document.removeEventListener("pointermove", onPointerMove);
    document.removeEventListener("pointerup", onPointerUp);
    document.body.style.userSelect = "";
    document.body.style.cursor = "";
  }, [onPointerMove]);

  const startDrag = useCallback(
    (e: React.PointerEvent) => {
      e.preventDefault();
      startXRef.current = e.clientX;
      startWidthRef.current = width;
      setIsDragging(true);
      document.body.style.userSelect = "none";
      document.body.style.cursor = "col-resize";
      document.addEventListener("pointermove", onPointerMove);
      document.addEventListener("pointerup", onPointerUp);
    },
    [width, onPointerMove, onPointerUp]
  );

  const onKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const step = e.shiftKey ? 48 : 16;
      if (e.key === "ArrowLeft") {
        e.preventDefault();
        setWidth((w) => Math.max(minWidth, w - step));
      } else if (e.key === "ArrowRight") {
        e.preventDefault();
        setWidth((w) => Math.min(maxWidth, w + step));
      } else if (e.key === "Enter" || e.key === " ") {
        e.preventDefault();
        setWidth(defaultWidth);
      }
    },
    [minWidth, maxWidth, defaultWidth]
  );

  const resetToDefault = useCallback(() => setWidth(defaultWidth), [defaultWidth]);

  useEffect(() => {
    return () => {
      document.removeEventListener("pointermove", onPointerMove);
      document.removeEventListener("pointerup", onPointerUp);
    };
  }, [onPointerMove, onPointerUp]);

  return (
    <div ref={containerRef} className={`flex min-h-0 min-w-0 ${className}`}>
      {/* Left panel */}
      <div
        className={`shrink-0 min-w-0 overflow-hidden ${leftClassName}`}
        style={{ width }}
        data-rl-component="ResizablePanel"
      >
        {left}
      </div>

      {/* Drag handle — desktop only */}
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label="Resize panels. Use arrow keys to adjust, Enter to reset."
        tabIndex={0}
        onPointerDown={startDrag}
        onDoubleClick={resetToDefault}
        onKeyDown={onKeyDown}
        className={`hidden lg:flex w-1 shrink-0 cursor-col-resize items-center justify-center relative group focus:outline-none ${
          isDragging ? "bg-primary-400/60" : "bg-primary-200/30 dark:bg-stone-800 hover:bg-primary-300/50 dark:hover:bg-stone-700"
        }`}
      >
        {/* Invisible hit target (wider than visible bar) */}
        <div className="absolute inset-y-0 -inset-x-1.5" />
        {/* Visible bar */}
        <div
          className={`w-px h-8 rounded-full transition-colors ${
            isDragging
              ? "bg-primary-500"
              : "bg-stone-300 dark:bg-stone-600 group-hover:bg-primary-400 dark:group-hover:bg-primary-500"
          }`}
        />
      </div>

      {/* Right panel */}
      <div className="flex-1 min-w-0 overflow-hidden" data-rl-component="ResizablePanel">
        {right}
      </div>
    </div>
  );
}
