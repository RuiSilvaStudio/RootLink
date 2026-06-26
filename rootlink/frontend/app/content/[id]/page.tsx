"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { ExternalLink, Bookmark, Calendar, Globe, Leaf } from "lucide-react";
import { api } from "@/lib/api";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CommentSection } from "@/components/CommentSection";
import { useLocale } from "@/lib/locale-context";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";

export default function ContentDetailPage() {
  const params = useParams();
  const [content, setContent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [bookmarked, setBookmarked] = useState(false);
  const { t } = useLocale();

  useEffect(() => {
    const id = Number(params.id);
    api.content.get(id)
      .then((c) => setContent(c))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [params.id]);

  const handleBookmark = async () => {
    try {
      await api.content.bookmarks.create({ content_id: content.id });
      setBookmarked(true);
    } catch {}
  };

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-12 space-y-6">
        <div className="h-6 w-48 bg-primary-100 dark:bg-primary-950/20 rounded-lg animate-pulse" />
        <div className="space-y-3">
          <div className="h-10 w-3/4 bg-primary-100 dark:bg-primary-950/20 rounded-lg animate-pulse" />
          <div className="h-4 w-full bg-primary-100 dark:bg-primary-950/20 rounded animate-pulse" />
          <div className="h-4 w-5/6 bg-primary-100 dark:bg-primary-950/20 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-20 text-center">
        <Leaf className="w-12 h-12 text-stone-300 mx-auto mb-4" />
        <p className="text-stone-500">{t("content.not_found")}</p>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-12">
      <Breadcrumbs items={[
        { label: t("nav.search"), href: "/search" },
        { label: content.title }
      ]} />

      <article className="mt-6">
        <div className="flex gap-2 mb-5 flex-wrap">
          {content.verification_status === "community_reviewed" && (
            <Badge variant="green" dot>{t("content.community_reviewed")}</Badge>
          )}
          {content.verification_status === "cross_referenced" && (
            <Badge variant="blue" dot>{t("content.cross_referenced")}</Badge>
          )}
          <Badge variant="sage">{content.category}</Badge>
          <Badge variant="stone">{content.content_type}</Badge>
        </div>

        <h1 className="text-3xl sm:text-4xl font-serif font-bold text-stone-800 dark:text-stone-100 leading-tight mb-5">
          {content.title}
        </h1>

        <div className="flex items-center gap-4 text-sm text-stone-500 mb-8 flex-wrap">
          {content.published_at && (
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-stone-00 dark:text-stone-500" />
              {new Date(content.published_at).toLocaleDateString()}
            </span>
          )}
          {content.source_url && (
            <span className="flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-stone-00 dark:text-stone-500" />
              {new URL(content.source_url).hostname}
            </span>
          )}
        </div>

        {content.summary && (
          <div className="bg-primary-50 rounded-2xl p-6 mb-8 border border-primary-100">
            <p className="text-stone-700 leading-relaxed font-light">{content.summary}</p>
          </div>
        )}

        {content.full_text && (
          <div className="text-stone-700 leading-relaxed space-y-5 font-light">
            {content.full_text.split("\n").filter(Boolean).map((p: string, i: number) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        )}

        <div className="flex gap-3 mt-10 pt-6 border-t border-primary-100">
          {content.url && (
            <a href={content.url} target="_blank" rel="noopener noreferrer">
              <Button variant="primary" className="flex items-center gap-2">
                <ExternalLink className="w-4 h-4" /> {t("content.view_original")}
              </Button>
            </a>
          )}
          <Button
            variant="secondary"
            onClick={handleBookmark}
            disabled={bookmarked}
          >
            <Bookmark className={`w-4 h-4 ${bookmarked ? "fill-primary-500 text-primary-500" : ""}`} />
            {bookmarked ? t("content.saved") : t("content.bookmark")}
          </Button>
        </div>
      </article>

      {/* Discussion */}
      <CommentSection entityType="content" entityId={Number(params.id)} />
    </div>
  );
}
