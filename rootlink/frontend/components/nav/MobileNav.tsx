"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import {
  X, Search, Users, CalendarDays, Network, Building2, Rss,
  Leaf, BookOpen, Wrench, ShoppingBag, Sprout, RefreshCw,
  Shield, FileText, Globe, Settings, LogOut, Heart,
  Bell, Star, CheckCheck, ArrowRight,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/lib/locale-context";
import { api } from "@/lib/api";
import { SafeAvatar } from "./UserAvatar";
import { Wordmark } from "@/components/ui/Wordmark";

type Sheet = "create" | "notifications" | "profile" | null;
type NotifTab = "notifications" | "messages" | "activity";

interface Props {
  unread: number;
  moon: { phase: string; illumination: number; icon: string; agricultural_pt?: string } | null;
  openSheet: Sheet;
  onCloseSheet: () => void;
  drawerOpen: boolean;
  onCloseDrawer: () => void;
}

export function MobileNav({ unread, moon, openSheet, onCloseSheet, drawerOpen, onCloseDrawer }: Props) {
  const { user, token, logout } = useAuth();
  const { t } = useLocale();
  const [notifTab, setNotifTab] = useState<NotifTab>("notifications");
  const [notifs, setNotifs] = useState<any[]>([]);
  const [notifsLoaded, setNotifsLoaded] = useState(false);

  // TECH_DEBT.md §0 / user-logic-review.md §8-9 (was missing super_admin —
  // the frontend mirror of the backend super_admin-not-superset bug).
  const isStaff = user && (user.role === "admin" || user.role === "moderator" || user.role === "contributor" || user.role === "super_admin");
  const initial = user?.name?.[0]?.toUpperCase() ?? "U";

  // Load notifications when sheet opens
  useEffect(() => {
    if (openSheet === "notifications" && token && !notifsLoaded) {
      api.notifications.list().then((n) => { setNotifs(n); setNotifsLoaded(true); }).catch(() => {});
    }
  }, [openSheet, token, notifsLoaded]);

  const markAllRead = async () => {
    await api.notifications.markAllRead();
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })));
  };

  const backdropVisible = drawerOpen || openSheet !== null;

  return (
    <>
      {/* ── Backdrop ───────────────────────────────────────── */}
      {backdropVisible && (
        <div
          className="fixed inset-0 z-[60] bg-stone-950/60 backdrop-blur-sm lg:hidden"
          onClick={() => { onCloseDrawer(); onCloseSheet(); }}
        />
      )}

      {/* ══════════════════════════════════════════════════════
          H A M B U R G E R   D R A W E R
      ══════════════════════════════════════════════════════ */}
      {drawerOpen && (
        <div className="fixed inset-y-0 left-0 z-[70] w-[min(85vw,320px)] bg-white dark:bg-stone-900 flex flex-col overflow-hidden lg:hidden animate-drawer-in border-r border-stone-200 dark:border-stone-800">
          {/* Header */}
          <div className="flex items-center justify-between px-4 h-14 border-b border-stone-200 dark:border-stone-800 flex-shrink-0">
            <span className="text-brand dark:text-primary-300">
              <Wordmark className="h-6 w-auto" />
            </span>
            <button onClick={onCloseDrawer} className="p-2 -mr-1 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-primary-50/60 dark:hover:bg-primary-900/20 transition-colors" aria-label={t("nav.admin")}>
              <X className="w-5 h-5" />
            </button>
          </div>
          {/* Body */}
          <div className="flex-1 overflow-y-auto p-4 space-y-5">
            {[
              { label: t("nav.discover"), items: [
                { href: "/search", label: t("nav.search"), Icon: Search },
                { href: "/groups", label: t("nav.groups"), Icon: Users },
                { href: "/events", label: t("nav.events"), Icon: CalendarDays },
                { href: "/network", label: t("nav.network"), Icon: Network },
                { href: "/entities", label: t("nav.entities"), Icon: Building2 },
                { href: "/feed", label: t("nav.feed"), Icon: Rss },
              ]},
              { label: t("nav.grow"), items: [
                { href: "/plants", label: t("nav.plants"), Icon: Leaf },
                { href: "/learning", label: t("nav.learning"), Icon: BookOpen },
                { href: "/tools", label: t("nav.tools"), Icon: Wrench },
              ]},
              { label: t("nav.exchange"), items: [
                { href: "/marketplace", label: t("nav.marketplace"), Icon: ShoppingBag },
                { href: "/composting", label: t("nav.composting"), Icon: Sprout },
                { href: "/upcycling", label: t("nav.upcycling"), Icon: RefreshCw },
              ]},
            ].map((section) => (
              <div key={section.label}>
                <p className="text-[10px] font-display font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider mb-1.5 px-1">
                  {section.label}
                </p>
                <div className="grid grid-cols-2 gap-0.5">
                  {section.items.map(({ href, label, Icon }) => (
                    <Link key={href} href={href} onClick={onCloseDrawer}
                      className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-stone-600 dark:text-stone-400 hover:bg-primary-50/60 dark:hover:bg-primary-900/20 hover:text-stone-900 dark:hover:text-stone-100 transition-colors">
                      <Icon className="w-4 h-4 shrink-0 text-primary-500" />
                      {label}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
            {token && (
              <div>
                <p className="text-[10px] font-display font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider mb-1.5 px-1">
                  {t("nav.community")}
                </p>
                <div className="grid grid-cols-2 gap-0.5">
                  <Link href="/donate" onClick={onCloseDrawer}
                    className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm font-medium text-stone-600 dark:text-stone-400 hover:bg-primary-50/60 dark:hover:bg-primary-900/20 hover:text-stone-900 dark:hover:text-stone-100 transition-colors">
                    <Heart className="w-4 h-4 shrink-0 text-primary-500" />
                    {t("nav.support_us")}
                  </Link>
                </div>
              </div>
            )}
          </div>
          {/* Footer */}
          <div className="border-t border-stone-200 dark:border-stone-800 p-3 flex-shrink-0 pb-safe">
            {!token && (
              <Link href="/auth/login" onClick={onCloseDrawer}
                className="block w-full text-center px-4 py-2.5 rounded-xl2 text-sm bg-primary-600 text-cream font-display font-semibold hover:bg-primary-500 transition-colors">
                {t("nav.sign_in")}
              </Link>
            )}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          C R E A T E   S H E E T
      ══════════════════════════════════════════════════════ */}
      {openSheet === "create" && (
        <div className="fixed bottom-0 inset-x-0 z-[70] bg-white dark:bg-stone-900 rounded-t-2xl shadow-2xl lg:hidden max-h-[85vh] overflow-y-auto animate-sheet-up">
          <div className="w-9 h-1 rounded-full bg-stone-200 dark:bg-stone-700 mx-auto mt-3" />
          <div className="flex items-center justify-between px-5 py-3 border-b border-stone-200 dark:border-stone-800">
            <h3 className="font-display text-base font-semibold text-stone-900 dark:text-stone-100">{t("create.button")}</h3>
            <button onClick={onCloseSheet} className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 hover:bg-primary-50/60 dark:hover:bg-primary-900/20 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="px-4 pt-3 pb-2 border-b border-stone-100 dark:border-stone-800">
            <p className="font-display font-semibold text-stone-800 dark:text-stone-100 text-[0.9375rem]">{t("create.heading")}</p>
            <p className="text-[0.8125rem] text-primary-500 dark:text-primary-400 mt-0.5 leading-snug">{t("create.subheading")}</p>
          </div>
          <div className="p-4 grid grid-cols-2 gap-1 pb-safe">
            {[
              { href: "/articles/new", label: t("create.article"), icon: FileText },
              { href: "/events?new=1", label: t("create.event"), icon: CalendarDays },
              { href: "/marketplace/create", label: t("create.listing"), icon: ShoppingBag },
              { href: "/groups?new=1", label: t("create.group"), icon: Users },
              { href: "/submit", label: t("create.submit"), icon: Globe },
              { href: "/learning/courses/new", label: t("create.course"), icon: BookOpen },
              { href: "/learning/paths/new", label: t("create.path"), icon: RefreshCw },
            ].map(({ href, label, icon: Icon }) => (
              <Link key={href} href={href} onClick={onCloseSheet}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-primary-50/60 dark:hover:bg-primary-900/20 transition-colors">
                <div className="w-7 h-7 rounded-lg bg-primary-100/70 dark:bg-primary-900/30 flex items-center justify-center text-primary-600 dark:text-primary-300 shrink-0">
                  <Icon className="w-3.5 h-3.5" />
                </div>
                <span className="text-[0.8125rem] font-medium text-stone-700 dark:text-stone-200">{label}</span>
              </Link>
            ))}
          </div>
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          N O T I F I C A T I O N S   S H E E T
      ══════════════════════════════════════════════════════ */}
      {openSheet === "notifications" && (
        <div className="fixed bottom-0 inset-x-0 z-[70] bg-white dark:bg-stone-900 rounded-t-2xl shadow-2xl lg:hidden max-h-[85vh] flex flex-col animate-sheet-up">
          <div className="w-9 h-1 rounded-full bg-stone-200 dark:bg-stone-700 mx-auto mt-3 flex-shrink-0" />
          {/* Tabs */}
          <div className="flex border-b border-stone-200 dark:border-stone-800 px-4 pt-2 gap-0.5 flex-shrink-0">
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
          <div className="flex-1 overflow-y-auto p-3">
            {notifTab === "notifications" && (
              <>
                {unread > 0 && (
                  <div className="flex justify-end mb-1">
                    <button onClick={markAllRead} className="flex items-center gap-1.5 text-xs text-primary-600 dark:text-primary-400 hover:underline font-serif">
                      <CheckCheck className="w-3.5 h-3.5" />
                      {t("nav.mark_all_read")}
                    </button>
                  </div>
                )}
                {notifs.length === 0 ? (
                  <p className="py-8 text-center text-sm text-stone-400 dark:text-stone-500 font-serif">{t("nav.no_notifications")}</p>
                ) : (
                  notifs.slice(0, 10).map((n) => {
                    const href = n.link || "#";
                    const isInternal = href.startsWith("/");
                    const Tag = isInternal ? Link : "a";
                    return (
                      <Tag key={n.id} href={href} {...(!isInternal ? { target: "_blank", rel: "noopener noreferrer" } : {})}
                        onClick={onCloseSheet}
                        className={`flex items-start gap-3 p-3 rounded-xl hover:bg-primary-50/40 dark:hover:bg-primary-900/20 transition-colors ${n.read ? "" : "bg-primary-50/30 dark:bg-primary-900/10"}`}>
                        <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/40 flex items-center justify-center text-primary-600 dark:text-primary-400 text-xs font-semibold flex-shrink-0">
                          <Bell className="w-4 h-4" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-stone-700 dark:text-stone-200 font-serif leading-snug">{n.message}</p>
                          <p className="text-xs text-stone-400 mt-1 font-serif">
                            {n.created_at ? new Date(n.created_at).toLocaleDateString() : ""}
                          </p>
                        </div>
                        {!n.read && <div className="w-2 h-2 rounded-full bg-primary-500 flex-shrink-0 mt-2" />}
                      </Tag>
                    );
                  })
                )}
                {notifs.length > 0 && (
                  <Link href="/notifications" onClick={onCloseSheet}
                    className="flex items-center justify-between px-3 py-2 mt-1 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-500 font-medium rounded-lg hover:bg-primary-50/40 dark:hover:bg-primary-900/20 transition-colors">
                    {t("nav.view_all_notifications")}
                    <ArrowRight className="w-3.5 h-3.5" />
                  </Link>
                )}
              </>
            )}
            {notifTab === "messages" && (
              <Link href="/messages" onClick={onCloseSheet}
                className="flex items-center justify-between px-3 py-2 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-500 font-medium rounded-lg hover:bg-primary-50/40 dark:hover:bg-primary-900/20 transition-colors">
                {t("nav.open_messages")}
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
            {notifTab === "activity" && (
              <Link href="/feed" onClick={onCloseSheet}
                className="flex items-center justify-between px-3 py-2 text-sm text-primary-600 dark:text-primary-400 hover:text-primary-500 font-medium rounded-lg hover:bg-primary-50/40 dark:hover:bg-primary-900/20 transition-colors">
                {t("nav.view_all_activity")}
                <ArrowRight className="w-3.5 h-3.5" />
              </Link>
            )}
            {/* Moon phase widget — always visible */}
            {moon && (
              <div className="mt-3 p-3 rounded-xl bg-primary-50/60 dark:bg-primary-900/15 border border-primary-200/30 dark:border-primary-800/30 flex items-center gap-3">
                <span className="text-2xl leading-none select-none">{moon.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-display font-semibold text-stone-800 dark:text-stone-100">{moon.phase}</p>
                  <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">{moon.illumination}% iluminado</p>
                </div>
              </div>
            )}
          </div>
          <div className="h-[env(safe-area-inset-bottom,0px)] flex-shrink-0" />
        </div>
      )}

      {/* ══════════════════════════════════════════════════════
          P R O F I L E   S H E E T
      ══════════════════════════════════════════════════════ */}
      {openSheet === "profile" && token && (
        <div className="fixed bottom-0 inset-x-0 z-[70] bg-white dark:bg-stone-900 rounded-t-2xl shadow-2xl lg:hidden max-h-[85vh] overflow-y-auto animate-sheet-up">
          <div className="w-9 h-1 rounded-full bg-stone-200 dark:bg-stone-700 mx-auto mt-3" />
          {/* User header */}
          <div className="flex items-center gap-3 px-5 py-4 border-b border-stone-200 dark:border-stone-800">
            <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/30 border border-primary-200 dark:border-primary-700/50 text-primary-700 dark:text-primary-300 flex items-center justify-center flex-shrink-0 overflow-hidden">
              <SafeAvatar url={user?.avatar_url} iconClassName="w-6 h-6" />
            </div>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-stone-900 dark:text-stone-100 truncate">{user?.name}</p>
              {user?.handle && <p className="text-xs text-stone-400 truncate">@{user.handle}</p>}
            </div>
          </div>
          {/* Menu */}
          <div className="p-2">
            {isStaff && (
              <Link href="/admin" onClick={onCloseSheet} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-stone-600 dark:text-stone-400 hover:bg-primary-50/60 dark:hover:bg-primary-900/20 hover:text-stone-900 dark:hover:text-stone-100 transition-colors">
                <Shield className="w-4 h-4 text-stone-400" />
                {t("nav.admin")}
                <span className="ml-auto text-[10px] font-display font-semibold text-primary-600 dark:text-primary-400 bg-primary-50 dark:bg-primary-900/30 px-1.5 py-0.5 rounded-full">Staff</span>
              </Link>
            )}
            <Link href="/profile" onClick={onCloseSheet} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-stone-600 dark:text-stone-400 hover:bg-primary-50/60 dark:hover:bg-primary-900/20 hover:text-stone-900 dark:hover:text-stone-100 transition-colors">
              <Users className="w-4 h-4 text-stone-400" />
              {t("nav.my_profile")}
            </Link>
            <Link href="/articles/my" onClick={onCloseSheet} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-stone-600 dark:text-stone-400 hover:bg-primary-50/60 dark:hover:bg-primary-900/20 hover:text-stone-900 dark:hover:text-stone-100 transition-colors">
              <FileText className="w-4 h-4 text-stone-400" />
              {t("nav.my_articles")}
            </Link>
            <Link href="/profile?tab=settings" onClick={onCloseSheet} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-stone-600 dark:text-stone-400 hover:bg-primary-50/60 dark:hover:bg-primary-900/20 hover:text-stone-900 dark:hover:text-stone-100 transition-colors">
              <Settings className="w-4 h-4 text-stone-400" />
              {t("nav.settings")}
            </Link>
            <Link href="/marketplace" onClick={onCloseSheet} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-stone-600 dark:text-stone-400 hover:bg-primary-50/60 dark:hover:bg-primary-900/20 hover:text-stone-900 dark:hover:text-stone-100 transition-colors">
              <ShoppingBag className="w-4 h-4 text-stone-400" />
              {t("nav.market_place")}
            </Link>
            <Link href="/donate" onClick={onCloseSheet} className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-stone-600 dark:text-stone-400 hover:bg-primary-50/60 dark:hover:bg-primary-900/20 hover:text-stone-900 dark:hover:text-stone-100 transition-colors">
              <Heart className="w-4 h-4 text-stone-400" />
              {t("nav.support_us")}
            </Link>
            <div className="h-px bg-stone-200 dark:border-stone-800 my-1 mx-3" />
            <button onClick={() => { logout(); onCloseSheet(); }}
              className="flex w-full items-center gap-2.5 px-3 py-2.5 rounded-xl text-sm text-stone-600 dark:text-stone-400 hover:bg-rust-50 dark:hover:bg-rust-900/20 hover:text-rust-600 dark:hover:text-rust-400 transition-colors">
              <LogOut className="w-4 h-4" />
              {t("nav.sign_out")}
            </button>
          </div>
          <div className="pb-safe" />
        </div>
      )}
    </>
  );
}
