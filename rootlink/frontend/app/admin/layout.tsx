"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useLocale } from "@/lib/locale-context";

const navItems = (t: (key: string, vars?: any) => string) => [
  { href: "/admin", label: t("admin.dashboard"), icon: "📊" },
  { href: "/admin/review-queue", label: t("admin.review_queue"), icon: "🔍" },
  { href: "/admin/plants", label: t("admin.plants"), icon: "🌱" },
  { href: "/admin/content", label: t("admin.content"), icon: "📄" },
  { href: "/admin/users", label: t("admin.users"), icon: "👥" },
  { href: "/admin/groups", label: t("admin.groups"), icon: "🏠" },
  { href: "/admin/comments", label: t("admin.comments"), icon: "💬" },
  { href: "/admin/notifications", label: t("admin.broadcast"), icon: "📢" },
  { href: "/submit", label: t("admin.submit_url"), icon: "🌐" },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { t } = useLocale();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/auth/login");
      return;
    }
    api.auth.me().then(setUser).catch(() => {
      localStorage.removeItem("token");
      router.push("/auth/login");
    }).finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-stone-400">
        {t("admin.loading")}
      </div>
    );
  }

  const allowed = user?.role === "admin" || user?.role === "moderator" || user?.role === "contributor";
  if (!allowed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4">
        <p className="text-stone-500 text-lg">{t("admin.no_access")}</p>
        <a href="/" className="text-primary-600 hover:underline">{t("admin.back_home")}</a>
      </div>
    );
  }

  return (
    <div className="flex min-h-[calc(100vh-4rem)]">
      <aside className="w-56 bg-stone-50 border-r border-stone-200 p-4 flex flex-col gap-1 shrink-0">
        <div className="text-xs font-semibold text-stone-400 uppercase tracking-wide mb-3 px-3">
          {t("admin.panel")}
        </div>
        {navItems(t).map((item) => {
          const active = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm transition ${
                active
                  ? "bg-primary-100 text-primary-800 font-medium"
                  : "text-stone-600 hover:bg-stone-100"
              }`}
            >
              <span>{item.icon}</span>
              {item.label}
            </Link>
          );
        })}
        <div className="mt-auto pt-4 border-t border-stone-200">
          <Link href="/" className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm text-stone-500 hover:bg-stone-100 transition">
            {t("admin.back_to_site")}
          </Link>
        </div>
      </aside>
      <main className="flex-1 p-6 bg-white overflow-auto">{children}</main>
    </div>
  );
}
