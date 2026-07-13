"use client";

/**
 * Content Studio shell — the responsive workbench surface for super_admin.
 *
 * Design: a focused, tool-like workspace using the platform's earth-brown/
 * Fraunces tokens. Slim top bar + collapsible sidebar (desktop, collapses
 * to icons) / drawer (mobile). Cmd+K opens the studio command palette.
 *
 * Spec: docs/content-studio/CONTENT_STUDIO.md §3.1, §3.2.
 *
 * Face-lift (2026-07-12): added sidebar collapse-to-icons, breadcrumb in
 * the header, and Cmd+K command palette integration.
 */

import { useState, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import {
  LayoutDashboard,
  Type,
  Palette,
  Boxes,
  Menu,
  X,
  ExternalLink,
  Moon,
  Sun,
  BookOpen,
  Library,
  AlertTriangle,
  Search,
  ChevronRight,
  PanelLeftClose,
  PanelLeftOpen,
  Languages,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/lib/locale-context";
import { Tooltip } from "@/components/ui";
import { BrandIcon } from "@/components/ui/BrandIcon";
import { StudioCommandPalette } from "./StudioCommandPalette";

interface StudioSection {
  label: string;
  href: string;
  icon: typeof Type;
  status: "active" | "soon";
  note?: string;
}

const SECTIONS: StudioSection[] = [
  { label: "Overview", href: "/studio", icon: LayoutDashboard, status: "active" },
  { label: "Content", href: "/studio/content", icon: Type, status: "active" },
  { label: "Theming", href: "/studio/theming", icon: Palette, status: "active" },
  { label: "Blocks", href: "/studio/blocks", icon: Boxes, status: "active" },
  { label: "Catalog", href: "/studio/catalog", icon: Library, status: "active" },
  { label: "Audit", href: "/studio/audit", icon: Search, status: "active" },
  { label: "Fonts", href: "/studio/fonts", icon: BookOpen, status: "active" },
  { label: "Glossary", href: "/studio/glossary", icon: Languages, status: "active" },
  { label: "Overrides", href: "/studio/overrides", icon: AlertTriangle, status: "active" },
];

/** Derive the current module name from the pathname for the breadcrumb. */
function currentModuleName(pathname: string): string {
  if (pathname === "/studio") return "Overview";
  const match = SECTIONS.find((s) => s.href !== "/studio" && pathname.startsWith(s.href));
  return match?.label || "Studio";
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

function NavItem({ section, onNavigate, collapsed }: { section: StudioSection; onNavigate?: () => void; collapsed?: boolean }) {
  const pathname = usePathname();
  const Icon = section.icon;
  const isActive = pathname === section.href || (section.href !== "/studio" && pathname.startsWith(section.href));
  const isSoon = section.status === "soon";

  const content = (
    <span
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
        collapsed ? "justify-center" : ""
      } ${
        isActive
          ? "bg-primary-600 text-cream"
          : isSoon
          ? "text-stone-400 dark:text-stone-600 cursor-not-allowed"
          : "text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800"
      }`}
    >
      <Icon className="w-4 h-4 shrink-0" />
      {!collapsed && <span className="flex-1 truncate">{section.label}</span>}
      {!collapsed && isSoon && <span className="text-xs uppercase tracking-wide text-stone-400">{section.note}</span>}
    </span>
  );

  if (isSoon) {
    return <div className="px-1">{content}</div>;
  }

  return (
    <Link
      href={section.href}
      onClick={onNavigate}
      aria-current={isActive ? "page" : undefined}
      aria-label={collapsed ? section.label : undefined}
      className="block px-1"
    >
      {collapsed ? (
        <Tooltip content={section.label} side="right">
          {content}
        </Tooltip>
      ) : (
        content
      )}
    </Link>
  );
}

export function StudioShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { t } = useLocale();
  const router = useRouter();
  const pathname = usePathname();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(false);

  const isSuperAdmin = !!user && (user.role === "super_admin" || (user.rank != null && user.rank >= 5));

  useEffect(() => {
    if (!loading && !isSuperAdmin) {
      router.replace("/auth/sign-in");
    }
  }, [loading, isSuperAdmin, router]);

  // Esc closes the mobile drawer.
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setDrawerOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawerOpen]);

  // Persist sidebar collapse preference.
  useEffect(() => {
    const stored = localStorage.getItem("rl-studio-sidebar-collapsed");
    if (stored === "true") setCollapsed(true);
  }, []);
  useEffect(() => {
    try { localStorage.setItem("rl-studio-sidebar-collapsed", String(collapsed)); } catch {}
  }, [collapsed]);

  if (loading || !isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream dark:bg-stone-950">
        <div className="animate-pulse-soft text-stone-400 font-serif">Loading studio…</div>
      </div>
    );
  }

  const moduleName = currentModuleName(pathname);

  return (
    <div className="h-screen bg-cream dark:bg-stone-950 flex flex-col">
      <StudioCommandPalette />

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
          <Link href="/studio" className="flex items-center gap-2 text-brand dark:text-primary-300">
            <BrandIcon className="w-5 h-5" />
            <span className="font-display font-semibold text-primary-700 dark:text-primary-300 text-sm tracking-tight">
              Content Studio
            </span>
          </Link>
          {/* Breadcrumb */}
          {pathname !== "/studio" && (
            <span className="hidden sm:flex items-center gap-1.5 text-xs text-stone-400">
              <ChevronRight className="w-3 h-3" />
              <span className="text-stone-600 dark:text-stone-300 font-medium">{moduleName}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-1">
          {/* Cmd+K hint */}
          <Tooltip content="Quick jump (Ctrl+K)" side="bottom">
            <kbd className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-stone-400 bg-stone-100 dark:bg-stone-800 border border-stone-200 dark:border-stone-700 font-mono">
              ⌘K
            </kbd>
          </Tooltip>
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
        <aside className={`hidden lg:flex flex-col ${collapsed ? "w-16" : "w-60"} shrink-0 border-r border-primary-200/40 dark:border-stone-800 p-3 gap-0.5 transition-[width] duration-200`}>
          {!collapsed && (
            <p className="px-3 pt-2 pb-1 text-xs uppercase tracking-wider text-stone-400 font-medium">
              Manage
            </p>
          )}
          {SECTIONS.map((s) => (
            <NavItem key={s.href} section={s} collapsed={collapsed} />
          ))}

          {!collapsed && (
            <div className="mt-auto p-3">
              <p className="text-xs text-stone-400 dark:text-stone-500 leading-relaxed">
                The studio manages RootLink&apos;s UI theming and content.
              </p>
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
                  Content Studio
                </span>
                <button
                  onClick={() => setDrawerOpen(false)}
                  className="p-1.5 rounded-lg text-stone-400 hover:text-stone-700 hover:bg-stone-100 dark:hover:bg-stone-800"
                  aria-label="Close navigation"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
              <p className="px-3 pb-1 text-xs uppercase tracking-wider text-stone-400 font-medium">
                Manage
              </p>
              {SECTIONS.map((s) => (
                <NavItem key={s.href} section={s} onNavigate={() => setDrawerOpen(false)} />
              ))}
            </aside>
          </div>
        )}

        {/* ── Main content ────────────────────────────────────── */}
        <main className="flex-1 min-w-0 overflow-hidden">{children}</main>
      </div>
    </div>
  );
}
