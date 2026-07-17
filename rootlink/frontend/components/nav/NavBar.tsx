"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  Bell, Sun, Moon, Menu, Heart, Shield, FileText,
  Settings, ShoppingBag, LogOut, ArrowRight,
  CheckCheck, Users, Star, Palette,
} from "lucide-react";
import { useGSAPToggle } from "@/lib/gsap";

import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/lib/locale-context";
import { DesktopDropdown } from "./DesktopDropdown";
import { CreateMenu } from "./CreateMenu";
import { MobileNav } from "./MobileNav";
import { MobileBottomBar } from "./MobileBottomBar";
import { desktopDropdowns } from "./NavConfig";
import { SafeAvatar } from "./UserAvatar";
import { Text } from "@/components/ui/Text";
import { Wordmark } from "@/components/ui/Wordmark";

type NotifTab = "notifications" | "messages" | "activity";
type MobileSheet = "create" | "notifications" | "profile" | null;

function ThemeToggle() {
  const [isDark, setIsDark] = useState(false);
  useEffect(() => { setIsDark(document.documentElement.classList.contains("dark")); }, []);
  const toggle = () => {
    const next = !isDark;
    setIsDark(next);
    document.documentElement.classList.toggle("dark", next);
    localStorage.setItem("theme", next ? "dark" : "light");
  };
  return (
    <button onClick={toggle} className="p-2 rounded-lg text-stone-400 dark:text-stone-300 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50/40 dark:hover:bg-primary-900/20 transition-colors" aria-label={isDark ? "Modo claro" : "Modo escuro"}>
      {isDark ? <Sun className="w-[18px] h-[18px]" /> : <Moon className="w-[18px] h-[18px]" />}
    </button>
  );
}

export function NavBar() {
  const { t, locale, setLocale } = useLocale();
  const { user, token, logout } = useAuth();

  // ── Scroll state ────────────────────────────────────────
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  // ── Notification state (SSE + polling) ─────────────────
  const [unread, setUnread] = useState(0);
  const [notifs, setNotifs] = useState<any[]>([]);
  const [notifsLoaded, setNotifsLoaded] = useState(false);
  useEffect(() => {
    if (!token) { setUnread(0); return; }
    const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";
    let es: EventSource | null = null;
    let interval: ReturnType<typeof setInterval> | null = null;
    const connectSSE = () => {
      try {
        es = new EventSource(`${API_URL}/api/notifications/stream?token=${token}`);
        es.onmessage = (e) => { try { setUnread(JSON.parse(e.data).count); } catch {} };
        es.onerror = () => {
          es?.close(); es = null;
          if (!interval) interval = setInterval(async () => {
            try { setUnread((await api.notifications.unreadCount()).count); } catch {}
          }, 30000);
        };
      } catch {
        if (!interval) interval = setInterval(async () => {
          try { setUnread((await api.notifications.unreadCount()).count); } catch {}
        }, 30000);
      }
    };
    connectSSE();
    return () => { es?.close(); if (interval) clearInterval(interval); };
  }, [token]);

  // ── Moon phase ──────────────────────────────────────────
  const [moon, setMoon] = useState<any>(null);
  useEffect(() => { api.external.moon().then(setMoon).catch(() => {}); }, []);

  // ── Sync user locale ────────────────────────────────────
  useEffect(() => {
    if (user?.locale && user.locale !== locale) setLocale(user.locale as "pt" | "en");
  }, [user?.locale]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (user && user.locale !== locale) api.auth.update({ locale }).catch(() => {});
  }, [locale]); // eslint-disable-line react-hooks/exhaustive-deps

  // ── Desktop dropdown state ──────────────────────────────
  const [openDropdown, setOpenDropdown] = useState<"notifications" | "profile" | null>(null);
  const [notifTab, setNotifTab] = useState<NotifTab>("notifications");
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const notifToggle = useGSAPToggle(openDropdown === "notifications", { duration: 0.15 });
  const profileToggle = useGSAPToggle(openDropdown === "profile", { duration: 0.15 });

  useEffect(() => {
    if (!openDropdown) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as Node;
      if (openDropdown === "notifications" && notifRef.current && !notifRef.current.contains(target)) setOpenDropdown(null);
      if (openDropdown === "profile" && profileRef.current && !profileRef.current.contains(target)) setOpenDropdown(null);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [openDropdown]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") setOpenDropdown(null); };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  // Load notifications on desktop dropdown open
  useEffect(() => {
    if (openDropdown === "notifications" && token && !notifsLoaded) {
      api.notifications.list().then((n) => { setNotifs(n); setNotifsLoaded(true); }).catch(() => {});
    }
  }, [openDropdown, token, notifsLoaded]);

  const markAllRead = async () => {
    await api.notifications.markAllRead();
    setUnread(0);
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  // ── Mobile state ────────────────────────────────────────
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mobileSheet, setMobileSheet] = useState<MobileSheet>(null);

  // Auth & roles
  // TECH_DEBT.md §0 / user-logic-review.md §8-9 (was missing super_admin —
  // the frontend mirror of the backend super_admin-not-superset bug).
  const isStaff = user && (user.role === "admin" || user.role === "moderator" || user.role === "contributor" || user.role === "super_admin");
  const isSuperAdmin = !!user && (user.role === "super_admin" || (user.rank != null && user.rank >= 5));
  const initial = user?.name?.[0]?.toUpperCase() ?? "U";

  return (
    <>
      {/* ══════════════════════════════════════════════════════
          D E S K T O P   N A V
      ══════════════════════════════════════════════════════ */}
      <nav className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled ? "nav-glass" : "bg-cream/60 dark:bg-stone-950/60"
      }`}>
        <div className="max-w-7xl mx-auto px-4 lg:px-6 h-14 lg:h-16 flex items-center justify-between gap-4 lg:gap-6">

          {/* Left: hamburger + wordmark */}
          <div className="flex items-center gap-1.5 flex-shrink-0">
            <button onClick={() => setDrawerOpen(true)}
              className="lg:hidden p-2 -ml-1.5 rounded-lg text-stone-500 dark:text-stone-400 hover:text-stone-800 dark:hover:text-stone-100 hover:bg-primary-50/60 dark:hover:bg-primary-900/20 transition-colors"
              aria-label="Abrir menu">
              <Menu className="w-5 h-5" />
            </button>
            <Link href="/" className="flex items-center leading-none select-none text-brand dark:text-primary-300">
              <Wordmark className="h-6 w-auto" />
            </Link>
          </div>

          {/* Center: desktop dropdown groups */}
          <div className="hidden lg:flex items-center gap-0.5 flex-1 justify-center">
            {desktopDropdowns.map((group) => (
              <DesktopDropdown key={group.labelKey} group={group} />
            ))}
          </div>

          {/* Right: theme → donate → updates → create → profile / sign-in */}
          <div className="flex items-center gap-0.5 flex-shrink-0">

            {/* Theme toggle — always visible */}
            <ThemeToggle />

            {token && (
              <>
                {/* Donate */}
                <Link href="/donate" className="hidden lg:flex p-2 rounded-lg text-stone-400 dark:text-stone-300 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50/40 dark:hover:bg-primary-900/20 transition-colors" aria-label={t("nav.support_us")} title={t("nav.support_us")}>
                  <Heart className="w-[18px] h-[18px]" />
                </Link>

                {/* Notifications dropdown */}
                <div ref={notifRef} className="relative hidden lg:block">
                  <button
                    onClick={() => setOpenDropdown(openDropdown === "notifications" ? null : "notifications")}
                    className="relative p-2 rounded-lg text-stone-400 dark:text-stone-300 hover:text-primary-600 dark:hover:text-primary-400 hover:bg-primary-50/40 dark:hover:bg-primary-900/20 transition-colors"
                    aria-label={t("nav.notifications")}
                  >
                    <Bell className="w-[18px] h-[18px]" />
                    {unread > 0 && (
                      <span className="absolute top-0.5 right-0.5 w-[18px] h-[18px] bg-rust-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none animate-pulse-soft">
                        {unread > 9 ? "9+" : unread}
                      </span>
                    )}
                  </button>

                  {notifToggle.shouldRender && (
                    <div
                      ref={notifToggle.ref as any}
                      className="absolute right-0 mt-2 w-[380px] bg-white dark:bg-stone-900 rounded-xl2 shadow-xl border border-primary-200/40 dark:border-primary-800/40 z-50 overflow-hidden"
                    >
                        {/* Tabs */}
                        <div className="flex border-b border-stone-200 dark:border-stone-800 px-4 pt-3 gap-0.5">
                          {(["notifications", "messages", "activity"] as NotifTab[]).map((tab) => (
                            <button key={tab} onClick={() => setNotifTab(tab)}
                              className={`text-sm font-medium pb-2.5 px-2 -mb-px transition-colors whitespace-nowrap border-b-2 ${
                                notifTab === tab
                                  ? "text-stone-900 dark:text-stone-50 border-primary-500"
                                  : "text-stone-500 dark:text-stone-400 border-transparent hover:text-stone-700 dark:hover:text-stone-200"
                              }`}>
                              {tab === "notifications" ? t("nav.notifications") : tab === "messages" ? t("nav.messages") : t("nav.activity")}
                              {tab === "notifications" && unread > 0 && (
                                <span className="ml-1.5 inline-flex items-center justify-center w-4 h-4 text-[9px] font-bold bg-primary-100 dark:bg-primary-900/40 text-primary-600 dark:text-primary-400 rounded-full">
                                  {unread > 9 ? "9+" : unread}
                                </span>
                              )}
                            </button>
                          ))}
                        </div>

                        {/* Notifications pane */}
                        {notifTab === "notifications" && (
                          <div className="p-3">
                            {unread > 0 && (
                              <div className="flex justify-end mb-1">
                                <button onClick={markAllRead} className="flex items-center gap-1.5 text-xs text-primary-600 dark:text-primary-400 hover:underline font-serif">
                                  <CheckCheck className="w-3.5 h-3.5" />{t("nav.mark_all_read")}
                                </button>
                              </div>
                            )}
                            {notifs.length === 0 ? (
                              <p className="py-6 text-center text-sm text-stone-400 font-serif">{t("nav.no_notifications")}</p>
                            ) : (
                              notifs.slice(0, 5).map((n) => {
                                const href = n.link || "#";
                                const isInternal = href.startsWith("/");
                                const Tag = isInternal ? Link : "a";
                                return (
                                  <Tag key={n.id} href={href} {...(!isInternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                                    onClick={() => setOpenDropdown(null)}
                                    className={`flex items-start gap-3 p-3 rounded-xl hover:bg-primary-50/40 dark:hover:bg-primary-900/20 transition-colors ${n.read ? "" : "bg-primary-50/30 dark:bg-primary-900/10"}`}>
                                    <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-primary-600 dark:text-primary-400 flex-shrink-0">
                                      <Bell className="w-4 h-4" />
                                    </div>
                                    <div className="flex-1 min-w-0">
                                      <p className="text-sm text-stone-700 dark:text-stone-200 font-serif leading-snug">{n.message}</p>
                                      <p className="text-xs text-stone-400 mt-0.5 font-serif">{n.created_at ? new Date(n.created_at).toLocaleDateString() : ""}</p>
                                    </div>
                                    {!n.read && <div className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0 mt-2" />}
                                  </Tag>
                                );
                              })
                            )}
                            <Link href="/notifications" onClick={() => setOpenDropdown(null)}
                              className="flex items-center justify-between px-3 py-2 mt-0.5 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-500 font-medium rounded-lg hover:bg-primary-50/40 dark:hover:bg-primary-900/20 transition-colors">
                              {t("nav.view_all_notifications")} <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                          </div>
                        )}

                        {/* Messages pane */}
                        {notifTab === "messages" && (
                          <div className="p-3">
                            <Link href="/messages" onClick={() => setOpenDropdown(null)}
                              className="flex items-center justify-between px-3 py-2 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-500 font-medium rounded-lg hover:bg-primary-50/40 dark:hover:bg-primary-900/20 transition-colors">
                              {t("nav.open_messages")} <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                          </div>
                        )}

                        {/* Activity pane */}
                        {notifTab === "activity" && (
                          <div className="p-3">
                            <Link href="/feed" onClick={() => setOpenDropdown(null)}
                              className="flex items-center justify-between px-3 py-2 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-500 font-medium rounded-lg hover:bg-primary-50/40 dark:hover:bg-primary-900/20 transition-colors">
                              {t("nav.view_all_activity")} <ArrowRight className="w-3.5 h-3.5" />
                            </Link>
                          </div>
                        )}

                        {/* Moon phase */}
                        {moon && (
                          <div className="mx-3 mb-3 mt-1 p-3 rounded-xl bg-primary-50/60 dark:bg-primary-900/15 border border-primary-200/30 dark:border-primary-800/30 flex items-center gap-3">
                            <span className="text-xl leading-none select-none">{moon.icon}</span>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-display font-semibold text-stone-800 dark:text-stone-100">{moon.phase}</p>
                              <p className="text-[10px] text-stone-400 dark:text-stone-500">{moon.illumination}% iluminado</p>
                            </div>
                          </div>
                        )}
                    </div>
                  )}
                </div>

                {/* Create menu (circle +) */}
                <div className="hidden lg:block">
                  <CreateMenu />
                </div>

                {/* Profile dropdown */}
                <div ref={profileRef} className="relative hidden lg:block ml-0.5">
                  <button
                    onClick={() => setOpenDropdown(openDropdown === "profile" ? null : "profile")}
                    className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 border border-primary-200 dark:border-primary-700/50 text-primary-700 dark:text-primary-300 flex items-center justify-center overflow-hidden hover:ring-2 hover:ring-primary-300 dark:hover:ring-primary-600 hover:ring-offset-2 hover:ring-offset-cream dark:hover:ring-offset-stone-950 transition-all"
                    aria-label={t("nav.profile")}
                  >
                    <SafeAvatar url={user?.avatar_url} iconClassName="w-4 h-4" />
                  </button>

                  {profileToggle.shouldRender && (
                    <div
                      ref={profileToggle.ref as any}
                      className="absolute right-0 mt-2 w-60 bg-white dark:bg-stone-900 rounded-xl2 shadow-xl border border-primary-200/40 dark:border-primary-800/40 z-50 overflow-hidden"
                    >
                        {/* User header */}
                        <div className="p-4 border-b border-stone-200 dark:border-stone-800 flex items-center gap-3">
                          <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/30 border border-primary-200 dark:border-primary-700/50 text-primary-700 dark:text-primary-300 flex items-center justify-center overflow-hidden flex-shrink-0">
                            <SafeAvatar url={user?.avatar_url} iconClassName="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <p className="text-sm font-semibold text-stone-900 dark:text-stone-100 truncate">{user?.name}</p>
                            {user?.handle && <p className="text-xs text-stone-400 truncate">@{user.handle}</p>}
                          </div>
                        </div>

                        <div className="p-2">
                          {isStaff && (
                            <Link href="/admin" onClick={() => setOpenDropdown(null)}
                              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-stone-600 dark:text-stone-400 hover:bg-primary-50/40 dark:hover:bg-primary-900/20 hover:text-stone-900 dark:hover:text-stone-100 transition-colors">
                              <Shield className="w-4 h-4 text-stone-400" />
                              {t("nav.admin")}
                              <span className="ml-auto text-[10px] font-display font-semibold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30 px-1.5 py-0.5 rounded-full">Staff</span>
                            </Link>
                          )}
                          {isSuperAdmin && (
                            <Link href="/studio" onClick={() => setOpenDropdown(null)}
                              className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-stone-600 dark:text-stone-400 hover:bg-primary-50/40 dark:hover:bg-primary-900/20 hover:text-stone-900 dark:hover:text-stone-100 transition-colors">
                              <Palette className="w-4 h-4 text-stone-400" />
                              Content Studio
                              <span className="ml-auto text-[10px] font-display font-semibold text-rust-600 dark:text-rust-400 bg-rust-50 dark:bg-rust-900/30 px-1.5 py-0.5 rounded-full">Studio</span>
                            </Link>
                          )}
                          <Link href="/profile" onClick={() => setOpenDropdown(null)}
                            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-stone-600 dark:text-stone-400 hover:bg-primary-50/40 dark:hover:bg-primary-900/20 hover:text-stone-900 dark:hover:text-stone-100 transition-colors">
                            <Users className="w-4 h-4 text-stone-400" />{t("nav.my_profile")}
                          </Link>
                          <Link href="/articles/my" onClick={() => setOpenDropdown(null)}
                            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-stone-600 dark:text-stone-400 hover:bg-primary-50/40 dark:hover:bg-primary-900/20 hover:text-stone-900 dark:hover:text-stone-100 transition-colors">
                            <FileText className="w-4 h-4 text-stone-400" />{t("nav.my_articles")}
                          </Link>
                          <Link href="/profile?tab=settings" onClick={() => setOpenDropdown(null)}
                            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-stone-600 dark:text-stone-400 hover:bg-primary-50/40 dark:hover:bg-primary-900/20 hover:text-stone-900 dark:hover:text-stone-100 transition-colors">
                            <Settings className="w-4 h-4 text-stone-400" />{t("nav.settings")}
                          </Link>
                          <Link href="/marketplace" onClick={() => setOpenDropdown(null)}
                            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-stone-600 dark:text-stone-400 hover:bg-primary-50/40 dark:hover:bg-primary-900/20 hover:text-stone-900 dark:hover:text-stone-100 transition-colors">
                            <ShoppingBag className="w-4 h-4 text-stone-400" />{t("nav.market_place")}
                          </Link>
                          <Link href="/donate" onClick={() => setOpenDropdown(null)}
                            className="flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-stone-600 dark:text-stone-400 hover:bg-primary-50/40 dark:hover:bg-primary-900/20 hover:text-stone-900 dark:hover:text-stone-100 transition-colors">
                            <Heart className="w-4 h-4 text-stone-400" />{t("nav.support_us")}
                          </Link>
                          <div className="h-px bg-stone-100 dark:bg-stone-800 my-1 mx-1" />
                          <button onClick={() => { logout(); setOpenDropdown(null); }}
                            className="flex w-full items-center gap-2.5 px-3 py-2 rounded-lg text-sm text-stone-600 dark:text-stone-400 hover:bg-rust-50 dark:hover:bg-rust-900/20 hover:text-rust-600 dark:hover:text-rust-400 transition-colors">
                            <LogOut className="w-4 h-4" />{t("nav.sign_out")}
                          </button>
                        </div>
                    </div>
                  )}
                </div>
              </>
            )}

            {/* Sign In (logged out, desktop) */}
            {!token && (
              <Link href="/auth/login"
                className="hidden lg:inline-flex ml-1 px-4 py-1.5 rounded-xl2 bg-primary-600 text-cream text-sm font-display font-semibold hover:bg-primary-500 transition-colors shadow-sm shadow-primary-600/20">
                <Text k="nav.sign_in" as="span" />
              </Link>
            )}

          </div>
        </div>
      </nav>

      {/* ══════════════════════════════════════════════════════
          M O B I L E   N A V   ( drawer + sheets )
      ══════════════════════════════════════════════════════ */}
      <MobileNav
        unread={unread}
        moon={moon}
        openSheet={mobileSheet}
        onCloseSheet={() => setMobileSheet(null)}
        drawerOpen={drawerOpen}
        onCloseDrawer={() => setDrawerOpen(false)}
      />

      {/* ══════════════════════════════════════════════════════
          M O B I L E   B O T T O M   B A R
      ══════════════════════════════════════════════════════ */}
      <MobileBottomBar
        unread={unread}
        onOpenCreate={() => setMobileSheet("create")}
        onOpenNotifications={() => setMobileSheet("notifications")}
        onOpenProfile={() => setMobileSheet("profile")}
      />
    </>
  );
}
