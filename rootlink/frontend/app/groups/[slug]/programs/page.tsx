"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useGroup, canSee } from "@/lib/group-context";
import { useLocale } from "@/lib/locale-context";
import type { GroupProgram, GroupProgramSubField } from "@/lib/groups-types";
import { MembersGate } from "@/components/groups/MembersGate";
import { LoadError } from "@/components/studio/LoadError";
import { Reveal } from "@/components/groups/RootNav";
import { GroupPageHero } from "@/components/groups/GroupPageChrome";
import { ProgramCard } from "@/components/groups/ProgramCard";
import { ArrowRight } from "lucide-react";

export default function GroupProgramsPage() {
  const { group, viewer } = useGroup();
  const { t } = useLocale();
  const [programs, setPrograms] = useState<GroupProgram[] | null>(null);
  const [subfields, setSubfields] = useState<Record<number, GroupProgramSubField[]>>({});
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
    } catch {
      setError(true);
    }
  }, [group.id, programsVisible]);

  useEffect(() => { load(); }, [load]);

  return (
    <div className="max-w-4xl mx-auto px-4 pb-16">
      <GroupPageHero
        eyebrow={t("groups.programs_title")}
        title={t("groups.pagehero_programs_title")}
        intro={t("groups.pagehero_programs_intro")}
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
            <p className="text-sm text-stone-400 font-serif">{t("groups.no_programs")}</p>
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
      </div>
    </div>
  );
}
