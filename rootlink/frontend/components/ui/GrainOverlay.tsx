"use client";

import { useRef } from "react";
import { useGSAP, gsap } from "@/lib/gsap";

interface GrainOverlayProps {
  opacity?: number;
  className?: string;
}

export function GrainOverlay({ opacity = 0.04, className = "" }: GrainOverlayProps) {
  const ref = useRef<HTMLDivElement>(null);
  useGSAP(() => {
    if (!ref.current) return;
    gsap.fromTo(ref.current, { opacity: 0 }, { opacity, duration: 0.3, ease: "power2.out" });
  }, { scope: ref });
  return (
    <div
      ref={ref}
      data-rl-component="GrainOverlay"
      className={`absolute inset-0 pointer-events-none overflow-hidden rounded-[inherit] ${className}`}
    >
      <div
        className="grain-animate absolute inset-[-50%] w-[200%] h-[200%]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='1'/%3E%3C/svg%3E")`,
          backgroundRepeat: "repeat",
          backgroundSize: "128px 128px",
        }}
      />
    </div>
  );
}
