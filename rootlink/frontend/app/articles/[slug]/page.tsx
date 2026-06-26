"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Calendar, Eye, MessageSquare, Bookmark, ExternalLink } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/lib/locale-context";
import { Badge } from "@/components/ui";
import ArticleEditor from "@/components/editor/ArticleEditor";
import ContentRating from "@/components/ContentRating";
import { CommentSection } from "@/components/CommentSection";

export default function ArticleViewPage() {
  const params = useParams();
  const slug = params.slug as string;
  const { user } = useAuth();
  const { locale } = useLocale();
  const [article, setArticle] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  useEffect(() => {
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

  return (
    <article className="max-w-3xl mx-auto px-4 sm:px-8 py-12">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200 transition-colors mb-8"
      >
        <ArrowLeft size={16} />
        Back
      </Link>

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

        {article.summary && (
          <p className="text-lg text-stone-600 dark:text-stone-400 font-serif mb-4">
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

        {article.canonical_url && (
          <a
            href={article.canonical_url}
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

      <div className="prose prose-stone dark:prose-invert max-w-none font-serif">
        <ArticleEditor data={article.body} readOnly />
      </div>

      <div className="mt-12 pt-8 border-t border-stone-200 dark:border-stone-700">
        <ContentRating contentId={article.id} isOwner={isOwner} />
      </div>

      <div className="mt-8">
        <CommentSection entityType="content" entityId={article.id} />
      </div>
    </article>
  );
}
