"use client";

import { useEffect, useState } from "react";
import { ArrowLeft, BarChart3 } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import { EditableText } from "@/components/editor-mode/editable-text";

export default function RankingPage() {
  const [info, setInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.articles.rankingTransparency().then(setInfo).catch(() => {}).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-12">
        <div className="space-y-4">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-stone-100 dark:bg-stone-800 animate-pulse" />
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
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-100 dark:bg-primary-900/30 mb-4">
          <BarChart3 className="w-8 h-8 text-primary-600 dark:text-primary-400" />
        </div>
        <EditableText k="ranking.hero_title" as="h1" className="text-3xl font-display font-bold text-stone-900 dark:text-stone-100 mb-2" />
        <EditableText k="ranking.hero_subtitle" as="p" className="text-stone-600 dark:text-stone-400 font-serif" />
      </div>

      {info && (
        <div className="space-y-6">
          <div className="p-6 rounded-2xl bg-primary-50 dark:bg-primary-900/20 border border-primary-200/40 dark:border-primary-800/30">
            <EditableText k="ranking.formula" as="h2" className="text-lg font-display font-semibold text-stone-900 dark:text-stone-100 mb-3" />
            <code className="block text-sm text-primary-700 dark:text-primary-400 bg-white dark:bg-stone-900 p-4 rounded-lg overflow-x-auto">
              {info.formula}
            </code>
          </div>

          <div className="grid sm:grid-cols-2 gap-4">
            {Object.entries(info.weights).map(([key, weight]) => (
              <div
                key={key}
                className="p-5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700"
              >
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-display font-semibold text-stone-900 dark:text-stone-100 capitalize">
                    {key}
                  </h3>
                  <span className="text-lg font-display font-bold text-primary-600 dark:text-primary-400">
                    {((weight as number) * 100).toFixed(0)}%
                  </span>
                </div>
                <p className="text-xs text-stone-500 dark:text-stone-400 font-serif">
                  {info.descriptions[key]}
                </p>
              </div>
            ))}
          </div>

          <div className="p-6 rounded-2xl bg-stone-50 dark:bg-stone-900/50 border border-stone-200 dark:border-stone-700">
            <EditableText k="ranking.details" as="h2" className="text-lg font-display font-semibold text-stone-900 dark:text-stone-100 mb-4" />
            <ul className="space-y-2 text-sm text-stone-600 dark:text-stone-400 font-serif">
              <li>
                • <strong><EditableText k="ranking.boost_label" as="span" /></strong> {info.boost_slots_per_page}{" "}
                <EditableText k="ranking.boost_text" as="span" />{" "}
                &ldquo;{info.boost_label}&rdquo;
              </li>
              <li>
                • <strong><EditableText k="ranking.time_decay_label" as="span" /></strong>{" "}
                <EditableText k="ranking.half_life_of" as="span" /> {info.freshness_half_life}
              </li>
              <li>
                • <strong><EditableText k="ranking.rating_method_label" as="span" /></strong>{" "}
                {info.rating_method}
              </li>
              <li>
                • <strong><EditableText k="ranking.engagement_signals_label" as="span" /></strong>{" "}
                {info.engagement_signals}
              </li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}
