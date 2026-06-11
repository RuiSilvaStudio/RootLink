"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/locale-context";

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
      <h1 className="text-2xl font-bold text-stone-800 mb-6">{t("admin.group_management")}</h1>

      <div className="flex gap-3 mb-4">
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("admin.search_group_placeholder")}
            className="border border-stone-300 rounded-lg px-3 py-1.5 text-sm w-56"
          />
          <button type="submit" className="bg-primary-600 text-white px-3 py-1.5 rounded-lg text-sm">
            {t("admin.search")}
          </button>
        </form>
      </div>

      <div className="space-y-2">
        {groups.map((g: any) => (
          <div key={g.id} className="flex items-center gap-3 bg-stone-50 rounded-lg p-3 border border-stone-200">
            {g.image_url ? (
              <img src={g.image_url} alt="" className="w-10 h-10 rounded-lg object-cover shrink-0" />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-primary-100 text-primary-700 flex items-center justify-center text-lg shrink-0">
                🏠
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="font-medium text-stone-800">{g.name}</p>
              <p className="text-xs text-stone-400">
                {g.slug} · {g.category}
              </p>
            </div>
            <button
              onClick={() => handleDelete(g.id)}
              className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200 shrink-0"
            >
              {t("admin.delete")}
            </button>
          </div>
        ))}
        {groups.length === 0 && (
          <p className="text-stone-400 text-sm py-8 text-center">{t("admin.no_groups")}</p>
        )}
      </div>
    </div>
  );
}
