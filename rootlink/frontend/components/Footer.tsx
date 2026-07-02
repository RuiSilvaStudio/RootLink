"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { X, ChevronDown } from "lucide-react";
import { useLocale } from "@/lib/locale-context";
import { EditableText } from "@/components/editor-mode/editable-text";

/* ── Botanical SVG separator ─────────────────────────────── */
function BotanicalSvg() {
  return (
    <svg className="w-full mt-10 h-10" viewBox="0 0 1152 40" preserveAspectRatio="xMidYMid meet" aria-hidden="true" focusable="false" xmlns="http://www.w3.org/2000/svg">
      <g stroke="currentColor" fill="none" strokeLinecap="round" strokeLinejoin="round" className="text-primary-300/20 dark:text-primary-700/15">
        <line x1="0" y1="20" x2="1152" y2="20" strokeWidth="1"/>
        <path d="M120,20 C130,20 138,12 148,8" strokeWidth="0.8"/><path d="M120,20 C128,20 134,26 140,30" strokeWidth="0.8"/>
        <path d="M148,8 C155,5 160,8 166,6" strokeWidth="0.6"/><path d="M140,30 C146,32 150,30 156,32" strokeWidth="0.6"/>
        <path d="M1032,20 C1022,20 1014,12 1004,8" strokeWidth="0.8"/><path d="M1032,20 C1024,20 1018,26 1012,30" strokeWidth="0.8"/>
        <path d="M1004,8 C997,5 992,8 986,6" strokeWidth="0.6"/><path d="M1012,30 C1006,32 1002,30 996,32" strokeWidth="0.6"/>
        <path d="M576,20 C568,20 562,10 556,5" strokeWidth="0.8"/><path d="M576,20 C582,20 586,10 592,5" strokeWidth="0.8"/>
        <path d="M576,20 C574,20 570,28 566,33" strokeWidth="0.8"/><path d="M576,20 C578,20 582,28 586,33" strokeWidth="0.8"/>
        <path d="M556,5 C552,2 548,4 544,2" strokeWidth="0.6"/><path d="M592,5 C596,2 600,4 604,2" strokeWidth="0.6"/>
        <circle cx="120" cy="20" r="2" fill="currentColor" stroke="none"/>
        <circle cx="576" cy="20" r="2.5" fill="currentColor" stroke="none"/>
        <circle cx="1032" cy="20" r="2" fill="currentColor" stroke="none"/>
        <circle cx="300" cy="20" r="1.2" fill="currentColor" stroke="none" className="text-primary-200/20 dark:text-primary-800/15"/>
        <circle cx="450" cy="20" r="1.2" fill="currentColor" stroke="none" className="text-primary-200/20 dark:text-primary-800/15"/>
        <circle cx="702" cy="20" r="1.2" fill="currentColor" stroke="none" className="text-primary-200/20 dark:text-primary-800/15"/>
        <circle cx="852" cy="20" r="1.2" fill="currentColor" stroke="none" className="text-primary-200/20 dark:text-primary-800/15"/>
      </g>
    </svg>
  );
}

/* ── Accordion column (mobile) ───────────────────────────── */
function FooterCol({ heading, children }: { heading: string; children: React.ReactNode }) {
  const [open, setOpen] = useState(false);

  // Reset on resize past 640px
  useEffect(() => {
    const handler = () => { if (window.innerWidth >= 640) setOpen(false); };
    window.addEventListener("resize", handler);
    return () => window.removeEventListener("resize", handler);
  }, []);

  return (
    <div>
      {/* Desktop heading — always visible */}
      <p className="hidden sm:block font-display text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-primary-600 dark:text-primary-500 pb-3 border-b border-b-primary-300/50 dark:border-b-primary-700/40 w-fit min-w-[2.5rem] mb-5">
        {heading}
      </p>
      {/* Mobile accordion trigger */}
      <button
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        className="sm:hidden flex items-center justify-between w-full py-4 font-display text-[0.625rem] font-semibold uppercase tracking-[0.18em] text-primary-600 dark:text-primary-500 border-t border-primary-200/20 dark:border-primary-800/20"
      >
        {heading}
        <ChevronDown className={`w-4 h-4 text-stone-400 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
      </button>
      {/* Body */}
      <div className={`overflow-hidden transition-[max-height] duration-300 ease-out sm:overflow-visible sm:max-h-none ${open ? "max-h-[600px]" : "max-h-0 sm:max-h-none"}`}>
        <div className="pb-2 sm:pb-0">
          {children}
        </div>
      </div>
    </div>
  );
}

/* ── Platform Index Overlay ──────────────────────────────── */
function PlatformIndex({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useLocale();

  // Prevent body scroll when open
  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => { document.body.style.overflow = ""; };
  }, [open]);

  // ESC key
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, [open, onClose]);

  if (!open) return null;

  const cards = [
    { id: "discover", num: "01", emoji: "🔍", label: t("nav.discover"), gc: "#7a6040",
      links: [
        { href: "/search", label: t("nav.search") },
        { href: "/groups", label: t("nav.groups") },
        { href: "/events", label: t("nav.events") },
        { href: "/network", label: t("nav.network") },
        { href: "/entities", label: t("nav.entities") },
        { href: "/feed", label: t("nav.feed") },
      ]},
    { id: "grow", num: "02", emoji: "🌿", label: t("nav.grow"), gc: "#22c55e",
      links: [
        { href: "/plants", label: t("nav.plants") },
        { href: "/learning", label: t("nav.learning") },
        { href: "/tools", label: t("nav.tools") },
      ]},
    { id: "exchange", num: "03", emoji: "♻️", label: t("nav.exchange"), gc: "#a8643d",
      links: [
        { href: "/marketplace", label: t("nav.marketplace") },
        { href: "/composting", label: t("nav.composting") },
        { href: "/upcycling", label: t("nav.upcycling") },
      ]},
    { id: "community", num: "04", emoji: "🤝", label: t("nav.community"), gc: "#634d33",
      links: [
        { href: "/submit", label: t("nav.add_knowledge") },
        { href: "/leaderboard", label: t("nav.leaderboard") },
        { href: "/donate", label: t("nav.support_us") },
      ]},
    { id: "content", num: "05", emoji: "✏️", label: t("nav.articles"), gc: "#917a56",
      links: [
        { href: "/articles", label: t("nav.articles") },
        { href: "/submit", label: t("nav.add_knowledge") },
      ]},
    { id: "account", num: "06", emoji: "👤", label: t("nav.profile"), gc: "#ad9a7a",
      links: [
        { href: "/profile", label: t("nav.my_profile") },
        { href: "/settings", label: t("nav.settings") },
        { href: "/messages", label: t("nav.messages") },
        { href: "/notifications", label: t("nav.notifications") },
      ]},
  ];

  const infoLinks = [
    { href: "/leaderboard", label: t("nav.leaderboard") },
    { href: "/tools", label: t("nav.tools") },
    { href: "/learning", label: t("nav.learning") },
    { href: "/submit", label: t("nav.add_knowledge") },
    { href: "/donate", label: t("nav.support_us") },
    { href: "https://github.com/RuiSilvaStudio/RootLink", label: "GitHub ↗", external: true },
  ];

  return (
    <div
      className="fixed inset-0 z-[100] bg-cream dark:bg-stone-950 flex flex-col overflow-hidden"
      role="dialog"
      aria-modal="true"
      aria-label={t("nav.platform_index")}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 border-b border-stone-200 dark:border-stone-800 flex-shrink-0">
        <div className="flex items-center gap-3">
          <span className="font-display text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-primary-500">RootLink</span>
          <span className="font-display text-base font-semibold text-stone-800 dark:text-stone-100">{t("nav.platform_index")}</span>
        </div>
        <button onClick={onClose} className="flex items-center gap-2 px-3 py-1.5 rounded-lg text-xs font-display font-semibold text-stone-400 dark:text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 hover:text-stone-700 dark:hover:text-stone-200 transition-colors" aria-label="Fechar">
          <X className="w-4 h-4" /> ESC
        </button>
      </div>

      {/* Scrollable card grid */}
      <div className="flex-1 overflow-y-auto p-6 scrollbar-none">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
          {cards.map((card) => (
            <article key={card.id} className="relative bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-6 transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg dark:hover:shadow-black/30 group">
              <span className="absolute top-4 right-4 font-display text-[2.25rem] font-light leading-none text-stone-900/[0.04] dark:text-white/[0.04]">{card.num}</span>
              <div className="flex items-center gap-2 mb-3">
                <span className="text-xl">{card.emoji}</span>
                <h3 className="font-display text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-stone-600 dark:text-stone-200">{card.label}</h3>
              </div>
              <div className="w-7 h-[1.5px] mb-4" style={{ background: card.gc }} />
              <ul className="space-y-1">
                {card.links.map((link) => (
                  <li key={link.href}>
                    <Link href={link.href} onClick={onClose}
                      className="flex items-center gap-2 text-[0.875rem] text-stone-500 dark:text-stone-400 hover:text-stone-900 dark:hover:text-stone-100 transition-colors">
                      <span className="w-1.5 h-1.5 rounded-full flex-shrink-0" style={{ background: card.gc }} />
                      {link.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </article>
          ))}

          {/* Info & Legal — full width */}
          <article className="relative bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-800 rounded-2xl p-6 col-span-full transition-all duration-150 hover:-translate-y-0.5 hover:shadow-lg dark:hover:shadow-black/30">
            <span className="absolute top-4 right-4 font-display text-[2.25rem] font-light leading-none text-stone-900/[0.04] dark:text-white/[0.04]">07</span>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-xl">📄</span>
              <h3 className="font-display text-[0.6875rem] font-semibold uppercase tracking-[0.12em] text-stone-600 dark:text-stone-200">Info &amp; Legal</h3>
            </div>
            <div className="w-7 h-[1.5px] bg-stone-400 mb-4" />
            <div className="flex flex-wrap gap-2">
              {infoLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={onClose}
                  {...(link.external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                  className="px-3.5 py-1.5 rounded-full bg-stone-50 dark:bg-stone-800 text-[0.8125rem] text-stone-500 dark:text-stone-400 hover:bg-primary-50 dark:hover:bg-primary-900/20 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
                >
                  {link.label}
                </Link>
              ))}
            </div>
          </article>
        </div>
      </div>
    </div>
  );
}

/* ══════════════════════════════════════════════════════════
   M A I N   F O O T E R
══════════════════════════════════════════════════════════ */
export function Footer() {
  const { t } = useLocale();
  const [indexOpen, setIndexOpen] = useState(false);

  return (
    <>
      <footer role="contentinfo" className="border-t border-primary-200/20 dark:border-primary-800/20 bg-cream dark:bg-stone-950 noise-bg">
        <div className="max-w-7xl mx-auto px-4 sm:px-8 py-14 sm:py-20">
          <div className="grid sm:grid-cols-3 gap-6 sm:gap-12">

            {/* ── Column 1: Brand ─────────────────────────── */}
            <div>
              <Link href="/" className="inline-flex items-center gap-2.5 mb-4 group" aria-label="RootLink — início">
                <div className="w-7 h-7 rounded-lg bg-primary-600 flex items-center justify-center group-hover:scale-105 transition-transform flex-shrink-0">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#f8f6f2" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"/>
                  </svg>
                </div>
                <span className="font-display text-lg font-semibold text-primary-700 dark:text-primary-300">RootLink</span>
              </Link>

              <EditableText
                k="nav.footer_description"
                as="p"
                className="text-sm text-stone-500 dark:text-stone-400 leading-relaxed max-w-xs"
              />

              {/* OSS badge */}
              <div className="inline-flex items-center gap-1.5 mt-4 mb-4 px-3 py-1.5 rounded-full bg-primary-50 dark:bg-primary-900/20 border border-primary-200/40 dark:border-primary-800/30" aria-label={t("nav.open_source_community")}>
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" className="text-primary-600 dark:text-primary-400" aria-hidden="true">
                  <polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/>
                </svg>
                <EditableText
                  k="nav.open_source_community"
                  as="span"
                  className="font-display text-[0.625rem] font-semibold uppercase tracking-[0.12em] text-primary-600 dark:text-primary-400"
                />
              </div>

              {/* Social links */}
              <nav className="flex items-center gap-2" aria-label="Redes sociais">
                <a href="https://github.com/RuiSilvaStudio/RootLink" target="_blank" rel="noopener noreferrer"
                  className="w-9 h-9 rounded-lg flex items-center justify-center bg-primary-50 dark:bg-primary-900/20 border border-primary-200/30 dark:border-primary-800/20 text-primary-600 dark:text-primary-400 hover:bg-primary-100 dark:hover:bg-primary-900/40 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
                  aria-label="RootLink no GitHub">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                    <path d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z"/>
                  </svg>
                </a>
                {/* Mastodon placeholder */}
                <div className="relative group/tip">
                  <button
                    className="w-9 h-9 rounded-lg flex items-center justify-center bg-primary-50 dark:bg-primary-900/20 border border-primary-200/30 dark:border-primary-800/20 text-primary-400 dark:text-primary-600 cursor-not-allowed opacity-60"
                    aria-label="Mastodon (brevemente)" onClick={(e) => e.preventDefault()}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M21.327 8.566c0-4.339-2.843-5.61-2.843-5.61-1.433-.658-3.894-.935-6.451-.956h-.063c-2.557.021-5.016.298-6.45.956 0 0-2.843 1.272-2.843 5.61 0 .993-.019 2.181.012 3.441.103 4.243.778 8.425 4.701 9.463 1.809.479 3.362.579 4.612.51 2.268-.126 3.541-.809 3.541-.809l-.075-1.646s-1.621.511-3.441.449c-1.804-.062-3.707-.194-3.999-2.409a4.523 4.523 0 01-.04-.621s1.77.433 4.014.536c1.372.063 2.658-.08 3.965-.236 2.506-.299 4.688-1.843 4.962-3.254.434-2.223.398-5.424.398-5.424z"/>
                    </svg>
                  </button>
                  <span className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-stone-800 text-stone-50 text-[10px] rounded whitespace-nowrap opacity-0 group-hover/tip:opacity-100 pointer-events-none transition-opacity">Brevemente</span>
                </div>
              </nav>
            </div>

            {/* ── Column 2: Resources ──────────────────────── */}
            <FooterCol heading={t("nav.resources")}>
              {[
                { href: "/submit",   key: "nav.add_knowledge" },
                { href: "/articles", key: "nav.articles" },
                { href: "/learning", key: "nav.learning" },
                { href: "/tools",    key: "nav.tools" },
              ].map(({ href, key }) => (
                <Link key={href} href={href}
                  className="block text-[0.9375rem] text-stone-600 dark:text-stone-400 py-[0.4375rem] leading-snug hover:text-primary-700 dark:hover:text-primary-300 transition-colors font-serif">
                  <EditableText k={key} as="span" />
                </Link>
              ))}
              <a href="https://github.com/RuiSilvaStudio/RootLink" target="_blank" rel="noopener noreferrer"
                className="inline-flex items-center gap-1.5 text-[0.9375rem] text-stone-600 dark:text-stone-400 py-[0.4375rem] hover:text-primary-700 dark:hover:text-primary-300 transition-colors font-serif">
                <EditableText k="nav.source_code" as="span" />
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/>
                </svg>
              </a>
            </FooterCol>

            {/* ── Column 3: Community ──────────────────────── */}
            <FooterCol heading={t("nav.community")}>
              {[
                { href: "/leaderboard", key: "nav.leaderboard" },
                { href: "/donate",      key: "nav.support_us" },
                { href: "/groups",      key: "nav.groups" },
                { href: "/network",     key: "nav.network" },
              ].map(({ href, key }) => (
                <Link key={href} href={href}
                  className="block text-[0.9375rem] text-stone-600 dark:text-stone-400 py-[0.4375rem] leading-snug hover:text-primary-700 dark:hover:text-primary-300 transition-colors font-serif">
                  <EditableText k={key} as="span" />
                </Link>
              ))}
            </FooterCol>

          </div>

          <BotanicalSvg />
        </div>

        {/* ── Bottom bar ──────────────────────────────────── */}
        <div className="border-t border-primary-200/15 dark:border-primary-800/15" style={{ background: "rgba(0,0,0,0.025)" }}>
          <div className="max-w-7xl mx-auto px-4 sm:px-8 py-6 sm:py-6 pb-[calc(1.5rem+var(--mobile-bar-h,64px))] sm:pb-6 flex flex-col sm:flex-row justify-between items-center gap-3">
            <p className="text-xs text-stone-400 dark:text-stone-500 font-serif">
              &copy; {new Date().getFullYear()} RootLink. <EditableText k="nav.all_rights_reserved" as="span" />
            </p>
            <nav className="flex items-center gap-1.5 text-xs text-stone-400 dark:text-stone-500 font-serif" aria-label="Legal">
              <Link href="/policies" className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors">Privacy</Link>
              <span className="text-stone-300 dark:text-stone-700">·</span>
              <Link href="/policies" className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors">Terms</Link>
              <span className="text-stone-300 dark:text-stone-700">·</span>
              <Link href="/policies" className="hover:text-primary-600 dark:hover:text-primary-400 transition-colors">Legal</Link>
            </nav>
            <button
              onClick={() => setIndexOpen(true)}
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full font-display text-xs font-semibold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/20 border border-primary-200/40 dark:border-primary-800/30 hover:bg-primary-100 dark:hover:bg-primary-900/40 hover:text-primary-700 dark:hover:text-primary-300 transition-colors"
              aria-haspopup="dialog"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/>
                <path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
              </svg>
              {t("nav.platform_map")}
            </button>
          </div>
        </div>
      </footer>

      <PlatformIndex open={indexOpen} onClose={() => setIndexOpen(false)} />
    </>
  );
}
