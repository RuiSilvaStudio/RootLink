"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Home, BookOpen, Plus, Bell, User, LogIn } from "lucide-react";
import { SafeAvatar } from "./UserAvatar";
import { useLocale } from "@/lib/locale-context";
import { useAuth } from "@/lib/auth-context";

interface Props {
  unread: number;
  onOpenCreate: () => void;
  onOpenNotifications: () => void;
  onOpenProfile: () => void;
}

export function MobileBottomBar({ unread, onOpenCreate, onOpenNotifications, onOpenProfile }: Props) {
  const { t } = useLocale();
  const { token, user } = useAuth();
  const pathname = usePathname();

  const initial = user?.name?.[0]?.toUpperCase() ?? "U";

  const tabCls = (active: boolean) =>
    `flex flex-col items-center justify-center gap-[3px] flex-1 py-2.5 transition-colors -webkit-tap-highlight-color-transparent ${
      active
        ? "text-primary-600 dark:text-primary-400"
        : "text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300"
    }`;

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 lg:hidden pb-safe" aria-label="Mobile navigation">
      <div className="bg-white/95 dark:bg-stone-900/95 backdrop-blur-md border-t border-stone-200 dark:border-stone-800 flex items-end">

        {/* Home */}
        <Link href="/" className={tabCls(pathname === "/")}>
          <Home className="w-5 h-5" strokeWidth={pathname === "/" ? 2 : 1.5} />
          <span className="text-[10px] font-display font-medium leading-none">{t("nav.home")}</span>
        </Link>

        {/* Learning */}
        <Link href="/learning" className={tabCls(pathname.startsWith("/learning"))}>
          <BookOpen className="w-5 h-5" strokeWidth={pathname.startsWith("/learning") ? 2 : 1.5} />
          <span className="text-[10px] font-display font-medium leading-none">{t("nav.learning")}</span>
        </Link>

        {/* Create — elevated center button */}
        <div className="flex flex-col items-center flex-1 pb-[env(safe-area-inset-bottom,0px)]">
          <button
            onClick={token ? onOpenCreate : undefined}
            disabled={!token}
            aria-label={t("create.button")}
            className={`w-14 h-14 rounded-full flex items-center justify-center shadow-lg -mt-7 transition-all duration-150 ${
              token
                ? "bg-primary-500 text-cream shadow-primary-500/30 hover:bg-primary-400 active:scale-95"
                : "bg-stone-200 dark:bg-stone-700 text-stone-400 dark:text-stone-500 cursor-not-allowed"
            }`}
          >
            <Plus className="w-6 h-6" strokeWidth={2.5} />
          </button>
          <span className={`text-[10px] font-display font-medium leading-none mt-1 mb-0.5 ${
            token ? "text-stone-400 dark:text-stone-500" : "text-stone-300 dark:text-stone-600"
          }`}>
            {t("create.button")}
          </span>
        </div>

        {/* Updates (Notifications) */}
        <button
          onClick={token ? onOpenNotifications : undefined}
          disabled={!token}
          className={`${tabCls(false)} relative ${!token ? "opacity-40 cursor-not-allowed" : ""}`}
          aria-label={t("nav.updates")}
        >
          <div className="relative">
            <Bell className="w-5 h-5" strokeWidth={1.5} />
            {token && unread > 0 && (
              <span className="absolute -top-1 -right-1 w-4 h-4 bg-rust-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center leading-none animate-pulse-soft">
                {unread > 9 ? "9+" : unread}
              </span>
            )}
          </div>
          <span className="text-[10px] font-display font-medium leading-none">{t("nav.updates")}</span>
        </button>

        {/* You / Sign In */}
        {token ? (
          <button onClick={onOpenProfile} className={tabCls(false)} aria-label={t("nav.you")}>
            <div className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-900/30 border border-primary-200 dark:border-primary-700/50 text-primary-700 dark:text-primary-300 flex items-center justify-center overflow-hidden">
              <SafeAvatar url={user?.avatar_url} iconClassName="w-3.5 h-3.5" />
            </div>
            <span className="text-[10px] font-display font-medium leading-none">{t("nav.you")}</span>
          </button>
        ) : (
          <Link href="/auth/login" className={tabCls(false)} aria-label={t("nav.sign_in")}>
            <LogIn className="w-5 h-5" strokeWidth={1.5} />
            <span className="text-[10px] font-display font-medium leading-none">{t("nav.sign_in")}</span>
          </Link>
        )}

      </div>
    </nav>
  );
}
