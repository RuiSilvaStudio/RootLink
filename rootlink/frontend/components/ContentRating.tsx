"use client";

import { useEffect, useState } from "react";
import { ThumbsUp, ThumbsDown } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/lib/locale-context";
import { useToast } from "@/lib/toast-context";

const RATING_TAGS = [
  { value: "well-researched", en: "Well researched", pt: "Bem pesquisado" },
  { value: "practical", en: "Practical", pt: "Pratico" },
  { value: "inspiring", en: "Inspiring", pt: "Inspirador" },
  { value: "clear-writing", en: "Clear writing", pt: "Escrita clara" },
  { value: "original", en: "Original", pt: "Original" },
  { value: "community-focused", en: "Community focused", pt: "Foco comunitario" },
];

interface RatingData {
  up_count: number;
  down_count: number;
  top_tags: { tag: string; count: number }[];
  user_reaction: string | null;
}

export default function ContentRating({ contentId, isOwner = false }: { contentId: number; isOwner?: boolean }) {
  const { user } = useAuth();
  const { t, locale } = useLocale();
  const { addToast } = useToast();
  const [rating, setRating] = useState<RatingData | null>(null);
  const [showTags, setShowTags] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    api.ratings.get(contentId).then(setRating).catch(() => {});
  }, [contentId]);

  const handleRate = async (reaction: "up" | "down") => {
    if (!user) {
      addToast("error", "Please log in to rate content");
      return;
    }
    if (isOwner) return;
    setLoading(true);
    try {
      if (rating?.user_reaction === reaction) {
        await api.ratings.remove(contentId);
      } else {
        await api.ratings.rate(contentId, { reaction });
      }
      const updated = await api.ratings.get(contentId);
      setRating(updated);
      if (reaction === "up" && rating?.user_reaction !== "up") {
        setShowTags(true);
      }
    } catch (err: any) {
      addToast("error", err.message);
    }
    setLoading(false);
  };

  const handleTag = async (tag: string) => {
    if (!user) return;
    try {
      await api.ratings.rate(contentId, { reaction: "up", tags: [tag] });
      const updated = await api.ratings.get(contentId);
      setRating(updated);
      setShowTags(false);
    } catch (err: any) {
      addToast("error", err.message);
    }
  };

  if (!rating) return null;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-4">
        <button
          onClick={() => handleRate("up")}
          disabled={loading || isOwner}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors
            ${rating.user_reaction === "up"
              ? "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400"
              : "bg-stone-100 text-stone-600 hover:bg-green-50 dark:bg-stone-800 dark:text-stone-400 dark:hover:bg-green-900/20"
            } ${isOwner ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        >
          <ThumbsUp size={16} />
          <span>{rating.up_count}</span>
        </button>

        <button
          onClick={() => handleRate("down")}
          disabled={loading || isOwner}
          className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm transition-colors
            ${rating.user_reaction === "down"
              ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
              : "bg-stone-100 text-stone-600 hover:bg-red-50 dark:bg-stone-800 dark:text-stone-400 dark:hover:bg-red-900/20"
            } ${isOwner ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
        >
          <ThumbsDown size={16} />
          <span>{rating.down_count}</span>
        </button>
      </div>

      {rating.top_tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {rating.top_tags.map(({ tag, count }) => {
            const meta = RATING_TAGS.find((t) => t.value === tag);
            return (
              <span
                key={tag}
                className="px-2 py-0.5 rounded-full text-xs bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-400"
              >
                {meta ? (locale === "pt" ? meta.pt : meta.en) : tag} ({count})
              </span>
            );
          })}
        </div>
      )}

      {showTags && (
        <div className="flex flex-wrap gap-1.5 animate-fade-in">
          <span className="text-xs text-stone-500 dark:text-stone-400 w-full mb-1">
            What makes this helpful?
          </span>
          {RATING_TAGS.map((tag) => (
            <button
              key={tag.value}
              onClick={() => handleTag(tag.value)}
              className="px-2.5 py-1 rounded-full text-xs bg-primary-50 text-primary-700 hover:bg-primary-100 dark:bg-primary-900/20 dark:text-primary-400 dark:hover:bg-primary-900/40 transition-colors cursor-pointer"
            >
              {locale === "pt" ? tag.pt : tag.en}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
