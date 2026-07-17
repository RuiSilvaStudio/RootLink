"use client";

/**
 * Animated count-up number (group landing stats — mockup [data-count]).
 *
 * Self-contained per element and keyed to `value`: the old page-level GSAP
 * sweep registered its tweens on mount, BEFORE the API data arrived, so every
 * stat animated to 0 and stayed there. This re-animates whenever the real
 * value lands, still on scroll-into-view, still honoring reduced motion.
 */

import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";

export function CountUp({ value, className = "" }: { value: number; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null);

  useGSAP(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      el.textContent = String(value);
      return;
    }
    const state = { n: 0 };
    const tween = gsap.to(state, {
      n: value,
      duration: 1.2,
      ease: "power1.out",
      onUpdate: () => { el.textContent = String(Math.round(state.n)); },
      scrollTrigger: { trigger: el, start: "top 92%", once: true },
    });
    return () => { tween.scrollTrigger?.kill(); tween.kill(); };
  }, [value]);

  return (
    <span ref={ref} className={className} aria-label={String(value)}>
      0
    </span>
  );
}
