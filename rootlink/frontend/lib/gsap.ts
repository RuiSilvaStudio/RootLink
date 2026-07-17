"use client";

import { useState, useRef, useEffect } from "react";
import { useGSAP } from "@gsap/react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger, useGSAP);

export { gsap, ScrollTrigger, useGSAP };

/**
 * GSAP replacement for Framer Motion's AnimatePresence pattern.
 *
 * Manages the render/unmount lifecycle: when `open` becomes true, renders the
 * element and animates it in. When `open` becomes false, animates out then
 * unmounts — matching AnimatePresence's behavior without the Framer Motion
 * dependency.
 *
 * Usage:
 *   const { ref, shouldRender } = useGSAPToggle(isOpen);
 *   return shouldRender ? <div ref={ref}>...</div> : null;
 */
export function useGSAPToggle(
  open: boolean,
  opts: {
    duration?: number;
    from?: gsap.TweenVars;
    to?: gsap.TweenVars;
  } = {}
) {
  const { duration = 0.15, from, to } = opts;
  const ref = useRef<HTMLDivElement>(null);
  const [shouldRender, setShouldRender] = useState(open);

  useGSAP(
    () => {
      if (open) {
        setShouldRender(true);
        // animate in on next frame (after render)
        requestAnimationFrame(() => {
          if (!ref.current) return;
          gsap.fromTo(
            ref.current,
            { opacity: 0, y: 4, scale: 0.98, ...from },
            { opacity: 1, y: 0, scale: 1, duration, ease: "power2.out", ...to }
          );
        });
      } else if (shouldRender) {
        if (!ref.current) {
          setShouldRender(false);
          return;
        }
        gsap.to(ref.current, {
          opacity: 0,
          y: 4,
          scale: 0.98,
          duration,
          ease: "power2.in",
          onComplete: () => setShouldRender(false),
          ...to,
        });
      }
    },
    { dependencies: [open], scope: ref }
  );

  return { ref, shouldRender };
}

/**
 * GSAP page transition hook for Next.js App Router.
 *
 * Animates the main content on route change. Unlike Framer Motion's
 * AnimatePresence, this does NOT set initial opacity:0 in the server HTML —
 * it animates from 0 on the client only, so content is never invisible if
 * JS fails or is slow to load.
 */
export function useGSAPPageTransition(pathname: string) {
  const ref = useRef<HTMLElement>(null);

  useGSAP(
    () => {
      if (!ref.current) return;
      gsap.fromTo(
        ref.current,
        { opacity: 0, y: 8 },
        {
          opacity: 1,
          y: 0,
          duration: 0.25,
          ease: "power2.out",
          // CRITICAL: clear the inline transform when done. A leftover
          // `transform` on <main> (even the identity translate(0,0)) makes it
          // the containing block for ALL `position: fixed` descendants —
          // fixed panels/preloaders then scroll away with the page instead of
          // pinning to the viewport. (LESSONS.md #51)
          clearProps: "transform,opacity",
        }
      );
    },
    { dependencies: [pathname], scope: ref }
  );

  return ref;
}
