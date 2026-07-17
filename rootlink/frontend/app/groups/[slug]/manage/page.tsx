"use client";

import { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { useGroup } from "@/lib/group-context";
import { useLocale } from "@/lib/locale-context";
import { SettingsSection } from "@/components/groups/manage/SettingsSection";
import { MembersSection } from "@/components/groups/manage/MembersSection";
import { InvitesSection } from "@/components/groups/manage/InvitesSection";
import { RecordsSection } from "@/components/groups/manage/RecordsSection";
import { ContentSection } from "@/components/groups/manage/ContentSection";
import {
  Settings, Users, Ticket, BookOpen, CalendarPlus,
} from "lucide-react";

type SectionId = "settings" | "members" | "invites" | "records" | "content";

export default function GroupManagePage() {
  const { group, viewer, refresh } = useGroup();
  const { t } = useLocale();
  const router = useRouter();
  const params = useParams();
  const slug = params.slug as string;
  const [section, setSection] = useState<SectionId>("settings");

  // Access gate: non-managers are quietly sent to the group's public page.
  useEffect(() => {
    if (!viewer.is_manager) router.replace(`/groups/${slug}`);
  }, [viewer.is_manager, router, slug]);
  if (!viewer.is_manager) return null;

  const sections: { id: SectionId; label: string; icon: React.ReactNode }[] = [
    { id: "settings", label: t("groups.manage.section_settings"), icon: <Settings className="w-4 h-4" aria-hidden /> },
    { id: "members", label: t("groups.manage.section_members"), icon: <Users className="w-4 h-4" aria-hidden /> },
    { id: "invites", label: t("groups.manage.section_invites"), icon: <Ticket className="w-4 h-4" aria-hidden /> },
    { id: "records", label: t("groups.manage.section_contacts"), icon: <BookOpen className="w-4 h-4" aria-hidden /> },
    { id: "content", label: t("groups.manage.section_content"), icon: <CalendarPlus className="w-4 h-4" aria-hidden /> },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <header className="mb-6">
        <h1 className="font-display text-2xl font-semibold text-primary-800 dark:text-primary-200">{t("groups.manage.title")}</h1>
        <p className="text-sm text-stone-500">{t("groups.manage.subtitle", { name: group.name })}</p>
      </header>

      {/* Section nav */}
      <nav aria-label={t("groups.manage.title")} className="flex gap-1.5 mb-8 overflow-x-auto scrollbar-none pb-1">
        {sections.map(s => (
          <button
            key={s.id}
            onClick={() => setSection(s.id)}
            aria-current={section === s.id ? "true" : undefined}
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition ${
              section === s.id
                ? "bg-primary-600 text-cream"
                : "text-stone-500 hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-700 dark:hover:text-primary-300"
            }`}
          >
            {s.icon} {s.label}
          </button>
        ))}
      </nav>

      {section === "settings" && <SettingsSection group={group} onSaved={refresh} />}
      {section === "members" && <MembersSection group={group} viewer={viewer} onChanged={refresh} />}
      {section === "invites" && <InvitesSection group={group} />}
      {section === "records" && <RecordsSection group={group} />}
      {section === "content" && <ContentSection group={group} />}
    </div>
  );
}
