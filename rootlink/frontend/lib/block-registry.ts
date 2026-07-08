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
      { name: "button_href", label: "Button link", type: "text", default: "/auth/sign-in" },
    ],
    Component: CtaBlock,
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
