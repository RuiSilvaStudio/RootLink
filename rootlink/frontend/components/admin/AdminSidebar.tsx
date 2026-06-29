"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/locale-context";
import { Menu, X, ChevronLeft } from "lucide-react";
import {
  LayoutDashboard,
  Search,
  Leaf,
  FileText,
  Users,
  MessageSquare,
  Megaphone,
  Globe,
  Ticket,
  Heart,
  Award,
  Store,
  Settings,
  Type,
} from "lucide-react";
import { AdminSidebarSection, type AdminSection } from "./AdminSidebarSection";

function getAdminSections(t: (key: string) => string, isAdmin: boolean, canEditCopy: boolean): AdminSection[] {
  return [
    {
      labelKey: "admin.section_overview",
      items: [
        { href: "/admin", label: t("admin.dashboard"), icon: LayoutDashboard },
      ],
    },
    {
      labelKey: "admin.section_content",
      items: [
        { href: "/admin/review-queue", label: t("admin.review_queue"), icon: Search },
        { href: "/admin/plants", label: t("admin.plants"), icon: Leaf },
        { href: "/admin/content", label: t("admin.content"), icon: FileText },
        { href: "/admin/comments", label: t("admin.comments"), icon: MessageSquare },
      ],
    },
    {
      labelKey: "admin.section_people",
      items: [
        { href: "/admin/users", label: t("admin.users"), icon: Users },
        { href: "/admin/groups", label: t("admin.groups"), icon: Users },
      ],
    },
    {
      labelKey: "admin.section_events_commerce",
      items: [
        { href: "/admin/tickets", label: t("admin.tickets"), icon: Ticket },
        { href: "/admin/donations", label: t("admin.donations"), icon: Heart },
        { href: "/admin/sponsors", label: t("admin.sponsors"), icon: Award },
        { href: "/admin/vendors", label: t("admin.vendors"), icon: Store },
      ],
    },
    {
      labelKey: "admin.section_system",
      items: [
        { href: "/admin/notifications", label: t("admin.broadcast"), icon: Megaphone },
        { href: "/admin/submit", label: t("admin.submit_url"), icon: Globe },
        ...(canEditCopy ? [{ href: "/admin/copy", label: t("admin.site_copy"), icon: Type }] : []),
        ...(isAdmin ? [{ href: "/admin/config", label: t("admin.config"), icon: Settings }] : []),
      ],
    },
  ];
}

export function AdminSidebar() {
  const { t } = useLocale();
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [mobileOpen, setMobileOpen] = useState(false);

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
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center text-stone-400 font-serif pt-16 ml-16">
        {t("admin.loading")}
      </div>
    );
  }

  const allowed = ["super_admin", "admin", "moderator", "contributor"].includes(user?.role);
  if (!allowed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 pt-16 ml-16">
        <p className="text-stone-500 text-lg font-serif">{t("admin.no_access")}</p>
        <Link href="/" className="text-primary-600 hover:underline font-serif">{t("admin.back_home")}</Link>
      </div>
    );
  }

  const closeMobile = () => setMobileOpen(false);
  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const canEditCopy = user?.role === "super_admin" || user?.can_edit_copy;
  const sections = getAdminSections(t, isAdmin, canEditCopy);

  return (
    <>
      {/* DESKTOP SIDEBAR — always expanded */}
      <aside className="fixed top-20 bottom-2 left-2 z-50 w-64 liquid-glass rounded-2xl flex-col overflow-hidden hidden lg:flex">
        <div className="h-11 px-3 shrink-0 flex items-center">
          <h2 className="text-sm font-display font-semibold text-cream/90 uppercase tracking-[0.12em]">
            {t("admin.panel")}
          </h2>
        </div>

        <nav className="relative z-10 flex-1 flex flex-col gap-0.5 px-2 py-1 overflow-y-auto scrollbar-none">
          {sections.map((section) => (
            <AdminSidebarSection
              key={section.labelKey}
              section={section}
              defaultExpanded={section.items.some((item) => pathname === item.href)}
              pathname={pathname}
            />
          ))}
        </nav>

        <div className="px-2 pb-2 pt-1 border-t border-white/5 relative z-10">
          <Link
            href="/"
            title={t("admin.back_to_site")}
            className="flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-serif text-cream/50 hover:text-cream hover:bg-white/5 transition"
          >
            <ChevronLeft className="w-5 h-5 shrink-0" />
            <span className="whitespace-nowrap">{t("admin.back_to_site")}</span>
          </Link>
        </div>
      </aside>

      {/* MOBILE SIDEBAR — full-height drawer */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="fixed inset-0 bg-black/40 z-40 backdrop-blur-sm lg:hidden"
              onClick={closeMobile}
            />
            <motion.div
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: "spring" as const, stiffness: 500, damping: 35 }}
              className="fixed top-0 left-0 bottom-0 z-50 w-[280px] liquid-glass-drawer flex flex-col lg:hidden"
            >
              <div className="flex items-center justify-between h-16 px-5 border-b border-white/5 shrink-0">
                <h2 className="text-sm font-display font-semibold text-stone-700 uppercase tracking-[0.12em]">
                  {t("admin.panel")}
                </h2>
                <button
                  onClick={closeMobile}
                  className="p-1.5 rounded-lg hover:bg-primary-100/40 text-stone-400 hover:text-stone-600 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <nav className="flex-1 overflow-y-auto px-3 py-4 flex flex-col gap-1">
                {sections.map((section) => (
                  <div key={section.labelKey} className="mb-2">
                    <p className="px-4 py-1 text-[10px] font-display font-semibold text-stone-400 uppercase tracking-[0.12em]">
                      {t(section.labelKey)}
                    </p>
                    {section.items.map((item) => {
                      const Icon = item.icon;
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          onClick={closeMobile}
                          className="flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-serif text-stone-600 hover:bg-primary-50/40 transition"
                        >
                          <Icon className="w-5 h-5 shrink-0 text-stone-400" />
                          <span>{item.label}</span>
                        </Link>
                      );
                    })}
                  </div>
                ))}
              </nav>

              <div className="px-3 pb-4 pt-2 border-t border-primary-200/30 shrink-0">
                <Link
                  href="/"
                  onClick={closeMobile}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm text-stone-500 hover:text-stone-700 hover:bg-primary-50/30 transition font-serif"
                >
                  <ChevronLeft className="w-4 h-4" />
                  {t("admin.back_to_site")}
                </Link>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* MOBILE MENU TRIGGER */}
      <button
        className="lg:hidden flex items-center gap-2 mb-4 text-sm text-stone-500 hover:text-stone-700 transition"
        onClick={() => setMobileOpen(true)}
      >
        <Menu className="w-5 h-5" />
        <span className="text-xs font-display font-semibold text-stone-400 uppercase tracking-[0.12em]">{t("admin.panel")}</span>
      </button>
    </>
  );
}
