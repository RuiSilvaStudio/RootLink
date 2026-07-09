"use client";

/**
 * De facto components — repeated UI patterns extracted into named components.
 *
 * These patterns appeared 5-50× across the codebase as inline JSX. Extracting
 * them into named components with data-rl-component attributes lets the visual
 * overlay's selection agent recognize them as single selectable units instead
 * of raw DOM elements.
 *
 * Spec: docs/content-studio/CONTENT_STUDIO.md (component catalog, Phase A-D).
 */

import { ReactNode } from "react";
import Link from "next/link";
import { ArrowRight, LucideIcon } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

// ══════════════════════════════════════════════════════════════════
// 1. IconContainer — the most repeated pattern (50+ occurrences)
// ══════════════════════════════════════════════════════════════════

const ICON_SIZES = {
  sm: "w-8 h-8",
  md: "w-10 h-10",
  lg: "w-12 h-12",
  xl: "w-14 h-14",
  "2xl": "w-16 h-16",
};

const ICON_INNER = {
  sm: "w-4 h-4",
  md: "w-5 h-5",
  lg: "w-6 h-6",
  xl: "w-7 h-7",
  "2xl": "w-8 h-8",
};

const SHAPES = {
  xl: "rounded-xl",
  "2xl": "rounded-2xl",
  full: "rounded-full",
};

interface IconContainerProps {
  icon: LucideIcon;
  size?: keyof typeof ICON_SIZES;
  shape?: keyof typeof SHAPES;
  bgColor?: string; // e.g. "bg-primary-100 dark:bg-primary-950/20"
  iconColor?: string; // e.g. "text-primary-600"
  hoverScale?: boolean;
  className?: string;
}

export function IconContainer({
  icon: Icon,
  size = "md",
  shape = "xl",
  bgColor = "bg-primary-100 dark:bg-primary-950/20",
  iconColor = "text-primary-600",
  hoverScale = false,
  className = "",
}: IconContainerProps) {
  return (
    <div
      data-rl-component="IconContainer"
      className={`flex items-center justify-center shrink-0 ${ICON_SIZES[size]} ${SHAPES[shape]} ${bgColor} ${hoverScale ? "group-hover:scale-110 transition-transform duration-300" : ""} ${className}`}
    >
      <Icon className={`${ICON_INNER[size]} ${iconColor}`} />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// 2. SectionHeader — badge + h2 + editorial rule (every HomeBlock/PageBlock)
// ══════════════════════════════════════════════════════════════════

interface SectionHeaderProps {
  badge?: ReactNode;
  heading: ReactNode;
  badgeVariant?: "sage" | "green" | "earth" | "blue" | "stone" | "amber" | "red";
  className?: string;
}

export function SectionHeader({ badge, heading, badgeVariant = "sage", className = "" }: SectionHeaderProps) {
  return (
    <div data-rl-component="SectionHeader" className={`mb-16 ${className}`}>
      {badge && <Badge variant={badgeVariant} className="mb-5">{badge}</Badge>}
      <h2 className="text-4xl sm:text-5xl font-display font-semibold text-stone-800 dark:text-stone-100 leading-[1.05] max-w-2xl">
        {heading}
      </h2>
      <div className="mt-5 w-16 h-0.5 bg-primary-300/40 rounded-full" />
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// 3. LinkWithArrow — "Explore →" pattern (5+ sites)
// ══════════════════════════════════════════════════════════════════

interface LinkWithArrowProps {
  href: string;
  children: ReactNode;
  className?: string;
  target?: string;
  rel?: string;
}

export function LinkWithArrow({ href, children, className = "", target, rel }: LinkWithArrowProps) {
  return (
    <Link
      href={href}
      data-rl-component="LinkWithArrow"
      target={target}
      rel={rel}
      className={`inline-flex items-center gap-2 text-sm font-display font-medium text-primary-600 mt-6 group-hover:gap-3 transition-all ${className}`}
    >
      {children}
      <ArrowRight className="w-3.5 h-3.5" />
    </Link>
  );
}

// ══════════════════════════════════════════════════════════════════
// 4. FilterPill — family/content-type pill button (events/search/marketplace)
// ══════════════════════════════════════════════════════════════════

interface FilterPillProps {
  label: string;
  active?: boolean;
  onClick?: () => void;
}

export function FilterPill({ label, active = false, onClick }: FilterPillProps) {
  return (
    <button
      data-rl-component="FilterPill"
      onClick={onClick}
      className={`px-3 py-1.5 text-sm rounded-xl border transition-all ${
        active
          ? "bg-primary-500 text-white border-primary-500 shadow-sm"
          : "bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 border-primary-100 dark:border-stone-700 hover:border-primary-300"
      }`}
    >
      {label}
    </button>
  );
}

// ══════════════════════════════════════════════════════════════════
// 5. SidebarWidget — unifies MoonWidget/SunWidget/RelatedGroups/SpeciesWidget
// ══════════════════════════════════════════════════════════════════

interface SidebarWidgetProps {
  icon: LucideIcon;
  title: string;
  children: ReactNode;
  className?: string;
}

export function SidebarWidget({ icon: Icon, title, children, className = "" }: SidebarWidgetProps) {
  return (
    <div
      data-rl-component="SidebarWidget"
      className={`rounded-2xl border border-stone-200/60 bg-white dark:bg-stone-900 p-4 ${className}`}
    >
      <div className="flex items-center gap-2 mb-3">
        <Icon className="w-4 h-4 text-stone-500" />
        <h3 className="text-xs font-display font-semibold text-stone-500 uppercase tracking-wider">{title}</h3>
      </div>
      {children}
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// 6. RankedListRow — gold/silver/bronze leaderboard row
// ══════════════════════════════════════════════════════════════════

interface RankedListRowProps {
  rank: number;
  name: string;
  avatarUrl?: string | null;
  amount: string;
  tierLabel?: string;
}

export function RankedListRow({ rank, name, avatarUrl, amount, tierLabel }: RankedListRowProps) {
  const tierStyles = [
    "bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/30",
    "bg-stone-50 dark:bg-stone-800/50 border-stone-200 dark:border-stone-700",
    "bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800/30",
  ];
  const rankColors = [
    "text-amber-600 dark:text-amber-400",
    "text-stone-500 dark:text-stone-400",
    "text-orange-600 dark:text-orange-400",
  ];
  const tierIdx = rank <= 3 ? rank - 1 : 3;

  return (
    <div
      data-rl-component="RankedListRow"
      className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${tierIdx < 3 ? tierStyles[tierIdx] : "bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-700"}`}
    >
      <div className="flex items-center gap-4">
        <span className={`text-lg font-display font-bold w-8 ${tierIdx < 3 ? rankColors[tierIdx] : "text-stone-400 dark:text-stone-500"}`}>
          {rank}
        </span>
        {avatarUrl ? (
          <img src={avatarUrl} alt="" className="w-10 h-10 rounded-full" />
        ) : (
          <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-sm font-medium text-primary-700 dark:text-primary-400">
            {name[0]}
          </div>
        )}
        <div>
          <p className="text-sm font-medium text-stone-700 dark:text-stone-300">{name}</p>
          {tierLabel && rank <= 3 && (
            <p className="text-xs text-stone-400 dark:text-stone-500">{tierLabel}</p>
          )}
        </div>
      </div>
      <span className="text-sm font-display font-semibold text-primary-600 dark:text-primary-400">{amount}</span>
    </div>
  );
}

// ══════════════════════════════════════════════════════════════════
// 7. ResultCard — unifies ArticleCard/EventCard/GroupCard/CourseCard/PlantCard
// ══════════════════════════════════════════════════════════════════

interface ResultCardProps {
  href: string;
  title: string;
  summary?: string;
  thumbnail?: ReactNode;
  badges?: ReactNode;
  accent?: string; // border/bg accent color class
  target?: string;
  rel?: string;
  className?: string;
}

export function ResultCard({
  href,
  title,
  summary,
  thumbnail,
  badges,
  accent = "primary",
  target,
  rel,
  className = "",
}: ResultCardProps) {
  return (
    <Link
      href={href}
      data-rl-component="ResultCard"
      target={target}
      rel={rel}
      className={`group block rounded-2xl border border-${accent}-200/60 bg-white dark:bg-stone-900 p-5 transition-all hover:shadow-md hover:border-${accent}-300/60 ${className}`}
    >
      <div className="flex items-start gap-4">
        {thumbnail}
        <div className="flex-1 min-w-0">
          {badges && <div className="flex items-center gap-2 mb-1">{badges}</div>}
          <h3 className="text-base font-display font-semibold text-stone-800 dark:text-stone-100">{title}</h3>
          {summary && <p className="text-sm text-stone-500 mt-1.5 line-clamp-2 font-serif">{summary}</p>}
        </div>
      </div>
    </Link>
  );
}
