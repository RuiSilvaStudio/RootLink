"use client";

import { useEffect, useState } from "react";
import { Trophy, ArrowLeft, Heart } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/locale-context";
import { Button } from "@/components/ui";

export default function LeaderboardPage() {
  const { locale } = useLocale();
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.points.leaderboard(50).then(setLeaderboard).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-12">
        <div className="space-y-3">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-stone-100 dark:bg-stone-800 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-12">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200 transition-colors mb-8"
      >
        <ArrowLeft size={16} />
        Back
      </Link>

      <div className="text-center mb-10">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-amber-100 dark:bg-amber-900/30 mb-4">
          <Trophy className="w-8 h-8 text-amber-600 dark:text-amber-400" />
        </div>
        <h1 className="text-3xl font-display font-bold text-stone-900 dark:text-stone-100 mb-2">
          {locale === "pt" ? "Classificação de Doadores" : "Donor Leaderboard"}
        </h1>
        <p className="text-stone-600 dark:text-stone-400 font-serif">
          {locale === "pt"
            ? "Reconhecimento aos membros que mais apoiam a comunidade RootLink."
            : "Recognizing members who most support the RootLink community."}
        </p>
      </div>

      {leaderboard.length === 0 ? (
        <div className="text-center py-12">
          <Heart className="w-12 h-12 text-stone-300 dark:text-stone-600 mx-auto mb-4" />
          <p className="text-stone-500 dark:text-stone-400 font-serif">
            {locale === "pt" ? "Ainda não há doadores. Seja o primeiro!" : "No donors yet. Be the first!"}
          </p>
          <Link href="/donate" className="mt-4 inline-block">
            <Button variant="primary">{locale === "pt" ? "Doar agora" : "Donate now"}</Button>
          </Link>
        </div>
      ) : (
        <div className="space-y-2">
          {leaderboard.map((entry, i) => (
            <div
              key={entry.user_id}
              className={`flex items-center justify-between p-4 rounded-xl border transition-colors ${
                i === 0
                  ? "bg-amber-50 dark:bg-amber-900/10 border-amber-200 dark:border-amber-800/30"
                  : i === 1
                  ? "bg-stone-50 dark:bg-stone-800/50 border-stone-200 dark:border-stone-700"
                  : i === 2
                  ? "bg-orange-50 dark:bg-orange-900/10 border-orange-200 dark:border-orange-800/30"
                  : "bg-white dark:bg-stone-900 border-stone-200 dark:border-stone-700"
              }`}
            >
              <div className="flex items-center gap-4">
                <span
                  className={`text-lg font-display font-bold w-8 ${
                    i === 0
                      ? "text-amber-600 dark:text-amber-400"
                      : i === 1
                      ? "text-stone-500 dark:text-stone-400"
                      : i === 2
                      ? "text-orange-600 dark:text-orange-400"
                      : "text-stone-400 dark:text-stone-500"
                  }`}
                >
                  {i + 1}
                </span>
                {entry.avatar_url ? (
                  <img src={entry.avatar_url} alt="" className="w-10 h-10 rounded-full" />
                ) : (
                  <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-sm font-medium text-primary-700 dark:text-primary-400">
                    {entry.name[0]}
                  </div>
                )}
                <div>
                  <p className="text-sm font-medium text-stone-700 dark:text-stone-300">
                    {entry.name}
                  </p>
                  {i < 3 && (
                    <p className="text-xs text-stone-400 dark:text-stone-500">
                      {i === 0
                        ? locale === "pt" ? "Ouro" : "Gold"
                        : i === 1
                        ? locale === "pt" ? "Prata" : "Silver"
                        : locale === "pt" ? "Bronze" : "Bronze"}
                    </p>
                  )}
                </div>
              </div>
              <span className="text-sm font-display font-semibold text-primary-600 dark:text-primary-400">
                €{entry.total_donated.toFixed(0)}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
