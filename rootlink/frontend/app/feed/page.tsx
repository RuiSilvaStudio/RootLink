"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Rss, FileText, Calendar, Users, Sprout } from "lucide-react";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/locale-context";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListSkeleton } from "@/components/ui/LoadingSkeleton";

const typeIcons: Record<string, any> = {
  content: FileText,
  event: Calendar,
  group: Users,
};

const typeColors: Record<string, string> = {
  content: "bg-primary-100 text-primary-600",
  event: "bg-earth-100 text-earth-600",
  group: "bg-blue-100 text-blue-600",
};

export default function FeedPage() {
  const { t } = useLocale();
  const router = useRouter();
  const [feed, setFeed] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/auth/login");
      return;
    }
    api.social.feed().then(setFeed).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-12">
      <PageHeader
        icon={<Rss className="w-5 h-5 text-primary-500" />}
        title={t("feed.title")}
        subtitle={t("feed.subtitle")}
      />

      {loading ? (
        <ListSkeleton count={6} />
      ) : feed.length === 0 ? (
        <EmptyState
          icon={<Rss className="w-7 h-7" />}
          title={t("feed.empty")}
          message={t("feed.empty_desc")}
        />
      ) : (
        <div className="space-y-3">
          {feed.map((item, i) => {
            const Icon = typeIcons[item.type] || Rss;
            const colorClass = typeColors[item.type] || "bg-primary-100 text-primary-600";
            return (
              <div key={i} className="rounded-2xl border border-primary-100/40 bg-white p-5 flex items-start gap-4 transition-shadow hover:shadow-md">
                <div className={`w-10 h-10 rounded-xl ${colorClass} flex items-center justify-center shrink-0 mt-0.5`}>
                  <Icon className="w-5 h-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-stone-700 text-sm">
                    <span className="font-medium text-stone-800">User #{item.actor_id}</span>{" "}
                    {item.action}{" "}
                    {item.target?.title && (
                      <span className="font-medium text-primary-700">{item.target.title}</span>
                    )}
                  </p>
                  <p className="text-xs text-stone-400 mt-1.5">
                    {item.created_at ? new Date(item.created_at).toLocaleString() : ""}
                  </p>
                </div>
                {item.type && (
                  <Badge variant="stone" className="shrink-0 capitalize">{item.type}</Badge>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
