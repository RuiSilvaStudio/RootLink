"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, usePathname } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Group, GroupViewer } from "@/lib/groups-types";
import { GroupProvider } from "@/lib/group-context";
import { useLocale } from "@/lib/locale-context";
import { LoadError } from "@/components/studio/LoadError";
import { Settings } from "lucide-react";

export default function GroupLayout({ children }: { children: React.ReactNode }) {
  const params = useParams();
  const slug = params.slug as string;
  const pathname = usePathname();
  const { t } = useLocale();

  const [group, setGroup] = useState<Group | null>(null);
  const [viewer, setViewer] = useState<GroupViewer | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    if (!slug) return;
    setLoadError(false);
    try {
      const g = await api.groups.getBySlug(slug);
      // Viewer relationship in the same pass — one request, works anonymously
      const v = await api.groups.me(g.id);
      setGroup(g);
      setViewer(v);
      setNotFound(false);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      if (/not found/i.test(msg)) setNotFound(true);
      else setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [slug]);

  useEffect(() => {
    load();
  }, [load]);

  const segments = pathname.split("/").filter(Boolean);
  const lastSegment = segments[segments.length - 1];
  const activeTab = lastSegment === slug ? "landing" : lastSegment;

  if (loading) {
    return (
      <div className="min-h-screen bg-cream dark:bg-stone-950">
        <div className="h-12 border-b border-primary-100 dark:border-stone-800 bg-cream dark:bg-stone-950" />
        <div className="max-w-6xl mx-auto px-4 py-8 space-y-6" aria-busy="true">
          <div className="h-64 rounded-xl2 skeleton-shimmer" />
          <div className="h-8 w-1/3 skeleton-shimmer rounded" />
          <div className="h-4 w-2/3 skeleton-shimmer rounded" />
          <div className="grid sm:grid-cols-2 gap-5">
            <div className="h-40 rounded-xl2 skeleton-shimmer" />
            <div className="h-40 rounded-xl2 skeleton-shimmer" />
          </div>
        </div>
      </div>
    );
  }

  if (notFound) {
    return (
      <div className="min-h-screen bg-cream dark:bg-stone-950 grid place-items-center">
        <div className="text-center">
          <p className="font-display text-lg text-stone-500 dark:text-stone-400" data-rl-text="groups.not_found">{t("groups.not_found")}</p>
          <Link href="/groups" data-rl-text="groups.back_to_groups"
            className="text-rust-500 text-sm hover:underline mt-2 inline-block">
            ← {t("groups.back_to_groups")}
          </Link>
        </div>
      </div>
    );
  }

  if (loadError || !group || !viewer) {
    return (
      <div className="min-h-screen bg-cream dark:bg-stone-950 grid place-items-center px-4">
        <div className="w-full max-w-md">
          <LoadError message={t("groups.group_load_error")} onRetry={() => { setLoading(true); load(); }} />
        </div>
      </div>
    );
  }

  const tabs = [
    { id: "landing", label: t("groups.tab_home"), key: "groups.tab_home", href: `/groups/${slug}` },
    { id: "about", label: t("groups.tab_about"), key: "groups.tab_about", href: `/groups/${slug}/about` },
    { id: "community", label: t("groups.tab_community"), key: "groups.tab_community", href: `/groups/${slug}/community` },
    { id: "calendar", label: t("groups.tab_calendar"), key: "groups.tab_calendar", href: `/groups/${slug}/calendar` },
    { id: "news", label: t("groups.tab_news"), key: "groups.tab_news", href: `/groups/${slug}/news` },
    { id: "programs", label: t("groups.tab_programs"), key: "groups.tab_programs", href: `/groups/${slug}/programs` },
  ];

  return (
    <GroupProvider value={{ group, viewer, refresh: load }}>
      <div className="min-h-screen bg-cream dark:bg-stone-950" data-group-slug={slug} data-group-id={group.id}>
        {/* Sticky group tabbar — sticks right below the fixed platform navbar (h-16) */}
        <nav aria-label={group.name} className="sticky top-16 z-40 bg-cream/95 dark:bg-stone-950/95 backdrop-blur border-b border-primary-100 dark:border-stone-800">
          <div className="max-w-6xl mx-auto px-4 flex items-center gap-5 overflow-x-auto scrollbar-none">
            {tabs.map(tab => (
              <Link
                key={tab.id}
                href={tab.href}
                data-rl-text={tab.key}
                aria-current={activeTab === tab.id ? "page" : undefined}
                className={`relative py-3 text-sm font-medium whitespace-nowrap transition-colors ${activeTab === tab.id ? "text-primary-700 dark:text-primary-300" : "text-stone-400 hover:text-stone-600 dark:hover:text-stone-300"}`}
              >
                {tab.label}
                {activeTab === tab.id && <span aria-hidden className="absolute left-0 right-0 bottom-[-1px] h-0.5 bg-rust-500" />}
              </Link>
            ))}
            {viewer.is_manager && (
              <Link
                href={`/groups/${slug}/manage`}
                data-rl-text="groups.tab_manage"
                aria-current={activeTab === "manage" ? "page" : undefined}
                className={`relative py-3 text-sm font-medium whitespace-nowrap transition-colors flex items-center gap-1 ${activeTab === "manage" ? "text-primary-700 dark:text-primary-300" : "text-stone-400 hover:text-stone-600 dark:hover:text-stone-300"}`}
              >
                <Settings className="w-3.5 h-3.5" aria-hidden /> {t("groups.tab_manage")}
                {activeTab === "manage" && <span aria-hidden className="absolute left-0 right-0 bottom-[-1px] h-0.5 bg-rust-500" />}
              </Link>
            )}
            <span className="ml-auto font-display text-sm text-stone-400 whitespace-nowrap hidden sm:inline">{group.name}</span>
          </div>
        </nav>

        {/* Page content */}
        {children}
      </div>
    </GroupProvider>
  );
}
