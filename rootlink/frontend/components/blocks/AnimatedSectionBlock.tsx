/**
 * Animated section block — a page section with a full-bleed background
 * animation (one of 6 choices) and optional overlay content (badge,
 * heading, subtitle). Mirrors the HomeHeroBlock pattern: animation sits
 * at z-0 as an absolute layer, content at z-10.
 *
 * Spec: docs/content-studio/CONTENT_STUDIO.md §6.
 */

"use client";

import dynamic from "next/dynamic";
import { useLocale } from "@/lib/locale-context";
import { Badge } from "@/components/ui/Badge";
import { Text } from "@/components/ui/Text";
import { HeroParticleCanvas } from "@/components/ui/HeroParticleCanvas";
import { SeedsCanvas } from "@/components/ui/SeedsCanvas";

type BlockProps = { props: Record<string, string> };

// Vanta wrappers are client-only (they touch window); load lazily
const VantaHalo = dynamic(() => import("@/components/ui/VantaBackground").then(m => m.VantaHalo), { ssr: false });
const VantaBirds = dynamic(() => import("@/components/ui/VantaBackground").then(m => m.VantaBirds), { ssr: false });
const VantaClouds = dynamic(() => import("@/components/ui/VantaBackground").then(m => m.VantaClouds), { ssr: false });
const VantaTopology = dynamic(() => import("@/components/ui/VantaBackground").then(m => m.VantaTopology), { ssr: false });

const ANIMATIONS: Record<string, () => JSX.Element> = {
  particles: () => <HeroParticleCanvas />,
  seeds: () => <SeedsCanvas />,
  halo: () => <VantaHalo />,
  birds: () => <VantaBirds />,
  clouds: () => <VantaClouds />,
  topology: () => <VantaTopology />,
};

export function AnimatedSectionBlock({ props }: BlockProps) {
  const { t } = useLocale();
  const animKey = props.animation || "particles";
  const Animation = ANIMATIONS[animKey] || ANIMATIONS.particles;

  const hasContent = Boolean(props.badge || props.heading || props.subtitle);

  return (
    <section
      data-rl-component="AnimatedSectionBlock"
      className="relative min-h-[30vh] flex items-center justify-center py-12 overflow-hidden"
    >
      <Animation />
      <div className="absolute inset-0 z-[1] bg-gradient-to-b from-cream/60 via-cream/20 to-transparent dark:from-stone-950/70 dark:via-stone-950/30 dark:to-transparent pointer-events-none" />
      {hasContent && (
        <div className="relative z-10 max-w-4xl mx-auto text-center">
          {props.badge && (
            <Badge variant="sage" className="mb-6">{props.badge}</Badge>
          )}
          {props.heading && (
            <Text
              as="h1"
              k="animated_section.heading"
              className="text-4xl sm:text-5xl md:text-6xl font-display font-semibold text-stone-800 dark:text-stone-100 leading-[0.95] tracking-tight"
            >
              {props.heading || t("animated_section.heading")}
            </Text>
          )}
          {props.subtitle && (
            <Text
              as="p"
              k="animated_section.subtitle"
              className="text-lg sm:text-xl text-stone-500 dark:text-stone-300 mt-6 max-w-2xl mx-auto font-serif leading-relaxed"
            >
              {props.subtitle || t("animated_section.subtitle")}
            </Text>
          )}
        </div>
      )}
    </section>
  );
}
