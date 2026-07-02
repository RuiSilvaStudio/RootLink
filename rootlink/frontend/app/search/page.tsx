"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { Search, Filter, ArrowRight, TrendingUp, Sparkles, X } from "lucide-react";
import { api } from "@/lib/api";
import { safeImageUrl } from "@/lib/image-url";
import { useLocale } from "@/lib/locale-context";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui/EmptyState";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";
import { ArticleCard } from "@/components/search/ArticleCard";
import { CourseCard } from "@/components/search/CourseCard";
import { EventCard } from "@/components/search/EventCard";
import { GroupCard } from "@/components/search/GroupCard";
import { PlantCard } from "@/components/search/PlantCard";
import { ExternalCard } from "@/components/search/ExternalCard";
import { MoonWidget } from "@/components/search/MoonWidget";
import { SunWidget } from "@/components/search/SunWidget";
import { RelatedGroups } from "@/components/search/RelatedGroups";
import { EditableText } from "@/components/editor-mode/editable-text";
import { SpeciesWidget } from "@/components/search/SpeciesWidget";

const PAGE_SIZE = 10;

const ResultCard = ({ item }: { item: any }) => {
  switch (item.content.content_type) {
    case "course": return <CourseCard item={item} />;
    case "event": return <EventCard item={item} />;
    case "group": return <GroupCard item={item} />;
    case "plant": return <PlantCard item={item} />;
    case "video": return <ArticleCard item={item} />;
    default: return <ArticleCard item={item} />;
  }
};

function SearchContent() {
  const { t } = useLocale();
  const searchParams = useSearchParams();
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState(searchParams.get("q") || "");
  const [category, setCategory] = useState(searchParams.get("category") || "");
  const [family, setFamily] = useState(searchParams.get("family") || "");
  const [contentType, setContentType] = useState("");
  const [results, setResults] = useState<any[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [page, setPage] = useState(1);
  const [popular, setPopular] = useState<any[]>([]);
  const [trending, setTrending] = useState<{ query: string; count: number }[]>([]);
  const [initLoading, setInitLoading] = useState(true);
  const [families, setFamilies] = useState<any[]>([]);
  const [familyCategories, setFamilyCategories] = useState<any[]>([]);

  // Autocomplete
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [selectedSuggestion, setSelectedSuggestion] = useState(-1);
  const suggestionsRef = useRef<HTMLDivElement>(null);

  // Recent searches (localStorage)
  const [recentSearches, setRecentSearches] = useState<string[]>([]);

  const { locale } = useLocale();

  const contentTypes = [
    { label: t("search.type_all"), value: "" },
    { label: t("search.type_articles"), value: "article" },
    { label: t("search.type_events"), value: "event" },
    { label: t("search.type_courses"), value: "course" },
    { label: t("search.type_videos"), value: "video" },
    { label: t("search.type_groups") || "Groups", value: "group" },
    { label: t("search.type_plants") || "Plants", value: "plant" },
  ];

  // Load recent searches
  useEffect(() => {
    try {
      const stored = localStorage.getItem("rootlink_recent_searches");
      if (stored) setRecentSearches(JSON.parse(stored));
    } catch {}
  }, []);

  const saveRecentSearch = (q: string) => {
    const updated = [q, ...recentSearches.filter((s) => s !== q)].slice(0, 10);
    setRecentSearches(updated);
    localStorage.setItem("rootlink_recent_searches", JSON.stringify(updated));
  };

  const removeRecentSearch = (q: string) => {
    const updated = recentSearches.filter((s) => s !== q);
    setRecentSearches(updated);
    localStorage.setItem("rootlink_recent_searches", JSON.stringify(updated));
  };

  // Load initial data
  useEffect(() => {
    api.taxonomy.families().then(setFamilies).catch(() => {});
    const q = searchParams.get("q");
    const cat = searchParams.get("category");
    const fam = searchParams.get("family");
    if (fam) {
      setFamily(fam);
      api.taxonomy.categories(fam).then(setFamilyCategories).catch(() => {});
    }
    if (q) {
      setQuery(q);
      doSearch(q, cat || "", fam || "");
    } else {
      Promise.all([
        api.content.popular(3).catch(() => []),
        api.content.trendingSearches(8).catch(() => []),
      ]).then(([pop, tr]) => {
        setPopular(pop);
        setTrending(tr);
      }).finally(() => setInitLoading(false));
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // When family changes, load its categories
  const handleFamilyChange = (famValue: string) => {
    setFamily(famValue);
    setCategory("");
    if (famValue) {
      api.taxonomy.categories(famValue).then(setFamilyCategories).catch(() => setFamilyCategories([]));
    } else {
      setFamilyCategories([]);
    }
  };

  // Autocomplete debounced
  useEffect(() => {
    if (!query || query.length < 2) {
      setSuggestions([]);
      return;
    }
    const timer = setTimeout(() => {
      api.content.search({ q: query, limit: 5 })
        .then((res) => setSuggestions(res.results.slice(0, 5)))
        .catch(() => setSuggestions([]));
    }, 300);
    return () => clearTimeout(timer);
  }, [query]);

  // Close suggestions on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (suggestionsRef.current && !suggestionsRef.current.contains(e.target as Node)) {
        setShowSuggestions(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const doSearch = async (q: string, cat?: string, ct?: string, p?: number, fam?: string) => {
    if (!q.trim()) return;
    setLoading(true);
    setSearched(true);
    setShowSuggestions(false);
    const pg = p ?? page;
    try {
      const res = await api.content.search({
        q,
        category: cat || category,
        family: fam || family,
        content_type: ct || contentType,
        limit: PAGE_SIZE,
        offset: (pg - 1) * PAGE_SIZE,
      });
      setResults(res.results);
      setTotal(res.total);
      setPage(pg);
      saveRecentSearch(q.trim());
    } catch {
      setResults([]);
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    doSearch(query, category, contentType, 1, family);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (!showSuggestions || suggestions.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedSuggestion((prev) => Math.min(prev + 1, suggestions.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedSuggestion((prev) => Math.max(prev - 1, -1));
    } else if (e.key === "Enter" && selectedSuggestion >= 0) {
      e.preventDefault();
      const s = suggestions[selectedSuggestion];
      setQuery(s.content.title);
      setShowSuggestions(false);
      setPage(1);
      doSearch(s.content.title, category, contentType, 1, family);
    } else if (e.key === "Escape") {
      setShowSuggestions(false);
    }
  };

  const totalPages = Math.ceil(total / PAGE_SIZE);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-12">
      {/* Search input */}
      <div className="mb-6 relative" ref={suggestionsRef}>
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-600 dark:text-stone-500 w-5 h-5" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setShowSuggestions(true);
              setSelectedSuggestion(-1);
            }}
            onFocus={() => { if (suggestions.length > 0 || recentSearches.length > 0) setShowSuggestions(true); }}
            onKeyDown={handleKeyDown}
            placeholder={t("search.placeholder")}
            className="w-full pl-12 pr-4 py-3.5 rounded-2xl border border-primary-200/60 dark:border-stone-700 bg-white/80 dark:bg-stone-900/80 backdrop-blur-sm text-sm text-stone-800 dark:text-stone-100 focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15 focus:outline-none transition-all font-serif shadow-sm"
          />
        </div>

        {/* Autocomplete dropdown */}
        {showSuggestions && (suggestions.length > 0 || recentSearches.length > 0) && (
          <div className="absolute z-50 top-full mt-1 w-full bg-white dark:bg-stone-900 border border-primary-100/60 dark:border-stone-700 rounded-2xl shadow-lg overflow-hidden">
            {/* Recent searches */}
            {!searched && recentSearches.length > 0 && (
              <div className="p-3 border-b border-stone-100 dark:border-stone-800">
                <p className="text-[10px] text-stone-600 dark:text-stone-400 uppercase tracking-wider mb-2">Recent searches</p>
                <div className="flex flex-wrap gap-1.5">
                  {recentSearches.slice(0, 5).map((s) => (
                    <div key={s} className="flex items-center gap-1 px-2.5 py-1 bg-stone-50 dark:bg-stone-800 rounded-lg text-xs text-stone-600 dark:text-stone-300">
                      <button
                        type="button"
                        onClick={() => {
                          setQuery(s);
                          setShowSuggestions(false);
                          setPage(1);
                          doSearch(s, category, contentType, 1, family);
                        }}
                        className="hover:text-primary-700 dark:hover:text-primary-300 transition"
                      >
                        {s}
                      </button>
                      <button type="button" onClick={() => removeRecentSearch(s)} className="text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300">
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Suggestions */}
            {suggestions.length > 0 && (
              <div className="py-1">
                {suggestions.map((s, i) => (
                  <button
                    key={s.content.id}
                    type="button"
                    onClick={() => {
                      setQuery(s.content.title);
                      setShowSuggestions(false);
                      setPage(1);
                      doSearch(s.content.title, category, contentType, 1, family);
                    }}
                    className={`w-full px-4 py-2.5 text-left flex items-center gap-3 transition ${
                      i === selectedSuggestion ? "bg-primary-50 dark:bg-primary-900/30" : "hover:bg-stone-50 dark:hover:bg-stone-800"
                    }`}
                  >
                    <Search className="w-3.5 h-3.5 text-stone-600 dark:text-stone-500 shrink-0" />
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-stone-700 line-clamp-1">{s.content.title}</p>
                    </div>
                    <Badge variant="stone" className="text-[9px] shrink-0">{s.content.content_type}</Badge>
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </form>
      </div>

      {/* Filters */}
      <div className="flex gap-2 mb-8 flex-wrap items-center">
        <Filter className="w-4 h-4 text-stone-600 dark:text-stone-500 shrink-0" />
        {/* Family filter */}
        <button
          onClick={() => { handleFamilyChange(""); if (query) doSearch(query, "", contentType, 1, ""); }}
          className={`px-3 py-1.5 text-sm rounded-xl border transition-all ${
            !family ? "bg-primary-500 text-white border-primary-500 shadow-sm" : "bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 border-primary-100 dark:border-stone-700 hover:border-primary-300 dark:hover:border-primary-600"
          }`}
        >
          {t("search.all") || "All"}
        </button>
        {families.map((fam) => (
          <button
            key={fam.value}
            onClick={() => {
              handleFamilyChange(fam.value);
              if (query) doSearch(query, "", contentType, 1, fam.value);
            }}
            className={`px-3 py-1.5 text-sm rounded-xl border transition-all ${
              family === fam.value ? "bg-primary-500 text-white border-primary-500 shadow-sm" : "bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 border-primary-100 dark:border-stone-700 hover:border-primary-300 dark:hover:border-primary-600"
            }`}
          >
            {locale === "pt" ? fam.label_pt : fam.label}
          </button>
        ))}

        {/* Category sub-filter (only when family selected) */}
        {family && familyCategories.length > 0 && (
          <>
            <div className="w-px h-6 bg-primary-100 dark:bg-primary-950/20 mx-1 self-center" />
            <select
              value={category}
              onChange={(e) => {
                setCategory(e.target.value);
                if (query) doSearch(query, e.target.value, contentType, 1, family);
              }}
              className="px-3 py-1.5 text-sm rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15"
            >
              <option value="">{t("search.all_categories") || "All categories"}</option>
              {familyCategories.map((cat) => (
                <option key={cat.value} value={cat.value}>
                  {locale === "pt" ? cat.label_pt : cat.label}
                </option>
              ))}
            </select>
          </>
        )}

        <div className="w-px h-6 bg-primary-100 dark:bg-primary-950/20 mx-1 self-center" />
        {contentTypes.map((ct) => (
          <button
            key={ct.value}
            onClick={() => {
              setContentType(ct.value);
              if (query) doSearch(query, category, ct.value, 1, family);
            }}
            className={`px-3 py-1.5 text-sm rounded-xl border transition-all ${
              contentType === ct.value
                ? "bg-stone-800 dark:bg-stone-200 text-white dark:text-stone-900 border-stone-800 dark:border-stone-200 shadow-sm"
                : "bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 border-primary-100 dark:border-stone-700 hover:border-stone-300 dark:hover:border-stone-500"
            }`}
          >
            {ct.label}
          </button>
        ))}
      </div>

      {/* Main layout: results + sidebar */}
      <div className="flex gap-8">
        {/* Results column */}
        <div className="flex-1 min-w-0">
          {loading && (
            <div className="space-y-4">
              {[1, 2, 3].map((i) => (
                <CardSkeleton key={i} />
              ))}
            </div>
          )}

          {searched && !loading && (
            <>
              <p className="text-sm text-stone-500 mb-5 font-medium">
                {total} {t("search.results_for", { total, query })}
              </p>
              {results.length === 0 ? (
                <div className="py-16">
                  <EmptyState
                    icon={<Search className="w-7 h-7" />}
                    title={t("search.no_results")}
                    message={t("search.try_different")}
                    action={{ label: t("search.submit_link"), onClick: () => window.location.href = "/submit" }}
                  />
                </div>
              ) : (
                <div className="space-y-3">
                  {results.map((r: any) => (
                    <ResultCard key={`${r.content.content_type}-${r.content.id}`} item={r} />
                  ))}
                </div>
              )}

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 mt-8">
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page <= 1}
                    onClick={() => doSearch(query, category, contentType, page - 1, family)}
                  >
                    {t("search.prev")}
                  </Button>
                  {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
                    const p = i + 1;
                    return (
                      <button
                        key={p}
                        onClick={() => doSearch(query, category, contentType, p, family)}
                        className={`w-9 h-9 text-sm rounded-xl border transition-all ${
                          p === page
                            ? "bg-primary-500 text-white border-primary-500 shadow-sm"
                            : "border-primary-100 dark:border-stone-700 text-stone-600 dark:text-stone-300 hover:border-primary-300 dark:hover:border-primary-600 bg-white dark:bg-stone-900"
                        }`}
                      >
                        {p}
                      </button>
                    );
                  })}
                  <Button
                    variant="secondary"
                    size="sm"
                    disabled={page >= totalPages}
                    onClick={() => doSearch(query, category, contentType, page + 1, family)}
                  >
                    {t("search.next")}
                  </Button>
                </div>
              )}
            </>
          )}

          {/* Pre-search state */}
          {!searched && !initLoading && (
            <div className="space-y-8">
              {popular.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <Sparkles className="w-5 h-5 text-amber-500" />
                    <h2 className="text-lg font-serif font-bold text-stone-800">{t("home.popular_content")}</h2>
                  </div>
                  <div className="grid sm:grid-cols-3 gap-3">
                    {popular.map((item: any) => {
                      const isExternal = Boolean(item.url);
                      const Tag = isExternal ? "a" : Link;
                      const extraProps = isExternal ? { target: "_blank", rel: "noopener noreferrer" as const } : {};
                      return (
                        <Tag key={item.id} href={isExternal ? item.url : `/articles/${item.slug!}`} {...extraProps}
                        className="rounded-2xl border border-primary-100/40 dark:border-stone-700 bg-white dark:bg-stone-900 p-4 flex items-start gap-3 transition-all hover:shadow-md hover:border-primary-200/60 dark:hover:border-primary-700"
                        >
                        <div className="w-12 h-12 rounded-xl shrink-0 flex items-center justify-center overflow-hidden">
                          <img
                            src={safeImageUrl(item.image_url, "/images/placeholder-card.svg")}
                            alt={item.title}
                            className="w-full h-full object-cover"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <h3 className="font-medium text-sm text-stone-800 dark:text-stone-100 line-clamp-2">{item.title}</h3>
                          <div className="flex gap-1 mt-1">
                            <Badge variant="sage" className="text-[10px]">{item.category}</Badge>
                          </div>
                        </div>
                      </Tag>
                      );
                    })}
                  </div>
                </div>
              )}

              {trending.length > 0 && (
                <div>
                  <div className="flex items-center gap-2 mb-4">
                    <TrendingUp className="w-5 h-5 text-primary-500" />
                    <h2 className="text-lg font-serif font-bold text-stone-800">{t("home.popular_searches")}</h2>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {trending.map((s) => (
                      <button
                        key={s.query}
                        onClick={() => {
                          setQuery(s.query);
                          setPage(1);
                          doSearch(s.query, category, contentType, 1, family);
                        }}
                        className="px-4 py-2 bg-white dark:bg-stone-900 border border-primary-100 dark:border-stone-700 rounded-xl text-sm text-stone-700 dark:text-stone-200 hover:border-primary-300 dark:hover:border-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition font-light"
                      >
                        {s.query}
                        <span className="text-[10px] text-stone-600 dark:text-stone-500 ml-2">({s.count})</span>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {popular.length === 0 && trending.length === 0 && (
                <EmptyState
                  icon={<Search className="w-7 h-7" />}
                  title={t("search.enter_term")}
                  message={t("search.enter_term_desc")}
                />
              )}
            </div>
          )}
        </div>

        {/* Sidebar — visible on desktop when searched */}
        {searched && !loading && (
          <div className="hidden lg:block w-72 shrink-0 space-y-4">
            <MoonWidget />
            <SunWidget />
            <RelatedGroups query={query} />
            <SpeciesWidget query={query} />
          </div>
        )}
      </div>

      {/* Submit CTA */}
      <div className="max-w-6xl mx-auto mt-12">
        <div className="bg-primary-50 dark:bg-primary-900/20 border border-primary-100 dark:border-primary-800 rounded-2xl p-6 text-center">
          <EditableText k="search.cant_find" as="p" className="text-stone-600 dark:text-stone-300 text-sm mb-3 font-medium" />
          <a
            href="/submit"
            className="inline-flex items-center gap-1.5 text-sm font-medium text-white bg-primary-500 hover:bg-primary-700 px-5 py-2.5 rounded-xl transition shadow-sm hover:shadow-md"
          >
            <EditableText k="search.submit_link" as="span" /> <ArrowRight className="w-3.5 h-3.5" />
          </a>
        </div>
      </div>
    </div>
  );
}

export default function SearchPage() {
  return (
    <Suspense fallback={<div className="p-8"><div className="max-w-6xl mx-auto px-4 sm:px-8"><div className="h-12 bg-primary-100 dark:bg-primary-950/20 rounded-2xl animate-pulse" /></div></div>}>
      <SearchContent />
    </Suspense>
  );
}
