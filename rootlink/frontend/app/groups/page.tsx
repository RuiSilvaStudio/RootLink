"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import Link from "next/link";
import { Search, Plus, MapPin } from "lucide-react";
import { api } from "@/lib/api";
import type { Group } from "@/lib/groups-types";
import { parseCategories } from "@/lib/groups-types";
import { useLocale } from "@/lib/locale-context";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadError } from "@/components/studio/LoadError";
import { safeImageUrl } from "@/lib/image-url";
import { Text } from "@/components/ui/Text";

const FAMILIES = ["Agricultura", "Saúde e bem-estar", "Cultura e artes", "Desporto", "Ação social", "Ambiente", "Educação", "Comunidade"];

export default function GroupsPage() {
  const { t } = useLocale();
  const [groups, setGroups] = useState<Group[] | null>(null);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "organic" | "structured">("all");
  const [familyFilter, setFamilyFilter] = useState("");
  const [locationFilter, setLocationFilter] = useState("");
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Server-side filtering, debounced 400ms per the UX contract
  const load = useCallback(async (opts: { q: string; type: string; family: string; location: string }) => {
    setError(false);
    try {
      setGroups(await api.groups.list({
        limit: 100,
        q: opts.q || undefined,
        groupType: opts.type !== "all" ? opts.type : undefined,
        family: opts.family || undefined,
        location: opts.location || undefined,
      }));
    } catch {
      setError(true);
    }
  }, []);

  useEffect(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      load({ q: query, type: typeFilter, family: familyFilter, location: locationFilter });
    }, groups === null ? 0 : 400);
    return () => { if (debounceTimer.current) clearTimeout(debounceTimer.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query, typeFilter, familyFilter, locationFilter, load]);

  const hasFilters = !!query || typeFilter !== "all" || !!familyFilter || !!locationFilter;
  const clearAll = () => { setQuery(""); setTypeFilter("all"); setFamilyFilter(""); setLocationFilter(""); };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <Text k="groups.title" as="h1" className="font-display text-3xl font-semibold text-primary-800 dark:text-primary-200" />
          <Text k="groups.subtitle" as="p" className="text-sm text-stone-500 mt-1" />
        </div>
        <Link href="/groups/create">
          <Button size="sm" data-rl-text="groups.create_group"><Plus className="w-4 h-4" aria-hidden /> {t("groups.create_group")}</Button>
        </Link>
      </div>

      {/* Search bar */}
      <label htmlFor="groups-search" className="sr-only">{t("groups.search_placeholder")}</label>
      <input
        id="groups-search"
        type="search"
        placeholder={t("groups.search_placeholder")}
        value={query}
        onChange={e => setQuery(e.target.value)}
        className="w-full px-5 py-3.5 bg-white dark:bg-stone-900 border border-primary-200/60 dark:border-stone-700 rounded-2xl text-stone-800 dark:text-stone-100 text-base placeholder:text-stone-400 focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15 focus:outline-none mb-4"
      />

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-4 mb-8 pb-6 border-b border-primary-100 dark:border-stone-800">
        <div className="flex items-center gap-1.5" role="group" aria-label={t("groups.filter_type")}>
          <span className="text-xs font-display font-medium text-stone-400 uppercase tracking-wide mr-1">{t("groups.filter_type")}</span>
          {([["all", t("groups.filter_all")], ["organic", t("groups.type_organic")], ["structured", t("groups.type_structured")]] as const).map(([val, label]) => (
            <button
              key={val}
              aria-pressed={typeFilter === val}
              onClick={() => setTypeFilter(val)}
              className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${typeFilter === val ? "bg-primary-600 text-cream" : "bg-primary-100/50 dark:bg-stone-800 text-stone-500 hover:bg-primary-100 dark:hover:bg-stone-700"}`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          <label htmlFor="groups-family" className="text-xs font-display font-medium text-stone-400 uppercase tracking-wide mr-1">{t("groups.filter_family")}</label>
          <select
            id="groups-family"
            value={familyFilter}
            onChange={e => setFamilyFilter(e.target.value)}
            className="px-2.5 py-1 rounded-full text-xs font-medium border border-primary-200/60 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 focus:border-primary-400 focus:outline-none"
          >
            <option value="">{t("groups.filter_family_all")}</option>
            {FAMILIES.map(f => <option key={f} value={f}>{f}</option>)}
          </select>
        </div>
        <div className="flex items-center gap-1.5">
          <label htmlFor="groups-location" className="text-xs font-display font-medium text-stone-400 uppercase tracking-wide mr-1">{t("groups.filter_location")}</label>
          <input
            id="groups-location"
            type="text"
            placeholder={t("groups.location_placeholder")}
            value={locationFilter}
            onChange={e => setLocationFilter(e.target.value)}
            className="px-2.5 py-1 rounded-full text-xs font-medium border border-primary-200/60 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 placeholder:text-stone-400 focus:border-primary-400 focus:outline-none w-28"
          />
        </div>
        {hasFilters && (
          <button onClick={clearAll} data-rl-text="groups.clear_filters" className="text-xs text-stone-400 hover:text-rust-500 ml-auto">{t("groups.clear_filters")}</button>
        )}
      </div>

      {/* Error */}
      {error && <LoadError message={t("groups.list_load_error")} onRetry={() => load({ q: query, type: typeFilter, family: familyFilter, location: locationFilter })} />}

      {/* Loading */}
      {!error && groups === null && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5" aria-busy="true">
          {Array.from({ length: 6 }).map((_, i) => <div key={i} className="h-64 rounded-2xl skeleton-shimmer" />)}
        </div>
      )}

      {/* Results */}
      {!error && groups !== null && (
        <>
          <p className="text-sm text-stone-400 mb-4" role="status">{t("groups.results_count", { count: groups.length })}</p>

          {groups.length === 0 ? (
            <EmptyState
              icon={<Search className="w-7 h-7 text-primary-400" aria-hidden />}
              title={t("groups.empty_title")}
              message={t("groups.empty_message")}
              action={hasFilters ? { label: t("groups.clear_filters"), onClick: clearAll } : undefined}
            />
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {groups.map(g => {
                const cats = parseCategories(g.categories);
                return (
                  <Link key={g.id} href={`/groups/${g.slug}`} className="rounded-2xl overflow-hidden border border-primary-200/60 dark:border-stone-700 bg-white dark:bg-stone-900 hover:shadow-lg hover:border-primary-300 transition group">
                    <div className="relative h-28 overflow-hidden">
                      {g.image_url ? (
                        <img src={safeImageUrl(g.image_url, "/images/placeholder-card.svg")} alt="" className="w-full h-full object-cover group-hover:scale-105 transition duration-400" />
                      ) : (
                        <div className="w-full h-full bg-gradient-to-br from-primary-200 to-earth-500/40" aria-hidden />
                      )}
                      <span className={`absolute top-2 left-2 px-2 py-0.5 rounded-full text-xs font-semibold ${g.group_type === "structured" ? "bg-earth-500 text-cream" : "bg-emerald-600 text-cream"}`}>
                        {g.group_type === "structured" ? t("groups.type_structured") : t("groups.type_organic")}
                      </span>
                    </div>
                    <div className="p-4">
                      <div className="flex items-start gap-3">
                        {g.logo_url && <img src={safeImageUrl(g.logo_url)} alt="" className="w-10 h-10 rounded-lg border border-primary-200 dark:border-stone-700 object-cover shrink-0 -mt-6 shadow-sm relative" />}
                        <div className="min-w-0 flex-1">
                          <h2 className="font-display text-base font-semibold text-primary-800 dark:text-primary-200 truncate">{g.name}</h2>
                          <p className="text-xs text-stone-400 truncate flex items-center gap-1">
                            {g.location && <><MapPin className="w-3 h-3 shrink-0" aria-hidden />{g.location} · </>}
                            {g.description?.slice(0, 60) || t("groups.no_description")}
                          </p>
                        </div>
                      </div>
                      {cats.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-3">
                          {cats.slice(0, 2).map(c => (
                            <span key={c} className="text-xs px-2 py-0.5 rounded-full bg-primary-100/50 dark:bg-primary-900/30 text-primary-500 dark:text-primary-300">
                              {c.split(" / ").pop()}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}
