"use client";

import { useState, useEffect } from "react";
import { Bell, Rss } from "lucide-react";
import { api } from "@/lib/api";
import { AuthProvider, useAuth } from "@/lib/auth-context";
import { LocaleProvider, useLocale } from "@/lib/locale-context";
import "./globals.css";

function LanguageSwitcher() {
  const { locale, setLocale } = useLocale();
  const { user } = useAuth();

  const toggle = async () => {
    const next: "pt" | "en" = locale === "pt" ? "en" : "pt";
    setLocale(next);
    if (user) {
      try {
        await api.auth.update({ locale: next });
      } catch {}
    }
  };

  return (
    <button
      onClick={toggle}
      className="text-xs font-medium uppercase tracking-wider text-stone-500 hover:text-primary-700 transition border border-stone-300 rounded px-2 py-1"
      title={locale === "pt" ? "Switch to English" : "Mudar para Português"}
    >
      {locale === "pt" ? "EN" : "PT"}
    </button>
  );
}

function NavBar() {
  const { t, locale, setLocale } = useLocale();
  const { user, token } = useAuth();
  const [unread, setUnread] = useState(0);
  const [showNotifs, setShowNotifs] = useState(false);
  const [notifs, setNotifs] = useState<any[]>([]);

  useEffect(() => {
    if (!token) { setUnread(0); return; }
    const fetchNotifs = async () => {
      try {
        const { count } = await api.notifications.unreadCount();
        setUnread(count);
      } catch {}
    };
    fetchNotifs();
    const interval = setInterval(fetchNotifs, 30000);
    return () => clearInterval(interval);
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

  return (
    <nav className="bg-white border-b border-stone-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <a href="/" className="flex items-center gap-2">
          <img src="/logo.png" alt={t("nav.rootlink")} className="h-14 w-auto" />
          <span className="text-xl font-bold text-primary-700 font-serif ml-2">{t("nav.rootlink")}</span>
        </a>
        <div className="flex items-center gap-4">
          <a href="/search" className="text-stone-600 hover:text-primary-700 transition text-sm">{t("nav.search")}</a>
          <a href="/submit" className="text-stone-600 hover:text-primary-700 transition text-sm">{t("nav.submit")}</a>
          <a href="/groups" className="text-stone-600 hover:text-primary-700 transition text-sm">{t("nav.groups")}</a>
          <a href="/events" className="text-stone-600 hover:text-primary-700 transition text-sm">{t("nav.events")}</a>
          <a href="/tools" className="text-stone-600 hover:text-primary-700 transition text-sm">{t("nav.tools")}</a>
          <a href="/learning" className="text-stone-600 hover:text-primary-700 transition text-sm">{t("nav.learning")}</a>
          <a href="/network" className="text-stone-600 hover:text-primary-700 transition text-sm">{t("nav.network")}</a>
          <LanguageSwitcher />
          {token && (
            <>
              <a href="/feed" className="text-stone-600 hover:text-primary-700 transition">
                <Rss className="w-5 h-5" />
              </a>
              <a href="/messages" className="text-stone-600 hover:text-primary-700 transition">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
                </svg>
              </a>
              <div className="relative">
                <button onClick={openNotifs} className="text-stone-600 hover:text-primary-700 transition relative">
                  <Bell className="w-5 h-5" />
                  {unread > 0 && (
                    <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-4 h-4 flex items-center justify-center">
                      {unread > 9 ? "9+" : unread}
                    </span>
                  )}
                </button>
                {showNotifs && (
                  <div className="absolute right-0 mt-2 w-80 bg-white rounded-xl shadow-lg border border-stone-200 z-50">
                    <div className="p-3 border-b border-stone-100 flex justify-between items-center">
                      <span className="font-semibold text-sm text-stone-700">{t("nav.notifications")}</span>
                      {unread > 0 && (
                        <button onClick={markAllRead} className="text-xs text-primary-600 hover:underline">{t("nav.mark_all_read")}</button>
                      )}
                    </div>
                    <div className="max-h-80 overflow-y-auto">
                      {notifs.length === 0 ? (
                        <p className="p-4 text-sm text-stone-400 text-center">{t("nav.no_notifications")}</p>
                      ) : (
                        notifs.map((n) => (
                          <a key={n.id} href={n.link || "#"}
                            className={`block p-3 border-b border-stone-50 hover:bg-stone-50 transition ${n.read ? "" : "bg-primary-50"}`}>
                            <p className="text-sm text-stone-700">{n.message}</p>
                            <p className="text-xs text-stone-400 mt-1">{n.created_at ? new Date(n.created_at).toLocaleDateString() : ""}</p>
                          </a>
                        ))
                      )}
                    </div>
                    {notifs.length > 0 && (
                      <a href="/notifications" className="block p-2 text-center text-xs text-primary-600 hover:underline border-t border-stone-100">{t("nav.view_all")}</a>
                    )}
                  </div>
                )}
              </div>
              {isStaff && (
                <a href="/admin" className="text-stone-600 hover:text-primary-700 transition text-sm">{t("nav.admin")}</a>
              )}
              <a href="/profile" className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition text-sm font-medium">{t("nav.profile")}</a>
            </>
          )}
          {!token && (
            <a href="/auth/login" className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition text-sm font-medium">{t("nav.sign_in")}</a>
          )}
        </div>
      </div>
    </nav>
  );
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt">
      <body className="min-h-screen flex flex-col">
        <LocaleProvider>
          <AuthProvider>
            <NavBar />
            <main className="flex-1">{children}</main>
          </AuthProvider>
          <Footer />
        </LocaleProvider>
      </body>
    </html>
  );
}

function Footer() {
  const { t } = useLocale();
  return (
    <footer className="bg-stone-800 text-stone-400 py-8 text-center text-sm">
      <p>{t("nav.footer")}</p>
    </footer>
  );
}
