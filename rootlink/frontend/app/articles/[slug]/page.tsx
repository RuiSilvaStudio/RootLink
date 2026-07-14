"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, Eye, MessageSquare, Bookmark, ExternalLink, Search } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/lib/locale-context";
import { Badge } from "@/components/ui";
import { Breadcrumbs } from "@/components/Breadcrumbs";
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

  useEffect(() => {
    // Check if the user came from the search page (via sessionStorage)
    try {
      const ctx = sessionStorage.getItem("rl_search_context");
      if (ctx) setSearchContext(JSON.parse(ctx));
    } catch {}

    api.articles.get(slug)
      .then(setArticle)
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
        <h1 className="text-2xl font-display font-bold text-stone-900 dark:text-stone-100 mb-2">Article not found</h1>
        <p className="text-stone-500 dark:text-stone-400">This article may have been removed or is still in draft.</p>
        <Link href="/" className="text-primary-600 hover:underline mt-4 inline-block">Go home</Link>
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
          { label: "Articles", href: "/search?q=" },
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
            <Badge variant="amber">Community Supported</Badge>
          )}
          {article.verification_status === "community_reviewed" && (
            <Badge variant="green">Reviewed</Badge>
          )}
          {article.verification_status === "cross_referenced" && (
            <Badge variant="blue">Cross-referenced</Badge>
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

        {(article.canonical_url || article.source_url) && (
          <a
            href={article.canonical_url || article.source_url}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 mt-3 text-xs text-primary-600 hover:underline"
          >
            <ExternalLink size={12} />
            Original source
          </a>
        )}
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
            Este artigo foi indexado de uma fonte externa.{" "}
            <a
              href={article.canonical_url || article.source_url}
              target="_blank"
              rel="noopener noreferrer"
              className="text-primary-600 hover:underline"
            >
              Ler artigo original
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
