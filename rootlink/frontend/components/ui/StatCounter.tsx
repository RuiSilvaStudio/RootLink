"use client";

import { useEffect, useRef, useState } from "react";

type Props = {
  value: number;
  label: string;
  duration?: number;
};

export function StatCounter({ value, label, duration = 1200 }: Props) {
  const [display, setDisplay] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (value === 0) return;

    setDisplay(0);
    const start = performance.now();
    let raf: number;

    const animate = (now: number) => {
      const elapsed = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      setDisplay(Math.round(eased * value));
      if (progress < 1) raf = requestAnimationFrame(animate);
    };
    raf = requestAnimationFrame(animate);

    return () => cancelAnimationFrame(raf);
  }, [value, duration]);

  return (
    <div data-rl-component="StatCounter" ref={ref} className="text-center">
      <div className="number-lg text-4xl sm:text-5xl text-stone-800 dark:text-stone-100">{display}</div>
      <p className="text-sm text-stone-500 dark:text-stone-400 mt-2 font-serif tracking-wide">{label}</p>
    </div>
  );
}
