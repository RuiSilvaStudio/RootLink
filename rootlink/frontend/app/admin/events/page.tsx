"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { safeImageUrl } from "@/lib/image-url";
import { useLocale } from "@/lib/locale-context";
import { usePermission } from "@/lib/use-permission";
import { useToast } from "@/lib/toast-context";
import { Badge } from "@/components/ui/Badge";
import { Search } from "lucide-react";

const STATUS_VARIANT: Record<string, "green" | "amber" | "stone"> = {
  published: "green",
  draft: "amber",
  archived: "stone",
};

export default function AdminEvents() {
  const { t } = useLocale();
  // Platform-only gate (event.archive is entity_scope="platform" in the
  // registry) — an organization's own super admin must NOT see the button,
  // so this uses can() rather than a bare role === "super_admin" check.
  const { can } = usePermission();
  const canArchive = can("event.archive");
  const { addToast } = useToast();
  const [events, setEvents] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  const fetchEvents = async () => {
    const params: any = {};
    if (search) params.q = search;
    const data = await api.admin.listEvents(params);
    setEvents(data);
  };

  useEffect(() => { fetchEvents(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchEvents();
  };

  const statusLabel = (status: string) => {
    const key = `admin.event_status_${status}`;
    const label = t(key);
    return label === key ? status : label;
  };

  const handleArchive = async (ev: any) => {
    if (!confirm(t("admin.archive_event_confirm", { name: ev.title }))) return;
    try {
      const res = await api.admin.archiveEvent(ev.id);
      addToast("success", t("admin.archive_event_success", { count: res?.notified ?? 0 }));
      fetchEvents();
    } catch (err: any) {
      addToast("error", err.message || t("admin.archive_event_failed"));
    }
  };

  return (
    <div>
      <div className="mb-6">
        <Badge variant="sage" className="mb-3">{t("admin.events")}</Badge>
        <h1 className="text-3xl sm:text-4xl font-display font-semibold text-stone-800 dark:text-stone-100 leading-[1.08]">
          {t("admin.event_management")}
        </h1>
      </div>

      <div className="flex gap-2 mb-5">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 dark:text-stone-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("admin.search_event_placeholder")}
              className="pl-9 pr-3 py-2 border border-stone-200/60 dark:border-stone-800 rounded-xl text-sm bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 font-serif focus:outline-none focus:ring-2 focus:ring-primary-500/15 focus:border-primary-400 transition w-56"
            />
          </div>
          <button type="submit" className="px-4 py-2 bg-primary-600 text-cream rounded-xl text-sm font-display font-medium hover:bg-primary-700 transition">
            {t("admin.search")}
          </button>
        </form>
      </div>

      <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/60 dark:border-stone-800 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 dark:border-stone-800">
                <th className="text-left px-4 py-3 text-xs font-display font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider">{t("admin.event_name")}</th>
                <th className="text-left px-4 py-3 text-xs font-display font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider hidden sm:table-cell">{t("admin.event_date")}</th>
                <th className="text-left px-4 py-3 text-xs font-display font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider hidden md:table-cell">{t("admin.event_creator")}</th>
                <th className="text-left px-4 py-3 text-xs font-display font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider hidden sm:table-cell">{t("admin.event_status")}</th>
                <th className="text-right px-4 py-3 text-xs font-display font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider">{t("admin.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {events.map((ev: any) => (
                <tr key={ev.id} className="border-b border-stone-50 dark:border-stone-800 last:border-0 hover:bg-stone-50/50 dark:hover:bg-stone-800/50 transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {ev.image_url ? (
                        <img src={safeImageUrl(ev.image_url, "/images/placeholder-card.svg")} alt="" loading="lazy" className="w-8 h-8 rounded-lg object-cover shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-950/20/60 text-primary-600 flex items-center justify-center shrink-0">
                          <span className="text-sm">📅</span>
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-medium text-stone-800 dark:text-stone-100 font-serif truncate flex items-center gap-2">
                          {ev.title}
                          {ev.status === "archived" && <Badge variant="stone" className="text-[10px]">{t("admin.archived")}</Badge>}
                        </p>
                        <p className="text-xs text-stone-400 dark:text-stone-500 font-serif sm:hidden">
                          {ev.date ? new Date(ev.date).toLocaleDateString() : "—"}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="text-stone-500 dark:text-stone-300 font-serif text-xs">{ev.date ? new Date(ev.date).toLocaleDateString() : "—"}</span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <span className="text-stone-500 dark:text-stone-300 font-serif text-xs">{ev.creator_name || "—"}</span>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <Badge variant={STATUS_VARIANT[ev.status] || "stone"} className="text-[10px]">{statusLabel(ev.status)}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {ev.status === "archived" ? (
                      <span className="text-xs text-stone-400 dark:text-stone-500 font-serif">{t("admin.archived")}</span>
                    ) : canArchive ? (
                      <button
                        onClick={() => handleArchive(ev)}
                        className="text-xs bg-rust-50 text-rust-600 border border-rust-200/60 px-2.5 py-1 rounded-lg hover:bg-rust-100 font-display font-medium transition"
                      >
                        {t("admin.archive")}
                      </button>
                    ) : (
                      <span className="text-xs text-stone-300 dark:text-stone-500 font-serif" title={t("admin.archive_event_super_admin_hint")}>{t("admin.super_admin_only")}</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {events.length === 0 && (
          <p className="text-stone-400 dark:text-stone-500 text-sm py-8 text-center font-serif">{t("admin.no_events")}</p>
        )}
      </div>
    </div>
  );
}
