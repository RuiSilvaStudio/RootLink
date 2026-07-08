"use client";

/**
 * Live block-composed page — renders a BlockPage's sections via BlockRenderer.
 *
 * This is the public-facing route for block-composed surfaces. The studio
 * composes pages at /studio/blocks; visitors see them at /p/{slug}.
 *
 * Spec: docs/content-studio/CONTENT_STUDIO.md §6 (Phase 3: one new
 * block-composed surface ships live).
 */

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { api } from "@/lib/api";
import { BlockRenderer, type BlockSectionData } from "@/components/blocks";
import { PageSkeleton } from "@/components/ui/LoadingSkeleton";

export default function BlockPage() {
  const params = useParams();
  const slug = params.slug as string;
  const [page, setPage] = useState<{
    id: number;
    slug: string;
    label: string;
    is_published: boolean;
    sections: BlockSectionData[];
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const data = await api.blocks.getPage(slug);
        setPage(data);
      } catch {
        setNotFound(true);
      } finally {
        setLoading(false);
      }
    })();
  }, [slug]);

  if (loading) return <PageSkeleton />;
  if (notFound || !page)
    return (
      <div className="min-h-[60vh] flex items-center justify-center">
        <div className="text-center">
          <h1 className="font-display text-2xl font-semibold text-stone-400 mb-2">
            Page not found
          </h1>
          <p className="text-sm text-stone-400 font-serif">
            The page &ldquo;{slug}&rdquo; doesn&apos;t exist or isn&apos;t published.
          </p>
        </div>
      </div>
    );

  return (
    <div className="min-h-screen bg-cream dark:bg-stone-950 pt-16">
      <BlockRenderer sections={page.sections} />
    </div>
  );
}
