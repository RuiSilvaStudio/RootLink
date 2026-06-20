"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Bell, Rss, Menu, X, Search, Leaf, Users, BookOpen, ExternalLink, Moon, Sun, Building, RefreshCw, Sprout } from "lucide-react";
import { api } from "@/lib/api";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { LocaleProvider, useLocale } from "@/lib/locale-context";
import { ToastProvider } from "@/lib/toast-context";
import { Collapsible } from "@/components/Collapsible";
import { CommandPalette } from "@/components/CommandPalette";
import "./globals.css";

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
      className="text-[11px] font-display font-medium uppercase tracking-[0.15em] text-stone-400 hover:text-primary-600 transition"
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
      className="p-1.5 text-stone-400 hover:text-primary-600 transition"
      aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
      title={isDark ? "Light mode" : "Dark mode"}
    >
      {isDark ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
    </button>
  );
}

function NavBar() {
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
        es = new EventSource("/api/notifications/stream");
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
  }, [user?.locale]);

  useEffect(() => {
    if (user && user.locale !== locale) {
      api.auth.update({ locale }).catch(() => {});
    }
  }, [locale]);

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

  const navLinks = [
    { href: "/search", label: t("nav.search"), icon: Search },
    { href: "/groups", label: t("nav.groups"), icon: Users },
    { href: "/events", label: t("nav.events") },
    { href: "/marketplace", label: t("nav.marketplace"), icon: RefreshCw },
    { href: "/composting", label: t("nav.composting"), icon: Sprout },
    { href: "/upcycling", label: t("nav.upcycling"), icon: RefreshCw },
    { href: "/tools", label: t("nav.tools") },
    { href: "/learning", label: t("nav.learning"), icon: BookOpen },
    { href: "/entities", label: t("nav.entities"), icon: Building },
    { href: "/network", label: t("nav.network") },
  ];

  return (
    <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
      scrolled ? "nav-glass" : "bg-cream/60"
    }`}>
      <div className="max-w-6xl mx-auto px-4 sm:px-8 h-16 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 group">
          <div className="w-8 h-8 rounded-lg bg-primary-600 flex items-center justify-center group-hover:scale-105 transition-transform">
            <Leaf className="w-4 h-4 text-cream" strokeWidth={2} />
          </div>
          <span className="text-base font-display font-semibold text-primary-700 tracking-tight">{t("nav.rootlink")}</span>
        </Link>

        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="px-3 py-1.5 text-sm text-stone-500 hover:text-primary-700 font-serif transition-colors"
            >
              {link.label}
            </Link>
          ))}
          <div className="w-px h-4 bg-primary-200/40 mx-3" />
          <ThemeToggle />
          <LanguageSwitcher />
          {moon && (
            <div className="relative" data-moon-dropdown>
              <button
                onClick={() => setShowMoon(!showMoon)}
                className="p-1.5 text-stone-400 hover:text-primary-600 transition"
                title={`${moon.phase} — ${moon.illumination}%`}
              >
                <span className="text-base leading-none">{moon.icon}</span>
              </button>
              {showMoon && (
                <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl shadow-lg border border-primary-200/40 z-50 p-4">
                  <div className="flex items-center gap-3 mb-2">
                    <span className="text-2xl">{moon.icon}</span>
                    <div>
                      <p className="text-sm font-display font-semibold text-stone-700">{moon.phase}</p>
                      <p className="text-[10px] text-stone-400">{moon.illumination}% illuminated</p>
                    </div>
                  </div>
                  <p className="text-xs text-stone-500 leading-relaxed font-serif">{moon.agricultural_en}</p>
                </div>
              )}
            </div>
          )}
          {token && (
            <>
              <Link href="/feed" className="p-1.5 text-stone-400 hover:text-primary-600 transition" aria-label={t("nav.feed")}>
                <Rss className="w-3.5 h-3.5" />
              </Link>
              <Link href="/messages" className="p-1.5 text-stone-400 hover:text-primary-600 transition" aria-label={t("nav.messages")}>
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </Link>
              <div className="relative">
                <button onClick={openNotifs} className="p-1.5 text-stone-400 hover:text-primary-600 transition relative" aria-label={t("nav.notifications")}>
                  <Bell className="w-3.5 h-3.5" />
                  {unread > 0 && (
                    <span className="absolute -top-0.5 -right-0.5 bg-rust-500 text-white text-[9px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </button>
                {showNotifs && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl2 shadow-lg border border-primary-200/40 z-50 overflow-hidden">
                    <div className="p-4 border-b border-primary-100/40 flex justify-between items-center">
                      <span className="text-sm font-display font-medium text-stone-700">{t("nav.notifications")}</span>
                      {unread > 0 && (
                        <button onClick={markAllRead} className="text-xs text-primary-600 hover:underline font-serif">{t("nav.mark_all_read")}</button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifs.length === 0 ? (
                        <p className="p-4 text-sm text-stone-400 text-center font-serif">{t("nav.no_notifications")}</p>
                      ) : (
                        notifs.map((n) => {
                          const href = n.link || "#";
                          const isInternal = href.startsWith("/");
                          const Tag = isInternal ? Link : "a";
                          const extraProps = isInternal ? {} : { target: "_blank", rel: "noopener noreferrer" };
                          return (
                          <Tag key={n.id} href={href} {...extraProps}
                            className={`block p-4 border-b border-primary-50 hover:bg-primary-50/30 transition ${n.read ? "" : "bg-primary-50/30"}`}>
                            <p className="text-sm text-stone-700 font-serif">{n.message}</p>
                            <p className="text-xs text-stone-400 mt-1 font-serif">{n.created_at ? new Date(n.created_at).toLocaleDateString() : ""}</p>
                          </Tag>
                          );
                        })
                      )}
                    </div>
                    {notifs.length > 0 && (
                      <Link href="/notifications" className="block p-3 text-center text-xs text-primary-600 hover:bg-primary-50/30 border-t border-primary-100/40 font-serif">
                        {t("nav.view_all")}
                      </Link>
                    )}
                  </div>
                )}
              </div>
              {isStaff && (
                <Link href="/admin" className="px-3 py-1.5 text-sm text-stone-500 hover:text-primary-700 font-serif transition-colors">
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

        <div className="flex md:hidden items-center gap-2">
          <ThemeToggle />
          <LanguageSwitcher />
          {moon && (
            <button
              onClick={() => setShowMoon(!showMoon)}
              className="p-1.5 text-stone-400 relative"
              title={`${moon.phase} — ${moon.illumination}%`}
            >
              <span className="text-base leading-none">{moon.icon}</span>
            </button>
          )}
          {token && (
            <button onClick={openNotifs} className="p-1.5 text-stone-400 relative" aria-label={t("nav.notifications")}>
              <Bell className="w-4 h-4" />
              {unread > 0 && (
                <span className="absolute -top-0.5 -right-0.5 bg-rust-500 text-white text-[9px] font-bold rounded-full w-3.5 h-3.5 flex items-center justify-center">
                  {unread > 9 ? "9+" : unread}
                </span>
              )}
            </button>
          )}
          <button onClick={() => setMobileOpen(!mobileOpen)} className="p-1.5 text-stone-400 hover:text-primary-600 transition" aria-label={mobileOpen ? "Close menu" : "Open menu"}>
            {mobileOpen ? <X className="w-4 h-4" /> : <Menu className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <Collapsible open={mobileOpen}>
        <div className="md:hidden border-t border-primary-200/30 bg-cream/95 backdrop-blur-md px-4 py-4 space-y-1">
          {navLinks.map((link) => (
            <Link key={link.href} href={link.href} onClick={closeMobile}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-stone-600 hover:bg-primary-50/40 transition font-serif">
              {link.icon && <link.icon className="w-4 h-4 text-stone-400" />}
              {link.label}
            </Link>
          ))}
          <hr className="border-primary-200/30 my-2" />
          {token ? (
            <>
              <Link href="/feed" onClick={closeMobile} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-stone-600 hover:bg-primary-50/40 transition font-serif">
                <Rss className="w-4 h-4 text-stone-400" />{t("nav.feed")}
              </Link>
              <Link href="/messages" onClick={closeMobile} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-stone-600 hover:bg-primary-50/40 transition font-serif">
                <svg className="w-4 h-4 text-stone-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
                {t("nav.messages")}
              </Link>
              {isStaff && (
                <Link href="/admin" onClick={closeMobile} className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-stone-600 hover:bg-primary-50/40 transition font-serif">
                  <ExternalLink className="w-4 h-4 text-stone-400" />{t("nav.admin")}
                </Link>
              )}
              <Link href="/profile" onClick={closeMobile}
                className="block mt-2 px-4 py-2.5 rounded-xl2 text-sm bg-primary-600 text-cream text-center font-display font-medium hover:bg-primary-700 transition shadow-sm">
                {t("nav.profile")}
              </Link>
            </>
          ) : (
            <Link href="/auth/login" onClick={closeMobile}
              className="block mt-2 px-4 py-2.5 rounded-xl2 text-sm bg-primary-600 text-cream text-center font-display font-medium hover:bg-primary-700 transition shadow-sm">
              {t("nav.sign_in")}
            </Link>
          )}
        </div>
      </Collapsible>
    </nav>
  );
}

function LangUpdater() {
  const { locale } = useLocale();
  useEffect(() => {
    document.documentElement.lang = locale;
  }, [locale]);
  return null;
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAdmin = pathname.startsWith("/admin");
  const isAuth = pathname.startsWith("/auth");
  return (
    <html lang="pt" className="noise-bg" suppressHydrationWarning>
      <head>
        <link rel="manifest" href="/manifest.json" />
        <meta name="theme-color" content="#7a6040" />
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            try {
              var stored = localStorage.getItem('theme');
              var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
              if (stored === 'dark' || (!stored && prefersDark)) {
                document.documentElement.classList.add('dark');
              }
            } catch(e) {}
          })();
        `}} />
      </head>
      <body className="min-h-screen flex flex-col">
        <LocaleProvider>
          <LangUpdater />
          <AuthProvider>
            <ToastProvider>
              <CommandPalette />
              <NavBar />
              {isAdmin ? (
                <main className="flex-1">{children}</main>
              ) : (
                <AnimatePresence mode="wait">
                  <motion.main
                    key={pathname}
                    initial={{ opacity: 0, y: 8 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -8 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className={`flex-1 ${isAuth ? "" : "pt-16"}`}
                  >
                    {children}
                  </motion.main>
                </AnimatePresence>
              )}
            </ToastProvider>
          </AuthProvider>
          {!isAdmin && !isAuth && <Footer />}
        </LocaleProvider>
      </body>
    </html>
  );
}

function Footer() {
  const { t } = useLocale();
  return (
    <footer className="border-t border-primary-200/30 bg-cream noise-bg dark:bg-stone-950 dark:border-primary-800/30">
      <div className="max-w-6xl mx-auto px-4 sm:px-8 py-14 sm:py-20">
        <div className="grid sm:grid-cols-3 gap-12">
          <div>
            <div className="flex items-center gap-2.5 mb-4">
              <div className="w-7 h-7 rounded-lg bg-primary-600 flex items-center justify-center">
                <Leaf className="w-4 h-4 text-cream" strokeWidth={2} />
              </div>
              <span className="font-display text-base font-semibold text-primary-700 dark:text-primary-300">RootLink</span>
            </div>
            <p className="text-sm text-stone-500 dark:text-stone-400 font-serif leading-relaxed max-w-xs">
              {t("nav.footer_description")}
            </p>
          </div>
          <div>
            <h4 className="text-xs font-display font-semibold text-stone-600 dark:text-stone-400 uppercase tracking-[0.12em] mb-5">{t("nav.explore")}</h4>
            <div className="space-y-3">
              <Link href="/search" className="block text-sm text-stone-500 dark:text-stone-400 hover:text-primary-700 dark:hover:text-primary-400 transition font-serif">{t("nav.search")}</Link>
              <Link href="/groups" className="block text-sm text-stone-500 dark:text-stone-400 hover:text-primary-700 dark:hover:text-primary-400 transition font-serif">{t("nav.groups")}</Link>
              <Link href="/events" className="block text-sm text-stone-500 dark:text-stone-400 hover:text-primary-700 dark:hover:text-primary-400 transition font-serif">{t("nav.events")}</Link>
              <Link href="/tools" className="block text-sm text-stone-500 dark:text-stone-400 hover:text-primary-700 dark:hover:text-primary-400 transition font-serif">{t("nav.tools")}</Link>
              <Link href="/learning" className="block text-sm text-stone-500 dark:text-stone-400 hover:text-primary-700 dark:hover:text-primary-400 transition font-serif">{t("nav.learning")}</Link>
              <Link href="/entities" className="block text-sm text-stone-500 dark:text-stone-400 hover:text-primary-700 dark:hover:text-primary-400 transition font-serif">{t("nav.entities")}</Link>
            </div>
          </div>
          <div>
            <h4 className="text-xs font-display font-semibold text-stone-600 dark:text-stone-400 uppercase tracking-[0.12em] mb-5">{t("nav.connect")}</h4>
            <div className="space-y-3">
              <a href="https://github.com/RuiSilvaStudio/RootLink" target="_blank" rel="noopener noreferrer" className="block text-sm text-stone-500 dark:text-stone-400 hover:text-primary-700 dark:hover:text-primary-400 transition font-serif">GitHub</a>
              <Link href="/network" className="block text-sm text-stone-500 dark:text-stone-400 hover:text-primary-700 dark:hover:text-primary-400 transition font-serif">{t("nav.network")}</Link>
              <Link href="/submit" className="block text-sm text-stone-500 dark:text-stone-400 hover:text-primary-700 dark:hover:text-primary-400 transition font-serif">{t("nav.submit")}</Link>
            </div>
          </div>
        </div>
      </div>
      <div className="border-t border-primary-200/20 dark:border-primary-800/20 py-6">
        <div className="max-w-6xl mx-auto px-4 sm:px-8 flex flex-col sm:flex-row justify-between items-center gap-2">
          <p className="text-xs text-stone-400 dark:text-stone-500 font-serif">&copy; 2026 RootLink. {t("nav.footer")}</p>
          <div className="w-8 h-px bg-primary-300/30 sm:hidden" />
          <p className="text-xs text-stone-400 dark:text-stone-500 font-serif">{t("nav.footer_description")}</p>
        </div>
      </div>
    </footer>
  );
}
