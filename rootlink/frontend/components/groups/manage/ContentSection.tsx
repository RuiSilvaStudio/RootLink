"use client";

/**
 * Manage → Content: link platform events/articles/courses to the group.
 * Courses have a per-link public/private toggle (is_public on GroupContent).
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { api } from "@/lib/api";
import type { Group, GroupContentLink } from "@/lib/groups-types";
import { useLocale } from "@/lib/locale-context";
import { useToast } from "@/lib/toast-context";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Toggle } from "@/components/ui/Toggle";
import { LoadError } from "@/components/studio/LoadError";
import { Calendar, Newspaper, GraduationCap, Link2 } from "lucide-react";

type Kind = "event" | "article" | "course";

interface SearchResult { id: number; title: string; meta?: string }

export function ContentSection({ group }: { group: Group }) {
  const { t } = useLocale();
  const [kind, setKind] = useState<Kind>("event");

  const tabs: { k: Kind; icon: React.ReactNode; label: string }[] = [
    { k: "event", icon: <Calendar className="w-4 h-4" aria-hidden />, label: t("groups.manage.linked_events") },
    { k: "article", icon: <Newspaper className="w-4 h-4" aria-hidden />, label: t("groups.manage.linked_articles") },
    { k: "course", icon: <GraduationCap className="w-4 h-4" aria-hidden />, label: t("groups.linked_courses") },
  ];

  return (
    <div className="max-w-2xl space-y-5">
      <p className="text-sm text-stone-500" data-rl-text="groups.manage.content_help">{t("groups.manage.content_help")}</p>
      <div className="flex gap-1" role="tablist">
        {tabs.map(({ k, icon, label }) => (
          <button
            key={k}
            role="tab"
            aria-selected={kind === k}
            onClick={() => setKind(k)}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium transition ${kind === k ? "bg-primary-100 dark:bg-primary-900/40 text-primary-700 dark:text-primary-300" : "text-stone-500 hover:text-primary-700 dark:hover:text-primary-300"}`}
          >
            {icon} {label}
          </button>
        ))}
      </div>
      <LinkPanel key={kind} group={group} kind={kind} />
    </div>
  );
}

function LinkPanel({ group, kind }: { group: Group; kind: Kind }) {
  const { t } = useLocale();
  const { addToast } = useToast();
  const [linked, setLinked] = useState<GroupContentLink[] | null>(null);
  const [error, setError] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const searchLabel = kind === "event" ? t("groups.manage.search_events")
    : kind === "article" ? t("groups.manage.search_articles")
    : t("groups.search_courses");
  const linkLabel = kind === "event" ? t("groups.manage.link_event")
    : kind === "article" ? t("groups.manage.link_article")
    : t("groups.link_course");
  const emptyText = kind === "event" ? t("groups.no_events")
    : kind === "article" ? t("groups.no_articles")
    : t("groups.no_courses");

  const load = useCallback(async () => {
    setError(false);
    try { setLinked(await api.groups.listGroupContent(group.id, kind)); }
    catch { setError(true); }
  }, [group.id, kind]);

  useEffect(() => { load(); }, [load]);

  // Debounced search (400ms per UX contract)
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current);
    if (!query.trim()) { setResults([]); setSearching(false); return; }
    setSearching(true);
    searchTimer.current = setTimeout(async () => {
      try {
        if (kind === "event") {
          const events = await api.events.list(true);
          const q = query.toLowerCase();
          setResults(
            (events as Array<{ id: number; title: string; date?: string; location?: string }>)
              .filter(e => e.title?.toLowerCase().includes(q))
              .slice(0, 8)
              .map(e => ({ id: e.id, title: e.title, meta: [fmtDate(e.date), e.location].filter(Boolean).join(" · ") }))
          );
        } else {
          const res = await api.content.search({ q: query, content_type: kind === "course" ? "course" : undefined, limit: 8 });
          setResults(res.results.map(r => ({ id: r.content.id, title: r.content.title })));
        }
      } catch {
        setResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current); };
  }, [query, kind]);

  const linkItem = async (r: SearchResult) => {
    try {
      // Courses default to public; the owner toggles per-course in the list
      await api.groups.linkContent(group.id, kind, r.id, kind === "course" ? true : undefined);
      addToast("success", t("groups.manage.content_linked"));
      setQuery("");
      setResults([]);
      await load();
    } catch (e: unknown) {
      addToast("error", (e instanceof Error && e.message) || t("groups.manage.content_error"));
    }
  };

  const toggleCoursePublic = async (l: GroupContentLink) => {
    const next = !l.is_public;
    setLinked(cur => cur?.map(x => (x.content_id === l.content_id ? { ...x, is_public: next } : x)) ?? null);
    try {
      await api.groups.updateContentLink(group.id, "course", l.content_id, next);
      addToast("success", t("groups.manage.saved_toast"));
    } catch (e: unknown) {
      setLinked(cur => cur?.map(x => (x.content_id === l.content_id ? { ...x, is_public: l.is_public } : x)) ?? null);
      addToast("error", (e instanceof Error && e.message) || t("groups.manage.content_error"));
    }
  };

  const unlinkItem = async (l: GroupContentLink) => {
    if (!window.confirm(t("groups.manage.unlink_confirm", { title: l.title || `#${l.content_id}` }))) return;
    const prev = linked;
    setLinked(cur => cur?.filter(x => x.content_id !== l.content_id) ?? null);
    try {
      await api.groups.unlinkContent(group.id, kind, l.content_id);
      addToast("success", t("groups.manage.content_unlinked"));
    } catch (e: unknown) {
      setLinked(prev ?? null);
      addToast("error", (e instanceof Error && e.message) || t("groups.manage.content_error"));
    }
  };

  const linkedIds = new Set(linked?.map(l => l.content_id) ?? []);

  return (
    <Card variant="plain" className="p-5 space-y-4">
      {/* Search + link */}
      <div>
        <label htmlFor={`content-search-${kind}`} className="sr-only">{searchLabel}</label>
        <input
          id={`content-search-${kind}`}
          type="search"
          placeholder={searchLabel}
          value={query}
          onChange={e => setQuery(e.target.value)}
          className="w-full px-4 py-2.5 bg-white dark:bg-stone-900 border border-primary-200/60 dark:border-stone-700 rounded-xl2 text-sm text-stone-800 dark:text-stone-100 placeholder:text-stone-400 focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15 focus:outline-none"
        />
        {query.trim() && (
          <div className="mt-2 rounded-xl border border-primary-100 dark:border-stone-800 divide-y divide-primary-100 dark:divide-stone-800 overflow-hidden">
            {searching && <p className="px-4 py-3 text-sm text-stone-400">{t("common.loading")}</p>}
            {!searching && results.length === 0 && <p className="px-4 py-3 text-sm text-stone-400">{t("groups.manage.no_results")}</p>}
            {!searching && results.map(r => (
              <div key={r.id} className="flex items-center gap-3 px-4 py-2.5 bg-white dark:bg-stone-900">
                <div className="min-w-0 flex-1 text-sm">
                  <p className="font-medium text-stone-800 dark:text-stone-100 truncate">{r.title}</p>
                  {r.meta && <p className="text-xs text-stone-400">{r.meta}</p>}
                </div>
                {linkedIds.has(r.id) ? (
                  <span className="text-xs text-emerald-600">✓</span>
                ) : (
                  <Button size="xs" variant="secondary" onClick={() => linkItem(r)}>
                    <Link2 className="w-3.5 h-3.5" aria-hidden /> {linkLabel}
                  </Button>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Linked list */}
      {error && <LoadError message={t("groups.group_load_error")} onRetry={load} />}
      {!error && linked === null && (
        <div className="space-y-2" aria-busy="true">
          {[0, 1].map(i => <div key={i} className="h-12 rounded-xl skeleton-shimmer" />)}
        </div>
      )}
      {!error && linked !== null && linked.length === 0 && (
        <p className="text-sm text-stone-400 py-2 text-center">{emptyText}</p>
      )}
      {!error && linked !== null && linked.map(l => (
        <div key={l.content_id} className="flex items-center gap-3 py-2 border-t border-primary-100 dark:border-stone-800 first:border-t-0">
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-medium text-stone-800 dark:text-stone-100 truncate">{l.title || `#${l.content_id}`}</p>
            {(l.date || l.location) && <p className="text-xs text-stone-400">{[fmtDate(l.date), l.location].filter(Boolean).join(" · ")}</p>}
            {/* Per-course public/private toggle */}
            {kind === "course" && (
              <Toggle
                id={`course-visibility-${l.content_id}`}
                label={l.is_public ? t("groups.course_public") : t("groups.course_private")}
                checked={l.is_public}
                onChange={() => toggleCoursePublic(l)}
                className="mt-2"
              />
            )}
          </div>
          <Button size="xs" variant="danger" onClick={() => unlinkItem(l)}>{t("groups.manage.unlink")}</Button>
        </div>
      ))}
    </Card>
  );
}

function fmtDate(iso?: string | null): string {
  if (!iso) return "";
  try { return new Date(iso).toLocaleDateString("pt-PT", { day: "numeric", month: "short" }); }
  catch { return ""; }
}
