"use client";

import { useEffect, useRef, useCallback } from "react";

/* ─── colour tokens (RGBA) ──────────────────────────────────────── */

const LIGHT = {
  bg: [248, 246, 242] as const,           // cream
  blobs: [
    [173, 154, 122, 0.10],                // primary-300
    [187, 160, 128, 0.09],                // earth-300
    [207, 155, 122, 0.08],                // rust-300
    [145, 122, 86, 0.07],                 // primary-400
  ] as readonly (readonly number[])[],
  particles: [122, 96, 64, 0.12] as const, // primary-500 light dots
};

const DARK = {
  bg: [12, 10, 9] as const,               // stone-950
  blobs: [
    [173, 154, 122, 0.06],                // primary-300 (dimmer)
    [187, 160, 128, 0.05],                // earth-300
    [207, 155, 122, 0.05],                // rust-300
    [105, 90, 60, 0.04],                  // earth-600
  ] as readonly (readonly number[])[],
  particles: [202, 189, 170, 0.18] as const, // stone-300 light dots
};

/* ─── helpers ────────────────────────────────────────────────────── */

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function rgba(c: readonly number[], aOverride?: number) {
  return `rgba(${c[0]},${c[1]},${c[2]},${aOverride ?? c[3]})`;
}

/* ─── blob (organic morphing shape) ─────────────────────────────── */

interface Blob {
  x: number;
  y: number;
  radius: number;
  /** control-point angle offsets — each oscillates independently */
  cpOffsets: number[];
  /** phase offsets so blobs don't sync */
  phases: number[];
  /** speed per control point */
  speeds: number[];
  /** base angle between control points */
  cpCount: number;
  /** fill colour */
  color: readonly number[];
  alpha: number;
  /** movement vector */
  vx: number;
  vy: number;
}

function createBlob(
  w: number,
  h: number,
  palette: readonly (readonly number[])[],
): Blob {
  const cpCount = 5 + Math.floor(Math.random() * 2); // 5 or 6
  const color = palette[Math.floor(Math.random() * palette.length)];
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    radius: Math.min(w, h) * (0.12 + Math.random() * 0.14),
    cpOffsets: Array.from({ length: cpCount }, () => (Math.random() - 0.5) * 0.6),
    phases: Array.from({ length: cpCount }, () => Math.random() * Math.PI * 2),
    speeds: Array.from({ length: cpCount }, () => 0.3 + Math.random() * 0.5),
    cpCount,
    color,
    alpha: color[3],
    vx: (Math.random() - 0.5) * 0.15,
    vy: (Math.random() - 0.5) * 0.1,
  };
}

function drawBlob(ctx: CanvasRenderingContext2D, b: Blob, time: number, w: number, h: number) {
  // drift
  b.x += b.vx;
  b.y += b.vy;

  // wrap around softly
  if (b.x < -b.radius * 2) b.x = w + b.radius;
  if (b.x > w + b.radius * 2) b.x = -b.radius;
  if (b.y < -b.radius * 2) b.y = h + b.radius;
  if (b.y > h + b.radius * 2) b.y = -b.radius;

  // breathing scale
  const breathe = 1 + Math.sin(time * 0.0004 + b.phases[0]) * 0.08;
  const r = b.radius * breathe;

  ctx.beginPath();

  const points: { x: number; y: number }[] = [];
  for (let i = 0; i < b.cpCount; i++) {
    const angle = (i / b.cpCount) * Math.PI * 2;
    const offset =
      Math.sin(time * 0.0005 * b.speeds[i] + b.phases[i]) * b.cpOffsets[i];
    const pr = r * (1 + offset);
    points.push({
      x: b.x + Math.cos(angle) * pr,
      y: b.y + Math.sin(angle) * pr,
    });
  }

  // draw smooth closed curve through points
  if (points.length < 3) return;

  ctx.moveTo(
    (points[points.length - 1].x + points[0].x) / 2,
    (points[points.length - 1].y + points[0].y) / 2,
  );

  for (let i = 0; i < points.length; i++) {
    const next = points[(i + 1) % points.length];
    const mx = (points[i].x + next.x) / 2;
    const my = (points[i].y + next.y) / 2;
    ctx.quadraticCurveTo(points[i].x, points[i].y, mx, my);
  }

  ctx.closePath();

  ctx.fillStyle = rgba(b.color, b.alpha * breathe);
  ctx.fill();
}

/* ─── particle (small floating dot) ─────────────────────────────── */

interface Particle {
  x: number;
  y: number;
  r: number;
  alpha: number;
  /** parallax depth multiplier — higher = moves faster on scroll */
  depth: number;
  vx: number;
  vy: number;
  /** horizontal wobble amplitude */
  wobbleAmp: number;
  wobbleSpeed: number;
  wobblePhase: number;
  color: readonly number[];
}

function createParticle(
  w: number,
  h: number,
  color: readonly number[],
): Particle {
  return {
    x: Math.random() * w,
    y: Math.random() * h,
    r: 1 + Math.random() * 2.5,
    alpha: 0.08 + Math.random() * 0.14,
    depth: 0.2 + Math.random() * 0.8,
    vx: (Math.random() - 0.5) * 0.08,
    vy: -(0.05 + Math.random() * 0.12), // gentle upward drift
    wobbleAmp: 0.3 + Math.random() * 0.8,
    wobbleSpeed: 0.0006 + Math.random() * 0.001,
    wobblePhase: Math.random() * Math.PI * 2,
    color,
  };
}

function drawParticle(
  ctx: CanvasRenderingContext2D,
  p: Particle,
  time: number,
  scrollY: number,
  w: number,
  h: number,
) {
  // wobble
  const wobbleX = Math.sin(time * p.wobbleSpeed + p.wobblePhase) * p.wobbleAmp;

  // parallax offset based on scroll
  const parallaxOffset = scrollY * p.depth * 0.08;

  let px = p.x + wobbleX;
  let py = p.y - parallaxOffset;

  // wrap
  py = ((py % h) + h) % h;
  px = ((px % w) + w) % w;

  // drift
  p.x += p.vx;
  p.y += p.vy;
  if (p.y < -10) {
    p.y = h + 10;
    p.x = Math.random() * w;
  }

  // pulse
  const pulse = 1 + Math.sin(time * 0.001 + p.wobblePhase) * 0.3;

  ctx.beginPath();
  ctx.arc(px, py, p.r, 0, Math.PI * 2);
  ctx.fillStyle = rgba(p.color, p.alpha * pulse);
  ctx.fill();
}

/* ─── component ─────────────────────────────────────────────────── */

export function HeroParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animRef = useRef<number>(0);
  const blobsRef = useRef<Blob[]>([]);
  const particlesRef = useRef<Particle[]>([]);
  const scrollRef = useRef(0);
  const isDarkRef = useRef(false);
  const prefersReducedRef = useRef(false);
  const visibleRef = useRef(true);
  const sizeRef = useRef({ w: 0, h: 0 });

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
      // re-seed particle colours when mode changes
      const pal = getPalette();
      particlesRef.current.forEach((p) => {
        p.color = pal.particles;
      });
    };
    onClassChange(); // initial check
    const observer = new MutationObserver(onClassChange);
    observer.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["class"],
    });

    // scroll
    const onScroll = () => (scrollRef.current = window.scrollY);
    window.addEventListener("scroll", onScroll, { passive: true });

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

      // re-seed blobs on first resize or significant size change
      const pal = getPalette();
      if (blobsRef.current.length === 0) {
        blobsRef.current = Array.from({ length: 6 }, () =>
          createBlob(w, h, pal.blobs),
        );
        particlesRef.current = Array.from({ length: 40 }, () =>
          createParticle(w, h, pal.particles),
        );
      }
    };
    resize();
    const resizeObs = new ResizeObserver(resize);
    if (canvas.parentElement) resizeObs.observe(canvas.parentElement);

    // visibility (pause when hero scrolls out)
    const visObs = new IntersectionObserver(
      ([entry]) => {
        visibleRef.current = entry.isIntersecting;
      },
      { threshold: 0 },
    );
    if (canvas.parentElement) visObs.observe(canvas.parentElement);

    /* ── animation loop ─────────────────────────────────────────── */

    let prevTime = 0;

    const loop = (time: number) => {
      animRef.current = requestAnimationFrame(loop);

      if (!visibleRef.current) return;
      if (prefersReducedRef.current) {
        // draw static blobs once, then stop
        const { w, h } = sizeRef.current;
        if (w === 0) return;
        ctx.clearRect(0, 0, w, h);
        const pal = getPalette();
        blobsRef.current.forEach((b) => drawBlob(ctx, b, 0, w, h));
        return;
      }

      const dt = time - prevTime;
      prevTime = time;
      if (dt > 200) return; // tab was hidden, skip

      const { w, h } = sizeRef.current;
      if (w === 0) return;

      ctx.clearRect(0, 0, w, h);

      // draw blobs (back layer)
      blobsRef.current.forEach((b) => drawBlob(ctx, b, time, w, h));

      // draw particles (front layer)
      particlesRef.current.forEach((p) =>
        drawParticle(ctx, p, time, scrollRef.current, w, h),
      );
    };

    animRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(animRef.current);
      mql.removeEventListener("change", onClassChange);
      observer.disconnect();
      window.removeEventListener("scroll", onScroll);
      resizeObs.disconnect();
      visObs.disconnect();
    };
  }, [getPalette]);

  return (
    <canvas
      data-rl-component="HeroParticleCanvas"
      ref={canvasRef}
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 z-0"
      style={{ willChange: "transform" }}
    />
  );
}
