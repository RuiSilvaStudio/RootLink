"use client";

import { useState, useEffect, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { Search, Filter } from "lucide-react";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/locale-context";

function SearchContent() {
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [category, setCategory] = useState(searchParams.get("category") || "");
  const [contentType, setContentType] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  const categories = [
    { label: t("search.all"), value: "" },
    { label: t("search.category_gardening"), value: "gardening" },
    { label: t("search.category_woodworking"), value: "woodworking" },
    { label: t("search.category_craft_trades"), value: "craft_trades" },
    { label: t("search.category_homesteading"), value: "homesteading" },
  ];

  const contentTypes = [
    { label: t("search.type_all"), value: "" },
    { label: t("search.type_articles"), value: "article" },
    { label: t("search.type_events"), value: "event" },
    { label: t("search.type_courses"), value: "course" },
    { label: t("search.type_videos"), value: "video" },
  ];

  useEffect(() => {
    const q = searchParams.get("q");
    const cat = searchParams.get("category");
    if (q) {
      setQuery(q);
      doSearch(q, cat || "");
    }
  }, []);

  const doSearch = async (
    q: string,
    cat?: string,
    ct?: string
  ) => {
    if (!q.trim()) return;
    setLoading(true);
    setSearched(true);
    try {
      const res = await api.content.search({
        q,
        category: cat || category,
        content_type: ct || contentType,
      });
      setResults(res.results);
      setTotal(res.total);
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    doSearch(query);
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <form onSubmit={handleSubmit} className="mb-8">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 w-5 h-5" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={t("search.placeholder")}
            className="w-full pl-12 pr-4 py-3 rounded-xl border border-stone-300 bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </form>

      <div className="flex gap-4 mb-6 flex-wrap">
        <div className="flex items-center gap-2">
          <Filter className="w-4 h-4 text-stone-500" />
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              if (query) doSearch(query, e.target.value, contentType);
            }}
            className="text-sm border border-stone-300 rounded-lg px-3 py-1.5 bg-white"
          >
            {categories.map((c) => (
              <option key={c.value} value={c.value}>
                {c.label}
              </option>
            ))}
          </select>
          <select
            value={contentType}
            onChange={(e) => {
              setContentType(e.target.value);
              if (query) doSearch(query, category, e.target.value);
            }}
            className="text-sm border border-stone-300 rounded-lg px-3 py-1.5 bg-white"
          >
            {contentTypes.map((ct) => (
              <option key={ct.value} value={ct.value}>
                {ct.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {loading && <p className="text-stone-500">{t("search.searching")}</p>}

      {searched && !loading && (
        <>
          <p className="text-sm text-stone-500 mb-4">
            {t("search.results_for", { total, query })}
          </p>
          {results.length === 0 ? (
            <p className="text-stone-500">{t("search.no_results")}</p>
          ) : (
            <div className="space-y-4">
              {results.map((r: any) => (
                <a
                  key={r.content.id}
                  href={r.content.url || `/content/${r.content.id}`}
                  target={r.content.url ? "_blank" : undefined}
                  rel={r.content.url ? "noopener noreferrer" : undefined}
                  className="block bg-white p-5 rounded-lg border border-stone-200 hover:shadow-md transition"
                >
                  <h3 className="font-semibold text-primary-800 text-lg">
                    {r.content.title}
                  </h3>
                  <p className="text-stone-600 mt-1 text-sm">
                    {r.content.summary?.slice(0, 300)}...
                  </p>
                  <div className="flex gap-2 mt-3 flex-wrap">
                    {r.content.verification_status === "community_reviewed" && (
                      <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium flex items-center gap-1">
                        {t("search.community_reviewed")}
                      </span>
                    )}
                    {r.content.verification_status === "cross_referenced" && (
                      <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-medium flex items-center gap-1">
                        {t("search.cross_referenced")}
                      </span>
                    )}
                    <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded">
                      {r.content.category}
                    </span>
                    <span className="text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded">
                      {r.content.content_type}
                    </span>
                    {r.content.source_url && (
                      <span className="text-xs text-stone-400 truncate max-w-[200px]">
                        {new URL(r.content.source_url).hostname}
                      </span>
                    )}
                    <span className="text-xs text-stone-400 ml-auto">
                      {Math.round(r.score * 100)}% relevance
                    </span>
                  </div>
                </a>
              ))}
            </div>
          )}
        </>
      )}

      {!searched && (
        <div className="text-center py-20 text-stone-400">
          <Search className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>{t("search.enter_term")}</p>
        </div>
      )}
    </div>
  );
}

export default function SearchPage() {
  const { t } = useLocale();
  return (
    <Suspense fallback={<div className="p-8">{t("search.loading")}</div>}>
      <SearchContent />
      <div className="max-w-5xl mx-auto px-4 pb-12 -mt-4">
        <div className="bg-stone-50 border border-stone-200 rounded-xl p-5 text-center">
          <p className="text-stone-600 text-sm mb-2">
            {t("search.cant_find")}
          </p>
          <a
            href="/submit"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-700 hover:text-primary-800 bg-primary-100 hover:bg-primary-200 px-4 py-2 rounded-lg transition"
          >
            {t("search.submit_link")}
          </a>
        </div>
      </div>
    </Suspense>
  );
}
