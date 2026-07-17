"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useGroup, canSee } from "@/lib/group-context";
import { useLocale } from "@/lib/locale-context";
import { useToast } from "@/lib/toast-context";
import type { GroupMember, GroupAnnouncement, GroupChatLink, GroupGalleryItem } from "@/lib/groups-types";
import { RootNav, Reveal } from "@/components/groups/RootNav";
import { GroupPageHero, SectionHead } from "@/components/groups/GroupPageChrome";
import { MembersGate } from "@/components/groups/MembersGate";
import { LoadError } from "@/components/studio/LoadError";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Modal } from "@/components/ui/Modal";
import { safeImageUrl } from "@/lib/image-url";
import { MessageCircle, ExternalLink, Trash2 } from "lucide-react";

export default function GroupCommunityPage() {
  const { group, viewer } = useGroup();
  const { t, locale } = useLocale();
  const { addToast } = useToast();

  const [members, setMembers] = useState<GroupMember[]>([]);
  const [announcements, setAnnouncements] = useState<GroupAnnouncement[] | null>(null);
  const [chats, setChats] = useState<GroupChatLink[]>([]);
  const [gallery, setGallery] = useState<GroupGalleryItem[]>([]);
  const [lightbox, setLightbox] = useState<GroupGalleryItem | null>(null);
  const [error, setError] = useState(false);
  const [draft, setDraft] = useState("");
  const [posting, setPosting] = useState(false);

  const membersVisible = canSee(viewer, "members");
  const announcementsVisible = canSee(viewer, "announcements");
  const chatsVisible = canSee(viewer, "chats");
  const galleryVisible = canSee(viewer, "gallery");

  const load = useCallback(async () => {
    setError(false);
    try {
      const [ms, anns, chs, gal] = await Promise.all([
        membersVisible ? api.groups.members(group.id) : Promise.resolve([]),
        announcementsVisible ? api.groups.announcements(group.id) : Promise.resolve([]),
        chatsVisible ? api.groups.chats(group.id) : Promise.resolve([]),
        galleryVisible ? api.groups.gallery(group.id).catch(() => []) : Promise.resolve([]),
      ]);
      setMembers(ms); setAnnouncements(anns); setChats(chs); setGallery(gal);
    } catch {
      setError(true);
    }
  }, [group.id, membersVisible, announcementsVisible, chatsVisible, galleryVisible]);

  useEffect(() => { load(); }, [load]);

  const post = async () => {
    if (!draft.trim()) return;
    setPosting(true);
    try {
      const created = await api.groups.createAnnouncement(group.id, draft.trim());
      setAnnouncements(prev => prev ? [created, ...prev] : [created]);
      setDraft("");
      addToast("success", t("groups.announcement_posted"));
    } catch (e: unknown) {
      addToast("error", (e instanceof Error && e.message) || t("groups.post_error"));
    } finally {
      setPosting(false);
    }
  };

  const removeAnnouncement = async (a: GroupAnnouncement) => {
    if (!window.confirm(t("groups.announcement_delete_confirm"))) return;
    const prev = announcements;
    setAnnouncements(cur => cur?.filter(x => x.id !== a.id) ?? null);
    try {
      await api.groups.deleteAnnouncement(group.id, a.id);
      addToast("success", t("groups.announcement_deleted"));
    } catch (e: unknown) {
      setAnnouncements(prev ?? null);
      addToast("error", (e instanceof Error && e.message) || t("groups.post_error"));
    }
  };

  if (error) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10">
        <LoadError message={t("groups.group_load_error")} onRetry={load} />
      </div>
    );
  }

  if (announcements === null && announcementsVisible) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-10 space-y-5" aria-busy="true">
        <div className="h-8 w-1/3 skeleton-shimmer rounded" />
        <div className="h-24 skeleton-shimmer rounded-xl2" />
        <div className="h-40 skeleton-shimmer rounded-xl2" />
      </div>
    );
  }

  const fmtDate = (iso: string | null) => {
    if (!iso) return "";
    try { return new Date(iso).toLocaleDateString(locale === "pt" ? "pt-PT" : "en-GB", { day: "numeric", month: "long" }); }
    catch { return ""; }
  };

  const roleLabel = (role: string) =>
    role === "owner" || role === "admin" ? t("groups.role_owner")
      : role === "staff" || role === "moderator" ? t("groups.role_staff")
        : null;

  const navSections = [
    { id: "avisos", label: t("groups.announcements_title") },
    { id: "membros", label: t("groups.members_title") },
    ...(galleryVisible ? (gallery.length > 0 || viewer.is_manager ? [{ id: "galeria", label: t("groups.gallery_title") }] : []) : [{ id: "galeria", label: t("groups.gallery_title") }]),
    ...(chatsVisible && (chats.length > 0 || viewer.is_manager) ? [{ id: "conversas", label: t("groups.chats_title") }] : []),
  ];

  return (
    <div className="relative">
      <RootNav sections={navSections} />
      <div className="max-w-4xl mx-auto px-4 pb-16">
        <GroupPageHero
          eyebrow={t("groups.community_title")}
          title={t("groups.pagehero_community_title")}
          intro={t("groups.pagehero_community_intro")}
        />
        <div className="space-y-14 pt-12">

        {/* Announcements */}
        <Reveal id="avisos">
          <SectionHead eyebrow={t("groups.announcements_title")} title={t("groups.announcements_headline")} />
          {!announcementsVisible ? (
            <MembersGate title={t("groups.announcements_title")} />
          ) : (
            <div className="space-y-4">
              {viewer.is_manager && (
                <div className="rounded-2xl border border-primary-100 dark:border-stone-800 bg-white dark:bg-stone-900 p-4">
                  <Textarea
                    label={t("groups.new_announcement")}
                    placeholder={t("groups.announcement_placeholder")}
                    value={draft}
                    maxLength={5000}
                    rows={3}
                    onChange={e => setDraft(e.target.value)}
                  />
                  <div className="mt-2 flex justify-end">
                    <Button size="sm" onClick={post} disabled={posting || !draft.trim()} loading={posting}>
                      {posting ? t("groups.posting") : t("groups.post")}
                    </Button>
                  </div>
                </div>
              )}
              {(announcements ?? []).length === 0 && (
                <p className="text-sm text-stone-400">{t("groups.no_announcements")}</p>
              )}
              {(announcements ?? []).map(a => (
                <article key={a.id} className="rounded-2xl border border-primary-100 dark:border-stone-800 bg-white dark:bg-stone-900 p-5">
                  <div className="flex items-start justify-between gap-3">
                    <p className="text-sm text-stone-700 dark:text-stone-200 font-serif leading-relaxed whitespace-pre-line flex-1">{a.body}</p>
                    {viewer.is_manager && (
                      <Button size="xs" variant="ghost" onClick={() => removeAnnouncement(a)} aria-label={t("groups.announcement_delete_confirm")}>
                        <Trash2 className="w-3.5 h-3.5" aria-hidden />
                      </Button>
                    )}
                  </div>
                  <p className="text-xs text-stone-400 mt-2">{fmtDate(a.created_at)}</p>
                </article>
              ))}
            </div>
          )}
        </Reveal>

        {/* Members */}
        <Reveal id="membros">
          <SectionHead eyebrow={t("groups.members_title")} title={t("groups.members_headline")} />
          {!membersVisible ? (
            <MembersGate title={t("groups.members_title")} />
          ) : (
            <div className="flex flex-wrap gap-x-5 gap-y-6">
              {members.map(m => {
                const name = m.user_name || `#${m.user_id}`;
                const role = roleLabel(m.role);
                return (
                  <div key={m.id} className="flex flex-col items-center text-center w-20">
                    {m.user_avatar ? (
                      <img src={safeImageUrl(m.user_avatar)} alt="" className="w-[52px] h-[52px] rounded-full object-cover border-2 border-white dark:border-stone-900 shadow-[0_4px_14px_rgba(36,26,16,0.12)]" />
                    ) : (
                      <div aria-hidden className="w-[52px] h-[52px] rounded-full bg-earth-500 grid place-items-center text-cream text-sm font-display font-semibold border-2 border-white dark:border-stone-900 shadow-[0_4px_14px_rgba(36,26,16,0.12)]">
                        {name.charAt(0).toUpperCase()}
                      </div>
                    )}
                    <p className="text-xs font-medium text-stone-700 dark:text-stone-200 truncate w-full mt-2">{name}</p>
                    {role && <p className="text-xs text-earth-500">{role}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </Reveal>

        {/* Gallery */}
        {(galleryVisible ? gallery.length > 0 || viewer.is_manager : true) && (
          <Reveal id="galeria">
            <SectionHead eyebrow={t("groups.gallery_title")} title={t("groups.gallery_headline")} />
            {!galleryVisible ? (
              <MembersGate title={t("groups.gallery_title")} />
            ) : gallery.length === 0 ? (
              <p className="text-sm text-stone-400 font-serif">{t("groups.no_photos")}</p>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {gallery.map(g => (
                  <button
                    key={g.id}
                    onClick={() => setLightbox(g)}
                    aria-label={g.caption || t("groups.gallery_title")}
                    className="group relative aspect-square rounded-2xl overflow-hidden border border-primary-100 dark:border-stone-800 focus-visible:ring-2 focus-visible:ring-primary-500/40"
                  >
                    <img
                      src={safeImageUrl(g.image_url)}
                      alt={g.caption || ""}
                      className="w-full h-full object-cover group-hover:scale-[1.04] transition duration-500"
                    />
                    {g.caption && (
                      <span className="absolute bottom-0 inset-x-0 px-3 py-2 bg-gradient-to-t from-stone-950/70 to-transparent text-cream text-xs font-serif text-left opacity-0 group-hover:opacity-100 transition">
                        {g.caption}
                      </span>
                    )}
                  </button>
                ))}
              </div>
            )}
          </Reveal>
        )}

        {/* Chats */}
        {chatsVisible && (chats.length > 0 || viewer.is_manager) && (
          <Reveal id="conversas">
            <SectionHead eyebrow={t("groups.chats_title")} title={t("groups.chats_headline")} />
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
          </Reveal>
        )}
        </div>
      </div>

      {/* Gallery lightbox */}
      <Modal
        open={!!lightbox}
        onClose={() => setLightbox(null)}
        title={lightbox?.caption || t("groups.gallery_title")}
        widthClassName="max-w-3xl"
      >
        {lightbox && (
          <img
            src={safeImageUrl(lightbox.image_url)}
            alt={lightbox.caption || ""}
            className="w-full max-h-[70vh] object-contain rounded-xl"
          />
        )}
      </Modal>
    </div>
  );
}
