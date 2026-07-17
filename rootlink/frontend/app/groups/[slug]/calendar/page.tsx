"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useGroup, canSee } from "@/lib/group-context";
import { useLocale } from "@/lib/locale-context";
import type { GroupContentLink } from "@/lib/groups-types";
import { MembersGate } from "@/components/groups/MembersGate";
import { LoadError } from "@/components/studio/LoadError";
import { Reveal } from "@/components/groups/RootNav";
import { GroupPageHero } from "@/components/groups/GroupPageChrome";
import { Text } from "@/components/ui/Text";
import { ArrowRight, MapPin } from "lucide-react";

export default function GroupCalendarPage() {
  const { group, viewer } = useGroup();
  const { t, locale } = useLocale();
  const [events, setEvents] = useState<GroupContentLink[] | null>(null);
  const [error, setError] = useState(false);
  const calendarVisible = canSee(viewer, "calendar");

  const load = useCallback(async () => {
    setError(false);
    try {
      setEvents(calendarVisible ? await api.groups.listGroupContent(group.id, "event") : []);
    } catch {
      setError(true);
    }
  }, [group.id, calendarVisible]);

  useEffect(() => { load(); }, [load]);

  const fmtShort = (iso: string | null) => {
    if (!iso) return "—";
    try { return new Date(iso).toLocaleDateString(locale === "pt" ? "pt-PT" : "en-GB", { day: "numeric", month: "short" }).replace(".", ""); }
    catch { return "—"; }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 pb-16">
      <GroupPageHero
        eyebrowKey="groups.calendar_title"
        titleKey="groups.pagehero_calendar_title"
        introKey="groups.pagehero_calendar_intro"
      />
      <div className="pt-12">
        {!calendarVisible ? (
          <MembersGate title={t("groups.calendar_title")} />
        ) : error ? (
          <LoadError message={t("groups.group_load_error")} onRetry={load} />
        ) : events === null ? (
          <div className="space-y-3" aria-busy="true">
            {[0, 1, 2].map(i => <div key={i} className="h-16 rounded-xl skeleton-shimmer" />)}
          </div>
        ) : events.length === 0 ? (
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="text-sm text-stone-400 font-serif" data-rl-text="groups.no_events">{t("groups.no_events")}</p>
            {viewer.is_manager && (
              <Link href={`/groups/${group.slug}/manage`} className="text-[0.8rem] font-semibold text-rust-500 hover:text-rust-600 inline-flex items-center gap-1">
                {t("groups.link_first_event")} <ArrowRight className="w-3 h-3" aria-hidden />
              </Link>
            )}
          </div>
        ) : (
          /* mockup .rowline — hairline rows, date eyebrow, arrow slides in on hover */
          <Reveal>
            <div className="border-t border-primary-100 dark:border-stone-800">
              {events.map(ev => (
                <Link
                  key={ev.content_id}
                  href={`/events/${ev.content_id}`}
                  className="group flex items-center gap-4 py-4 px-1 border-b border-primary-100 dark:border-stone-800 transition-all hover:bg-white/85 dark:hover:bg-stone-900/60 hover:pl-3"
                >
                  <span className="text-xs font-display font-semibold tracking-[0.22em] uppercase text-earth-500 min-w-[4.4rem] shrink-0">
                    {fmtShort(ev.date)}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-semibold text-stone-800 dark:text-stone-100 truncate">
                      {ev.title || `#${ev.content_id}`}
                    </span>
                    {ev.location && (
                      <span className="flex items-center gap-1 text-xs text-earth-500 mt-0.5">
                        <MapPin className="w-3 h-3" aria-hidden />{ev.location}
                      </span>
                    )}
                  </span>
                  <ArrowRight className="w-4 h-4 text-rust-500 opacity-0 -translate-x-1.5 group-hover:opacity-100 group-hover:translate-x-0 transition" aria-hidden />
                </Link>
              ))}
            </div>
          </Reveal>
        )}
      </div>
    </div>
  );
}
