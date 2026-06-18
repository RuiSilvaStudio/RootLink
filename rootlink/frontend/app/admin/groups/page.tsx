"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/locale-context";
import { Badge } from "@/components/ui/Badge";
import { Search } from "lucide-react";

export default function AdminGroups() {
  const { t } = useLocale();
  const [groups, setGroups] = useState<any[]>([]);
  const [search, setSearch] = useState("");

  const fetchGroups = async () => {
    const params: any = {};
    if (search) params.q = search;
    const data = await api.admin.listGroups(params);
    setGroups(data);
  };

  useEffect(() => { fetchGroups(); }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchGroups();
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t("admin.delete_group_confirm"))) return;
    await api.admin.deleteGroup(id);
    fetchGroups();
  };

  return (
    <div>
      <div className="mb-6">
        <Badge variant="sage" className="mb-3">{t("admin.groups")}</Badge>
        <h1 className="text-3xl sm:text-4xl font-display font-semibold text-stone-800 leading-[1.08]">
          {t("admin.group_management")}
        </h1>
      </div>

      <div className="flex gap-2 mb-5">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("admin.search_group_placeholder")}
              className="pl-9 pr-3 py-2 border border-stone-200/60 rounded-xl text-sm bg-white font-serif focus:outline-none focus:ring-2 focus:ring-primary-500/15 focus:border-primary-400 transition w-56"
            />
          </div>
          <button type="submit" className="px-4 py-2 bg-primary-600 text-cream rounded-xl text-sm font-display font-medium hover:bg-primary-700 transition">
            {t("admin.search")}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100">
                <th className="text-left px-4 py-3 text-xs font-display font-semibold text-stone-400 uppercase tracking-wider">{t("admin.group_name")}</th>
                <th className="text-left px-4 py-3 text-xs font-display font-semibold text-stone-400 uppercase tracking-wider hidden sm:table-cell">{t("admin.category")}</th>
                <th className="text-right px-4 py-3 text-xs font-display font-semibold text-stone-400 uppercase tracking-wider">{t("admin.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {groups.map((g: any) => (
                <tr key={g.id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/50 transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      {g.image_url ? (
                        <img src={g.image_url} alt="" loading="lazy" className="w-8 h-8 rounded-lg object-cover shrink-0" />
                      ) : (
                        <div className="w-8 h-8 rounded-lg bg-primary-100/60 text-primary-600 flex items-center justify-center shrink-0">
                          <span className="text-sm">🏠</span>
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="font-medium text-stone-800 font-serif truncate">{g.name}</p>
                        <p className="text-xs text-stone-400 font-serif sm:hidden">{g.slug}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <Badge variant="sage" className="text-[10px]">{g.category}</Badge>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleDelete(g.id)}
                      className="text-xs bg-stone-100/60 text-stone-500 border border-stone-200/40 px-2.5 py-1 rounded-lg hover:bg-stone-100 font-display font-medium transition"
                    >
                      {t("admin.delete")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {groups.length === 0 && (
          <p className="text-stone-400 text-sm py-8 text-center font-serif">{t("admin.no_groups")}</p>
        )}
      </div>
    </div>
  );
}
