"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useGroup, canSee } from "@/lib/group-context";
import { useLocale } from "@/lib/locale-context";
import type { GroupProgram, GroupProgramSubField, GroupContentLink } from "@/lib/groups-types";
import { MembersGate } from "@/components/groups/MembersGate";
import { LoadError } from "@/components/studio/LoadError";
import { Reveal } from "@/components/groups/RootNav";
import { GroupPageHero, SectionHead } from "@/components/groups/GroupPageChrome";
import { Text } from "@/components/ui/Text";
import { ProgramCard } from "@/components/groups/ProgramCard";
import { ArrowRight } from "lucide-react";

export default function GroupProgramsPage() {
  const { group, viewer } = useGroup();
  const { t } = useLocale();
  const [programs, setPrograms] = useState<GroupProgram[] | null>(null);
  const [subfields, setSubfields] = useState<Record<number, GroupProgramSubField[]>>({});
  const [courses, setCourses] = useState<GroupContentLink[]>([]);
  const [error, setError] = useState(false);
  const programsVisible = canSee(viewer, "programs");

  const load = useCallback(async () => {
    setError(false);
    try {
      if (!programsVisible) { setPrograms([]); return; }
      const progs = await api.groups.programs(group.id);
      setPrograms(progs);
      // Parallel subfield fetch (previously serial N+1)
      const all = await Promise.all(progs.map(p => api.groups.subfields(group.id, p.id).catch(() => [])));
      const map: Record<number, GroupProgramSubField[]> = {};
      progs.forEach((p, i) => { map[p.id] = all[i]; });
      setSubfields(map);
      // Fetch linked courses (per-course is_public filtered server-side)
      setCourses(await api.groups.listGroupContent(group.id, "course").catch(() => []));
    } catch {
      setError(true);
    }
  }, [group.id, programsVisible]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="max-w-4xl mx-auto px-4 pb-16">
      <GroupPageHero
        eyebrowKey="groups.programs_title"
        titleKey="groups.pagehero_programs_title"
        introKey="groups.pagehero_programs_intro"
      />
      <div className="pt-12">
        {!programsVisible ? (
          <MembersGate title={t("groups.programs_title")} />
        ) : error ? (
          <LoadError message={t("groups.group_load_error")} onRetry={load} />
        ) : programs === null ? (
          <div className="grid sm:grid-cols-2 gap-4" aria-busy="true">
            {[0, 1].map(i => <div key={i} className="h-36 rounded-2xl skeleton-shimmer" />)}
          </div>
        ) : programs.length === 0 ? (
          <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <p className="text-sm text-stone-400 font-serif" data-rl-text="groups.no_programs">{t("groups.no_programs")}</p>
            {viewer.is_manager && (
              <Link href={`/groups/${group.slug}/manage`} className="text-[0.8rem] font-semibold text-rust-500 hover:text-rust-600 inline-flex items-center gap-1">
                {t("groups.wizard.add_program").replace("+ ", "")} <ArrowRight className="w-3 h-3" aria-hidden />
              </Link>
            )}
          </div>
        ) : (
          /* mockup .acts — numbered activity cards */
          <Reveal className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {programs.map((p, i) => (
              <ProgramCard key={p.id} program={p} subfields={subfields[p.id] ?? []} index={i} />
            ))}
          </Reveal>
        )}

        {/* Linked courses */}
        {courses.length > 0 && (
          <Reveal>
            <SectionHead eyebrowKey="groups.course_label" titleKey="groups.linked_courses" />
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {courses.map((c, i) => (
                <Link
                  key={c.content_id}
                  href={`/learning/courses/${c.content_id}`}
                  className="group relative rounded-2xl border border-primary-100 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 overflow-hidden hover:-translate-y-1 hover:shadow-[0_18px_44px_rgba(36,26,16,0.09)] transition-all duration-300 block"
                >
                  <span aria-hidden className="absolute -top-3 right-2 font-display text-7xl font-semibold text-primary-100/70 dark:text-primary-900/40 select-none">
                    {String((programs?.length ?? 0) + i + 1).padStart(2, "0")}
                  </span>
                  <p className="relative text-xs font-display font-semibold tracking-[0.22em] uppercase text-earth-500 mb-2" data-rl-text="groups.course_label">{t("groups.course_label")}</p>
                  <h3 className="relative font-display font-[560] text-lg text-primary-800 dark:text-primary-200 group-hover:text-rust-600 dark:group-hover:text-rust-400 transition">{c.title || `#${c.content_id}`}</h3>
                </Link>
              ))}
            </div>
          </Reveal>
        )}
      </div>
    </div>
  );
}
