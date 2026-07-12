"use client";

/**
 * Admin Shell — the responsive workbench surface for staff users.
 *
 * Mirrors `components/studio/StudioShell.tsx` (2026-07-12 face-lift):
 * sticky header bar + collapsible sidebar (cream bg + border-r, collapses to
 * icons) / drawer (mobile). Escape closes the drawer. Breadcrumb in header.
 *
 * Replaces the old glassmorphism AdminSidebar + 17-line layout that hid
 * `<main>` on mobile (the reported mobile bug).
 *
 * Spec: the admin is a back-office tool — the `frontend-ui-guardian` skill's
 * "Back-Office / Tool UI" chapter is binding. Consistency IS the design.
 */

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter, usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Search,
  Leaf,
  FileText,
  Users,
  MessageSquare,
  Megaphone,
  Globe,
  CalendarDays,
  Ticket as TicketIcon,
  Heart,
  Award,
  Store,
  Settings,
  Scale,
  ShieldCheck,
  Menu,
  X,
  ExternalLink,
  Moon,
  Sun,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  ChevronLeft,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/lib/locale-context";
import { Tooltip } from "@/components/ui";
import { BrandIcon } from "@/components/ui/BrandIcon";
import { AdminSidebarSection, type AdminSection } from "./AdminSidebarSection";

function getAdminSections(t: (key: string) => string, isAdmin: boolean, isSuperAdmin: boolean): AdminSection[] {
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
        ...(isAdmin ? [{ href: "/admin/entity-verification", label: "Entity Verification", icon: ShieldCheck }] : []),
      ],
    },
    {
      labelKey: "admin.section_events_commerce",
      items: [
        { href: "/admin/events", label: t("admin.events"), icon: CalendarDays },
        { href: "/admin/tickets", label: t("admin.tickets"), icon: TicketIcon },
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
        ...(isSuperAdmin ? [{ href: "/admin/legal", label: t("admin.legal_docs"), icon: Scale }] : []),
        ...(isAdmin ? [{ href: "/admin/config", label: t("admin.config"), icon: Settings }] : []),
      ],
    },
  ];
}

/** Derive the current module name from the pathname for the breadcrumb. */
function currentModuleName(pathname: string, sections: AdminSection[]): string {
  if (pathname === "/admin") return "Dashboard";
  for (const section of sections) {
    for (const item of section.items) {
      if (item.href !== "/admin" && pathname.startsWith(item.href)) {
        return item.label;
      }
    }
  }
  return "Admin";
}

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);
  return (
    <Tooltip content={dark ? "Switch to light mode" : "Switch to dark mode"} side="bottom">
      <button
        onClick={() => {
          const next = !dark;
          setDark(next);
          document.documentElement.classList.toggle("dark", next);
          try {
            localStorage.setItem("theme", next ? "dark" : "light");
          } catch {}
        }}
        className="p-2 rounded-lg text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 transition"
        aria-label="Toggle dark mode"
      >
        {dark ? <Sun className="w-4 h-4" /> : <Moon className="w-4 h-4" />}
      </button>
    </Tooltip>
  );
}

export function AdminShell({ children }: { children: React.ReactNode }) {
  const { t } = useLocale();
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  // Auth gate — staff only (mirrors the old AdminSidebar gate).
  const allowed = !!user && ["super_admin", "admin", "moderator", "contributor"].includes(user.role);

  useEffect(() => {
    if (!loading && !user) {
      router.push("/auth/login");
    }
  }, [loading, user, router]);

  // Persist sidebar collapse preference.
  useEffect(() => {
    const stored = localStorage.getItem("rl-admin-sidebar-collapsed");
    if (stored === "true") setCollapsed(true);
  }, []);
  useEffect(() => {
    try { localStorage.setItem("rl-admin-sidebar-collapsed", String(collapsed)); } catch {}
  }, [collapsed]);

  // Esc closes the mobile drawer.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream dark:bg-stone-950">
        <div className="animate-pulse-soft text-stone-400 font-serif">Loading admin…</div>
      </div>
    );
  }

  if (!allowed) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center gap-4 bg-cream dark:bg-stone-950">
        <p className="text-stone-500 text-lg font-serif">{t("admin.no_access")}</p>
        <Link href="/" className="text-primary-600 hover:underline font-serif">{t("admin.back_home")}</Link>
      </div>
    );
  }

  const isAdmin = user?.role === "admin" || user?.role === "super_admin";
  const isSuperAdmin = user?.role === "super_admin";
  const sections = getAdminSections(t, isAdmin, isSuperAdmin);
  const moduleName = currentModuleName(pathname, sections);

  return (
    <div className="h-screen bg-cream dark:bg-stone-950 flex flex-col">
      {/* ── Top bar ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 h-12 shrink-0 flex items-center justify-between px-4 border-b border-primary-200/40 dark:border-stone-800 bg-cream/90 dark:bg-stone-950/90 backdrop-blur-md">
        <div className="flex items-center gap-2">
          {/* Hamburger — mobile only */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="lg:hidden p-1.5 -ml-1 rounded-lg text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800"
            aria-label="Open navigation"
          >
            <Menu className="w-5 h-5" />
          </button>
          {/* Collapse toggle — desktop only */}
          <Tooltip content={collapsed ? "Expand sidebar" : "Collapse sidebar"} side="bottom">
            <button
              onClick={() => setCollapsed((c) => !c)}
              className="hidden lg:flex p-1.5 -ml-1 rounded-lg text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 transition"
              aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            >
              {collapsed ? <PanelLeftOpen className="w-4 h-4" /> : <PanelLeftClose className="w-4 h-4" />}
            </button>
          </Tooltip>
          <Link href="/admin" className="flex items-center gap-2 text-brand dark:text-primary-300">
            <BrandIcon className="w-5 h-5" />
            <span className="font-display font-semibold text-primary-700 dark:text-primary-300 text-sm tracking-tight">
              Admin
            </span>
          </Link>
          {/* Breadcrumb */}
          {pathname !== "/admin" && (
            <span className="hidden sm:flex items-center gap-1.5 text-xs text-stone-400">
              <ChevronRight className="w-3 h-3" />
              <span className="text-stone-600 dark:text-stone-300 font-medium">{moduleName}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          <ThemeToggle />
          <Link
            href="/"
            target="_blank"
            className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 transition"
          >
            <ExternalLink className="w-3.5 h-3.5" />
            View site
          </Link>
        </div>
      </header>

      <div className="flex-1 flex min-h-0">
        {/* ── Sidebar — desktop docked (collapsible) ──────────── */}
        <aside className={`hidden lg:flex flex-col ${collapsed ? "w-16" : "w-64"} shrink-0 border-r border-primary-200/40 dark:border-stone-800 p-3 gap-0.5 transition-[width] duration-200`}>
          {!collapsed && (
            <p className="px-3 pt-2 pb-1 text-xs uppercase tracking-wider text-stone-400 font-medium">
              {t("admin.panel")}
            </p>
          )}
          {sections.map((section) => (
            <AdminSidebarSection
              key={section.labelKey}
              section={section}
              defaultExpanded={section.items.some((item) => pathname === item.href)}
              pathname={pathname}
              collapsed={collapsed}
            />
          ))}

          {!collapsed && (
            <div className="mt-auto p-3">
              <Link
                href="/"
                className="flex items-center gap-2 text-xs text-stone-400 dark:text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 transition font-serif"
              >
                <ChevronLeft className="w-3 h-3" />
                {t("admin.back_to_site")}
              </Link>
            </div>
          )}
        </aside>

        {/* ── Sidebar — mobile drawer ─────────────────────────── */}
        {drawerOpen && (
          <div className="lg:hidden fixed inset-0 z-50 flex">
            <div
              className="absolute inset-0 bg-stone-950/40 backdrop-blur-sm"
              onClick={() => setDrawerOpen(false)}
            />
            <aside className="relative w-72 max-w-[80vw] bg-cream dark:bg-stone-950 border-r border-primary-200/40 dark:border-stone-800 p-3 flex flex-col gap-0.5 animate-drawer-in">
              <div className="flex items-center justify-between mb-2">
                <span className="flex items-center gap-2 font-display font-semibold text-primary-700 dark:text-primary-300 text-sm">
                  <BrandIcon className="w-4 h-4" />
                  {t("admin.panel")}
                </span>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800"
                  aria-label="Close navigation"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto">
                {sections.map((section) => (
                  <AdminSidebarSection
                    key={section.labelKey}
                    section={section}
                    defaultExpanded={section.items.some((item) => pathname === item.href)}
                    pathname={pathname}
                  />
                ))}
              </div>
              <Link
                href="/"
                onClick={() => setDrawerOpen(false)}
                className="flex items-center gap-2 px-3 py-2 text-sm text-stone-500 hover:text-stone-700 dark:hover:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 rounded-lg transition font-serif mt-2"
              >
                <ChevronLeft className="w-4 h-4" />
                {t("admin.back_to_site")}
              </Link>
            </aside>
          </div>
        )}

        {/* ── Main content ────────────────────────────────────── */}
        <main className="flex-1 min-w-0 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
