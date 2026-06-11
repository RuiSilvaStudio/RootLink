"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Rss, FileText, Calendar, Users } from "lucide-react";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/locale-context";

const typeIcons: Record<string, any> = {
  content: FileText,
  event: Calendar,
  group: Users,
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
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center gap-3 mb-8">
        <Rss className="w-6 h-6 text-primary-600" />
        <div>
          <h1 className="text-3xl font-bold text-stone-800 font-serif">{t("feed.title")}</h1>
          <p className="text-stone-500 text-sm mt-1">
            {t("feed.subtitle")}
          </p>
        </div>
      </div>

      {loading ? (
        <p className="text-stone-500">{t("feed.loading")}</p>
      ) : feed.length === 0 ? (
        <div className="text-center py-20 text-stone-400">
          <Rss className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p className="text-lg mb-2">{t("feed.empty")}</p>
          <p className="text-sm">
            {t("feed.empty_desc")}
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {feed.map((item, i) => {
            const Icon = typeIcons[item.type] || Rss;
            return (
              <div key={i} className="bg-white p-4 rounded-lg border border-stone-200 flex gap-4 items-start">
                <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center flex-shrink-0 mt-1">
                  <Icon className="w-5 h-5 text-primary-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-stone-700">
                    <span className="font-medium">User #{item.actor_id}</span>{" "}
                    {item.action}{" "}
                    <span className="font-medium text-primary-700">
                      {item.type === "event"
                        ? item.target.title
                        : item.type === "content"
                        ? item.target.title
                        : ""}
                    </span>
                  </p>
                  <p className="text-xs text-stone-400 mt-1">
                    {item.created_at ? new Date(item.created_at).toLocaleString() : ""}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
