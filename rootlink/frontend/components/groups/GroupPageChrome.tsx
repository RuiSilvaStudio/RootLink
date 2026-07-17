"use client";

/**
 * Editorial chrome for group sub-pages — ports the mockup's `.page-hero` and
 * section-head patterns (discovery/mockups/group-landing-agency). These pages
 * are a public destination, not back-office: eyebrow + display headline with
 * the wonk'd last word + a quiet intro line.
 */

import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";

/** Splits the last word off so it can carry the wonk axis (mockup <em class="wonk">). */
function splitLastWord(title: string): [string, string] {
  const words = title.trim().split(" ");
  const last = words.pop() ?? "";
  return [words.join(" "), last];
}

export function GroupPageHero({ eyebrow, title, intro }: {
  eyebrow: string; title: string; intro?: string | null;
}) {
  const ref = useRef<HTMLElement>(null);
  const [head, tail] = splitLastWord(title);

  useGSAP(() => {
    if (!ref.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.fromTo(
      ref.current.children,
      { opacity: 0, y: 16 },
      { opacity: 1, y: 0, duration: 0.6, ease: "power3.out", stagger: 0.08 }
    );
  }, []);

  return (
    <header ref={ref} className="pt-10 sm:pt-14 pb-8 border-b border-primary-100 dark:border-stone-800">
      <p className="text-xs font-display font-semibold tracking-[0.22em] uppercase text-earth-500 mb-3">{eyebrow}</p>
      <h1
        className="font-display font-[560] text-primary-800 dark:text-primary-200 leading-[1.02] tracking-[-0.015em] text-[clamp(2.4rem,5.5vw,4rem)]"
        style={{ fontVariationSettings: '"opsz" 144' }}
      >
        {head && <>{head} </>}
        <em className="wonk not-italic">{tail}</em>
      </h1>
      {intro && <p className="mt-4 text-earth-500 font-serif max-w-[38em] leading-relaxed">{intro}</p>}
    </header>
  );
}

/** In-page section heading: eyebrow + smaller display h2 (mockup snippet-head). */
export function SectionHead({ eyebrow, title }: { eyebrow?: string; title: string }) {
  return (
    <div className="mb-6">
      {eyebrow && (
        <p className="text-xs font-display font-semibold tracking-[0.22em] uppercase text-earth-500 mb-2">{eyebrow}</p>
      )}
      <h2
        className="font-display font-[560] text-primary-800 dark:text-primary-200 leading-[1.05] tracking-[-0.015em] text-[clamp(1.5rem,2.8vw,2.2rem)]"
        style={{ fontVariationSettings: '"opsz" 144' }}
      >
        {title}
      </h2>
    </div>
  );
}
