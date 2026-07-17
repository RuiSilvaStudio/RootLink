"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useGroup, canSee } from "@/lib/group-context";
import { useLocale } from "@/lib/locale-context";
import type { GroupContact, GroupBoardMember, GroupDocument, GroupChatLink } from "@/lib/groups-types";
import { RootNav, Reveal } from "@/components/groups/RootNav";
import { GroupPageHero, SectionHead } from "@/components/groups/GroupPageChrome";
import { Text } from "@/components/ui/Text";
import { MembersGate } from "@/components/groups/MembersGate";
import { LoadError } from "@/components/studio/LoadError";
import Link from "next/link";
import { FileText, MapPin, Phone, Mail, Globe, Clock, MessageCircle, ExternalLink, ArrowRight } from "lucide-react";

export default function GroupAboutPage() {
  const { group, viewer } = useGroup();
  const { t } = useLocale();

  const [contacts, setContacts] = useState<GroupContact[] | null>(null);
  const [board, setBoard] = useState<GroupBoardMember[]>([]);
  const [documents, setDocuments] = useState<GroupDocument[]>([]);
  const [chats, setChats] = useState<GroupChatLink[]>([]);
  const [error, setError] = useState(false);

  const contactsVisible = canSee(viewer, "contacts");
  const documentsVisible = canSee(viewer, "documents");
  const chatsVisible = canSee(viewer, "chats");

  const load = useCallback(async () => {
    setError(false);
    try {
      const [c, b, d, ch] = await Promise.all([
        contactsVisible ? api.groups.contacts(group.id) : Promise.resolve([]),
        api.groups.board(group.id),
        documentsVisible ? api.groups.documents(group.id) : Promise.resolve([]),
        chatsVisible ? api.groups.chats(group.id) : Promise.resolve([]),
      ]);
      setContacts(c); setBoard(b); setDocuments(d); setChats(ch);
    } catch {
      setError(true);
    }
  }, [group.id, contactsVisible, documentsVisible, chatsVisible]);

  useEffect(() => { load(); }, [load]);

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <LoadError message={t("groups.group_load_error")} onRetry={load} />
      </div>
    );
  }

  if (contacts === null) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-5" aria-busy="true">
        <div className="h-8 w-1/3 skeleton-shimmer rounded" />
        <div className="h-24 skeleton-shimmer rounded-xl2" />
        <div className="h-40 skeleton-shimmer rounded-xl2" />
      </div>
    );
  }

  // Empty sections are hidden from everyone except the owner (definition doc)
  const showBoard = board.length > 0;
  const showDocuments = documentsVisible ? documents.length > 0 || viewer.is_manager : true;
  const showContacts = contactsVisible ? contacts.length > 0 || viewer.is_manager : true;
  const showChats = chatsVisible ? chats.length > 0 || viewer.is_manager : true;
  const showConduct = !!group.conduct;

  const navSections = [
    ...(group.description_long ? [{ id: "sobre", label: t("groups.about_title") }] : []),
    ...(showConduct ? [{ id: "conduta", label: t("groups.manage.conduct_label") }] : []),
    ...(showBoard ? [{ id: "orgaos", label: t("groups.board_title") }] : []),
    ...(showDocuments ? [{ id: "documentos", label: t("groups.documents_title") }] : []),
    ...(showContacts ? [{ id: "contactos", label: t("groups.contacts_title") }] : []),
    ...(showChats ? [{ id: "conversas", label: t("groups.chats_title") }] : []),
  ];

  return (
    <div className="relative">
      <RootNav sections={navSections} />
      <div className="max-w-4xl mx-auto px-4 pb-16">
        <GroupPageHero
          eyebrowKey="groups.about_title"
          titleKey="groups.pagehero_about_title"
          {...(group.description ? { intro: group.description } : { introKey: "groups.pagehero_about_intro" })}
        />
        <div className="space-y-14 pt-12">
        {/* About */}
        {group.description_long && (
          <Reveal id="sobre">
            <div className="font-serif text-primary-700 dark:text-stone-300 leading-relaxed whitespace-pre-line max-w-[38em] text-[clamp(1rem,1.4vw,1.15rem)]">
              {group.description_long}
            </div>
          </Reveal>
        )}

        {/* Conduct */}
        {showConduct && (
          <Reveal id="conduta">
            <SectionHead eyebrowKey="groups.manage.conduct_label" titleKey="groups.conduct_headline" />
            <div className="rounded-2xl border border-primary-100 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 text-sm text-stone-600 dark:text-stone-300 font-serif leading-relaxed whitespace-pre-line">
              {group.conduct}
            </div>
          </Reveal>
        )}

        {/* Board — grouped by Órgão (Direção, Conselho Fiscal, …) */}
        {showBoard && (
          <Reveal id="orgaos">
            <SectionHead eyebrowKey="groups.board_title" titleKey="groups.board_headline" />
            <div className="space-y-8">
              {Object.entries(
                board.reduce<Record<string, GroupBoardMember[]>>((acc, b) => {
                  (acc[b.body_name] ??= []).push(b);
                  return acc;
                }, {})
              ).map(([bodyName, members]) => (
                <div key={bodyName}>
                  <h3 className="font-display font-[560] text-primary-800 dark:text-primary-200 text-lg tracking-[-0.01em] pb-2 mb-3 border-b border-primary-100 dark:border-stone-800">
                    {bodyName}
                  </h3>
                  <ul className="space-y-2">
                    {members.map(b => (
                      <li key={b.id} className="flex flex-wrap items-baseline gap-x-2 text-sm">
                        <span className="font-medium text-stone-800 dark:text-stone-100">{b.member_name}</span>
                        {b.role && <span className="text-earth-500">{b.role}</span>}
                        {b.term_start && (
                          <span className="text-xs text-stone-400">
                            ({b.term_start}{b.term_end ? `–${b.term_end}` : ""})
                          </span>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </Reveal>
        )}

        {/* Documents */}
        {showDocuments && (
          <Reveal id="documentos">
            <SectionHead eyebrowKey="groups.documents_title" titleKey="groups.documents_headline" />
            {!documentsVisible ? (
              <MembersGate title={t("groups.documents_title")} />
            ) : documents.length === 0 ? (
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <p className="text-sm text-stone-400 font-serif">{t("groups.no_documents")}</p>
                {viewer.is_manager && (
                  <Link href={`/groups/${group.slug}/manage`} className="text-[0.8rem] font-semibold text-rust-500 hover:text-rust-600 inline-flex items-center gap-1">
                    {t("groups.manage.add_document")} <ArrowRight className="w-3 h-3" aria-hidden />
                  </Link>
                )}
              </div>
            ) : (
              <div className="space-y-2">
                {documents.map(d => (
                  <a
                    key={d.id}
                    href={d.file_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-xl2 border border-primary-100 dark:border-stone-800 bg-white dark:bg-stone-900 p-4 hover:border-primary-300 transition"
                  >
                    <FileText className="w-4 h-4 text-primary-500 shrink-0" aria-hidden />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-stone-800 dark:text-stone-100 truncate">{d.title}</p>
                      <p className="text-xs text-stone-400">{t(`groups.manage.doc_type_${d.doc_type}`)}</p>
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-stone-300" aria-hidden />
                  </a>
                ))}
              </div>
            )}
          </Reveal>
        )}

        {/* Contacts */}
        {showContacts && (
          <Reveal id="contactos">
            <SectionHead eyebrowKey="groups.contacts_title" titleKey="groups.contacts_headline" />
            {!contactsVisible ? (
              <MembersGate title={t("groups.contacts_title")} />
            ) : contacts.length === 0 ? (
              <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
                <p className="text-sm text-stone-400 font-serif">{t("groups.no_contacts")}</p>
                {viewer.is_manager && (
                  <Link href={`/groups/${group.slug}/manage`} className="text-[0.8rem] font-semibold text-rust-500 hover:text-rust-600 inline-flex items-center gap-1">
                    {t("groups.manage.add_contact")} <ArrowRight className="w-3 h-3" aria-hidden />
                  </Link>
                )}
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {contacts.map(c => (
                  <div key={c.id} className="rounded-xl2 border border-primary-100 dark:border-stone-800 bg-white dark:bg-stone-900 p-4 space-y-1.5">
                    <p className="text-sm font-medium text-stone-800 dark:text-stone-100">{c.label}</p>
                    {c.address && <p className="flex items-center gap-1.5 text-xs text-stone-500"><MapPin className="w-3.5 h-3.5 shrink-0" aria-hidden />{c.address}</p>}
                    {c.phone && <p className="flex items-center gap-1.5 text-xs text-stone-500"><Phone className="w-3.5 h-3.5 shrink-0" aria-hidden /><a className="hover:text-primary-600" href={`tel:${c.phone.replace(/\s/g, "")}`}>{c.phone}</a></p>}
                    {c.email && <p className="flex items-center gap-1.5 text-xs text-stone-500"><Mail className="w-3.5 h-3.5 shrink-0" aria-hidden /><a className="hover:text-primary-600" href={`mailto:${c.email}`}>{c.email}</a></p>}
                    {c.website && <p className="flex items-center gap-1.5 text-xs text-stone-500"><Globe className="w-3.5 h-3.5 shrink-0" aria-hidden /><a className="hover:text-primary-600" href={c.website} target="_blank" rel="noopener noreferrer">{c.website}</a></p>}
                    {c.hours && <p className="flex items-center gap-1.5 text-xs text-stone-500"><Clock className="w-3.5 h-3.5 shrink-0" aria-hidden />{c.hours}</p>}
                  </div>
                ))}
              </div>
            )}
          </Reveal>
        )}

        {/* Chats */}
        {showChats && (
          <Reveal id="conversas">
            <SectionHead eyebrowKey="groups.chats_title" titleKey="groups.chats_headline" />
            {!chatsVisible ? (
              <MembersGate title={t("groups.chats_title")} />
            ) : (
              <div className="space-y-2">
                {chats.map(ch => (
                  <a
                    key={ch.id}
                    href={ch.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 rounded-xl2 border border-primary-100 dark:border-stone-800 bg-white dark:bg-stone-900 p-4 hover:border-primary-300 transition"
                  >
                    <MessageCircle className="w-4 h-4 text-emerald-600 shrink-0" aria-hidden />
                    <span className="text-sm font-medium text-stone-800 dark:text-stone-100 flex-1">{ch.name}</span>
                    <ExternalLink className="w-3.5 h-3.5 text-stone-300" aria-hidden />
                  </a>
                ))}
              </div>
            )}
          </Reveal>
        )}
        </div>
      </div>
    </div>
  );
}
