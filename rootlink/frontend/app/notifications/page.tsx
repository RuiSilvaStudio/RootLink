"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck, Info } from "lucide-react";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/locale-context";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListSkeleton } from "@/components/ui/LoadingSkeleton";

export default function NotificationsPage() {
  const { t } = useLocale();
  const router = useRouter();
  const [notifs, setNotifs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/auth/login");
      return;
    }
    api.notifications.list().then(setNotifs).catch(() => {}).finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const markAllRead = async () => {
    await api.notifications.markAllRead();
    setNotifs(notifs.map((n) => ({ ...n, read: true })));
  };

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-8 py-12">
      <PageHeader
        icon={<Bell className="w-5 h-5 text-primary-500" />}
        title={t("notifications.title")}
        action={
          notifs.length > 0 ? (
            <Button variant="secondary" size="sm" onClick={markAllRead}>
              <CheckCheck className="w-4 h-4" /> {t("notifications.mark_all_read")}
            </Button>
          ) : undefined
        }
      />

      {loading ? (
        <ListSkeleton count={5} />
      ) : notifs.length === 0 ? (
        <EmptyState
          icon={<Bell className="w-7 h-7" />}
          title={t("notifications.empty")}
          message={t("notifications.empty_desc") || "You'll see notifications here when someone interacts with your content."}
        />
      ) : (
        <div className="space-y-2">
          {notifs.map((n) => (
            <a
              key={n.id}
              href={n.link || "#"}
              className={`block p-5 rounded-2xl border transition ${
                n.read
                  ? "bg-white border-primary-100"
                  : "bg-primary-50 border-primary-200"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-2.5 h-2.5 rounded-full mt-1.5 shrink-0 ${
                  n.read ? "bg-transparent" : "bg-primary-500"
                }`} />
                <div className="flex-1 min-w-0">
                  <p className={`text-sm ${n.read ? "text-stone-600" : "text-stone-800 dark:text-stone-100 font-medium"}`}>
                    {n.message}
                  </p>
                  <p className="text-xs text-stone-400 mt-1">
                    {n.created_at ? new Date(n.created_at).toLocaleString() : ""}
                  </p>
                </div>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
