"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { safeImageUrl } from "@/lib/image-url";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/lib/locale-context";
import { useToast } from "@/lib/toast-context";
import { Badge } from "@/components/ui/Badge";
import { Search } from "lucide-react";

export default function AdminGroups() {
  const { t } = useLocale();
  const { user } = useAuth();
  const { addToast } = useToast();
  const isSuperAdmin = user?.role === "super_admin";
  const [groups, setGroups] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  const fetchGroups = async () => {
    const params: any = {};
    if (search) params.q = search;
    const data = await api.admin.listGroups(params);
    setGroups(data);
  };

  useEffect(() => { fetchGroups(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchGroups();
  };

  const handleArchive = async (g: any) => {
    if (!confirm(`Archive "${g.name}"? All members will be notified and the group will be hidden (not deleted). This requires super admin.`)) return;
    try {
      const res = await api.admin.archiveGroup(g.id);
      addToast("success", `Group archived${res?.notified != null ? ` — ${res.notified} member(s) notified` : ""}`);
      fetchGroups();
    } catch (err: any) {
      addToast("error", err.message || "Failed to archive group");
    }
  };

  return (
    <div>
      <div className="mb-6">
        <Badge variant="sage" className="mb-3">{t("admin.groups")}</Badge>
        <h1 className="text-3xl sm:text-4xl font-display font-semibold text-stone-800 dark:text-stone-100 leading-[1.08]">
          {t("admin.group_management")}
        </h1>
      </div>

      <div className="flex gap-2 mb-5">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 dark:text-stone-500" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("admin.search_group_placeholder")}
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
                <th className="text-left px-4 py-3 text-xs font-display font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider">{t("admin.group_name")}</th>
                <th className="text-left px-4 py-3 text-xs font-display font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider hidden sm:table-cell">{t("admin.category")}</th>
                <th className="text-right px-4 py-3 text-xs font-display font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider">{t("admin.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g: any) => (
                <tr key={g.id} className="border-b border-stone-50 dark:border-stone-800 last:border-0 hover:bg-stone-50/50 dark:hover:bg-stone-800/50 transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {g.image_url ? (
                        <img src={safeImageUrl(g.image_url, "/images/placeholder-card.svg")} alt="" loading="lazy" className="w-8 h-8 rounded-lg object-cover shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-primary-100 dark:bg-primary-950/20/60 text-primary-600 flex items-center justify-center shrink-0">
                          <span className="text-sm">🏠</span>
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-medium text-stone-800 dark:text-stone-100 font-serif truncate flex items-center gap-2">
                          {g.name}
                          {g.status === "archived" && <Badge variant="stone" className="text-[10px]">Archived</Badge>}
                        </p>
                        <p className="text-xs text-stone-400 dark:text-stone-500 font-serif sm:hidden">{g.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <Badge variant="sage" className="text-[10px]">{g.category}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {g.status === "archived" ? (
                      <span className="text-xs text-stone-400 dark:text-stone-500 font-serif">Archived</span>
                    ) : isSuperAdmin ? (
                      <button
                        onClick={() => handleArchive(g)}
                        className="text-xs bg-rust-50 text-rust-600 border border-rust-200/60 px-2.5 py-1 rounded-lg hover:bg-rust-100 font-display font-medium transition"
                      >
                        Archive
                      </button>
                    ) : (
                      <span className="text-xs text-stone-300 dark:text-stone-500 font-serif" title="Only a super admin can archive groups">Super admin only</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {groups.length === 0 && (
          <p className="text-stone-400 dark:text-stone-500 text-sm py-8 text-center font-serif">{t("admin.no_groups")}</p>
        )}
      </div>
    </div>
  );
}
