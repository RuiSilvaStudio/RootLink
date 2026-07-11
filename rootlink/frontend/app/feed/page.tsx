"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Rss, ArrowRight } from "lucide-react";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/locale-context";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListSkeleton } from "@/components/ui/LoadingSkeleton";
import { Text } from "@/components/ui/Text";
import { FeedItemCard } from "@/components/cards/FeedItemCard";
import { BlockRenderer, type BlockSectionData } from "@/components/blocks";

export default function FeedPage() {
  const { t } = useLocale();
  const router = useRouter();
  const [feed, setFeed] = useState<{ following: any[]; discover: any[] }>({ following: [], discover: [] });
  const [loading, setLoading] = useState(true);
  const [heroSections, setHeroSections] = useState<BlockSectionData[] | null>(null);

  useEffect(() => {
    api.blocks.getPage("feed").then((p) => p?.sections?.length ? setHeroSections(p.sections) : setHeroSections([])).catch(() => setHeroSections([]));
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/auth/login");
      return;
    }
    api.social.feed().then(setFeed).catch(() => {}).finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-12">
      {heroSections && heroSections.length > 0 && (
        <BlockRenderer sections={heroSections} />
      )}

      <PageHeader
        icon={<Rss className="w-5 h-5 text-primary-500" />}
        title={<Text k="feed.title" as="span" />}
        subtitle={<Text k="feed.subtitle" as="span" />}
      />

      {loading ? (
        <div className="space-y-8">
          <div>
            <div className="h-5 w-32 bg-primary-100 dark:bg-primary-950/20/60 rounded animate-pulse mb-4" />
            <ListSkeleton count={3} />
          </div>
          <div>
            <div className="h-5 w-32 bg-primary-100 dark:bg-primary-950/20/60 rounded animate-pulse mb-4" />
            <ListSkeleton count={4} />
          </div>
        </div>
      ) : (
        <div className="space-y-10 mt-8">
          {/* Following section */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-display font-semibold text-stone-800 dark:text-stone-100 dark:text-stone-200">
                {t("feed.following")}
              </h2>
              <div className="flex-1 h-px bg-primary-100 dark:bg-primary-950/20 dark:bg-primary-800/30" />
              <span className="text-xs text-stone-00 dark:text-stone-500">{feed.following.length}</span>
            </div>

            {feed.following.length === 0 ? (
              <div className="bg-primary-50/40 dark:bg-primary-900/10 rounded-2xl p-6 text-center border border-primary-100/40 dark:border-primary-800/20">
                <p className="text-sm text-stone-500 dark:text-stone-00 dark:text-stone-500 font-serif mb-4">
                  {t("feed.following_empty")}
                </p>
                <Link
                  href="/network"
                  className="inline-flex items-center gap-1.5 text-sm font-display font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 transition"
                >
                  {t("feed.discover_people")} <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {feed.following.map((item, i) => (
                  <FeedItemCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </section>

          {/* Discover section */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-display font-semibold text-stone-800 dark:text-stone-100 dark:text-stone-200">
                {t("feed.discover")}
              </h2>
              <div className="flex-1 h-px bg-primary-100 dark:bg-primary-950/20 dark:bg-primary-800/30" />
              <span className="text-xs text-stone-00 dark:text-stone-500">{feed.discover.length}</span>
            </div>

            {feed.discover.length === 0 ? (
              <EmptyState
                icon={<Rss className="w-7 h-7" />}
                title={t("feed.empty")}
                message={t("feed.empty_desc")}
              />
            ) : (
              <div className="space-y-3">
                {feed.discover.map((item, i) => (
                  <FeedItemCard key={item.id} item={item} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
