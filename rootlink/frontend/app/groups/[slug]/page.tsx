"use client";

/**
 * Group landing — port of the approved agency mockup
 * (discovery/mockups/group-landing-agency/index.html) onto real data.
 *
 * Motion system: session-scoped preloader curtain, hero line-mask reveal,
 * cover parallax, marquee, scroll reveals, stat count-ups — GSAP, honoring
 * prefers-reduced-motion. Empty sections are hidden (except for managers,
 * per the definition doc); private sections gate instead of leak.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { useGroup, canSee } from "@/lib/group-context";
import { useLocale } from "@/lib/locale-context";
import { useToast } from "@/lib/toast-context";
import { useAuth } from "@/lib/auth-context";
import type { GroupMember, GroupContentLink, GroupProgram, GroupProgramSubField, GroupAnnouncement, GroupGalleryItem } from "@/lib/groups-types";
import { parseCategories } from "@/lib/groups-types";
import { gsap, useGSAP, ScrollTrigger } from "@/lib/gsap";
import { RootNav } from "@/components/groups/RootNav";
import { MembersGate, RequestJoinButton } from "@/components/groups/MembersGate";
import { CountUp } from "@/components/groups/CountUp";
import { ProgramCard } from "@/components/groups/ProgramCard";
import { Button } from "@/components/ui/Button";
import { safeImageUrl } from "@/lib/image-url";
import { MapPin, ArrowRight, Newspaper } from "lucide-react";

export default function GroupLandingPage() {
  const { group, viewer, refresh } = useGroup();
  const { t, locale } = useLocale();
  const { addToast } = useToast();
  const { user } = useAuth();
  const router = useRouter();

  const [members, setMembers] = useState<GroupMember[]>([]);
  const [events, setEvents] = useState<GroupContentLink[]>([]);
  const [articles, setArticles] = useState<GroupContentLink[]>([]);
  const [programs, setPrograms] = useState<GroupProgram[]>([]);
  const [subfieldsByProgram, setSubfieldsByProgram] = useState<Map<number, GroupProgramSubField[]>>(new Map());
  const [announcements, setAnnouncements] = useState<GroupAnnouncement[]>([]);
  const [gallery, setGallery] = useState<GroupGalleryItem[]>([]);
  const [eventIndex, setEventIndex] = useState(0);
  const [busy, setBusy] = useState(false);

  const scope = useRef<HTMLDivElement>(null);
  const preloaderRef = useRef<HTMLDivElement>(null);
  const heroImgRef = useRef<HTMLImageElement>(null);

  const membersVisible = canSee(viewer, "members");
  const calendarVisible = canSee(viewer, "calendar");
  const newsVisible = canSee(viewer, "news");
  const programsVisible = canSee(viewer, "programs");
  const announcementsVisible = canSee(viewer, "announcements");
  const galleryVisible = canSee(viewer, "gallery");

  // ── data ──
  const load = useCallback(async () => {
    const safe = <T,>(p: Promise<T[]>): Promise<T[]> => p.catch(() => []);
    const [ms, evs, arts, progs, anns, gal] = await Promise.all([
      membersVisible ? safe(api.groups.members(group.id)) : Promise.resolve([]),
      calendarVisible ? safe(api.groups.listGroupContent(group.id, "event")) : Promise.resolve([]),
      newsVisible ? safe(api.groups.listGroupContent(group.id, "article")) : Promise.resolve([]),
      programsVisible ? safe(api.groups.programs(group.id)) : Promise.resolve([]),
      announcementsVisible ? safe(api.groups.announcements(group.id)) : Promise.resolve([]),
      galleryVisible ? safe(api.groups.gallery(group.id)) : Promise.resolve([]),
    ]);
    setMembers(ms); setEvents(evs); setArticles(arts); setPrograms(progs); setAnnouncements(anns); setGallery(gal);
    // fetch sub-fields per program (parallel) for the 3-level tree
    if (progs.length > 0) {
      const sfs = await Promise.all(progs.map(p => safe(api.groups.subfields(group.id, p.id))));
      const map = new Map<number, GroupProgramSubField[]>();
      progs.forEach((p, i) => map.set(p.id, sfs[i]));
      setSubfieldsByProgram(map);
    }
  }, [group.id, membersVisible, calendarVisible, newsVisible, programsVisible, announcementsVisible, galleryVisible]);

  useEffect(() => { load(); }, [load]);

  // ── motion ──
  useGSAP(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const preKey = `rl-group-entrance-${group.slug}`;
    const seen = sessionStorage.getItem(preKey);
    const tl = gsap.timeline();

    // Preloader curtain — once per visit (session), never on reduced motion
    if (preloaderRef.current) {
      if (!seen && !reduced) {
        sessionStorage.setItem(preKey, "1");
        tl.fromTo(".rl-pre-name", { yPercent: 110 }, { yPercent: 0, duration: 0.55, ease: "power3.out" })
          .fromTo(".rl-pre-line", { scaleX: 0 }, { scaleX: 1, duration: 0.5, ease: "power2.inOut" }, "-=0.2")
          .to(preloaderRef.current, { yPercent: -100, duration: 0.65, ease: "power4.inOut", delay: 0.15 })
          .set(preloaderRef.current, { display: "none" });
      } else {
        gsap.set(preloaderRef.current, { display: "none" });
      }
    }

    if (!reduced) {
      // Hero identity + meta fade-up (the name is identity, not a tagline —
      // no line-mask reveal, just a gentle fade)
      tl.fromTo(".rl-hero-fade",
        { opacity: 0, y: 14 },
        { opacity: 1, y: 0, duration: 0.6, ease: "power2.out", stagger: 0.07 },
        seen ? 0.1 : "-=0.3"
      );

      // Cover parallax
      if (heroImgRef.current) {
        gsap.to(heroImgRef.current, {
          yPercent: 14, ease: "none",
          scrollTrigger: { trigger: heroImgRef.current, start: "top top", end: "bottom top", scrub: true },
        });
      }
      // (stat count-ups live in the per-element <CountUp> component — they
      // must re-run when API data lands, not on page mount)
    } else {
      gsap.set(".rl-hero-fade", { clearProps: "all" });
    }

    return () => { ScrollTrigger.getAll().forEach(st => st.kill()); };
  }, { scope, dependencies: [group.slug] });

  // ── membership actions ──
  const join = async () => {
    if (!user) { router.push("/auth/login"); return; }
    setBusy(true);
    try {
      await api.groups.join(group.id);
      addToast("success", t("groups.joined_toast"));
      await refresh();
    } catch (e: unknown) {
      addToast("error", (e instanceof Error && e.message) || t("groups.join_error"));
    } finally { setBusy(false); }
  };

  const leave = async () => {
    // Owners can never leave directly — the server blocks it; don't even ask.
    if (viewer.is_owner || viewer.is_founder) {
      addToast("warning", t("groups.owner_must_transfer"));
      return;
    }
    if (!window.confirm(t("groups.leave_confirm", { name: group.name }))) return;
    setBusy(true);
    try {
      await api.groups.leave(group.id);
      addToast("success", t("groups.left_toast"));
      await refresh();
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      // Map known backend errors to PT
      if (/owner|transfer/i.test(msg)) addToast("error", t("groups.owner_must_transfer"));
      else addToast("error", t("groups.leave_error"));
    } finally { setBusy(false); }
  };

  // ── derived ──
  const cats = parseCategories(group.categories);
  const memberCount = members.length;
  const fmtDay = (iso: string | null) => {
    if (!iso) return { day: "—", mon: "" };
    try {
      const d = new Date(iso);
      return {
        day: String(d.getDate()),
        mon: d.toLocaleDateString(locale === "pt" ? "pt-PT" : "en-GB", { month: "short" }).replace(".", ""),
      };
    } catch { return { day: "—", mon: "" }; }
  };
  const fmtFull = (iso: string | null) => {
    if (!iso) return "";
    try { return new Date(iso).toLocaleDateString(locale === "pt" ? "pt-PT" : "en-GB", { weekday: "short", day: "numeric", month: "short" }); }
    catch { return ""; }
  };

  const nextEvent = events[eventIndex];
  const marqueeItems = [
    ...cats.map(c => c.split(" / ").pop() as string),
    memberCount > 1 ? t("groups.members_count", { count: memberCount }) : null,
    group.location,
    ...programs.map(p => p.name),
  ].filter(Boolean) as string[];
  // A marquee with 2 items reads as a glitch, not a rhythm — it needs enough
  // material to earn its loop (the mockup had 7 items).
  const showMarquee = marqueeItems.length >= 4;

  // Sections earn their place: hidden when empty (unless manager), gated when private
  const showAbout = !!(group.description_long || group.description) || viewer.is_manager;
  const showCommunity = membersVisible ? memberCount > 0 || viewer.is_manager : true;
  const showCalendar = calendarVisible ? events.length > 0 || viewer.is_manager : true;
  const showNews = newsVisible ? articles.length > 0 || viewer.is_manager : true;
  const showPrograms = programsVisible ? programs.length > 0 || viewer.is_manager : true;
  const showGallery = galleryVisible ? gallery.length > 0 || viewer.is_manager : true;

  const navSections = [
    ...(showAbout ? [{ id: "snip-sobre", label: t("groups.tab_about") }] : []),
    ...(showCommunity ? [{ id: "snip-comunidade", label: t("groups.tab_community") }] : []),
    ...(showCalendar ? [{ id: "snip-calendario", label: t("groups.tab_calendar") }] : []),
    ...(showNews ? [{ id: "snip-noticias", label: t("groups.tab_news") }] : []),
    ...(showPrograms ? [{ id: "snip-atividades", label: t("groups.tab_programs") }] : []),
    ...(showGallery ? [{ id: "snip-galeria", label: t("groups.gallery_title") }] : []),
  ];

  const heroMeta = [
    membersVisible && memberCount > 0
      ? (memberCount === 1 ? t("groups.members_one") : t("groups.members_count", { count: memberCount }))
      : null,
    programs.length > 0 ? `${programs.length} ${t("groups.tab_programs").toLowerCase()}` : null,
    group.location,
  ].filter(Boolean) as string[];

  return (
    <div ref={scope}>
      {/* Preloader curtain (session-scoped) */}
      <div
        ref={preloaderRef}
        aria-hidden
        className="fixed inset-0 z-[90] bg-primary-800 grid place-items-center"
      >
        <div className="text-center">
          <div className="overflow-hidden">
            <span className="rl-pre-name inline-block font-display text-3xl sm:text-4xl font-semibold text-cream">{group.name}</span>
          </div>
          <div className="rl-pre-line h-px bg-cream/40 mt-4 origin-left" />
        </div>
      </div>

      <RootNav sections={navSections} />

      {/* ── Hero ── */}
      <header className="relative min-h-[72vh] flex items-end overflow-hidden bg-primary-800">
        <div className="absolute inset-0 overflow-hidden" aria-hidden>
          {group.image_url && (
            <img
              ref={heroImgRef}
              src={safeImageUrl(group.image_url, "/images/placeholder-card.svg")}
              alt=""
              className="w-full h-[115%] object-cover"
            />
          )}
          <div className="absolute inset-0 bg-gradient-to-t from-stone-950/85 via-stone-950/40 to-stone-950/10" />
        </div>

        <div className="relative z-10 max-w-6xl mx-auto px-4 pb-14 pt-40 w-full">
          <div className="rl-hero-fade flex flex-wrap items-center gap-2 mb-4">
            <span className={`px-2.5 py-1 rounded-full text-xs font-semibold ${group.group_type === "structured" ? "bg-rust-500 text-cream" : "bg-emerald-600 text-cream"}`}>
              {group.group_type === "structured" ? t("groups.type_structured") : t("groups.type_organic")}
            </span>
            {group.location && (
              <span className="px-2.5 py-1 rounded-full text-xs font-medium bg-cream/15 text-cream backdrop-blur flex items-center gap-1">
                <MapPin className="w-3 h-3" aria-hidden />{group.location}
              </span>
            )}
          </div>

          {/* Identity block — logo + name together, description below the name
              (mockup .hero-id). Proportions: 64px logo, display name, serif
              description. The name is identity (not a poetic tagline), so no
              line-mask/wonk treatment — just a fade-up. */}
          <div className="rl-hero-fade flex items-start gap-4 mb-6">
            {group.logo_url && (
              <img
                src={safeImageUrl(group.logo_url)}
                alt=""
                className="w-16 h-16 rounded-2xl object-cover border-2 border-cream/30 shadow shrink-0"
              />
            )}
            <div className="min-w-0">
              <h1 className="font-display font-semibold text-cream text-4xl sm:text-5xl md:text-6xl leading-[1.05] tracking-[-0.01em]">
                {group.name}
              </h1>
              {group.description && (
                <p className="text-cream/80 text-sm sm:text-base mt-2 max-w-lg font-serif leading-relaxed">
                  {group.description}
                </p>
              )}
            </div>
          </div>

          <div className="rl-hero-fade flex flex-wrap items-center gap-x-4 gap-y-1 text-cream/70 text-sm mb-7">
            {heroMeta.map((item, i) => (
              <span key={item} className="flex items-center gap-x-4">
                {i > 0 && <span aria-hidden>·</span>}
                {item}
              </span>
            ))}
          </div>

          <div className="rl-hero-fade flex flex-wrap gap-3">
            {viewer.is_member && (viewer.is_owner || viewer.is_founder) ? (
              // Owners don't get a Leave button — handover lives in Manage →
              // Transfer ownership. They get a shortcut to the cockpit instead.
              <Link href={`/groups/${group.slug}/manage`}>
                <Button>{t("groups.tab_manage")} <ArrowRight className="w-4 h-4" aria-hidden /></Button>
              </Link>
            ) : viewer.is_member ? (
              <Button variant="secondary" className="!border-cream/40 !text-cream hover:!bg-cream/10" onClick={leave} disabled={busy}>
                {t("groups.leave")}
              </Button>
            ) : group.is_open ? (
              <Button onClick={join} disabled={busy} loading={busy}>
                {t("groups.join")} <ArrowRight className="w-4 h-4" aria-hidden />
              </Button>
            ) : (
              <RequestJoinButton size="md" hero />
            )}
            <Link href={`/groups/${group.slug}/about`}>
              <Button variant="secondary" className="!border-cream/40 !text-cream hover:!bg-cream/10">{t("groups.tab_about")}</Button>
            </Link>
          </div>

          {/* Coming-up carousel */}
          {calendarVisible && events.length > 0 && nextEvent && (
            <div className="rl-hero-fade mt-8 max-w-md">
              <p className="text-xs font-display font-medium tracking-widest uppercase text-cream/60 mb-2 flex items-center gap-1.5">
                <span aria-hidden className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                {t("groups.upcoming_events")}
              </p>
              <Link
                href={`/events/${nextEvent.content_id}`}
                className="flex items-center gap-4 rounded-2xl bg-cream/10 backdrop-blur border border-cream/15 p-4 hover:bg-cream/15 transition"
              >
                <div className="text-center shrink-0">
                  <p className="font-display text-2xl font-semibold text-cream leading-none">{fmtDay(nextEvent.date).day}</p>
                  <p className="text-xs text-cream/60 uppercase">{fmtDay(nextEvent.date).mon}</p>
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-medium text-cream truncate">{nextEvent.title || `#${nextEvent.content_id}`}</p>
                  <p className="text-xs text-cream/60">{[fmtFull(nextEvent.date), nextEvent.location].filter(Boolean).join(" · ")}</p>
                </div>
              </Link>
              {events.length > 1 && (
                <div className="flex items-center gap-1.5 mt-2" role="tablist" aria-label={t("groups.upcoming_events")}>
                  {events.slice(0, 6).map((ev, i) => (
                    <button
                      key={ev.content_id}
                      role="tab"
                      aria-selected={i === eventIndex}
                      aria-label={ev.title || String(ev.content_id)}
                      onClick={() => setEventIndex(i)}
                      className={`h-1.5 rounded-full transition-all ${i === eventIndex ? "w-5 bg-cream" : "w-1.5 bg-cream/40 hover:bg-cream/60"}`}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* ── Marquee ── */}
      {showMarquee && (
        <div className="overflow-hidden border-y border-primary-100 dark:border-stone-800 bg-white dark:bg-stone-900 py-3 select-none" aria-hidden>
          <div className="flex whitespace-nowrap rl-marquee">
            {[0, 1].map(dup => (
              <div key={dup} className="flex shrink-0 items-center">
                {marqueeItems.map((item, i) => (
                  <span key={`${dup}-${i}`} className="flex items-center text-sm font-display text-stone-500 dark:text-stone-400">
                    <span className="px-5">{item}</span>
                    <span className="text-rust-400">✺</span>
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="max-w-6xl mx-auto px-4">
        {/* ── About snippet ── */}
        {showAbout && (
          <SnippetSection
            id="snip-sobre"
            eyebrow={t("groups.about_title")}
            headline={t("groups.snippet_about_headline")}
            linkLabel={t("groups.see_page")}
            href={`/groups/${group.slug}/about`}
          >
            {/* mockup .kicker — larger serif, measure-limited */}
            <p className="font-serif text-primary-700 dark:text-stone-300 leading-relaxed max-w-[34em] text-[clamp(1.05rem,1.5vw,1.25rem)]">
              {group.description_long?.slice(0, 400) || group.description || t("groups.no_description_yet")}
            </p>
            {cats.length > 0 && (
              <div className="flex flex-wrap gap-1.5 mt-5">
                {cats.map(c => (
                  <span key={c} className="px-2.5 py-1 rounded-full text-xs font-medium bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-300">
                    {c.split(" / ").pop()}
                  </span>
                ))}
              </div>
            )}
          </SnippetSection>
        )}

        {/* ── Community snippet ── */}
        {showCommunity && (
          <SnippetSection
            id="snip-comunidade"
            eyebrow={t("groups.community_title")}
            headline={t("groups.snippet_community_headline")}
            linkLabel={t("groups.see_page")}
            href={`/groups/${group.slug}/community`}
            tinted
          >
            {!membersVisible ? (
              <MembersGate title={t("groups.members_title")} />
            ) : (
              <div className="grid sm:grid-cols-2 gap-5 items-start">
                {announcementsVisible && announcements[0] && (
                  <div className="rounded-2xl border border-primary-100 dark:border-stone-800 bg-white dark:bg-stone-900 p-5">
                    <p className="text-xs font-display font-medium tracking-widest uppercase text-earth-500 mb-2">{t("groups.announcements_title")}</p>
                    <p className="text-sm text-stone-600 dark:text-stone-300 font-serif leading-relaxed line-clamp-4">{announcements[0].body}</p>
                  </div>
                )}
                <div>
                  <CountUp value={memberCount} className="block font-display font-semibold text-rust-500 leading-none text-[clamp(3rem,7vw,5rem)]" />
                  <p className="text-sm text-stone-500 mt-2">
                    {memberCount === 1 ? t("groups.members_one") : t("groups.members_count", { count: memberCount })}
                  </p>
                  <div className="flex mt-4 -space-x-2">
                    {members.slice(0, 6).map(m => {
                      const nm = m.user_name || `#${m.user_id}`;
                      return m.user_avatar ? (
                        <img key={m.id} src={safeImageUrl(m.user_avatar)} alt={nm} title={nm} className="w-9 h-9 rounded-full object-cover border-2 border-cream dark:border-stone-950" />
                      ) : (
                        <span key={m.id} title={nm} className="w-9 h-9 rounded-full bg-earth-500 text-cream grid place-items-center text-xs font-display font-semibold border-2 border-cream dark:border-stone-950">
                          {nm.charAt(0).toUpperCase()}
                        </span>
                      );
                    })}
                    {memberCount > 6 && (
                      <span className="w-9 h-9 rounded-full bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-300 grid place-items-center text-xs font-display font-semibold border-2 border-cream dark:border-stone-950">
                        +{memberCount - 6}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            )}
          </SnippetSection>
        )}

        {/* ── Calendar snippet ── */}
        {showCalendar && (
          <SnippetSection
            id="snip-calendario"
            eyebrow={t("groups.calendar_title")}
            headline={t("groups.snippet_calendar_headline")}
            linkLabel={t("groups.see_page")}
            href={`/groups/${group.slug}/calendar`}
          >
            {!calendarVisible ? (
              <MembersGate title={t("groups.calendar_title")} />
            ) : events.length === 0 ? (
              <EmptyLine
                text={t("groups.no_events")}
                cta={viewer.is_manager ? { label: t("groups.link_first_event"), href: `/groups/${group.slug}/manage` } : undefined}
              />
            ) : (
              <div className="divide-y divide-primary-100 dark:divide-stone-800">
                {events.slice(0, 3).map(ev => (
                  <Link key={ev.content_id} href={`/events/${ev.content_id}`} className="flex items-center gap-4 py-3.5 group">
                    <span className="text-xs font-display font-medium tracking-wide uppercase text-earth-500 min-w-16">{fmtFull(ev.date)}</span>
                    <span className="text-sm font-medium text-stone-800 dark:text-stone-100 flex-1 min-w-0 truncate group-hover:text-primary-700 dark:group-hover:text-primary-300 transition">
                      {ev.title || `#${ev.content_id}`}
                    </span>
                    <ArrowRight className="w-4 h-4 text-stone-300 group-hover:text-rust-500 group-hover:translate-x-0.5 transition" aria-hidden />
                  </Link>
                ))}
              </div>
            )}
          </SnippetSection>
        )}

        {/* ── News snippet ── */}
        {showNews && (
          <SnippetSection
            id="snip-noticias"
            eyebrow={t("groups.news_title")}
            headline={t("groups.snippet_news_headline")}
            linkLabel={t("groups.see_page")}
            href={`/groups/${group.slug}/news`}
            tinted
          >
            {!newsVisible ? (
              <MembersGate title={t("groups.news_title")} />
            ) : articles.length === 0 ? (
              <EmptyLine
                text={t("groups.no_articles")}
                cta={viewer.is_manager ? { label: t("groups.link_first_article"), href: `/groups/${group.slug}/manage` } : undefined}
              />
            ) : (
              <div className="grid sm:grid-cols-2 gap-4">
                {articles.slice(0, 2).map(a => (
                  <Link key={a.content_id} href={`/content/${a.content_id}`} className="rounded-2xl border border-primary-100 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 hover:border-primary-300 hover:shadow-sm transition block">
                    <Newspaper className="w-4 h-4 text-primary-400 mb-3" aria-hidden />
                    <h3 className="font-display font-semibold text-stone-800 dark:text-stone-100">{a.title || `#${a.content_id}`}</h3>
                  </Link>
                ))}
              </div>
            )}
          </SnippetSection>
        )}

        {/* ── Programs snippet ── */}
        {showPrograms && (
          <SnippetSection
            id="snip-atividades"
            eyebrow={t("groups.programs_title")}
            headline={t("groups.snippet_programs_headline")}
            linkLabel={t("groups.see_page")}
            href={`/groups/${group.slug}/programs`}
          >
            {!programsVisible ? (
              <MembersGate title={t("groups.programs_title")} />
            ) : programs.length === 0 ? (
              <EmptyLine
                text={t("groups.no_programs")}
                cta={viewer.is_manager ? { label: t("groups.wizard.add_program").replace("+ ", ""), href: `/groups/${group.slug}/manage` } : undefined}
              />
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {programs.slice(0, 3).map((p, i) => (
                  <ProgramCard key={p.id} program={p} subfields={subfieldsByProgram.get(p.id) ?? []} index={i} />
                ))}
              </div>
            )}
          </SnippetSection>
        )}

        {/* ── Gallery snippet ── */}
        {showGallery && (
          <SnippetSection
            id="snip-galeria"
            eyebrow={t("groups.gallery_title")}
            headline={t("groups.snippet_gallery_headline")}
            linkLabel={t("groups.see_page")}
            href={`/groups/${group.slug}/community#galeria`}
            tinted
          >
            {!galleryVisible ? (
              <MembersGate title={t("groups.gallery_title")} />
            ) : gallery.length === 0 ? (
              <EmptyLine
                text={t("groups.no_photos")}
                cta={viewer.is_manager ? { label: t("groups.manage.add_photo"), href: `/groups/${group.slug}/manage` } : undefined}
              />
            ) : (
              /* editorial mosaic: first photo leads, the rest follow square */
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 auto-rows-fr">
                {gallery.slice(0, 5).map((g, i) => (
                  <Link
                    key={g.id}
                    href={`/groups/${group.slug}/community#galeria`}
                    className={`group relative rounded-2xl overflow-hidden border border-primary-100 dark:border-stone-800 ${i === 0 ? "col-span-2 row-span-2" : "aspect-square"}`}
                  >
                    <img
                      src={safeImageUrl(g.image_url)}
                      alt={g.caption || ""}
                      className="w-full h-full object-cover group-hover:scale-[1.04] transition duration-500"
                    />
                    {i === 4 && gallery.length > 5 && (
                      <span className="absolute inset-0 grid place-items-center bg-stone-950/55 text-cream font-display text-xl font-semibold">
                        +{gallery.length - 5}
                      </span>
                    )}
                    {g.caption && i === 0 && (
                      <span className="absolute bottom-0 inset-x-0 px-4 py-2.5 bg-gradient-to-t from-stone-950/70 to-transparent text-cream text-xs font-serif">
                        {g.caption}
                      </span>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </SnippetSection>
        )}

        {/* ── Stats interlude + quoteline ── */}
        {(memberCount > 0 || events.length > 0 || programs.length > 0) && (
          <section className="py-14 sm:py-20">
            {/* stats earn their place with real numbers; "1 / 1" reads as
                emptiness, so the grid waits until something is ≥ 2 */}
            {[memberCount, events.length, programs.length, articles.length].some(n => n >= 2) && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-6 text-center mb-14">
                {membersVisible && memberCount > 0 && <Stat count={memberCount} label={t("groups.members_title").toLowerCase()} />}
                {events.length > 0 && <Stat count={events.length} label={t("groups.upcoming_events").toLowerCase()} />}
                {programs.length > 0 && <Stat count={programs.length} label={t("groups.tab_programs").toLowerCase()} />}
                {articles.length > 0 && <Stat count={articles.length} label={t("groups.tab_news").toLowerCase()} />}
              </div>
            )}
            {/* quoteline (mockup) — display italic, soft + wonk axes */}
            <p className="wonk italic font-display text-center text-primary-800 dark:text-primary-200 max-w-[26em] mx-auto text-[clamp(1.3rem,2.6vw,1.9rem)] leading-snug">
              {t("groups.stats_quote")}
            </p>
          </section>
        )}

        {/* ── CTA ── */}
        {!viewer.is_member && (
          <section className="py-16 text-center border-t border-primary-100 dark:border-stone-800">
            <h2 className="font-display text-4xl sm:text-5xl font-semibold text-primary-800 dark:text-primary-200">
              {t("groups.belong_title").split(" ").slice(0, -1).join(" ")}{" "}
              <em className="wonk not-italic">{t("groups.belong_title").split(" ").slice(-1)}</em>
            </h2>
            <p className="text-stone-500 mt-3 max-w-md mx-auto font-serif">{t("groups.belong_message", { name: group.name })}</p>
            <div className="mt-6">
              {group.is_open ? (
                <Button size="lg" onClick={join} disabled={busy} loading={busy}>
                  {t("groups.join")} <ArrowRight className="w-4 h-4" aria-hidden />
                </Button>
              ) : (
                <RequestJoinButton size="lg" />
              )}
            </div>
          </section>
        )}
      </div>
    </div>
  );
}

/** Editorial snippet section — mockup .snippet: eyebrow + display headline
 * with the arrow link bottom-aligned to the right, hairline between sections. */
function SnippetSection({ id, eyebrow, headline, linkLabel, href, tinted, children }: {
  id: string; eyebrow: string; headline: string; linkLabel: string; href: string; tinted?: boolean; children: React.ReactNode;
}) {
  const ref = useRef<HTMLElement>(null);
  useGSAP(() => {
    if (!ref.current || window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    gsap.fromTo(ref.current, { opacity: 0, y: 28 }, {
      opacity: 1, y: 0, duration: 0.75, ease: "power3.out",
      scrollTrigger: { trigger: ref.current, start: "top 85%", once: true },
    });
  }, []);
  return (
    <section
      id={id}
      ref={ref}
      className={`scroll-mt-32 py-12 sm:py-16 border-b border-primary-100 dark:border-stone-800 last-of-type:border-b-0 ${tinted ? "sm:-mx-4 sm:px-4 sm:rounded-3xl sm:bg-primary-50/40 dark:sm:bg-primary-900/10 sm:border-b-0" : ""}`}
    >
      {/* snippet-head: eyebrow + display headline, arrow link bottom-right */}
      <div className="flex items-end justify-between gap-4 mb-7">
        <div>
          <p className="text-xs font-display font-semibold tracking-[0.22em] uppercase text-earth-500">{eyebrow}</p>
          <h2
            className="font-display font-[560] text-primary-800 dark:text-primary-200 mt-2 leading-[1.02] tracking-[-0.015em] text-[clamp(2rem,4.6vw,3.4rem)]"
            style={{ fontVariationSettings: '"opsz" 144' }}
          >
            {headline}
          </h2>
        </div>
        <Link href={href} className="text-[0.8rem] font-semibold text-rust-500 hover:text-rust-600 flex items-center gap-1.5 group shrink-0 mb-1.5">
          {linkLabel} <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition" aria-hidden />
        </Link>
      </div>
      {children}
    </section>
  );
}

/** Empty-section line — with an action for managers, so an empty section is
 * an invitation to act, not a dead end (self-sufficiency §6). */
function EmptyLine({ text, cta }: { text: string; cta?: { label: string; href: string } }) {
  return (
    <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
      <p className="text-sm text-stone-400 font-serif">{text}</p>
      {cta && (
        <Link href={cta.href} className="text-[0.8rem] font-semibold text-rust-500 hover:text-rust-600 inline-flex items-center gap-1 group">
          {cta.label} <ArrowRight className="w-3 h-3 group-hover:translate-x-0.5 transition" aria-hidden />
        </Link>
      )}
    </div>
  );
}

function Stat({ count, label }: { count: number; label: string }) {  return (
    <div>
      {/* mockup .stat b — display font, rust */}
      <CountUp
        value={count}
        className="block font-display font-semibold text-rust-500 leading-none text-[clamp(2.2rem,5vw,3.6rem)]"
      />
      <p className="text-xs text-earth-500 mt-2">{label}</p>
    </div>
  );
}
