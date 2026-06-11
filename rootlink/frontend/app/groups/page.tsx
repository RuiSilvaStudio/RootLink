"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Users, Plus, Search, ExternalLink } from "lucide-react";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/locale-context";

export default function GroupsPage() {
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [category, setCategory] = useState("gardening");
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const { t } = useLocale();

  useEffect(() => {
    api.groups.list().then(setGroups).catch(() => {}).finally(() => setLoading(false));
  }, []);

  const suggestTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    const q = `${name} ${description}`.trim();
    if (!q || q.length < 3) { setSuggestions([]); return; }
    setSuggesting(true);
    suggestTimer.current = setTimeout(async () => {
      try {
        const results = await api.groups.search(q);
        setSuggestions(results);
      } catch {} finally { setSuggesting(false); }
    }, 400);
    return () => { if (suggestTimer.current) clearTimeout(suggestTimer.current); };
  }, [name, description]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const group = await api.groups.create({ name, slug, description, category });
      setGroups([group, ...groups]);
      setShowForm(false);
      setName("");
      setSlug("");
      setDescription("");
      setSuggestions([]);
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-stone-800 font-serif">{t("groups.title")}</h1>
          <p className="text-stone-500 mt-1">{t("groups.subtitle")}</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition text-sm"
        >
          <Plus className="w-4 h-4" /> {t("groups.new_group")}
        </button>
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white p-6 rounded-xl border border-stone-200 mb-8 space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">{t("groups.name_label")}</label>
              <input
                type="text"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, ""));
                }}
                required
                className="w-full px-3 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">{t("groups.slug_label")}</label>
              <input
                type="text"
                value={slug}
                onChange={(e) => setSlug(e.target.value)}
                required
                className="w-full px-3 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">{t("groups.category_label")}</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-stone-300 bg-white"
            >
              <option value="gardening">{t("groups.category_gardening")}</option>
              <option value="woodworking">{t("groups.category_woodworking")}</option>
              <option value="craft_trades">{t("groups.category_craft_trades")}</option>
              <option value="homesteading">{t("groups.category_homesteading")}</option>
              <option value="general">{t("groups.category_general")}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">{t("groups.description_label")}</label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>

          {suggestions.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <div className="flex items-center gap-1.5 text-sm font-medium text-blue-800 mb-2">
                <Search className="w-4 h-4" /> {t("groups.similar_groups")}
              </div>
              <div className="space-y-2">
                {suggestions.map((sg) => (
                  <Link key={sg.id} href={`/groups/${sg.id}`}
                    className="flex items-center justify-between bg-white rounded-lg px-3 py-2 border border-blue-100 hover:border-blue-300 transition text-sm">
                    <div>
                      <span className="font-medium text-stone-800">{sg.name}</span>
                      {sg.description && <span className="text-stone-500 ml-2">— {sg.description}</span>}
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-blue-500 shrink-0 ml-2" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <button type="submit" className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition">
              {t("groups.create_group")}
            </button>
            {suggesting && <span className="text-xs text-stone-400">{t("groups.searching")}</span>}
          </div>
        </form>
      )}

      {loading ? (
        <p className="text-stone-500">{t("groups.loading")}</p>
      ) : groups.length === 0 ? (
        <div className="text-center py-20 text-stone-400">
          <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>{t("groups.no_groups")}</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group) => (
            <a
              key={group.id}
              href={`/groups/${group.id}`}
              className="block bg-white p-5 rounded-xl border border-stone-200 hover:shadow-md transition"
            >
              <h3 className="font-semibold text-stone-800 text-lg">{group.name}</h3>
              <p className="text-sm text-stone-500 mt-1 line-clamp-2">
                {group.description || t("groups.no_description")}
              </p>
              <span className="inline-block mt-3 text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded">
                {group.category}
              </span>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
