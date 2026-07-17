"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useGroup, canSee } from "@/lib/group-context";
import { useLocale } from "@/lib/locale-context";
import type { GroupContentLink } from "@/lib/groups-types";
import { MembersGate } from "@/components/groups/MembersGate";
import { LoadError } from "@/components/studio/LoadError";
import { Reveal } from "@/components/groups/RootNav";
import { GroupPageHero } from "@/components/groups/GroupPageChrome";
import { Text } from "@/components/ui/Text";
import { safeImageUrl } from "@/lib/image-url";
import { ArrowRight } from "lucide-react";

export default function GroupNewsPage() {
  const { group, viewer } = useGroup();
  const { t, locale } = useLocale();
  const [articles, setArticles] = useState<GroupContentLink[] | null>(null);
  const [error, setError] = useState(false);
  const newsVisible = canSee(viewer, "news");

  const load = useCallback(async () => {
    setError(false);
    try {
      setArticles(newsVisible ? await api.groups.listGroupContent(group.id, "article") : []);
    } catch {
      setError(true);
    }
  }, [group.id, newsVisible]);

  useEffect(() => { load(); }, [load]);

  const fmtDate = (iso: string | null) => {
    if (!iso) return "";
    try { return new Date(iso).toLocaleDateString(locale === "pt" ? "pt-PT" : "en-GB", { day: "numeric", month: "short" }).replace(".", ""); }
    catch { return ""; }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 pb-16">
      <GroupPageHero
        eyebrowKey="groups.news_title"
        titleKey="groups.pagehero_news_title"
        introKey="groups.pagehero_news_intro"
      />
      <div className="pt-12">
        {!newsVisible ? (
          <MembersGate title={t("groups.news_title")} />
        ) : error ? (
          <LoadError message={t("groups.group_load_error")} onRetry={load} />
        ) : articles === null ? (
          <div className="grid sm:grid-cols-2 gap-4" aria-busy="true">
            {[0, 1].map(i => <div key={i} className="h-40 rounded-2xl skeleton-shimmer" />)}
          </div>
        ) : articles.length === 0 ? (
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="text-sm text-stone-400 font-serif" data-rl-text="groups.no_articles">{t("groups.no_articles")}</p>
            {viewer.is_manager && (
              <Link href={`/groups/${group.slug}/manage`} className="text-[0.8rem] font-semibold text-rust-500 hover:text-rust-600 inline-flex items-center gap-1">
                {t("groups.link_first_article")} <ArrowRight className="w-3 h-3" aria-hidden />
              </Link>
            )}
          </div>
        ) : (
          /* mockup .news-grid — editorial cards: eyebrow, display title */
          <Reveal className="grid sm:grid-cols-2 gap-4">
            {articles.map(a => (
              <Link
                key={a.content_id}
                href={`/content/${a.content_id}`}
                className="group rounded-2xl border border-primary-100 dark:border-stone-800 bg-white dark:bg-stone-900 overflow-hidden hover:-translate-y-1 hover:shadow-[0_18px_44px_rgba(36,26,16,0.09)] hover:border-primary-200 transition-all duration-300 block"
              >
                {a.image_url && (
                  <img src={safeImageUrl(a.image_url)} alt="" className="w-full h-36 object-cover" />
                )}
                <div className="p-5">
                  <p className="text-xs font-display font-semibold tracking-[0.22em] uppercase text-earth-500">
                    {t("groups.article_label")}{a.created_at ? ` · ${fmtDate(a.created_at)}` : ""}
                  </p>
                  <h3 className="font-display font-[560] text-primary-800 dark:text-primary-200 text-xl leading-snug mt-2 group-hover:text-rust-600 dark:group-hover:text-rust-400 transition">
                    {a.title || `#${a.content_id}`}
                  </h3>
                </div>
              </Link>
            ))}
          </Reveal>
        )}
      </div>
    </div>
  );
}
