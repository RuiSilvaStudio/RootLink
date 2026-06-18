"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/locale-context";
import { Send, CheckCircle, Globe, Leaf, ExternalLink, TrendingUp, AlertTriangle, CheckSquare, Eye } from "lucide-react";
import { StatCounter } from "@/components/ui/StatCounter";
import { Badge } from "@/components/ui/Badge";

export default function AdminDashboard() {
  const { t } = useLocale();
  const [stats, setStats] = useState<any>(null);
  const [trending, setTrending] = useState<{ query: string; count: number }[]>([]);

  useEffect(() => {
    api.admin.dashboard().then(setStats);
    api.admin.trendingSearches(10).then(setTrending).catch(() => {});
  }, []);

  if (!stats) return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="rounded-2xl p-5 bg-stone-200/40 animate-pulse h-28" />
      ))}
    </div>
  );

  const overviewStats = [
    { label: t("admin.stat_users"), value: stats.users },
    { label: t("admin.stat_content"), value: stats.content },
    { label: t("admin.stat_groups"), value: stats.groups },
    { label: t("admin.stat_events"), value: stats.events },
    { label: t("admin.stat_courses"), value: stats.courses },
  ];

  const contentStatus = [
    { label: t("admin.stat_unreviewed"), value: stats.unreviewed_content, icon: AlertTriangle, color: "bg-amber-100/60 text-amber-700 border-amber-200/40" },
    { label: t("admin.stat_cross_referenced"), value: stats.cross_referenced_content, icon: Eye, color: "bg-sky-100/60 text-sky-700 border-sky-200/40" },
    { label: t("admin.stat_reviewed"), value: (stats.content || 0) - (stats.unreviewed_content || 0) - (stats.cross_referenced_content || 0), icon: CheckSquare, color: "bg-emerald-100/60 text-emerald-700 border-emerald-200/40" },
  ];

  return (
    <div>
      <div className="mb-8">
        <Badge variant="sage" className="mb-3">{t("admin.dashboard")}</Badge>
        <h1 className="text-3xl sm:text-4xl font-display font-semibold text-stone-800 leading-[1.08]">
          {t("admin.dashboard_title")}
        </h1>
      </div>

      {/* Overview stats — editorial grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3 mb-8">
        {overviewStats.map((s) => (
          <div key={s.label} className="bg-white rounded-2xl border border-stone-200/60 p-5">
            <StatCounter value={s.value} label={s.label} duration={800} />
          </div>
        ))}
      </div>

      {/* Content status — task count pattern (GoAgri inspired) */}
      <div className="mb-8">
        <h2 className="text-sm font-display font-semibold text-stone-500 uppercase tracking-[0.12em] mb-3">
          {t("admin.content_status")}
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {contentStatus.map((s) => (
            <Link
              key={s.label}
              href="/admin/review-queue"
              className={`flex items-center gap-4 rounded-2xl border p-5 transition hover:shadow-sm ${s.color}`}
            >
              <s.icon className="w-6 h-6 shrink-0 opacity-60" />
              <div>
                <p className="text-3xl font-display font-semibold leading-none">{s.value}</p>
                <p className="text-sm mt-1 opacity-70 font-serif">{s.label}</p>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Quick actions */}
      <div className="mb-8">
        <h2 className="text-sm font-display font-semibold text-stone-500 uppercase tracking-[0.12em] mb-3">
          {t("admin.quick_actions")}
        </h2>
        <div className="flex flex-wrap gap-2">
          {[
            { href: "/admin/review-queue", label: t("admin.review_queue"), icon: CheckCircle },
            { href: "/admin/notifications", label: t("admin.broadcast"), icon: Send },
            { href: "/admin/plants", label: t("admin.plant_add"), icon: Leaf },
            { href: "/admin/submit", label: t("admin.submit_url"), icon: Globe },
          ].map((a) => (
            <Link
              key={a.href}
              href={a.href}
              className="flex items-center gap-2 px-4 py-2.5 bg-white border border-stone-200/60 rounded-xl text-sm text-stone-600 hover:border-primary-300 hover:text-primary-700 hover:bg-primary-50/30 transition font-serif"
            >
              <a.icon className="w-4 h-4" />
              {a.label}
            </Link>
          ))}
        </div>
      </div>

      {/* Trending searches */}
      {trending.length > 0 && (
        <div>
          <h2 className="text-sm font-display font-semibold text-stone-500 uppercase tracking-[0.12em] mb-3">
            {t("admin.trending_searches")}
          </h2>
          <div className="bg-white rounded-2xl border border-stone-200/60 divide-y divide-stone-100 max-w-lg">
            {trending.map((item, i) => (
              <div key={item.query} className="flex items-center justify-between px-4 py-3 text-sm">
                <span className="text-stone-700 font-serif flex items-center gap-2">
                  <span className="text-stone-300 font-display text-xs w-5 text-right">#{i + 1}</span>
                  {item.query}
                </span>
                <span className="text-stone-400 text-xs font-display">{item.count}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
