/**
 * Block type registry for the Content Studio.
 *
 * Spec: docs/content-studio/CONTENT_STUDIO.md §6.
 *
 * The registry lives in code (TypeScript declarations). New block types
 * are added by developers here and automatically appear in the studio's
 * block palette. Block *instances* (sections on a page) are data — stored
 * in the backend (block_sections table), editable in the studio without
 * a deploy.
 *
 * Each block type declares:
 *   - id: stable identifier stored in the DB (never rename)
 *   - label: human label shown in the studio palette
 *   - category: for grouping in the palette
 *   - fields: the configurable props (typed, with defaults)
 *   - Component: the React component that renders the block
 */

import type { ComponentType } from "react";
import { HeroBlock, TextBlock, CardGridBlock, CtaBlock } from "@/components/blocks/BlockComponents";
import { AnimatedSectionBlock } from "@/components/blocks/AnimatedSectionBlock";
import { HomeHeroBlock, HomeCategoriesBlock, HomeToolsBlock, HomeCommunityBlock, HomeRecentBlock, HomeCtaBlock } from "@/components/blocks/HomeBlocks";
import {
  DonateHeroBlock, DonateBalanceBlock, DonateTiersBlock, DonateLeaderboardBlock, DonateHowItWorksBlock,
  LeaderboardHeroBlock, LeaderboardListBlock,
  RankingHeroBlock, RankingDetailsBlock,
  ToolsHeaderBlock, ToolsGridBlock,
  GroupsHeaderBlock, GroupsHeroBlock,
} from "@/components/blocks/PageBlocks";

export type BlockFieldType = "text" | "textarea" | "color" | "image" | "number" | "select";

export interface BlockField {
  name: string;
  label: string;
  type: BlockFieldType;
  default?: string;
  options?: { value: string; label: string }[];
}

export interface BlockType {
  id: string;
  label: string;
  category: "layout" | "content" | "media";
  fields: BlockField[];
  Component: ComponentType<{ props: Record<string, string> }>;
}

export const BLOCK_REGISTRY: BlockType[] = [
  {
    id: "hero",
    label: "Hero",
    category: "layout",
    fields: [
      { name: "title", label: "Title", type: "text", default: "Welcome to RootLink" },
      { name: "subtitle", label: "Subtitle", type: "textarea", default: "A community platform for gardeners, makers, and homesteaders." },
      { name: "cta_text", label: "Button text", type: "text", default: "Get started" },
      { name: "cta_href", label: "Button link", type: "text", default: "/search" },
    ],
    Component: HeroBlock,
  },
  {
    id: "text-block",
    label: "Text section",
    category: "content",
    fields: [
      { name: "heading", label: "Heading", type: "text", default: "About this section" },
      { name: "body", label: "Body text", type: "textarea", default: "Write your content here." },
    ],
    Component: TextBlock,
  },
  {
    id: "card-grid",
    label: "Card grid",
    category: "layout",
    fields: [
      { name: "heading", label: "Section heading", type: "text", default: "Explore" },
      { name: "card1_title", label: "Card 1 title", type: "text", default: "Gardening" },
      { name: "card1_desc", label: "Card 1 description", type: "textarea", default: "Tips, tools, and community." },
      { name: "card2_title", label: "Card 2 title", type: "text", default: "Making" },
      { name: "card2_desc", label: "Card 2 description", type: "textarea", default: "Build, repair, upcycle." },
      { name: "card3_title", label: "Card 3 title", type: "text", default: "Community" },
      { name: "card3_desc", label: "Card 3 description", type: "textarea", default: "Connect and share." },
    ],
    Component: CardGridBlock,
  },
  {
    id: "cta",
    label: "Call to action",
    category: "content",
    fields: [
      { name: "title", label: "Title", type: "text", default: "Join the community" },
      { name: "subtitle", label: "Subtitle", type: "textarea", default: "Create an account to start contributing." },
      { name: "button_text", label: "Button text", type: "text", default: "Sign up" },
      { name: "button_href", label: "Button link", type: "text", default: "/auth/register" },
    ],
    Component: CtaBlock,
  },
  {
    id: "animated-section",
    label: "Animated section",
    category: "media",
    fields: [
      {
        name: "animation",
        label: "Animation",
        type: "select",
        default: "particles",
        options: [
          { value: "particles", label: "Particles (blobs + dots)" },
          { value: "seeds", label: "Seeds wave (grid)" },
          { value: "halo", label: "Halo (glowing ring)" },
          { value: "birds", label: "Birds (flocking)" },
          { value: "clouds", label: "Clouds (animated sky)" },
          { value: "topology", label: "Topology (network mesh)" },
        ],
      },
      { name: "badge", label: "Badge text", type: "text" },
      { name: "heading", label: "Heading (overrides i18n)", type: "text" },
      { name: "subtitle", label: "Subtitle (overrides i18n)", type: "textarea" },
    ],
    Component: AnimatedSectionBlock,
  },
  // ── Homepage blocks (Phase 4) ──────────────────────────
  // These are self-contained sections that fetch their own dynamic data
  // (stats, taxonomy families, recent content). Static copy (badges,
  // headings, subtitles) is editable via props in the studio.
  {
    id: "home-hero",
    label: "Home: Hero",
    category: "layout",
    fields: [
      { name: "badge", label: "Badge text", type: "text" },
      { name: "title", label: "Title (overrides i18n)", type: "text" },
      { name: "subtitle", label: "Subtitle (overrides i18n)", type: "textarea" },
    ],
    Component: HomeHeroBlock,
  },
  {
    id: "home-categories",
    label: "Home: Categories",
    category: "layout",
    fields: [
      { name: "badge", label: "Badge text", type: "text" },
      { name: "heading", label: "Heading (overrides i18n)", type: "text" },
    ],
    Component: HomeCategoriesBlock,
  },
  {
    id: "home-tools",
    label: "Home: Tools",
    category: "content",
    fields: [
      { name: "badge", label: "Badge text", type: "text" },
      { name: "heading", label: "Heading (overrides i18n)", type: "text" },
      { name: "subtitle", label: "Subtitle (overrides i18n)", type: "textarea" },
    ],
    Component: HomeToolsBlock,
  },
  {
    id: "home-community",
    label: "Home: Community",
    category: "content",
    fields: [
      { name: "badge", label: "Badge text", type: "text" },
      { name: "heading", label: "Heading (overrides i18n)", type: "text" },
    ],
    Component: HomeCommunityBlock,
  },
  {
    id: "home-recent",
    label: "Home: Recent content",
    category: "content",
    fields: [
      { name: "badge", label: "Badge text", type: "text" },
      { name: "heading", label: "Heading (overrides i18n)", type: "text" },
    ],
    Component: HomeRecentBlock,
  },
  {
    id: "home-cta",
    label: "Home: CTA",
    category: "content",
    fields: [
      { name: "badge", label: "Badge text", type: "text" },
      { name: "heading", label: "Heading (overrides i18n)", type: "text" },
      { name: "subtitle", label: "Subtitle (overrides i18n)", type: "textarea" },
    ],
    Component: HomeCtaBlock,
  },
  // ── Donate page blocks (Phase 5) ───────────────────────
  {
    id: "donate-hero",
    label: "Donate: Hero",
    category: "content",
    fields: [
      { name: "title", label: "Title (overrides i18n)", type: "text" },
      { name: "subtitle", label: "Subtitle (overrides i18n)", type: "textarea" },
    ],
    Component: DonateHeroBlock,
  },
  {
    id: "donate-balance",
    label: "Donate: Balance",
    category: "content",
    fields: [],
    Component: DonateBalanceBlock,
  },
  {
    id: "donate-tiers",
    label: "Donate: Tiers",
    category: "content",
    fields: [
      { name: "heading", label: "Heading (overrides i18n)", type: "text" },
    ],
    Component: DonateTiersBlock,
  },
  {
    id: "donate-leaderboard",
    label: "Donate: Top donors",
    category: "content",
    fields: [
      { name: "heading", label: "Heading (overrides i18n)", type: "text" },
    ],
    Component: DonateLeaderboardBlock,
  },
  {
    id: "donate-how-it-works",
    label: "Donate: How it works",
    category: "content",
    fields: [
      { name: "heading", label: "Heading (overrides i18n)", type: "text" },
    ],
    Component: DonateHowItWorksBlock,
  },
  // ── Leaderboard page blocks (Phase 6) ──────────────────
  {
    id: "leaderboard-hero",
    label: "Leaderboard: Hero",
    category: "content",
    fields: [
      { name: "title", label: "Title (overrides i18n)", type: "text" },
      { name: "subtitle", label: "Subtitle (overrides i18n)", type: "textarea" },
    ],
    Component: LeaderboardHeroBlock,
  },
  {
    id: "leaderboard-list",
    label: "Leaderboard: List",
    category: "content",
    fields: [],
    Component: LeaderboardListBlock,
  },
  // ── Ranking page blocks (Phase 7) ──────────────────────
  {
    id: "ranking-hero",
    label: "Ranking: Hero",
    category: "content",
    fields: [
      { name: "title", label: "Title (overrides i18n)", type: "text" },
      { name: "subtitle", label: "Subtitle (overrides i18n)", type: "textarea" },
    ],
    Component: RankingHeroBlock,
  },
  {
    id: "ranking-details",
    label: "Ranking: Details",
    category: "content",
    fields: [
      { name: "formula_heading", label: "Formula heading", type: "text" },
      { name: "details_heading", label: "Details heading", type: "text" },
    ],
    Component: RankingDetailsBlock,
  },
  // ── Tools page blocks (Phase 8) ────────────────────────
  {
    id: "tools-header",
    label: "Tools: Header",
    category: "content",
    fields: [
      { name: "title", label: "Title (overrides i18n)", type: "text" },
      { name: "subtitle", label: "Subtitle (overrides i18n)", type: "text" },
    ],
    Component: ToolsHeaderBlock,
  },
  {
    id: "tools-grid",
    label: "Tools: Grid",
    category: "layout",
    fields: [],
    Component: ToolsGridBlock,
  },
  // ── Groups page blocks (Phase 9) ───────────────────────
  {
    id: "groups-header",
    label: "Groups: Header",
    category: "content",
    fields: [
      { name: "title", label: "Title (overrides i18n)", type: "text" },
      { name: "subtitle", label: "Subtitle (overrides i18n)", type: "text" },
    ],
    Component: GroupsHeaderBlock,
  },
  {
    id: "groups-hero",
    label: "Groups: Hero cards",
    category: "content",
    fields: [
      { name: "card1_title", label: "Card 1 title", type: "text" },
      { name: "card1_desc", label: "Card 1 description", type: "textarea" },
      { name: "card2_title", label: "Card 2 title", type: "text" },
      { name: "card2_desc", label: "Card 2 description", type: "textarea" },
      { name: "card3_title", label: "Card 3 title", type: "text" },
      { name: "card3_desc", label: "Card 3 description", type: "textarea" },
    ],
    Component: GroupsHeroBlock,
  },
];

const BLOCK_MAP: Record<string, BlockType> = Object.fromEntries(
  BLOCK_REGISTRY.map((b) => [b.id, b])
);

export function getBlockType(id: string): BlockType | undefined {
  return BLOCK_MAP[id];
}

/** Default props for a block type (from field defaults). */
export function defaultPropsFor(blockTypeId: string): Record<string, string> {
  const block = BLOCK_MAP[blockTypeId];
  if (!block) return {};
  const props: Record<string, string> = {};
  for (const field of block.fields) {
    if (field.default !== undefined) props[field.name] = field.default;
  }
  return props;
}
