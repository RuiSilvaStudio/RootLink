"use client";

/**
 * Editorial chrome for group sub-pages — ports the mockup's `.page-hero` and
 * section-head patterns. Overlay-aware: passes keys to `<Text>` so the overlay
 * can edit the copy inline; the wonk last-word split is preserved.
 */

import { useRef } from "react";
import { gsap, useGSAP } from "@/lib/gsap";
import { Text } from "@/components/ui/Text";
import { useLocale } from "@/lib/locale-context";

/** Splits the last word off so it can carry the wonk axis (mockup <em class="wonk">). */
function splitLastWord(title: string): [string, string] {
  const words = title.trim().split(" ");
  const last = words.pop() ?? "";
  return [words.join(" "), last];
}

export function GroupPageHero({ eyebrowKey, titleKey, introKey, intro }: {
  eyebrowKey: string;
  titleKey: string;
  /** Pass introKey for static marketing copy (overlay-editable); pass intro
   * for computed values (e.g. group.description — not editable). */
  introKey?: string;
  intro?: string | null;
}) {
  const ref = useRef<HTMLElement>(null);
  const { t } = useLocale();

  useGSAP(() => {
    if (!ref.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.fromTo(
      ref.current.children,
      { opacity: 0, y: 16 },
      { opacity: 1, y: 0, duration: 0.6, ease: "power3.out", stagger: 0.08 }
    );
  }, []);

  const [head, tail] = splitLastWord(t(titleKey));

  return (
    <header ref={ref} data-rl-component="GroupPageHero" className="pt-10 sm:pt-14 pb-8 border-b border-primary-100 dark:border-stone-800">
      <Text k={eyebrowKey} as="p" className="text-xs font-display font-semibold tracking-[0.22em] uppercase text-earth-500 mb-3" />
      <Text
        k={titleKey}
        as="h1"
        className="font-display font-[560] text-primary-800 dark:text-primary-200 leading-[1.02] tracking-[-0.015em] text-[clamp(2.4rem,5.5vw,4rem)]"
        style={{ fontVariationSettings: '"opsz" 144' }}
      >
        {head && <>{head} </>}<em className="wonk not-italic">{tail}</em>
      </Text>
      {introKey ? (
        <Text k={introKey} as="p" className="mt-4 text-earth-500 font-serif max-w-[38em] leading-relaxed" />
      ) : intro ? (
        <p className="mt-4 text-earth-500 font-serif max-w-[38em] leading-relaxed">{intro}</p>
      ) : null}
    </header>
  );
}

/** In-page section heading: eyebrow + smaller display h2 (mockup snippet-head). */
export function SectionHead({ eyebrowKey, titleKey }: { eyebrowKey: string; titleKey: string }) {
  return (
    <div className="mb-6" data-rl-component="SectionHead">
      <Text k={eyebrowKey} as="p" className="text-xs font-display font-semibold tracking-[0.22em] uppercase text-earth-500 mb-2" />
      <Text
        k={titleKey}
        as="h2"
        className="font-display font-[560] text-primary-800 dark:text-primary-200 leading-[1.05] tracking-[-0.015em] text-[clamp(1.5rem,2.8vw,2.2rem)]"
        style={{ fontVariationSettings: '"opsz" 144' }}
      />
    </div>
  );
}
