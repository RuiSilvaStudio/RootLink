"use client";

import { useState, useEffect } from "react";
import { Search, Leaf, TreePine, Wrench, Users, BookOpen, Calendar, CheckSquare, Droplets } from "lucide-react";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/locale-context";

const categories = [
  { tKey: "search.category_gardening", slug: "gardening", icon: Leaf, color: "bg-green-100 text-green-700" },
  { tKey: "search.category_woodworking", slug: "woodworking", icon: TreePine, color: "bg-amber-100 text-amber-700" },
  { tKey: "search.category_craft_trades", slug: "craft_trades", icon: Wrench, color: "bg-stone-100 text-stone-700" },
];

export default function Home() {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [recent, setRecent] = useState<any[]>([]);
  const [searched, setSearched] = useState(false);
  const { t } = useLocale();

  useEffect(() => {
    api.content.recent(8).then(setRecent).catch(() => {});
  }, []);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setSearched(true);
    const res = await api.content.search({ q: query });
    setResults(res.results);
  };

  return (
    <div>
      <section className="bg-gradient-to-b from-primary-50 to-stone-50 py-20 px-4">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-5xl font-bold text-primary-900 font-serif mb-4">
            {t("home.hero_title")}
          </h1>
          <p className="text-xl text-stone-600 mb-8 max-w-2xl mx-auto">
            {t("home.hero_subtitle")}
          </p>
          <form onSubmit={handleSearch} className="max-w-2xl mx-auto">
            <div className="relative">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 w-5 h-5" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={t("home.search_placeholder")}
                className="w-full pl-12 pr-4 py-4 rounded-xl border border-stone-300 bg-white shadow-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent text-lg"
              />
            </div>
          </form>
          {searched && (
            <div className="mt-8 text-left max-w-2xl mx-auto">
              {results.length === 0 ? (
                <p className="text-stone-500 text-center">{t("home.no_results")}</p>
              ) : (
                <div className="space-y-4">
                  {results.map((r: any) => (
                    <a
                      key={r.content.id}
                      href={r.content.url || `/content/${r.content.id}`}
                      target={r.content.url ? "_blank" : undefined}
                      rel={r.content.url ? "noopener noreferrer" : undefined}
                      className="block bg-white p-4 rounded-lg border border-stone-200 hover:shadow-md transition"
                    >
                      <h3 className="font-semibold text-primary-800">{r.content.title}</h3>
                      <p className="text-sm text-stone-600 mt-1">
                        {r.content.summary?.slice(0, 200)}...
                      </p>
                      <div className="flex gap-2 mt-2 flex-wrap">
                        {r.content.verification_status === "community_reviewed" && (
                          <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">
                            {t("home.reviewed")}
                          </span>
                        )}
                        {r.content.verification_status === "cross_referenced" && (
                          <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-medium">
                            {t("home.cross_ref")}
                          </span>
                        )}
                        <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded">
                          {r.content.category}
                        </span>
                        <span className="text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded">
                          {r.content.content_type}
                        </span>
                        <span className="text-xs text-stone-400 ml-auto">
                          {Math.round(r.score * 100)}% match
                        </span>
                      </div>
                    </a>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="py-16 px-4 max-w-6xl mx-auto">
        <h2 className="text-2xl font-bold text-stone-800 font-serif mb-8">
          {t("home.browse_category")}
        </h2>
        <div className="grid md:grid-cols-3 gap-6">
          {categories.map((cat) => (
            <a
              key={cat.slug}
              href={`/search?category=${cat.slug}`}
              className={`p-6 rounded-xl border border-stone-200 bg-white hover:shadow-lg transition group ${cat.color}`}
            >
              <cat.icon className="w-10 h-10 mb-4" />
              <h3 className="text-xl font-semibold mb-2">{t(cat.tKey)}</h3>
              <p className="text-stone-600 text-sm">
                {t("home.discover_category", { category: t(cat.tKey).toLowerCase() })}
              </p>
            </a>
          ))}
        </div>
      </section>

      <section className="py-16 px-4 max-w-6xl mx-auto">
        <h2 className="text-2xl font-bold text-stone-800 font-serif mb-8">
          {t("home.featured_tools")}
        </h2>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <a href="/tools/gardening-calendar" className="p-6 rounded-xl border border-stone-200 bg-white hover:shadow-lg transition group">
            <Calendar className="w-10 h-10 mb-3 text-green-600" />
            <h3 className="text-lg font-semibold text-stone-800 mb-1">{t("home.gardening_calendar")}</h3>
            <p className="text-sm text-stone-500">{t("home.gardening_calendar_desc")}</p>
          </a>
          <a href="/tools/monthly-checklist" className="p-6 rounded-xl border border-stone-200 bg-white hover:shadow-lg transition group">
            <CheckSquare className="w-10 h-10 mb-3 text-amber-600" />
            <h3 className="text-lg font-semibold text-stone-800 mb-1">{t("home.monthly_checklist")}</h3>
            <p className="text-sm text-stone-500">{t("home.monthly_checklist_desc")}</p>
          </a>
          <a href="/tools/irrigation-calculator" className="p-6 rounded-xl border border-stone-200 bg-white hover:shadow-lg transition group">
            <Droplets className="w-10 h-10 mb-3 text-blue-600" />
            <h3 className="text-lg font-semibold text-stone-800 mb-1">{t("home.irrigation_calculator")}</h3>
            <p className="text-sm text-stone-500">{t("home.irrigation_calculator_desc")}</p>
          </a>
        </div>
      </section>

      <section className="bg-stone-100 py-16 px-4">
        <div className="max-w-6xl mx-auto grid md:grid-cols-3 gap-8">
          <div className="text-center p-6">
            <Users className="w-12 h-12 text-primary-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-stone-800">{t("home.community")}</h3>
            <p className="text-stone-600 mt-2">
              {t("home.community_desc")}
            </p>
          </div>
          <div className="text-center p-6">
            <BookOpen className="w-12 h-12 text-primary-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-stone-800">{t("home.learning")}</h3>
            <p className="text-stone-600 mt-2">
              {t("home.learning_desc")}
            </p>
          </div>
          <div className="text-center p-6">
            <Calendar className="w-12 h-12 text-primary-600 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-stone-800">{t("home.events")}</h3>
            <p className="text-stone-600 mt-2">
              {t("home.events_desc")}
            </p>
          </div>
        </div>
      </section>

      {recent.length > 0 && (
        <section className="py-16 px-4 max-w-6xl mx-auto">
          <h2 className="text-2xl font-bold text-stone-800 font-serif mb-8">
            {t("home.recently_indexed")}
          </h2>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {recent.map((item: any) => (
              <a
                key={item.id}
                href={item.url || "#"}
                className="block bg-white p-4 rounded-lg border border-stone-200 hover:shadow-md transition"
              >
                <h3 className="font-medium text-stone-800 line-clamp-2">
                  {item.title}
                </h3>
                <p className="text-xs text-stone-400 mt-2">
                  {item.category} · {item.content_type}
                </p>
              </a>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
