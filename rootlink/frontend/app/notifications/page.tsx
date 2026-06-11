"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Bell, CheckCheck } from "lucide-react";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/locale-context";

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
  }, []);

  const markAllRead = async () => {
    await api.notifications.markAllRead();
    setNotifs(notifs.map((n) => ({ ...n, read: true })));
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-3">
          <Bell className="w-6 h-6 text-primary-600" />
          <h1 className="text-3xl font-bold text-stone-800 font-serif">{t("notifications.title")}</h1>
        </div>
        <button
          onClick={markAllRead}
          className="flex items-center gap-1 text-sm text-primary-600 hover:underline"
        >
          <CheckCheck className="w-4 h-4" /> {t("notifications.mark_all_read")}
        </button>
      </div>

      {loading ? (
        <p className="text-stone-500">{t("notifications.loading")}</p>
      ) : notifs.length === 0 ? (
        <div className="text-center py-20 text-stone-400">
          <Bell className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>{t("notifications.empty")}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {notifs.map((n) => (
            <a
              key={n.id}
              href={n.link || "#"}
              className={`block p-4 rounded-lg border transition ${
                n.read
                  ? "bg-white border-stone-200"
                  : "bg-primary-50 border-primary-200"
              }`}
            >
              <div className="flex items-start gap-3">
                <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${
                  n.read ? "bg-transparent" : "bg-primary-500"
                }`} />
                <div>
                  <p className="text-stone-700">{n.message}</p>
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
