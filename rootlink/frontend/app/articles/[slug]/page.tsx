"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, Eye, MessageSquare, Bookmark, ExternalLink, Rss, Check } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/lib/locale-context";
import { Badge } from "@/components/ui";
import { Text } from "@/components/ui/Text";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { toast } from "sonner";
import ArticleEditor from "@/components/editor/ArticleEditor";
import ContentRating from "@/components/ContentRating";
import { CommentSection } from "@/components/CommentSection";

export default function ArticleViewPage() {
  const params = useParams();
  const slug = params.slug as string;
  const router = useRouter();
  const { user } = useAuth();
  const { locale } = useLocale();
  const [article, setArticle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [searchContext, setSearchContext] = useState<{ url: string; query: string; page: number } | null>(null);
  const [isSubscribed, setIsSubscribed] = useState(false);

  useEffect(() => {
    // Check if the user came from the search page (via sessionStorage)
    try {
      const ctx = sessionStorage.getItem("rl_search_context");
      if (ctx) setSearchContext(JSON.parse(ctx));
    } catch {}

    api.articles.get(slug)
      .then((a) => {
        setArticle(a);
        setIsSubscribed(a.is_subscribed || false);
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [slug]);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-12">
        <div className="h-8 w-64 rounded bg-stone-200 dark:bg-stone-800 animate-pulse mb-4" />
        <div className="h-4 w-48 rounded bg-stone-100 dark:bg-stone-800 animate-pulse mb-8" />
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-4 rounded bg-stone-100 dark:bg-stone-800 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (error || !article) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-12 text-center">
        <Text k="articles.not_found_title" as="h1" defaultText="Article not found" className="text-2xl font-display font-bold text-stone-900 dark:text-stone-100 mb-2" />
        <Text k="articles.not_found_message" as="p" defaultText="This article may have been removed or is still in draft." className="text-stone-500 dark:text-stone-400" />
        <Link href="/" className="text-primary-600 hover:underline mt-4 inline-block">
          <Text k="articles.go_home" as="span" defaultText="Go home" />
        </Link>
      </div>
    );
  }

  const isOwner = user?.id === article.created_by;

  // Check if the summary duplicates the first body paragraph — if so,
  // skip rendering it (the body already shows the same text).
  const isSummaryDuplicate = (() => {
    if (!article.summary) return false;
    const blocks = article.body?.blocks;
    if (!blocks || !blocks.length) return false;
    const firstPara = blocks.find((b: any) => b.type === "paragraph");
    if (!firstPara) return false;
    // Strip HTML tags from the paragraph text for comparison
    const paraText = (firstPara.data.text || "").replace(/<[^>]+>/g, "").trim();
    const summaryText = (article.summary || "").replace(/<[^>]+>/g, "").trim();
    // If the first 80 chars match, it's a duplicate
    return paraText.slice(0, 80).toLowerCase() === summaryText.slice(0, 80).toLowerCase();
  })();

  const toggleSubscription = async () => {
    if (!article.feed_source_id) return;
    try {
      if (isSubscribed) {
        await api.feeds.unsubscribe(article.feed_source_id);
        setIsSubscribed(false);
        toast.success(`Unsubscribed from ${article.feed_title || "feed"}`);
      } else {
        await api.feeds.subscribe(article.feed_source_id);
        setIsSubscribed(true);
        toast.success(`Subscribed to ${article.feed_title || "feed"}`);
      }
    } catch {
      toast.error("Failed to update subscription");
    }
  };

  return (
    <article className="max-w-3xl mx-auto px-4 sm:px-8 py-12">
      {searchContext && (
        <button
          onClick={() => router.push(searchContext.url)}
          className="inline-flex items-center gap-1.5 text-sm text-primary-600 hover:text-primary-700 dark:text-primary-400 dark:hover:text-primary-300 transition-colors mb-4"
        >
          <ArrowLeft size={16} />
          Back to &ldquo;{searchContext.query}&rdquo;
          {searchContext.page > 1 && <span className="text-stone-400 text-xs">(page {searchContext.page})</span>}
        </button>
      )}

      <Breadcrumbs
        items={[
          { label: <Text k="articles.breadcrumb" as="span" defaultText="Articles" />, href: "/search?q=" },
          ...(article.family
            ? [{ label: article.family, href: `/search?family=${encodeURIComponent(article.family)}` }]
            : []),
          { label: article.title },
        ]}
      />

      <header className="mb-8">
        <div className="flex flex-wrap items-center gap-2 mb-3">
          {article.category && (
            <Badge variant="sage">{article.category}</Badge>
          )}
          {article.is_boosted && (
            <Badge variant="amber"><Text k="articles.badge_community_supported" as="span" defaultText="Community Supported" /></Badge>
          )}
          {article.verification_status === "community_reviewed" && (
            <Badge variant="green"><Text k="articles.badge_reviewed" as="span" defaultText="Reviewed" /></Badge>
          )}
          {article.verification_status === "cross_referenced" && (
            <Badge variant="blue"><Text k="articles.badge_cross_referenced" as="span" defaultText="Cross-referenced" /></Badge>
          )}
        </div>

        <h1 className="text-3xl sm:text-4xl font-display font-bold text-stone-900 dark:text-stone-100 mb-4">
          {article.title}
        </h1>

        {article.summary && !isSummaryDuplicate && (
          <p className="text-sm text-stone-500 dark:text-stone-400 font-serif italic mb-4 leading-relaxed border-l-2 border-stone-200 dark:border-stone-700 pl-3">
            {article.summary}
          </p>
        )}

        <div className="flex flex-wrap items-center gap-4 text-sm text-stone-500 dark:text-stone-400">
          {article.author_name && (
            <div className="flex items-center gap-2">
              {article.author_avatar ? (
                <img src={article.author_avatar} alt="" className="w-6 h-6 rounded-full" />
              ) : (
                <div className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-xs font-medium text-primary-700 dark:text-primary-400">
                  {article.author_name[0]}
                </div>
              )}
              <span>{article.author_name}</span>
            </div>
          )}
          {article.published_at && (
            <span className="flex items-center gap-1">
              <Calendar size={14} />
              {new Date(article.published_at).toLocaleDateString(locale === "pt" ? "pt-PT" : "en-US", { year: "numeric", month: "long", day: "numeric" })}
            </span>
          )}
          {article.edited_at && (
            <span className="text-xs italic">
              (edited {new Date(article.edited_at).toLocaleDateString()})
            </span>
          )}
          <span className="flex items-center gap-1">
            <Eye size={14} />
            {article.view_count}
          </span>
          <span className="flex items-center gap-1">
            <MessageSquare size={14} />
            {article.comment_count}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-3 mt-3">
          {(article.canonical_url || article.source_url) && (
            <a
              href={article.canonical_url || article.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 text-xs text-primary-600 hover:underline"
            >
              <ExternalLink size={12} />
              <Text k="articles.original_source" as="span" defaultText="Original source" />
            </a>
          )}
          {article.feed_source_id && article.feed_title && (
            <button
              onClick={toggleSubscription}
              className={`inline-flex items-center gap-1 text-xs font-medium px-2.5 py-1 rounded-full transition-colors ${
                isSubscribed
                  ? "bg-primary-50 dark:bg-primary-900/20 text-primary-600 dark:text-primary-400 border border-primary-200/40 dark:border-primary-800/30"
                  : "bg-primary-600 text-cream hover:bg-primary-500"
              }`}
            >
              {isSubscribed ? <Check size={12} /> : <Rss size={12} />}
              {isSubscribed ? <Text k="articles.subscribed" as="span" defaultText="Subscribed" /> : `Subscribe to ${article.feed_title}`}
            </button>
          )}
        </div>
      </header>

      {article.image_url && (
        <img
          src={article.image_url}
          alt={article.title}
          className="w-full rounded-xl mb-8 aspect-video object-cover"
        />
      )}

      {article.body ? (
        <div className="prose prose-stone dark:prose-invert max-w-none font-serif">
          <ArticleEditor data={article.body} readOnly />
        </div>
      ) : article.full_text ? (
        <div className="prose prose-stone dark:prose-invert max-w-none font-serif">
          <p className="text-stone-500 dark:text-stone-400 text-sm mb-4 italic">
            <Text k="articles.indexed_notice" as="span" defaultText="Este artigo foi indexado de uma fonte externa." />{" "}
            <a
              href={article.canonical_url || article.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 hover:underline"
            >
              <Text k="articles.read_original" as="span" defaultText="Ler artigo original" />
            </a>
          </p>
          {article.full_text.split("\n").filter((p: string) => p.trim()).map((p: string, i: number) => (
            <p key={i}>{p}</p>
          ))}
        </div>
      ) : null}

      <div className="mt-12 pt-8 border-t border-stone-200 dark:border-stone-700">
        <ContentRating contentId={article.id} isOwner={isOwner} />
      </div>

      <div className="mt-8">
        <CommentSection entityType="content" entityId={article.id} />
      </div>
    </article>
  );
}
