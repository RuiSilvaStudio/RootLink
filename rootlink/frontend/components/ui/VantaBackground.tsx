"use client";

import { useEffect, useRef } from "react";

/* ─── colour tokens (hex, for Vanta) ────────────────────────────── */
/* Vanta expects decimal integers (0xRRGGBB). We convert from hex.   */

const COLORS = {
  light: {
    background: 0xf8f6f2, // cream
    base: 0xad9a7a,      // primary-300
    baseDark: 0x4f3d2a,  // primary-700
    accent: 0x8c6b48,    // earth-500
    sky: 0xe8ddd0,       // earth-100
  },
  dark: {
    background: 0x0c0a09, // stone-950
    base: 0x6b5a42,      // primary-400 dimmed
    baseDark: 0x2a2118,
    accent: 0x5a432e,    // earth-700
    sky: 0x1a1614,
  },
};

type ColorSet = typeof COLORS.light;

/* ─── shared hook ─────────────────────────────────────────────────── */

function useIsDark() {
  const ref = useRef(false);
  useEffect(() => {
    const check = () => {
      ref.current = document.documentElement.classList.contains("dark");
    };
    check();
    const obs = new MutationObserver(check);
    obs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });
    return () => obs.disconnect();
  }, []);
  return ref;
}

/* ─── base Vanta wrapper ─────────────────────────────────────────── */

interface VantaWrapperProps {
  effect: "halo" | "birds" | "clouds" | "topology";
  /** Stable identifier for data-rl-component */
  componentId: string;
  /** Build the settings object from the active color set */
  buildSettings: (colors: ColorSet) => Record<string, unknown>;
}

function VantaBackground({ effect, componentId, buildSettings }: VantaWrapperProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const effectRef = useRef<{ destroy: () => void; resize: () => void } | null>(null);
  const isDark = useIsDark();
  const isDarkRef = useRef(false);
  const visibleRef = useRef(true);
  const prefersReducedRef = useRef(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // reduced motion → don't render the WebGL effect at all
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    prefersReducedRef.current = mql.matches;
    if (mql.matches) return;

    const onMql = () => {
      const nowReduced = mql.matches;
      if (nowReduced && !prefersReducedRef.current) {
        // turned on: destroy
        if (effectRef.current) {
          try { effectRef.current.destroy(); } catch {}
          effectRef.current = null;
        }
      } else if (!nowReduced && prefersReducedRef.current) {
        // turned off: re-init
        initEffect();
      }
      prefersReducedRef.current = nowReduced;
    };
    mql.addEventListener("change", onMql);

    // visibility: pause/resume via destroy/re-init
    const visObs = new IntersectionObserver(
      ([entry]) => {
        const wasVisible = visibleRef.current;
        visibleRef.current = entry.isIntersecting;
        if (entry.isIntersecting && !wasVisible && !prefersReducedRef.current) {
          initEffect();
        } else if (!entry.isIntersecting && wasVisible) {
          if (effectRef.current) {
            try { effectRef.current.destroy(); } catch {}
            effectRef.current = null;
          }
        }
      },
      { threshold: 0 },
    );
    visObs.observe(container);

    // dark mode re-init
    const onClassChange = () => {
      const nowDark = document.documentElement.classList.contains("dark");
      if (nowDark !== isDarkRef.current) {
        isDarkRef.current = nowDark;
        if (effectRef.current && visibleRef.current && !prefersReducedRef.current) {
          try { effectRef.current.destroy(); } catch {}
          effectRef.current = null;
          initEffect();
        }
      }
    };
    isDarkRef.current = document.documentElement.classList.contains("dark");
    const classObs = new MutationObserver(onClassChange);
    classObs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    // initial init
    initEffect();

    async function initEffect() {
      if (effectRef.current) return;
      if (prefersReducedRef.current || !visibleRef.current) return;

      try {
        // Resolve the Vanta factory — static import paths per effect so
        // webpack splits one chunk per effect and TS resolves types cleanly.
        let VANTA_FACTORY: (opts: Record<string, unknown>) => { destroy: () => void; resize: () => void };
        if (effect === "topology") {
          const p5Module = await import("p5");
          (window as any).p5 = (p5Module as any).default || p5Module;
          const m = await import("vanta/dist/vanta.topology.min.js");
          VANTA_FACTORY = m.default;
        } else if (effect === "halo") {
          const threeModule = await import("three");
          (window as any).THREE = threeModule;
          const m = await import("vanta/dist/vanta.halo.min.js");
          VANTA_FACTORY = m.default;
        } else if (effect === "birds") {
          const threeModule = await import("three");
          (window as any).THREE = threeModule;
          const m = await import("vanta/dist/vanta.birds.min.js");
          VANTA_FACTORY = m.default;
        } else if (effect === "clouds") {
          const threeModule = await import("three");
          (window as any).THREE = threeModule;
          const m = await import("vanta/dist/vanta.clouds.min.js");
          VANTA_FACTORY = m.default;
        } else {
          return;
        }

        const colors = isDarkRef.current ? COLORS.dark : COLORS.light;
        const settings = {
          el: container,
          mouseControls: false,
          touchControls: false,
          gyroControls: false,
          ...(effect !== "topology" && { THREE: (window as any).THREE }),
          ...buildSettings(colors),
        };
        effectRef.current = VANTA_FACTORY(settings);
      } catch (err) {
        console.error(`[VantaBackground:${effect}] init failed`, err);
      }
    }

    return () => {
      mql.removeEventListener("change", onMql);
      visObs.disconnect();
      classObs.disconnect();
      if (effectRef.current) {
        try { effectRef.current.destroy(); } catch {}
        effectRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effect]);

  return (
    <div
      ref={containerRef}
      data-rl-component={componentId}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    />
  );
}

/* ─── 4 named exports ────────────────────────────────────────────── */

export function VantaHalo() {
  return (
    <VantaBackground
      effect="halo"
      componentId="VantaHalo"
      buildSettings={(c) => ({
        backgroundColor: c.background,
        backgroundAlpha: 0,
        baseColor: c.baseDark,
        color2: c.base,
        amplitudeFactor: 2,
        ringFactor: 1,
        rotationFactor: 1,
        size: 2.7,
        speed: 1,
        xOffset: -0.28,
        yOffset: 0,
      })}
    />
  );
}

export function VantaBirds() {
  return (
    <VantaBackground
      effect="birds"
      componentId="VantaBirds"
      buildSettings={(c) => ({
        backgroundColor: c.background,
        backgroundAlpha: 0,
        color1: c.base,
        color2: c.accent,
        colorMode: "varianceGradient",
        quantity: 5,
        birdSize: 1,
        speedLimit: 5,
        alignment: 20,
        cohesion: 20,
        separation: 20,
        wingSpan: 30,
      })}
    />
  );
}

export function VantaClouds() {
  return (
    <VantaBackground
      effect="clouds"
      componentId="VantaClouds"
      buildSettings={(c) => ({
        // Clouds is a full sky scene — needs a solid bg, not transparent
        backgroundColor: c.background,
        backgroundAlpha: 1,
        skyColor: c.sky,
        cloudColor: c.base,
        cloudShadowColor: c.baseDark,
        sunColor: c.accent,
        sunGlareColor: c.base,
        sunlightColor: c.base,
        speed: 0.5,
      })}
    />
  );
}

export function VantaTopology() {
  return (
    <VantaBackground
      effect="topology"
      componentId="VantaTopology"
      buildSettings={(c) => ({
        backgroundColor: c.background,
        backgroundAlpha: 0,
        color: c.base,
      })}
    />
  );
}
