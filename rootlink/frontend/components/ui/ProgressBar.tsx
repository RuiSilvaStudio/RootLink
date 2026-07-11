"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  value: number;
  max?: number;
  label?: string;
  showPercent?: boolean;
  size?: "sm" | "md";
  variant?: "primary" | "earth";
  className?: string;
};

export function ProgressBar({ value, max = 100, label, showPercent = true, size = "md", variant = "primary", className = "" }: Props) {
  const [width, setWidth] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const animated = useRef(false);
  const pct = Math.min(Math.round((value / max) * 100), 100);

  useEffect(() => {
    const el = ref.current;
    if (!el || animated.current) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting && !animated.current) {
          animated.current = true;
          setTimeout(() => setWidth(pct), 100);
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [pct]);

  const barColor = variant === "primary"
    ? "bg-primary-500"
    : "bg-earth-500";

  return (
    <div data-rl-component="ProgressBar" ref={ref} className={`space-y-2 ${className}`}>
      {(label || showPercent) && (
        <div className="flex justify-between items-center">
          {label && <span className="text-sm font-serif text-stone-600 dark:text-stone-300">{label}</span>}
          {showPercent && <span className="text-sm font-display text-stone-400 dark:text-stone-500">{pct}%</span>}
        </div>
      )}
      <div className={`w-full bg-primary-100/50 dark:bg-primary-900/30 rounded-full overflow-hidden ${size === "sm" ? "h-1.5" : "h-2.5"}`}>
        <div
          className={`${barColor} h-full rounded-full transition-all duration-1000 ease-out`}
          style={{ width: `${width}%` }}
        />
      </div>
    </div>
  );
}
