"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/locale-context";

export default function AdminDashboard() {
  const { t } = useLocale();
  const [stats, setStats] = useState<any>(null);
  const [trending, setTrending] = useState<{ query: string; count: number }[]>([]);

  useEffect(() => {
    api.admin.dashboard().then(setStats);
    api.admin.trendingSearches(10).then(setTrending).catch(() => {});
  }, []);

  if (!stats) return <p className="text-stone-400">{t("admin.loading_stats")}</p>;

  const cards = [
    { label: t("admin.stat_users"), value: stats.users, color: "bg-blue-50 text-blue-700" },
    { label: t("admin.stat_content"), value: stats.content, color: "bg-green-50 text-green-700" },
    { label: t("admin.stat_groups"), value: stats.groups, color: "bg-purple-50 text-purple-700" },
    { label: t("admin.stat_comments"), value: stats.comments, color: "bg-amber-50 text-amber-700" },
    { label: t("admin.stat_events"), value: stats.events, color: "bg-pink-50 text-pink-700" },
    { label: t("admin.stat_courses"), value: stats.courses, color: "bg-indigo-50 text-indigo-700" },
    { label: t("admin.stat_enrollments"), value: stats.enrollments, color: "bg-teal-50 text-teal-700" },
    { label: t("admin.stat_unreviewed"), value: stats.unreviewed_content, color: "bg-red-50 text-red-700" },
    { label: t("admin.stat_cross_referenced"), value: stats.cross_referenced_content, color: "bg-blue-50 text-blue-700" },
  ];

  return (
    <div>
      <h1 className="text-2xl font-bold text-stone-800 mb-6">{t("admin.dashboard_title")}</h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {cards.map((card) => (
          <div key={card.label} className={`rounded-xl p-5 ${card.color}`}>
            <p className="text-3xl font-bold">{card.value}</p>
            <p className="text-sm mt-1 opacity-80">{card.label}</p>
          </div>
        ))}
      </div>

      {trending.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-stone-700 mb-3">{t("admin.trending_searches")}</h2>
          <div className="bg-stone-50 rounded-xl border border-stone-200 divide-y divide-stone-200 max-w-md">
            {trending.map((item, i) => (
              <div key={item.query} className="flex items-center justify-between px-4 py-2.5 text-sm">
                <span className="text-stone-700">
                  <span className="text-stone-400 mr-2 font-mono">#{i + 1}</span>
                  {item.query}
                </span>
                <span className="text-stone-400 text-xs">{t("admin.trending_count", { count: item.count })}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
