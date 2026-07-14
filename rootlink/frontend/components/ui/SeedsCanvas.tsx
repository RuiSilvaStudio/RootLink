"use client";

import { useEffect, useRef, useCallback } from "react";

/* ─── colour tokens (RGBA) ──────────────────────────────────────── */

const LIGHT = {
  dot: [122, 96, 64, 0.45] as const,   // primary-500
  dotHi: [173, 154, 122, 0.65] as const, // primary-300
};

const DARK = {
  dot: [202, 189, 170, 0.45] as const,   // stone-300
  dotHi: [173, 154, 122, 0.6] as const,  // primary-300
};

type Palette = typeof LIGHT;

/* ─── helpers ────────────────────────────────────────────────────── */

function rgba(c: readonly number[], aOverride?: number) {
  return `rgba(${c[0]},${c[1]},${c[2]},${aOverride ?? c[3]})`;
}

/* ─── grid config ────────────────────────────────────────────────── */

const SEPARATION = 100;
const AMOUNTX = 100;
const AMOUNTY = 70;

interface Dot {
  baseX: number;
  baseZ: number;
}

/* ─── component ─────────────────────────────────────────────────── */

export function SeedsCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const dotsRef = useRef<Dot[]>([]);
  const isDarkRef = useRef(false);
  const prefersReducedRef = useRef(false);
  const visibleRef = useRef(true);
  const sizeRef = useRef({ w: 0, h: 0 });
  const cameraRotRef = useRef({ x: 0.5, y: 0 });

  const getPalette = useCallback(() => (isDarkRef.current ? DARK : LIGHT), []);

  /* ── init ─────────────────────────────────────────────────────── */

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d", { alpha: true });
    if (!ctx) return;

    // reduced motion
    const mql = window.matchMedia("(prefers-reduced-motion: reduce)");
    prefersReducedRef.current = mql.matches;
    const onMql = () => (prefersReducedRef.current = mql.matches);
    mql.addEventListener("change", onMql);

    // dark mode observer
    const onClassChange = () => {
      isDarkRef.current = document.documentElement.classList.contains("dark");
    };
    onClassChange();
    const observer = new MutationObserver(onClassChange);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    // build grid once (positions in world space)
    if (dotsRef.current.length === 0) {
      const dots: Dot[] = [];
      for (let ix = 0; ix < AMOUNTX; ix++) {
        for (let iy = 0; iy < AMOUNTY; iy++) {
          dots.push({
            baseX: ix * SEPARATION - ((AMOUNTX * SEPARATION) / 2),
            baseZ: iy * SEPARATION - ((AMOUNTY * SEPARATION) / 2),
          });
        }
      }
      dotsRef.current = dots;
    }

    // resize
    const resize = () => {
      const rect = canvas.parentElement?.getBoundingClientRect();
      if (!rect) return;
      const dpr = window.devicePixelRatio || 1;
      const w = rect.width;
      const h = rect.height;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      sizeRef.current = { w, h };
    };
    resize();
    const resizeObs = new ResizeObserver(resize);
    if (canvas.parentElement) resizeObs.observe(canvas.parentElement);

    // visibility (pause when scrolled out)
    const visObs = new IntersectionObserver(
      ([entry]) => {
        visibleRef.current = entry.isIntersecting;
      },
      { threshold: 0 },
    );
    if (canvas.parentElement) visObs.observe(canvas.parentElement);

    /* ── animation loop ─────────────────────────────────────────── */

    let count = 0;
    let prevTime = 0;

    const render = (time: number) => {
      const { w, h } = sizeRef.current;
      if (w === 0) return;

      ctx.clearRect(0, 0, w, h);

      const pal = getPalette();

      // camera-like perspective parameters
      const camZ = 1000;
      const fov = 120;
      const cx = w / 2;
      const cy = h / 2;
      const camRotX = cameraRotRef.current.x;
      const camRotY = cameraRotRef.current.y;

      // draw dots
      let i = 0;
      for (let ix = 0; ix < AMOUNTX; ix++) {
        for (let iy = 0; iy < AMOUNTY; iy++) {
          const dot = dotsRef.current[i++];
          if (!dot) continue;

          // wave displacement on Y
          const y =
            Math.sin((ix + count) * 0.3) * 50 +
            Math.sin((iy + count) * 0.5) * 50;

          // world coords
          let wx = dot.baseX;
          let wy = y;
          let wz = dot.baseZ;

          // rotate around X axis (tilt forward)
          let ry = wy * Math.cos(camRotX) - wz * Math.sin(camRotX);
          let rz = wy * Math.sin(camRotX) + wz * Math.cos(camRotX);

          // subtle rotation around Y
          let rx2 = wx * Math.cos(camRotY) + rz * Math.sin(camRotY);
          rz = -wx * Math.sin(camRotY) + rz * Math.cos(camRotY);
          wx = rx2;

          // perspective projection
          const depth = camZ - rz;
          if (depth <= 1) continue;
          const scale = fov / depth;
          const px = cx + wx * scale;
          const py2 = cy + ry * scale;

          if (px < -20 || px > w + 20 || py2 < -20 || py2 > h + 20) continue;

          // dot size with wave pulse
          const pulse =
            (Math.sin((ix + count) * 0.3) + 1) * 2 +
            (Math.sin((iy + count) * 0.5) + 1) * 2;
          const radius = Math.max(0.4, pulse * scale * 0.15);

          // depth-based alpha (closer = brighter)
          const depthNorm = Math.max(0, Math.min(1, 1 - rz / 4000));
          const alpha = 0.15 + depthNorm * 0.5;
          const color = depthNorm > 0.6 ? pal.dotHi : pal.dot;

          ctx.beginPath();
          ctx.arc(px, py2, radius, 0, Math.PI * 2);
          ctx.fillStyle = rgba(color, alpha);
          ctx.fill();
        }
      }
    };

    const loop = (time: number) => {
      animRef.current = requestAnimationFrame(loop);

      if (!visibleRef.current) return;

      if (prefersReducedRef.current) {
        // draw one static frame then stop requesting
        render(time);
        return;
      }

      const dt = time - prevTime;
      prevTime = time;
      if (dt > 200) return; // tab was hidden

      // gentle camera drift
      cameraRotRef.current.y = Math.sin(time * 0.00008) * 0.15;

      render(time);
      count += 0.1;
    };

    animRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animRef.current);
      mql.removeEventListener("change", onMql);
      observer.disconnect();
      resizeObs.disconnect();
      visObs.disconnect();
    };
  }, [getPalette]);

  return (
    <canvas
      data-rl-component="SeedsCanvas"
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0"
      style={{ willChange: "transform" }}
    />
  );
}
