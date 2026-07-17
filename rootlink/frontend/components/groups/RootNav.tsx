"use client";

/**
 * Floating root-nav panel — the signature element from the approved
 * group-landing mockup (discovery/mockups/group-landing-agency/index.html,
 * .rootnav). A vertical pill capsule fixed to the RIGHT edge: node dots on a
 * stem that fills with rust as you scroll, labels floating out on
 * hover/active, a leaf at the tip.
 *
 * Per the definition doc: tabs = pages, this panel = in-page anchors.
 * It hides itself when fewer than 2 sections are visible.
 */

import { useEffect, useRef, useState } from "react";
import { gsap, useGSAP, ScrollTrigger } from "@/lib/gsap";

export interface RootNavSection {
  id: string;
  label: string;
}

export function RootNav({ sections }: { sections: RootNavSection[] }) {
  const [active, setActive] = useState<string | null>(sections[0]?.id ?? null);
  const panelRef = useRef<HTMLElement>(null);
  const stemFillRef = useRef<HTMLSpanElement>(null);

  useGSAP(() => {
    if (!panelRef.current || sections.length < 2) return;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduced) {
      gsap.fromTo(
        panelRef.current,
        { opacity: 0, x: 12 },
        { opacity: 1, x: 0, duration: 0.6, ease: "power3.out", delay: 0.4, clearProps: "transform" }
      );
    }
    // Stem fills with rust as the page scrolls (mockup .stem i)
    if (stemFillRef.current) {
      gsap.fromTo(
        stemFillRef.current,
        { scaleY: 0 },
        {
          scaleY: 1,
          ease: "none",
          scrollTrigger: {
            trigger: document.documentElement,
            start: "top top",
            end: "bottom bottom",
            scrub: 0.4,
          },
        }
      );
    }
    return () => { ScrollTrigger.getAll().forEach(st => { if (st.trigger === document.documentElement) st.kill(); }); };
  }, [sections.length]);

  useEffect(() => {
    if (sections.length < 2) return;
    const observers: IntersectionObserver[] = [];
    for (const s of sections) {
      const el = document.getElementById(s.id);
      if (!el) continue;
      const obs = new IntersectionObserver(
        entries => {
          for (const entry of entries) {
            if (entry.isIntersecting) setActive(s.id);
          }
        },
        { rootMargin: "-40% 0px -55% 0px" }
      );
      obs.observe(el);
      observers.push(obs);
    }
    return () => observers.forEach(o => o.disconnect());
  }, [sections]);

  // The panel only earns its place with 2+ sections (definition doc §9)
  if (sections.length < 2) return null;

  const scrollTo = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <nav
      ref={panelRef}
      aria-label="Secções"
      className="hidden lg:flex flex-col items-center fixed right-4 top-1/2 -translate-y-1/2 z-40 px-1.5 py-4 rounded-full bg-white/70 dark:bg-stone-900/70 backdrop-blur-md border border-primary-100 dark:border-stone-800 shadow-[0_10px_40px_rgba(36,26,16,0.10)]"
    >
      {/* Stem + scroll-progress fill */}
      <span aria-hidden className="absolute top-9 bottom-9 w-0.5 rounded-full bg-primary-100 dark:bg-stone-700 overflow-hidden">
        <span ref={stemFillRef} className="absolute inset-0 origin-top bg-gradient-to-b from-rust-500 to-rust-300" style={{ transform: "scaleY(0)" }} />
      </span>

      {sections.map(s => {
        const isActive = active === s.id;
        return (
          <button
            key={s.id}
            onClick={() => scrollTo(s.id)}
            aria-current={isActive ? "true" : undefined}
            aria-label={s.label}
            className="group relative z-[1] w-[30px] h-[30px] my-0.5 grid place-items-center"
          >
            {/* node dot */}
            <span
              aria-hidden
              className={`rounded-full transition-all duration-300 ${
                isActive
                  ? "w-[13px] h-[13px] bg-rust-500 ring-[5px] ring-rust-500/15"
                  : "w-[9px] h-[9px] bg-primary-200 dark:bg-stone-600 group-hover:bg-earth-500"
              }`}
            />
            {/* floating label pill (left of the dot) */}
            <span
              className={`absolute right-[calc(100%+0.8rem)] top-1/2 -translate-y-1/2 px-2.5 py-1 rounded-full text-xs font-display font-semibold whitespace-nowrap bg-white dark:bg-stone-900 border border-primary-100 dark:border-stone-700 text-primary-700 dark:text-primary-300 shadow-[0_6px_20px_rgba(36,26,16,0.08)] pointer-events-none transition-all duration-200 ${
                isActive ? "opacity-100 translate-x-0" : "opacity-0 translate-x-1.5 group-hover:opacity-100 group-hover:translate-x-0"
              }`}
            >
              {s.label}
            </span>
          </button>
        );
      })}

      {/* Leaf tip (mockup .leaf) */}
      <svg aria-hidden className="mt-1.5 text-rust-500" width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <path d="M12 22c5-3 8-7.5 8-12.5C20 5 17 2 12 2S4 5 4 9.5C4 14.5 7 19 12 22Zm0-17c.5 2.5.5 7 0 12-.5-5-.5-9.5 0-12Z" />
      </svg>
    </nav>
  );
}

/**
 * Scroll-reveal wrapper for group page sections — the mockup's fade-up
 * entrance, driven by ScrollTrigger, respecting prefers-reduced-motion.
 */
export function Reveal({ children, id, className = "" }: {
  children: React.ReactNode; id?: string; className?: string;
}) {
  const ref = useRef<HTMLElement>(null);

  useGSAP(() => {
    if (!ref.current) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.fromTo(
      ref.current,
      { opacity: 0, y: 24 },
      {
        opacity: 1, y: 0, duration: 0.7, ease: "power3.out",
        scrollTrigger: { trigger: ref.current, start: "top 85%", once: true },
      }
    );
  }, []);

  return (
    <section id={id} ref={ref} className={`scroll-mt-32 ${className}`}>
      {children}
    </section>
  );
}
