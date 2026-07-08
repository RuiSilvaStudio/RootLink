"use client";

import { useState, useEffect } from "react";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import { BlockRenderer, type BlockSectionData } from "@/components/blocks";
import {
  DonateHeroBlock, DonateBalanceBlock, DonateTiersBlock,
  DonateLeaderboardBlock, DonateHowItWorksBlock,
} from "@/components/blocks/PageBlocks";

/**
 * Donate page — migrated to the block model (Phase 5).
 * Fetches /api/blocks/pages/donate → BlockRenderer.
 * Falls back to block components with default i18n props if no backend page.
 */

const FALLBACK_SECTIONS: BlockSectionData[] = [
  { id: 1, block_type: "donate-hero", props: {}, order: 0 },
  { id: 2, block_type: "donate-balance", props: {}, order: 1 },
  { id: 3, block_type: "donate-tiers", props: {}, order: 2 },
  { id: 4, block_type: "donate-leaderboard", props: {}, order: 3 },
  { id: 5, block_type: "donate-how-it-works", props: {}, order: 4 },
];

export default function DonatePage() {
  const [sections, setSections] = useState<BlockSectionData[] | null>(null);

  useEffect(() => {
    api.blocks.getPage("donate")
      .then((p) => p?.sections?.length ? setSections(p.sections) : setSections(FALLBACK_SECTIONS))
      .catch(() => setSections(FALLBACK_SECTIONS));
  }, []);

  if (!sections) return <div className="max-w-4xl mx-auto px-4 sm:px-8 py-12"><div className="h-32 rounded-xl bg-stone-100 dark:bg-stone-800 animate-pulse" /></div>;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-12">
      <Link href="/" className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200 transition-colors mb-8">
        <ArrowLeft size={16} /> Back
      </Link>
      <BlockRenderer sections={sections} />
    </div>
  );
}
