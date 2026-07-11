"use client";

/**
 * Hand-crafted CSS previews for the Element Catalog.
 *
 * Each component type gets a unique visual approximation built from CSS.
 * Images are represented with a distinct mountain-glyph placeholder.
 * Text content uses real sample text, not gray bars.
 */

import { createContext, useContext, type ReactNode } from "react";

const PreviewContext = createContext(false);
const useLarge = () => useContext(PreviewContext);

// ── Small building blocks ────────────────────────────────────────────────

/** A text line — replaces gray Bar where actual text content would appear. */
function TextLine({ text, className = "" }: { text: string; className?: string }) {
  return <div className={`text-stone-600 dark:text-stone-300 truncate ${className}`}>{text}</div>;
}

/** A faint text line for subtitles/descriptions. */
function SubText({ text, className = "" }: { text: string; className?: string }) {
  return <div className={`text-stone-400 dark:text-stone-500 truncate ${className}`}>{text}</div>;
}

/** A thin gray bar — only for dividers, spacers, or unknown content. */
function Bar({ w = "w-full", h = "h-2", tone = "default" }: { w?: string; h?: string; tone?: "default" | "primary" | "dark" }) {
  const bg = tone === "primary" ? "bg-primary-400/50 dark:bg-primary-600/40" : tone === "dark" ? "bg-stone-500/40 dark:bg-stone-400/30" : "bg-stone-300/60 dark:bg-stone-700/40";
  return <div className={`${h} ${w} rounded ${bg}`} />;
}

function IconBox({ size = "md", color = "primary" }: { size?: "sm" | "md" | "lg"; color?: "primary" | "amber" | "earth" | "sky" | "green" }) {
  const sizes = { sm: "w-8 h-8", md: "w-10 h-10", lg: "w-14 h-14" };
  const colors = {
    primary: "bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-300",
    amber: "bg-amber-100 dark:bg-amber-900/40 text-amber-600 dark:text-amber-300",
    earth: "bg-earth-100 dark:bg-earth-900/40 text-earth-600 dark:text-earth-300",
    sky: "bg-sky-100 dark:bg-sky-900/40 text-sky-600 dark:text-sky-300",
    green: "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-600 dark:text-emerald-300",
  };
  return (
    <div className={`${sizes[size]} rounded-xl flex items-center justify-center ${colors[color]}`}>
      <div className="w-1/2 h-1/2 rounded bg-current opacity-60" />
    </div>
  );
}

/** Image placeholder — a gray box with a mountain glyph, instantly recognizable as "image area". */
function ImagePlaceholder({ className = "", rounded = "rounded-lg" }: { className?: string; rounded?: string }) {
  return (
    <div className={`${rounded} bg-stone-100 dark:bg-stone-800 flex items-center justify-center ${className}`}>
      <svg className="w-1/2 h-1/2 text-stone-300 dark:text-stone-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <path d="M21 19H3l4-7 4 5 3-4 5 6z" />
        <circle cx="8.5" cy="7.5" r="1.5" />
      </svg>
    </div>
  );
}

function PillLabel({ text, active = false }: { text: string; active?: boolean }) {
  return (
    <span className={`inline-block px-2.5 py-0.5 rounded-full text-[10px] font-medium ${
      active ? "bg-primary-500 text-white" : "bg-primary-100/60 text-primary-700 border border-primary-200/40 dark:bg-primary-900/40 dark:text-primary-300 dark:border-primary-700/40"
    }`}>{text}</span>
  );
}

function Btn({ text, variant = "primary" }: { text: string; variant?: "primary" | "outline" }) {
  return variant === "primary"
    ? <div className="px-4 py-1.5 rounded-lg bg-primary-600 text-cream text-xs font-medium">{text}</div>
    : <div className="px-4 py-1.5 rounded-lg border border-primary-300/60 text-primary-700 text-xs font-medium">{text}</div>;
}

function Underline() {
  return <div className="w-8 h-0.5 rounded-full bg-primary-300/40" />;
}

function CardFrame({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`rounded-xl border border-stone-200/60 dark:border-stone-700/60 bg-white dark:bg-stone-900/50 p-3 ${className}`}>{children}</div>;
}

// ── Preview wrapper ──────────────────────────────────────────────────────

function PreviewFrame({ children, height = "h-24" }: { children: ReactNode; height?: string }) {
  const large = useLarge();
  const h = large ? "min-h-[300px] py-8 px-6" : height;
  const pad = large ? "p-8" : "p-3";
  return (
    <div className={`mb-6 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900/50 overflow-hidden ${h} flex items-center justify-center ${pad}`}>
      {children}
    </div>
  );
}

// ── Per-component preview registry ───────────────────────────────────────

const PREVIEWS: Record<string, () => ReactNode> = {
  // ── UI Components ──────────────────────────────────────────────────────
  Avatar: () => <PreviewFrame><div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/40 ring-2 ring-white dark:ring-stone-800 flex items-center justify-center text-primary-600 dark:text-primary-300 text-xs font-medium">RL</div></PreviewFrame>,
  Badge: () => <PreviewFrame><PillLabel text="BADGE" /></PreviewFrame>,
  Button: () => <PreviewFrame><Btn text="Button" /></PreviewFrame>,
  Card: () => <PreviewFrame><CardFrame className="w-full space-y-2"><TextLine text="Card title" className="text-sm font-medium" /><SubText text="Card description text" className="text-xs" /></CardFrame></PreviewFrame>,
  FilterPill: () => <PreviewFrame><div className="flex gap-2"><PillLabel text="All" active /><PillLabel text="Active" /></div></PreviewFrame>,
  IconContainer: () => <PreviewFrame><IconBox size="lg" /></PreviewFrame>,
  LinkWithArrow: () => <PreviewFrame><div className="flex items-center gap-1.5 text-primary-600 dark:text-primary-300 text-xs font-medium">See more <span className="text-sm">→</span></div></PreviewFrame>,
  PageHeader: () => <PreviewFrame height="h-28"><div className="w-full max-w-xs space-y-2"><IconBox size="sm" /><TextLine text="Page Title" className="text-base font-semibold" /><Underline /><SubText text="A short page description" className="text-xs" /></div></PreviewFrame>,
  RankedListRow: () => <PreviewFrame><div className="flex items-center gap-3 w-full"><span className="text-xs font-bold text-amber-500">1</span><div className="w-7 h-7 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-[10px] text-primary-600">MS</div><TextLine text="Maria Silva" className="text-xs flex-1" /><TextLine text="€120" className="text-xs font-semibold text-primary-600" /></div></PreviewFrame>,
  ResultCard: () => <PreviewFrame><CardFrame className="flex gap-3 w-full"><ImagePlaceholder className="w-16 h-16 shrink-0" /><div className="flex-1 space-y-1"><div className="flex gap-1"><PillLabel text="article" /></div><TextLine text="How to grow tomatoes" className="text-xs font-medium" /><SubText text="A beginner-friendly guide to…" className="text-[10px]" /></div></CardFrame></PreviewFrame>,
  Section: () => <PreviewFrame height="h-28"><div className="text-center space-y-2"><PillLabel text="label" /><TextLine text="Section Title" className="text-base font-semibold" /><div className="flex justify-center"><Underline /></div><SubText text="Section description text" className="text-xs" /></div></PreviewFrame>,
  SectionHeader: () => <PreviewFrame><div className="w-full space-y-2"><TextLine text="Heading" className="text-base font-semibold" /><Underline /></div></PreviewFrame>,
  SidebarWidget: () => <PreviewFrame><CardFrame className="w-full space-y-2"><div className="flex items-center gap-2"><IconBox size="sm" /><span className="text-[10px] uppercase tracking-wider text-stone-500">Widget</span></div><TextLine text="Widget content line" className="text-xs" /><SubText text="Secondary detail" className="text-[10px]" /></CardFrame></PreviewFrame>,
  StatCounter: () => <PreviewFrame><div className="text-center"><div className="text-3xl font-bold text-primary-600 dark:text-primary-300">1,234</div><div className="text-xs text-stone-500 font-serif">Members</div></div></PreviewFrame>,
  Toggle: () => <PreviewFrame><div className="flex items-center gap-2"><div className="w-10 h-6 rounded-full bg-primary-600 flex items-center justify-end pr-0.5"><div className="w-5 h-5 rounded-full bg-white" /></div><span className="text-xs text-stone-600 dark:text-stone-300">On</span></div></PreviewFrame>,
  Tooltip: () => <PreviewFrame><div className="relative"><div className="w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-primary-600 text-[10px]">i</div><div className="absolute top-6 left-6 px-2 py-1 rounded-lg bg-stone-900 text-stone-100 text-[10px] whitespace-nowrap">Tooltip text</div></div></PreviewFrame>,
  Input: () => <PreviewFrame><div className="w-full max-w-xs space-y-1"><label className="text-[10px] text-stone-500">Label</label><div className="px-3 py-2 rounded-lg border border-primary-200/60 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs text-stone-400">Placeholder…</div></div></PreviewFrame>,
  Select: () => <PreviewFrame><div className="w-full max-w-xs space-y-1"><label className="text-[10px] text-stone-500">Label</label><div className="px-3 py-2 rounded-lg border border-primary-200/60 dark:border-stone-700 bg-white dark:bg-stone-900 text-xs text-stone-600 dark:text-stone-300 flex items-center justify-between">Choose… <span className="text-stone-400">▼</span></div></div></PreviewFrame>,
  Textarea: () => <PreviewFrame><div className="w-full max-w-xs space-y-1"><label className="text-[10px] text-stone-500">Label</label><div className="px-3 py-2 rounded-lg border border-primary-200/60 dark:border-stone-700 bg-white dark:bg-stone-900 h-12 text-xs text-stone-400">Multi-line…</div></div></PreviewFrame>,
  ProgressBar: () => <PreviewFrame><div className="w-full max-w-xs space-y-1"><div className="flex justify-between text-[10px]"><span className="text-stone-500">Progress</span><span className="text-primary-600">75%</span></div><div className="h-2 rounded-full bg-primary-100/50 dark:bg-primary-900/30"><div className="h-2 rounded-full bg-primary-500 w-3/4" /></div></div></PreviewFrame>,

  // ── Layout Blocks ──────────────────────────────────────────────────────
  HeroBlock: () => <PreviewFrame height="h-28"><div className="text-center space-y-2 max-w-sm"><TextLine text="Hero Title" className="text-lg font-bold" /><SubText text="A compelling subtitle for the hero" className="text-xs" /><div className="flex justify-center"><PillLabel text="Get started" active /></div></div></PreviewFrame>,
  TextBlock: () => <PreviewFrame><div className="w-full space-y-2"><Underline /><TextLine text="Section Heading" className="text-sm font-semibold" /><SubText text="Body paragraph text goes here with some sample content." className="text-xs" /></div></PreviewFrame>,
  CardGridBlock: () => <PreviewFrame height="h-28"><div className="w-full space-y-2"><TextLine text="Grid Title" className="text-sm font-semibold" /><div className="grid grid-cols-3 gap-2">{[0, 1, 2].map((i) => <CardFrame key={i} className="space-y-1"><TextLine text={["Seeds", "Tools", "Soil"][i]} className="text-[10px] font-medium" /><SubText text="Short desc" className="text-[9px]" /></CardFrame>)}</div></div></PreviewFrame>,
  CtaBlock: () => <PreviewFrame><div className="rounded-xl2 bg-primary-600 p-4 text-center space-y-2 max-w-sm"><TextLine text="Call to Action" className="text-sm font-semibold text-cream" /><SubText text="Supporting subtitle text" className="text-xs text-cream/70" /><div className="flex justify-center"><Btn text="Get started" /></div></div></PreviewFrame>,
  HomeHeroBlock: () => <PreviewFrame height="h-32"><div className="grid grid-cols-3 gap-3 w-full"><div className="col-span-2 space-y-2"><PillLabel text="welcome" /><TextLine text="Find what feeds your land" className="text-lg font-bold" /><div className="flex gap-2"><div className="flex-1 px-2 py-1.5 rounded-lg border border-primary-200/60 text-[10px] text-stone-400">Search…</div><Btn text="Go" /></div></div><div className="space-y-2 border-l border-stone-200 dark:border-stone-700 pl-3"><div className="text-center"><div className="text-base font-bold text-primary-600">1.2k</div><div className="text-[8px] text-stone-500">members</div></div><div className="text-center"><div className="text-base font-bold text-primary-600">340</div><div className="text-[8px] text-stone-500">listings</div></div></div></div></PreviewFrame>,
  HomeCategoriesBlock: () => <PreviewFrame height="h-28"><div className="w-full space-y-2"><PillLabel text="explore" /><TextLine text="Categories" className="text-sm font-semibold" /><div className="grid grid-cols-3 gap-2">{[0, 1, 2].map((i) => <div key={i} className="rounded-lg border border-stone-200/60 dark:border-stone-700/60 p-2 flex flex-col items-center gap-1"><IconBox size="sm" /><TextLine text={["Seeds", "Tools", "Soil"][i]} className="text-[10px]" /></div>)}</div></div></PreviewFrame>,
  HomeToolsBlock: () => <PreviewFrame height="h-28"><div className="w-full space-y-2"><PillLabel text="tools" /><TextLine text="Tools" className="text-sm font-semibold" /><div className="grid grid-cols-3 gap-2">{[0, 1, 2].map((i) => <CardFrame key={i} className="space-y-1"><IconBox size="sm" color={["primary", "earth", "sky"][i] as "primary" | "earth" | "sky"} /><TextLine text={["Calendar", "Irrigation", "Checklist"][i]} className="text-[10px] font-medium" /><SubText text="Short description" className="text-[9px]" /></CardFrame>)}</div></div></PreviewFrame>,
  HomeCommunityBlock: () => <PreviewFrame height="h-28"><div className="w-full space-y-2"><PillLabel text="community" /><TextLine text="Join the community" className="text-sm font-semibold" /><div className="grid grid-cols-4 gap-1.5">{[0, 1, 2, 3].map((i) => <CardFrame key={i} className="space-y-1"><IconBox size="sm" color="green" /><TextLine text={["Discuss", "Events", "Share", "Learn"][i]} className="text-[10px]" /></CardFrame>)}</div></div></PreviewFrame>,
  HomeRecentBlock: () => <PreviewFrame height="h-28"><div className="w-full space-y-2"><PillLabel text="recent" /><TextLine text="Recent content" className="text-sm font-semibold" /><div className="grid grid-cols-4 gap-1.5">{[0, 1, 2, 3].map((i) => <CardFrame key={i} className="p-1 space-y-1"><ImagePlaceholder className="h-8 w-full" rounded="rounded" /><TextLine text={["Tomatoes", "Compost", "Rain", "Seeds"][i]} className="text-[9px] truncate" /></CardFrame>)}</div></div></PreviewFrame>,
  HomeCtaBlock: () => <PreviewFrame><div className="text-center space-y-2 max-w-sm"><div className="border-t border-stone-200 dark:border-stone-700 pt-2" /><PillLabel text="join" /><TextLine text="Ready to grow?" className="text-sm font-semibold" /><SubText text="Join RootLink today" className="text-xs" /><div className="flex justify-center gap-2"><Btn text="Sign up" /><Btn text="Learn more" variant="outline" /></div><div className="border-t border-stone-200 dark:border-stone-700" /></div></PreviewFrame>,

  // ── Page Blocks ────────────────────────────────────────────────────────
  DonateHeroBlock: () => <PreviewFrame><div className="text-center space-y-2"><IconBox size="lg" color="primary" /><TextLine text="Support RootLink" className="text-base font-bold" /><SubText text="Help us keep the platform free" className="text-xs" /></div></PreviewFrame>,
  DonateBalanceBlock: () => <PreviewFrame><div className="rounded-lg border border-primary-200/40 dark:border-stone-700 bg-primary-50/60 dark:bg-primary-900/20 p-3 flex w-full max-w-xs"><div className="flex-1"><SubText text="Balance" className="text-[10px]" /><TextLine text="€2,450" className="text-lg font-bold text-primary-700 dark:text-primary-300" /></div><div className="flex-1 border-l border-stone-200 dark:border-stone-700 pl-3"><SubText text="Total donated" className="text-[10px]" /><TextLine text="€8,920" className="text-lg font-bold text-primary-700 dark:text-primary-300" /></div></div></PreviewFrame>,
  DonateTiersBlock: () => <PreviewFrame height="h-28"><div className="w-full space-y-2"><TextLine text="Tiers" className="text-sm font-semibold" /><div className="grid grid-cols-3 gap-2">{[0, 1, 2].map((i) => <CardFrame key={i} className="space-y-1"><TextLine text={["Seed", "Sapling", "Oak"][i]} className="text-[10px] font-medium" /><TextLine text={`€${[5, 10, 25][i]}`} className="text-sm font-bold text-primary-600" /><SubText text="Short desc" className="text-[9px]" /></CardFrame>)}</div></div></PreviewFrame>,
  DonateLeaderboardBlock: () => <PreviewFrame height="h-28"><div className="w-full space-y-1.5"><div className="flex items-center gap-2"><IconBox size="sm" color="amber" /><TextLine text="Top donors" className="text-sm font-semibold" /></div>{[1, 2, 3].map((i) => <div key={i} className="flex items-center gap-2"><span className="text-[10px] font-bold text-amber-500">{i}</span><div className="w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-[8px] text-primary-600">{["MS", "JL", "RP"][i - 1]}</div><TextLine text={["Maria Silva", "João Lima", "Rita Pereira"][i - 1]} className="text-[10px] flex-1" /><TextLine text={`€${[120, 85, 50][i - 1]}`} className="text-[10px] font-semibold text-primary-600" /></div>)}</div></PreviewFrame>,
  DonateHowItWorksBlock: () => <PreviewFrame><div className="rounded-lg border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900/50 p-3 w-full max-w-xs space-y-1.5"><TextLine text="How it works" className="text-xs font-semibold" />{["Choose a tier", "Make a donation", "Support the community"].map((t, i) => <div key={i} className="flex gap-2"><span className="text-stone-400 text-[10px]">•</span><TextLine text={t} className="text-[10px]" /></div>)}</div></PreviewFrame>,
  LeaderboardHeroBlock: () => <PreviewFrame><div className="text-center space-y-2"><IconBox size="lg" color="amber" /><TextLine text="Leaderboard" className="text-base font-bold" /><SubText text="Top community contributors" className="text-xs" /></div></PreviewFrame>,
  LeaderboardListBlock: () => <PreviewFrame height="h-28"><div className="w-full space-y-1.5">{[1, 2, 3].map((i) => <div key={i} className="flex items-center gap-2 px-2 py-1.5 rounded-lg border border-stone-200/60 dark:border-stone-700/60"><span className={`text-[10px] font-bold ${["text-amber-500", "text-stone-400", "text-orange-600"][i - 1]}`}>{i}</span><div className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-[8px] text-primary-600">{["MS", "JL", "RP"][i - 1]}</div><TextLine text={["Maria Silva", "João Lima", "Rita Pereira"][i - 1]} className="text-[10px] flex-1" /><TextLine text={`€${[120, 85, 50][i - 1]}`} className="text-[10px] font-semibold text-primary-600" /></div>)}</div></PreviewFrame>,
  RankingHeroBlock: () => <PreviewFrame><div className="text-center space-y-2"><IconBox size="lg" color="primary" /><TextLine text="Rankings" className="text-base font-bold" /><SubText text="How we score entities" className="text-xs" /></div></PreviewFrame>,
  RankingDetailsBlock: () => <PreviewFrame height="h-28"><div className="w-full space-y-2"><div className="rounded-lg bg-primary-50/60 dark:bg-primary-900/20 p-2"><TextLine text="Scoring formula" className="text-[10px] font-medium" /><div className="mt-1 rounded bg-white dark:bg-stone-900 p-1"><TextLine text="score = engagement × 0.4 + quality × 0.6" className="text-[9px] font-mono text-stone-500" /></div></div><div className="grid grid-cols-2 gap-2">{[0, 1].map((i) => <CardFrame key={i} className="space-y-1"><TextLine text={["Engagement", "Quality"][i]} className="text-[10px]" /><TextLine text={["40%", "60%"][i]} className="text-sm font-bold text-primary-600" /></CardFrame>)}</div></div></PreviewFrame>,
  ToolsHeaderBlock: () => <PreviewFrame><div className="flex items-center gap-2 w-full"><IconBox size="sm" /><div><TextLine text="Tools" className="text-sm font-semibold" /><SubText text="Calculate and plan" className="text-[10px]" /></div></div></PreviewFrame>,
  ToolsGridBlock: () => <PreviewFrame height="h-28"><div className="grid grid-cols-3 gap-2 w-full">{[0, 1, 2].map((i) => <CardFrame key={i} className="space-y-1"><IconBox size="sm" color={["primary", "earth", "sky"][i] as "primary" | "earth" | "sky"} /><TextLine text={["Calendar", "Irrigation", "Checklist"][i]} className="text-[10px] font-medium" /><SubText text="Short description" className="text-[9px]" /><div className="text-[10px] text-primary-600">→</div></CardFrame>)}</div></PreviewFrame>,
  GroupsHeaderBlock: () => <PreviewFrame><div className="flex items-center justify-between w-full"><div className="flex items-center gap-2"><IconBox size="sm" /><TextLine text="Groups" className="text-sm font-semibold" /></div><Btn text="+ New" /></div></PreviewFrame>,
  GroupsHeroBlock: () => <PreviewFrame><div className="rounded-lg border border-stone-200/60 dark:border-stone-700/60 bg-gradient-to-r from-primary-50/50 to-transparent p-3 grid grid-cols-3 gap-3 w-full">{[0, 1, 2].map((i) => <div key={i} className="text-center space-y-1"><IconBox size="sm" /><TextLine text={["Discuss", "Events", "Network"][i]} className="text-[10px] font-medium" /><SubText text="Short desc" className="text-[9px]" /></div>)}</div></PreviewFrame>,

  // ── Result Cards ───────────────────────────────────────────────────────
  EmptyState: () => <PreviewFrame height="h-28"><div className="text-center space-y-2"><div className="w-12 h-12 rounded-full bg-primary-100/60 dark:bg-primary-900/40 mx-auto flex items-center justify-center"><div className="w-6 h-6 rounded bg-primary-400/50" /></div><TextLine text="Nothing here yet" className="text-sm font-semibold" /><SubText text="Check back later for updates" className="text-xs" /></div></PreviewFrame>,

  // ── Internal Effects ───────────────────────────────────────────────────
  GrainOverlay: () => <PreviewFrame><div className="w-full h-full rounded-lg opacity-[0.04]" style={{ backgroundImage: "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='100' height='100'%3E%3Cfilter id='n'%3E%3CfeTurbulence baseFrequency='0.9'/%3E%3C/filter%3E%3Crect width='100' height='100' filter='url(%23n)'/%3E%3C/svg%3E\")" }} /></PreviewFrame>,
  HeroParticleCanvas: () => <PreviewFrame><div className="relative w-full h-full overflow-hidden rounded-lg"><div className="absolute w-8 h-8 rounded-full bg-primary-300/20 blur-sm top-2 left-4" /><div className="absolute w-6 h-6 rounded-full bg-earth-300/20 blur-sm bottom-3 right-8" /><div className="absolute w-4 h-4 rounded-full bg-rust-300/20 blur-sm top-8 right-12" /></div></PreviewFrame>,
  ScrollReveal: () => <PreviewFrame><div className="text-xs text-stone-400 italic font-serif">fade-in wrapper (no visual)</div></PreviewFrame>,

  // ── Technical Helpers ──────────────────────────────────────────────────
  ImageUpload: () => <PreviewFrame><div className="border-2 border-dashed border-stone-300 dark:border-stone-600 rounded-lg p-4 text-center w-full max-w-xs"><ImagePlaceholder className="w-8 h-8 mx-auto" rounded="rounded" /><div className="text-[10px] text-stone-400 mt-1">Drop image here</div></div></PreviewFrame>,
  InfoPopover: () => <PreviewFrame><div className="relative"><div className="w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-primary-600 text-[10px]">i</div></div></PreviewFrame>,

  // ── Extracted List Cards ───────────────────────────────────────────────
  EventListCard: () => <PreviewFrame height="h-32"><CardFrame className="w-full !p-0 overflow-hidden"><ImagePlaceholder className="h-20 w-full" rounded="rounded-none" /><div className="p-2 space-y-1"><TextLine text="Workshop: Composting" className="text-[10px] font-medium" /><div className="flex items-center gap-2"><SubText text="Sat, Jun 15" className="text-[8px]" /><SubText text="12 attending" className="text-[8px]" /></div></div></CardFrame></PreviewFrame>,
  MarketplaceListCard: () => <PreviewFrame height="h-32"><CardFrame className="w-full !p-0 overflow-hidden"><ImagePlaceholder className="h-16 w-full" rounded="rounded-none" /><div className="p-2 space-y-1"><div className="flex gap-1"><PillLabel text="sell" /></div><TextLine text="Organic seeds" className="text-[10px] font-medium" /><TextLine text="€5.00" className="text-[10px] font-bold text-primary-600" /></div></CardFrame></PreviewFrame>,
  GroupListCard: () => <PreviewFrame><CardFrame className="w-full space-y-2"><ImagePlaceholder className="h-12 w-full" /><TextLine text="Urban Gardeners" className="text-xs font-medium" /><SubText text="A group for city growers" className="text-[10px]" /><PillLabel text="community" /></CardFrame></PreviewFrame>,
  PlantListCard: () => <PreviewFrame><CardFrame className="w-full"><div className="flex items-start gap-2"><ImagePlaceholder className="w-10 h-10 shrink-0" /><div className="flex-1 space-y-0.5"><TextLine text="Solanum lycopersicum" className="text-[10px] italic font-medium" /><SubText text="Tomato, Gartenperle" className="text-[9px]" /><div className="flex gap-1"><PillLabel text="vegetable" /></div></div></div></CardFrame></PreviewFrame>,
  FeedItemCard: () => <PreviewFrame><CardFrame className="w-full flex items-start gap-2"><div className="w-6 h-6 rounded-lg bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center shrink-0"><div className="w-3 h-3 rounded bg-primary-400/50" /></div><div className="flex-1 space-y-0.5"><TextLine text="Maria published Tomato growing guide" className="text-[10px]" /><SubText text="2 hours ago" className="text-[9px]" /></div><PillLabel text="article" /></CardFrame></PreviewFrame>,
  NetworkUserCard: () => <PreviewFrame><CardFrame className="w-full space-y-2"><div className="flex items-center gap-2"><div className="w-8 h-8 rounded-xl bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-[10px] font-bold text-primary-600">M</div><div><TextLine text="Maria Silva" className="text-[10px] font-medium" /><SubText text="Porto" className="text-[9px]" /></div></div><SubText text="Urban farmer and seed saver" className="text-[9px]" /><div className="flex gap-1"><PillLabel text="seeds" /><PillLabel text="compost" /></div></CardFrame></PreviewFrame>,
  ArticleListRow: () => <PreviewFrame><CardFrame className="w-full flex items-center gap-2"><ImagePlaceholder className="w-8 h-8 shrink-0" /><div className="flex-1 space-y-0.5"><div className="flex gap-1"><PillLabel text="published" /></div><TextLine text="Growing tomatoes in winter" className="text-[10px] font-medium" /><SubText text="Jun 10 · 12 likes · 340 views" className="text-[9px]" /></div></CardFrame></PreviewFrame>,
  LearningCourseCard: () => <PreviewFrame><CardFrame className="w-full space-y-1"><TextLine text="Intro to Permaculture" className="text-[10px] font-medium" /><SubText text="A beginner course" className="text-[9px]" /><div className="flex gap-1"><PillLabel text="published" /></div></CardFrame></PreviewFrame>,
  LearningEnrollmentCard: () => <PreviewFrame><CardFrame className="w-full space-y-2"><TextLine text="Soil Health 101" className="text-[10px] font-medium" /><div className="space-y-0.5"><div className="flex justify-between text-[9px]"><span className="text-stone-500">3/5 lessons</span><span className="text-primary-600">60%</span></div><div className="h-1.5 rounded-full bg-primary-100/50 dark:bg-primary-900/30"><div className="h-1.5 rounded-full bg-primary-500 w-3/5" /></div></div></CardFrame></PreviewFrame>,
  LearningAllCourseCard: () => <PreviewFrame><CardFrame className="w-full space-y-1"><ImagePlaceholder className="h-12 w-full" /><TextLine text="Compost Masterclass" className="text-[10px] font-medium" /><SubText text="Learn advanced techniques" className="text-[9px]" /><div className="flex gap-1"><PillLabel text="soil" /><PillLabel text="intermediate" /></div></CardFrame></PreviewFrame>,
  LearningPathCard: () => <PreviewFrame><CardFrame className="w-full space-y-1"><ImagePlaceholder className="h-12 w-full" /><TextLine text="Urban Farming Path" className="text-[10px] font-medium" /><SubText text="From soil to harvest" className="text-[9px]" /></CardFrame></PreviewFrame>,

  // ── Event Detail Cards ─────────────────────────────────────────────────
  EventScheduleItem: () => <PreviewFrame><div className="rounded-xl border border-primary-200 dark:border-primary-800 bg-primary-50 dark:bg-primary-900/20 p-3 w-full max-w-xs space-y-1"><div className="flex items-center gap-2"><PillLabel text="talk" /><SubText text="Main Hall" className="text-[9px]" /></div><TextLine text="Opening Keynote" className="text-[10px] font-semibold" /><SubText text="Dr. Silva" className="text-[9px]" /><div className="flex justify-end"><SubText text="09:00 — 10:00" className="text-[9px]" /></div></div></PreviewFrame>,
  EventAmenityCard: () => <PreviewFrame><div className="flex items-center gap-3 bg-primary-50 dark:bg-primary-900/20 rounded-xl p-3 w-full max-w-xs"><div className="w-8 h-8 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center"><div className="w-3 h-3 rounded bg-primary-400/50" /></div><div className="flex-1"><TextLine text="Coffee Break" className="text-[10px] font-medium" /><SubText text="10:00 — 10:30" className="text-[9px]" /></div></div></PreviewFrame>,
  EventSponsorCard: () => <PreviewFrame><div className="bg-gradient-to-br from-amber-50 to-yellow-50 dark:from-amber-900/20 dark:to-yellow-900/20 border border-amber-200 dark:border-amber-800 rounded-xl p-4 text-center w-full max-w-xs"><div className="h-8 flex items-center justify-center text-stone-300"><div className="w-5 h-5 rounded bg-stone-300" /></div><TextLine text="Green Gardens Co." className="text-[10px] font-medium mt-1" /></div></PreviewFrame>,
  EventDonationRow: () => <PreviewFrame><div className="flex items-center gap-3 bg-primary-50 dark:bg-primary-900/20 rounded-xl p-3 w-full max-w-xs"><div className="w-8 h-8 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center text-[10px] font-bold text-primary-700">MS</div><div className="flex-1"><TextLine text="Maria Silva" className="text-[10px] font-medium" /><SubText text="Keep up the great work!" className="text-[9px]" /></div><TextLine text="€50" className="text-[10px] font-bold text-primary-700" /></div></PreviewFrame>,
  EventTicketCard: () => <PreviewFrame><div className="flex items-center gap-3 bg-primary-50 dark:bg-primary-900/20 rounded-xl p-4 w-full max-w-xs"><div className="w-10 h-10 bg-white dark:bg-stone-900 rounded-xl flex items-center justify-center border border-primary-100 dark:border-stone-700"><div className="w-4 h-4 rounded bg-stone-300" /></div><div><TextLine text="Regular × 2" className="text-[10px] font-medium" /><SubText text="Total: €20" className="text-[9px]" /></div></div></PreviewFrame>,
  EventAttendeeChip: () => <PreviewFrame><div className="flex items-center gap-2 bg-primary-50 dark:bg-primary-900/20 px-3 py-1.5 rounded-full"><div className="w-5 h-5 bg-primary-100 dark:bg-primary-900/30 text-primary-700 rounded-full flex items-center justify-center text-[9px] font-medium">M</div><TextLine text="Maria" className="text-[10px]" /></div></PreviewFrame>,
  EventVendorRow: () => <PreviewFrame><div className="flex items-center gap-3 bg-primary-50 dark:bg-primary-900/20 rounded-xl p-3 w-full max-w-xs"><div className="w-8 h-8 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center"><div className="w-3 h-3 rounded bg-primary-400/50" /></div><div className="flex-1"><div className="flex items-center gap-2"><TextLine text="Catering Plus" className="text-[10px] font-medium" /><span className="text-[9px] px-1.5 py-0.5 rounded-full bg-green-100 text-green-700">confirmed</span></div><SubText text="Food service" className="text-[9px]" /></div></div></PreviewFrame>,

  // ── Profile Cards ──────────────────────────────────────────────────────
  ProfileGroupMiniCard: () => <PreviewFrame><div className="flex items-center gap-3 bg-primary-50/40 dark:bg-primary-900/10 rounded-xl p-3 w-full max-w-xs"><div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-950/20 flex items-center justify-center"><div className="w-3 h-3 rounded bg-primary-400/50" /></div><div><TextLine text="Urban Gardeners" className="text-[10px] font-medium" /><PillLabel text="admin" /></div></div></PreviewFrame>,
  ProfileContentCard: () => <PreviewFrame><div className="card-lift p-3 w-full max-w-xs"><ImagePlaceholder className="h-12 w-full" /><TextLine text="Growing tomatoes in winter" className="text-[10px] font-medium mt-1" /><SubText text="Jun 10, 2026" className="text-[9px]" /></div></PreviewFrame>,
  ProfileEventRow: () => <PreviewFrame><div className="flex items-center gap-3 bg-white dark:bg-stone-900 rounded-xl border border-primary-100/40 dark:border-stone-700/40 p-3 w-full max-w-xs"><div className="w-8 h-8 rounded-lg bg-earth-100 flex items-center justify-center"><div className="w-3 h-3 rounded bg-earth-400/50" /></div><div className="flex-1"><TextLine text="Seed Swap Meet" className="text-[10px] font-medium" /><SubText text="Jun 15 · Porto" className="text-[9px]" /></div></div></PreviewFrame>,
  ProfileGroupRow: () => <PreviewFrame><div className="flex items-center gap-3 bg-white dark:bg-stone-900 rounded-xl border border-primary-100/40 dark:border-stone-700/40 p-3 w-full max-w-xs"><div className="w-8 h-8 rounded-lg bg-blue-100 flex items-center justify-center"><div className="w-3 h-3 rounded bg-blue-400/50" /></div><div><TextLine text="Composting Circle" className="text-[10px] font-medium" /><PillLabel text="soil" /></div></div></PreviewFrame>,
  ProfileCourseRow: () => <PreviewFrame><div className="flex items-center gap-3 bg-white dark:bg-stone-900 rounded-xl border border-primary-100/40 dark:border-stone-700/40 p-3 w-full max-w-xs"><div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center"><div className="w-3 h-3 rounded bg-green-400/50" /></div><div className="flex-1"><TextLine text="Intro to Permaculture" className="text-[10px] font-medium" /><span className="text-[9px] px-1.5 py-0.5 rounded bg-green-100 text-green-700">published</span></div></div></PreviewFrame>,
  ProfileListingRow: () => <PreviewFrame><div className="flex items-center gap-3 bg-white dark:bg-stone-900 rounded-xl border border-primary-100/40 dark:border-stone-700/40 p-3 w-full max-w-xs"><ImagePlaceholder className="w-8 h-8 shrink-0" rounded="rounded-lg" /><div className="flex-1"><TextLine text="Organic Seeds" className="text-[10px] font-medium" /><div className="flex gap-1"><SubText text="€5.00" className="text-[9px]" /><span className="text-[9px] px-1 rounded bg-green-100 text-green-700">active</span></div></div></div></PreviewFrame>,
  ProfileSaleRow: () => <PreviewFrame><div className="flex items-center gap-3 bg-white dark:bg-stone-900 rounded-xl border border-primary-100/40 dark:border-stone-700/40 p-3 w-full max-w-xs"><div className="flex-1"><TextLine text="Heirloom Tomatoes" className="text-[10px] font-medium" /><SubText text="Jun 8" className="text-[9px]" /></div><TextLine text="€12.00" className="text-[10px] font-bold text-primary-700" /><span className="text-[9px] px-1 rounded bg-green-100 text-green-700">paid</span></div></PreviewFrame>,
  ProfilePurchaseRow: () => <PreviewFrame><div className="flex items-center gap-3 bg-white dark:bg-stone-900 rounded-xl border border-primary-100/40 dark:border-stone-700/40 p-3 w-full max-w-xs"><div className="flex-1"><TextLine text="Compost Bin" className="text-[10px] font-medium" /><SubText text="Jun 5" className="text-[9px]" /></div><TextLine text="€35.00" className="text-[10px] font-bold text-primary-700" /><span className="text-[9px] px-1 rounded bg-green-100 text-green-700">paid</span></div></PreviewFrame>,
  ProfileTicketRow: () => <PreviewFrame><div className="flex items-center gap-3 bg-white dark:bg-stone-900 rounded-xl border border-primary-100/40 dark:border-stone-700/40 p-4 w-full max-w-xs"><div className="w-8 h-8 rounded-xl bg-sky-100 flex items-center justify-center"><div className="w-3 h-3 rounded bg-sky-400/50" /></div><div className="flex-1"><TextLine text="Garden Workshop" className="text-[10px] font-medium" /><SubText text="regular × 1 — €10" className="text-[9px]" /></div><PillLabel text="checked in" /></div></PreviewFrame>,
  ProfileRsvpRow: () => <PreviewFrame><div className="flex items-center gap-3 bg-white dark:bg-stone-900 rounded-xl border border-primary-100/40 dark:border-stone-700/40 p-3 w-full max-w-xs"><div className="w-8 h-8 rounded-lg bg-amber-100 flex items-center justify-center"><div className="w-3 h-3 rounded bg-amber-400/50" /></div><div className="flex-1"><TextLine text="Harvest Festival" className="text-[10px] font-medium" /><SubText text="Sep 20 · Lisbon" className="text-[9px]" /></div></div></PreviewFrame>,
  ProfileDonationRow: () => <PreviewFrame><div className="flex items-center gap-3 bg-white dark:bg-stone-900 rounded-xl border border-primary-100/40 dark:border-stone-700/40 p-3 w-full max-w-xs"><div className="w-8 h-8 rounded-lg bg-rust-100 flex items-center justify-center"><div className="w-3 h-3 rounded bg-rust-400/50" /></div><div className="flex-1"><TextLine text="Support RootLink" className="text-[10px] font-medium" /><SubText text="May 1" className="text-[9px]" /></div><TextLine text="€25" className="text-[10px] font-bold text-rust-600" /></div></PreviewFrame>,
  ProfileEnrollmentRow: () => <PreviewFrame><div className="flex items-center gap-3 bg-white dark:bg-stone-900 rounded-xl border border-primary-100/40 dark:border-stone-700/40 p-3 w-full max-w-xs"><div className="w-8 h-8 rounded-lg bg-green-100 flex items-center justify-center"><div className="w-3 h-3 rounded bg-green-400/50" /></div><TextLine text="Soil Health 101" className="text-[10px] font-medium" /></div></PreviewFrame>,
  ProfileCommentRow: () => <PreviewFrame><div className="block bg-white dark:bg-stone-900 rounded-xl border border-primary-100/40 dark:border-stone-700/40 p-3 w-full max-w-xs space-y-1"><div className="flex items-center gap-2"><PillLabel text="event" /><SubText text="Jun 3" className="text-[9px]" /></div><TextLine text="&quot;Great event, learned a lot!&quot;" className="text-[10px] italic text-stone-500" /></div></PreviewFrame>,

  // ── Phase 3 — Minor page cards ────────────────────────────────────────
  MarketplaceSellerCard: () => <PreviewFrame><div className="flex items-center gap-3 bg-primary-50/40 dark:bg-primary-900/20 rounded-xl p-3 w-full max-w-xs"><div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-[10px] font-semibold text-primary-600">M</div><div className="flex-1"><div className="flex items-center gap-1"><TextLine text="Maria Silva" className="text-[10px] font-medium" /><div className="w-2.5 h-2.5 rounded-full bg-green-400" /></div><SubText text="View seller" className="text-[9px]" /></div></div></PreviewFrame>,
  GroupMemberChip: () => <PreviewFrame><div className="flex items-center gap-2 bg-primary-50 px-3 py-1.5 rounded-full"><div className="w-5 h-5 rounded-full bg-primary-100 dark:bg-primary-950/20 flex items-center justify-center"><div className="w-2.5 h-2.5 rounded bg-primary-400/50" /></div><TextLine text="User #42" className="text-[10px]" /><PillLabel text="admin" /></div></PreviewFrame>,
  PopularContentCard: () => <PreviewFrame><div className="rounded-2xl border border-primary-100/40 dark:border-stone-700 bg-white dark:bg-stone-900 p-3 flex items-start gap-2 w-full max-w-xs"><ImagePlaceholder className="w-8 h-8 shrink-0" rounded="rounded-xl" /><div className="flex-1"><TextLine text="How to grow tomatoes" className="text-[10px] font-medium" /><PillLabel text="article" /></div></div></PreviewFrame>,
};

export function ComponentPreview({ type, large = false }: { type: string; large?: boolean }) {
  const render = PREVIEWS[type];
  if (!render) {
    return (
      <div className={`mb-6 rounded-xl border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-900/50 ${large ? "min-h-[300px] p-8" : "h-20"} flex items-center justify-center text-xs text-stone-400 italic font-serif`}>
        {type}
      </div>
    );
  }
  return <PreviewContext.Provider value={large}>{render()}</PreviewContext.Provider>;
}
