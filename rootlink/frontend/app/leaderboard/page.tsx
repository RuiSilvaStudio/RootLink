"use client";

import { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import { BlockRenderer, type BlockSectionData } from "@/components/blocks";
import { LeaderboardHeroBlock, LeaderboardListBlock } from "@/components/blocks/PageBlocks";

/**
 * Leaderboard page — migrated to the block model (Phase 6).
 * Fetches /api/blocks/pages/leaderboard → BlockRenderer.
 * Falls back to block components with default i18n props if no backend page.
 */

const FALLBACK_SECTIONS: BlockSectionData[] = [
  { id: 1, block_type: "leaderboard-hero", props: {}, order: 0 },
  { id: 2, block_type: "leaderboard-list", props: {}, order: 1 },
];

export default function LeaderboardPage() {
  const [sections, setSections] = useState<BlockSectionData[] | null>(null);

  useEffect(() => {
    api.blocks.getPage("leaderboard")
      .then((p) => p?.sections?.length ? setSections(p.sections) : setSections(FALLBACK_SECTIONS))
      .catch(() => setSections(FALLBACK_SECTIONS));
  }, []);

  if (!sections) return <div className="max-w-3xl mx-auto px-4 sm:px-8 py-12"><div className="space-y-3">{[1,2,3,4,5].map((i) => <div key={i} className="h-16 rounded-xl bg-stone-100 dark:bg-stone-800 animate-pulse" />)}</div></div>;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-12">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200 transition-colors mb-8">
        <ArrowLeft size={16} /> Back
      </Link>
      <BlockRenderer sections={sections} />
    </div>
  );
}
