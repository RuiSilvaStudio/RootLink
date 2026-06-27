"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Bell, Rss, Search, Leaf, Moon, Sun, Menu, X, FileText, Heart } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/lib/locale-context";
import { Collapsible } from "@/components/Collapsible";
import { DesktopDropdown } from "./DesktopDropdown";
import { desktopDropdowns } from "./NavConfig";

function LanguageSwitcher() {
  const { locale, setLocale } = useLocale();
  const { user } = useAuth();

  const toggle = async () => {
    const next: "pt" | "en" = locale === "pt" ? "en" : "pt";
    setLocale(next);
    if (user) {
      try { await api.auth.update({ locale: next }); } catch {}
    }
  };

  return (
    <button
      onClick={toggle}
      className="text-[11px] font-display font-medium uppercase tracking-[0.15em] text-stone-400 dark:text-stone-300 hover:text-primary-600 dark:hover:text-primary-400 transition"
    >
      {locale === "pt" ? "EN" : "PT"}
    </button>
  );
}

function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    setIsDark(document.documentElement.classList.contains("dark"));
  }, []);

  const toggle = () => {
    const next = !isDark;
    setIsDark(next);
    if (next) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  };

  return (
    <button
      onClick={toggle}
      className="p-1.5 text-stone-400 dark:text-stone-300 hover:text-primary-600 dark:hover:text-primary-400 transition"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
    >
      {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
    </button>
  );
}

export function NavBar() {
  const { t, locale, setLocale } = useLocale();
  const { user, token } = useAuth();
  const [unread, setUnread] = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);
  const [notifs, setNotifs] = useState<any[]>([]);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const [moon, setMoon] = useState<any>(null);
  const [showMoon, setShowMoon] = useState(false);

  useEffect(() => {
    api.external.moon().then(setMoon).catch(() => {});
  }, []);

  useEffect(() => {
    if (!showMoon) return;
    const handler = (e: MouseEvent) => {
      if (!(e.target as HTMLElement).closest("[data-moon-dropdown]")) {
        setShowMoon(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showMoon]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (!token) { setUnread(0); return; }
    let es: EventSource | null = null;
    let interval: ReturnType<typeof setInterval> | null = null;

    const connectSSE = () => {
      try {
        const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";
        es = new EventSource(`${API_URL}/api/notifications/stream?token=${token}`);
        es.onmessage = (e) => {
          try {
            const { count } = JSON.parse(e.data);
            setUnread(count);
          } catch {}
        };
        es.onerror = () => {
          es?.close();
          es = null;
          if (!interval) {
            interval = setInterval(async () => {
              try {
                const { count } = await api.notifications.unreadCount();
                setUnread(count);
              } catch {}
            }, 30000);
          }
        };
      } catch {
        if (!interval) {
          interval = setInterval(async () => {
            try {
              const { count } = await api.notifications.unreadCount();
              setUnread(count);
            } catch {}
          }, 30000);
        }
      }
    };

    connectSSE();

    return () => {
      es?.close();
      if (interval) clearInterval(interval);
    };
  }, [token]);

  useEffect(() => {
    if (user?.locale && user.locale !== locale) {
      setLocale(user.locale as "pt" | "en");
    }
  }, [user?.locale]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (user && user.locale !== locale) {
      api.auth.update({ locale }).catch(() => {});
    }
  }, [locale]); // eslint-disable-line react-hooks/exhaustive-deps

  const isStaff = user && (user.role === "admin" || user.role === "moderator" || user.role === "contributor");

  const openNotifs = async () => {
    setShowNotifs(!showNotifs);
    if (!showNotifs && token) {
      const n = await api.notifications.list();
      setNotifs(n);
    }
  };

  const markAllRead = async () => {
    await api.notifications.markAllRead();
    setUnread(0);
    setNotifs(notifs.map((n) => ({ ...n, read: true })));
  };

  const closeMobile = () => setMobileOpen(false);

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled ? "nav-glass" : "bg-cream/60 dark:bg-stone-950/60"
    }`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center group-hover:scale-105 transition-transform">
            <Leaf className="w-4 h-4 text-cream" strokeWidth={2} />
          </div>
          <span className="text-base font-display font-semibold text-primary-700 dark:text-primary-200 tracking-tight">{t("nav.rootlink")}</span>
        </Link>

        {/* Desktop: Grouped dropdowns */}
        <div className="hidden md:flex items-center gap-1">
          {desktopDropdowns.map((group) => (
            <DesktopDropdown key={group.labelKey} group={group} />
          ))}
        </div>

        {/* Desktop: Right side icons */}
        <div className="hidden md:flex items-center gap-1">
          <Link href="/search" className="p-1.5 text-stone-400 dark:text-stone-300 hover:text-primary-600 dark:hover:text-primary-400 transition" aria-label={t("nav.search")}>
            <Search className="w-3.5 h-3.5" />
          </Link>
          <ThemeToggle />
          <LanguageSwitcher />
          {moon && (
            <div className="relative" data-moon-dropdown>
              <button
                onClick={() => setShowMoon(!showMoon)}
                className="p-1.5 text-stone-400 dark:text-stone-300 hover:text-primary-600 dark:hover:text-primary-400 transition"
                title={`${moon.phase} — ${moon.illumination}%`}
              >
                <span className="text-base leading-none">{moon.icon}</span>
              </button>
              {showMoon && (
                <div className="absolute right-0 mt-2 w-64 bg-white dark:bg-stone-900 rounded-2xl shadow-lg border border-primary-200/40 dark:border-primary-800/40 z-50 p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{moon.icon}</span>
                    <div>
                      <p className="text-sm font-display font-semibold text-stone-700 dark:text-stone-100">{moon.phase}</p>
                      <p className="text-[10px] text-stone-400 dark:text-stone-500">{moon.illumination}% illuminated</p>
                    </div>
                  </div>
                  <p className="text-xs text-stone-500 dark:text-stone-400 leading-relaxed font-serif">{moon.agricultural_en}</p>
                </div>
              )}
            </div>
          )}
          {token && (
            <>
              <Link href="/articles/my" className="p-1.5 text-stone-400 dark:text-stone-300 hover:text-primary-600 dark:hover:text-primary-400 transition" aria-label={t("nav.my_articles")}>
                <FileText className="w-3.5 h-3.5" />
              </Link>
              <Link href="/donate" className="p-1.5 text-stone-400 dark:text-stone-300 hover:text-primary-600 dark:hover:text-primary-400 transition" aria-label={t("nav.donate")}>
                <Heart className="w-3.5 h-3.5" />
              </Link>
              <Link href="/feed" className="p-1.5 text-stone-400 dark:text-stone-300 hover:text-primary-600 dark:hover:text-primary-400 transition" aria-label={t("nav.feed")}>
                <Rss className="w-3.5 h-3.5" />
              </Link>
              <Link href="/messages" className="p-1.5 text-stone-400 dark:text-stone-300 hover:text-primary-600 dark:hover:text-primary-400 transition" aria-label={t("nav.messages")}>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </Link>
              <div className="relative">
                <button onClick={openNotifs} className="p-1.5 text-stone-400 dark:text-stone-300 hover:text-primary-600 dark:hover:text-primary-400 transition relative" aria-label={t("nav.notifications")}>
                  <Bell className="w-3.5 h-3.5" />
                  {unread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-rust-500 text-white text-[9px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </button>
                {showNotifs && (
                  <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-stone-900 rounded-xl2 shadow-lg border border-primary-200/40 dark:border-primary-800/40 z-50 overflow-hidden">
                    <div className="p-4 border-b border-primary-100/40 dark:border-primary-800/30 flex justify-between items-center">
                      <span className="text-sm font-display font-medium text-stone-700 dark:text-stone-100">{t("nav.notifications")}</span>
                      {unread > 0 && (
                        <button onClick={markAllRead} className="text-xs text-primary-600 hover:underline font-serif">{t("nav.mark_all_read")}</button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifs.length === 0 ? (
                        <p className="p-4 text-sm text-stone-400 dark:text-stone-500 text-center font-serif">{t("nav.no_notifications")}</p>
                      ) : (
                        notifs.map((n) => {
                          const href = n.link || "#";
                          const isInternal = href.startsWith("/");
                          const Tag = isInternal ? Link : "a";
                          const extraProps = isInternal ? {} : { target: "_blank", rel: "noopener noreferrer" };
                          return (
                          <Tag key={n.id} href={href} {...extraProps}
                            className={`block p-4 border-b border-primary-50 dark:border-primary-800/20 hover:bg-primary-50/30 dark:hover:bg-primary-900/20 transition ${n.read ? "" : "bg-primary-50/30 dark:bg-primary-900/20"}`}>
                            <p className="text-sm text-stone-700 dark:text-stone-200 font-serif">{n.message}</p>
                            <p className="text-xs text-stone-400 dark:text-stone-500 mt-1 font-serif">{n.created_at ? new Date(n.created_at).toLocaleDateString() : ""}</p>
                          </Tag>
                          );
                        })
                      )}
                    </div>
                    {notifs.length > 0 && (
                      <Link href="/notifications" className="block p-3 text-center text-xs text-primary-600 dark:text-primary-400 hover:bg-primary-50/30 dark:hover:bg-primary-900/20 border-t border-primary-100/40 dark:border-primary-800/30 font-serif">
                        {t("nav.view_all")}
                      </Link>
                    )}
                  </div>
                )}
              </div>
              {isStaff && (
                <Link href="/admin" className="px-3 py-1.5 text-sm text-stone-500 dark:text-stone-300 hover:text-primary-700 dark:hover:text-primary-400 font-serif transition-colors">
                  {t("nav.admin")}
                </Link>
              )}
              <Link href="/profile"
                className="ml-2 px-4 py-1.5 rounded-xl2 bg-primary-600 text-cream text-sm font-display font-medium hover:bg-primary-700 transition shadow-sm hover:shadow-md">
                {t("nav.profile")}
              </Link>
            </>
          )}
          {!token && (
            <Link href="/auth/login"
              className="ml-2 px-4 py-1.5 rounded-xl2 bg-primary-600 text-cream text-sm font-display font-medium hover:bg-primary-700 transition shadow-sm hover:shadow-md">
              {t("nav.sign_in")}
            </Link>
          )}
        </div>

        {/* Mobile: top bar with hamburger */}
        <div className="flex md:hidden items-center gap-2">
          <button onClick={() => setMobileOpen(!mobileOpen)} className="p-1.5 text-stone-400 dark:text-stone-300 hover:text-primary-600 dark:hover:text-primary-400 transition" aria-label={mobileOpen ? "Close menu" : "Open menu"}>
            {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
          <Link href="/" className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-primary-600 flex items-center justify-center">
              <Leaf className="w-3.5 h-3.5 text-cream" strokeWidth={2} />
            </div>
          </Link>
          <div className="flex-1" />
          <Link href="/search" className="p-1.5 text-stone-400 dark:text-stone-300 hover:text-primary-600 dark:hover:text-primary-400 transition" aria-label={t("nav.search")}>
            <Search className="w-4 h-4" />
          </Link>
          {token && (
            <div className="relative">
              <button onClick={openNotifs} className="p-1.5 text-stone-400 dark:text-stone-300 relative" aria-label={t("nav.notifications")}>
                <Bell className="w-4 h-4" />
                {unread > 0 && (
                  <span className="absolute -top-0.5 -right-0.5 bg-rust-500 text-white text-[9px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">
                    {unread > 9 ? "9+" : unread}
                  </span>
                )}
              </button>
              {showNotifs && (
                <div className="absolute right-0 mt-2 w-80 bg-white dark:bg-stone-900 rounded-xl2 shadow-lg border border-primary-200/40 dark:border-primary-800/40 z-50 overflow-hidden">
                  <div className="p-4 border-b border-primary-100/40 dark:border-primary-800/30 flex justify-between items-center">
                    <span className="text-sm font-display font-medium text-stone-700 dark:text-stone-100">{t("nav.notifications")}</span>
                    {unread > 0 && (
                      <button onClick={markAllRead} className="text-xs text-primary-600 hover:underline font-serif">{t("nav.mark_all_read")}</button>
                    )}
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifs.length === 0 ? (
                      <p className="p-4 text-sm text-stone-400 dark:text-stone-500 text-center font-serif">{t("nav.no_notifications")}</p>
                    ) : (
                      notifs.map((n) => {
                        const href = n.link || "#";
                        const isInternal = href.startsWith("/");
                        const Tag = isInternal ? Link : "a";
                        const extraProps = isInternal ? {} : { target: "_blank", rel: "noopener noreferrer" };
                        return (
                        <Tag key={n.id} href={href} {...extraProps}
                          className={`block p-4 border-b border-primary-50 dark:border-primary-800/20 hover:bg-primary-50/30 dark:hover:bg-primary-900/20 transition ${n.read ? "" : "bg-primary-50/30 dark:bg-primary-900/20"}`}>
                          <p className="text-sm text-stone-700 dark:text-stone-200 font-serif">{n.message}</p>
                          <p className="text-xs text-stone-400 dark:text-stone-500 mt-1 font-serif">{n.created_at ? new Date(n.created_at).toLocaleDateString() : ""}</p>
                        </Tag>
                        );
                      })
                    )}
                  </div>
                  {notifs.length > 0 && (
                    <Link href="/notifications" className="block p-3 text-center text-xs text-primary-600 dark:text-primary-400 hover:bg-primary-50/30 dark:hover:bg-primary-900/20 border-t border-primary-100/40 dark:border-primary-800/30 font-serif">
                      {t("nav.view_all")}
                    </Link>
                  )}
                </div>
              )}
            </div>
          )}
          {token ? (
            <Link href="/profile" className="p-1.5 text-stone-400 dark:text-stone-300 hover:text-primary-600 dark:hover:text-primary-400 transition">
              <div className="w-6 h-6 rounded-full bg-primary-600 flex items-center justify-center">
                <span className="text-[10px] text-cream font-display font-semibold">
                  {user?.name?.[0]?.toUpperCase() || "U"}
                </span>
              </div>
            </Link>
          ) : (
            <Link href="/auth/login" className="text-xs text-primary-600 dark:text-primary-400 font-display font-medium px-2 py-1">
              {t("nav.sign_in")}
            </Link>
          )}
        </div>
      </div>

      {/* Mobile: grouped nav drawer */}
      <Collapsible open={mobileOpen}>
        <div className="md:hidden border-t border-primary-200/30 dark:border-primary-800/30 bg-cream/95 dark:bg-stone-950/95 backdrop-blur-md px-4 py-4 space-y-4 max-h-[70vh] overflow-y-auto">
          {desktopDropdowns.map((group) => (
            <div key={group.labelKey}>
              <p className="px-2 pb-1.5 text-[10px] font-display font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-[0.12em]">
                {t(group.labelKey)}
              </p>
              <div className="space-y-0.5">
                {group.items.map((item) => {
                  const Icon = item.icon;
                  return (
                    <Link key={item.href} href={item.href} onClick={closeMobile}
                      className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-stone-600 dark:text-stone-200 hover:bg-primary-50/40 dark:hover:bg-primary-900/20 transition font-serif">
                      <Icon className="w-4 h-4 text-stone-400 dark:text-stone-400" />
                      {t(item.labelKey)}
                    </Link>
                  );
                })}
              </div>
            </div>
          ))}
          <hr className="border-primary-200/30 dark:border-primary-800/30" />
          {token ? (
            <div className="space-y-0.5">
              <Link href="/articles/my" onClick={closeMobile} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-stone-600 dark:text-stone-200 hover:bg-primary-50/40 dark:hover:bg-primary-900/20 transition font-serif">
                <FileText className="w-4 h-4 text-stone-400 dark:text-stone-400" />{t("nav.my_articles")}
              </Link>
              <Link href="/articles/new" onClick={closeMobile} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-stone-600 dark:text-stone-200 hover:bg-primary-50/40 dark:hover:bg-primary-900/20 transition font-serif">
                <FileText className="w-4 h-4 text-stone-400 dark:text-stone-400" />{t("nav.new_article")}
              </Link>
              <Link href="/settings/feeds" onClick={closeMobile} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-stone-600 dark:text-stone-200 hover:bg-primary-50/40 dark:hover:bg-primary-900/20 transition font-serif">
                <Rss className="w-4 h-4 text-stone-400 dark:text-stone-400" />{t("nav.settings")}
              </Link>
              <Link href="/donate" onClick={closeMobile} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-stone-600 dark:text-stone-200 hover:bg-primary-50/40 dark:hover:bg-primary-900/20 transition font-serif">
                <Heart className="w-4 h-4 text-stone-400 dark:text-stone-400" />{t("nav.donate")}
              </Link>
              <Link href="/feed" onClick={closeMobile} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-stone-600 dark:text-stone-200 hover:bg-primary-50/40 dark:hover:bg-primary-900/20 transition font-serif">
                <Rss className="w-4 h-4 text-stone-400 dark:text-stone-400" />{t("nav.feed")}
              </Link>
              <Link href="/messages" onClick={closeMobile} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-stone-600 dark:text-stone-200 hover:bg-primary-50/40 dark:hover:bg-primary-900/20 transition font-serif">
                <svg className="w-4 h-4 text-stone-400 dark:text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                {t("nav.messages")}
              </Link>
              {isStaff && (
                <Link href="/admin" onClick={closeMobile} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-stone-600 dark:text-stone-200 hover:bg-primary-50/40 dark:hover:bg-primary-900/20 transition font-serif">
                  <svg className="w-4 h-4 text-stone-400 dark:text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                  </svg>
                  {t("nav.admin")}
                </Link>
              )}
              <Link href="/profile" onClick={closeMobile}
                className="block mt-2 px-4 py-2.5 rounded-xl2 text-sm bg-primary-600 text-cream text-center font-display font-medium hover:bg-primary-700 transition shadow-sm">
                {t("nav.profile")}
              </Link>
            </div>
          ) : (
            <Link href="/auth/login" onClick={closeMobile}
              className="block px-4 py-2.5 rounded-xl2 text-sm bg-primary-600 text-cream text-center font-display font-medium hover:bg-primary-700 transition shadow-sm">
              {t("nav.sign_in")}
            </Link>
          )}
        </div>
      </Collapsible>
    </nav>
  );
}
