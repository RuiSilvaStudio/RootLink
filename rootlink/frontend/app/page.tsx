"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { BlockRenderer, type BlockSectionData } from "@/components/blocks";
import { HomeHeroBlock, HomeCategoriesBlock, HomeToolsBlock, HomeCommunityBlock, HomeRecentBlock, HomeCtaBlock } from "@/components/blocks/HomeBlocks";
import { useLocale } from "@/lib/locale-context";

/**
 * Homepage — Phase 4: migrated to the block model.
 *
 * If a published `home` BlockPage exists in the backend, the homepage renders
 * its sections via BlockRenderer (editable + reorderable in /studio/blocks).
 * If no block page exists (e.g. backend unreachable, or not yet created),
 * it falls back to rendering the block components directly with default
 * props (i18n-driven) — so the homepage never breaks.
 *
 * Spec: docs/content-studio/CONTENT_STUDIO.md §8 (Phase 4+).
 */

// Fallback sections (rendered when no backend block page exists)
const FALLBACK_SECTIONS: BlockSectionData[] = [
  { id: 1, block_type: "home-hero", props: {}, order: 0 },
  { id: 2, block_type: "home-categories", props: {}, order: 1 },
  { id: 3, block_type: "home-tools", props: {}, order: 2 },
  { id: 4, block_type: "home-community", props: {}, order: 3 },
  { id: 5, block_type: "home-recent", props: {}, order: 4 },
  { id: 6, block_type: "home-cta", props: {}, order: 5 },
];

export default function Home() {
  const [sections, setSections] = useState<BlockSectionData[] | null>(null);
  const { t } = useLocale();

  useEffect(() => {
    api.blocks
      .getPage("home")
      .then((page) => {
        if (page && page.sections && page.sections.length > 0) {
          setSections(page.sections);
        } else {
          setSections(FALLBACK_SECTIONS);
        }
      })
      .catch(() => {
        // Backend unreachable or page not found — use fallback
        setSections(FALLBACK_SECTIONS);
      });
  }, []);

  if (!sections) {
    // Initial load — render the hero immediately for perceived performance
    return (
      <div>
        <HomeHeroBlock props={{}} />
      </div>
    );
  }

  return (
    <div>
      <BlockRenderer sections={sections} />
    </div>
  );
}
