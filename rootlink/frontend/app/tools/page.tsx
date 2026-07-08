"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { BlockRenderer, type BlockSectionData } from "@/components/blocks";
import { ToolsHeaderBlock, ToolsGridBlock } from "@/components/blocks/PageBlocks";

/**
 * Tools page — migrated to the block model (Phase 8).
 * Fetches /api/blocks/pages/tools → BlockRenderer.
 * Falls back to block components with default i18n props if no backend page.
 */

const FALLBACK_SECTIONS: BlockSectionData[] = [
  { id: 1, block_type: "tools-header", props: {}, order: 0 },
  { id: 2, block_type: "tools-grid", props: {}, order: 1 },
];

export default function ToolsPage() {
  const [sections, setSections] = useState<BlockSectionData[] | null>(null);

  useEffect(() => {
    api.blocks.getPage("tools")
      .then((p) => p?.sections?.length ? setSections(p.sections) : setSections(FALLBACK_SECTIONS))
      .catch(() => setSections(FALLBACK_SECTIONS));
  }, []);

  if (!sections) return null;

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-12">
      <BlockRenderer sections={sections} />
    </div>
  );
}
