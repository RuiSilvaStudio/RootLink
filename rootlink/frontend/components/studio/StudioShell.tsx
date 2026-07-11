"use client";

/**
 * Content Studio shell — the responsive workbench surface for super_admin.
 *
 * Design: a focused, tool-like workspace using the platform's earth-brown/
 * Fraunces tokens. Slim top bar + collapsible sidebar (desktop) / drawer
 * (mobile). Deliberately distinct from the public NavBar and the admin
 * AdminSidebar — the studio is a first-class product surface.
 *
 * Spec: docs/content-studio/CONTENT_STUDIO.md §3.1, §3.2 (vertical-slice
 * foundation: each primitive live on a real surface immediately).
 *
 * Mobile-first AND desktop-first (§1 principle 2): the sidebar is a docked
 * rail on lg+ and a slide-in drawer on mobile, with the same navigation
 * content in both. No functionality is desktop-only.
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
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/lib/locale-context";
import { BrandIcon } from "@/components/ui/BrandIcon";

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
  { label: "Overrides", href: "/studio/overrides", icon: AlertTriangle, status: "active" },
];

function ThemeToggle() {
  const [dark, setDark] = useState(false);
  useEffect(() => {
    setDark(document.documentElement.classList.contains("dark"));
  }, []);
  return (
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
  );
}

function NavItem({ section, onNavigate }: { section: StudioSection; onNavigate?: () => void }) {
  const pathname = usePathname();
  const Icon = section.icon;
  const isActive = pathname === section.href || (section.href !== "/studio" && pathname.startsWith(section.href));
  const isSoon = section.status === "soon";

  const content = (
    <span
      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
        isActive
          ? "bg-primary-600 text-cream"
          : isSoon
          ? "text-stone-400 dark:text-stone-600 cursor-not-allowed"
          : "text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800"
      }`}
    >
      <Icon className="w-4 h-4 shrink-0" />
      <span className="flex-1">{section.label}</span>
      {isSoon && <span className="text-[10px] uppercase tracking-wide text-stone-400">{section.note}</span>}
    </span>
  );

  if (isSoon) {
    return <div className="px-1">{content}</div>;
  }

  return (
    <Link href={section.href} onClick={onNavigate} className="block px-1">
      {content}
    </Link>
  );
}

export function StudioShell({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { t } = useLocale();
  const router = useRouter();
  const [drawerOpen, setDrawerOpen] = useState(false);

  // Gate: super_admin only. Uses both the legacy role string AND the new
  // rank-based model (rank >= 5, entity_kind platform) from the roles/
  // permissions redesign — mirrors composting/page.tsx's dual-check pattern.
  // Loading-safe: don't redirect until auth resolves.
  const isSuperAdmin = !!user && (user.role === "super_admin" || (user.rank != null && user.rank >= 5));

  useEffect(() => {
    if (!loading && !isSuperAdmin) {
      router.replace("/auth/sign-in");
    }
  }, [loading, isSuperAdmin, router]);

  if (loading || !isSuperAdmin) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-cream dark:bg-stone-950">
        <div className="animate-pulse-soft text-stone-400 font-serif">Loading studio…</div>
      </div>
    );
  }

  return (
    <div className="h-screen bg-cream dark:bg-stone-950 flex flex-col">
      {/* ── Top bar ─────────────────────────────────────────────── */}
      <header className="sticky top-0 z-40 h-12 shrink-0 flex items-center justify-between px-4 border-b border-primary-200/40 dark:border-stone-800 bg-cream/90 dark:bg-stone-950/90 backdrop-blur-md">
        <div className="flex items-center gap-3">
          {/* Hamburger — mobile only */}
          <button
            onClick={() => setDrawerOpen(true)}
            className="lg:hidden p-1.5 -ml-1 rounded-lg text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800"
            aria-label="Open navigation"
          >
            <Menu className="w-5 h-5" />
          </button>
          <Link href="/studio" className="flex items-center gap-2 text-brand dark:text-primary-300">
            <BrandIcon className="w-5 h-5" />
            <span className="font-display font-semibold text-primary-700 dark:text-primary-300 text-sm tracking-tight">
              Content Studio
            </span>
          </Link>
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
        {/* ── Sidebar — desktop docked ────────────────────────── */}
        <aside className="hidden lg:flex flex-col w-60 shrink-0 border-r border-primary-200/40 dark:border-stone-800 p-3 gap-0.5">
          <p className="px-3 pt-2 pb-1 text-[10px] uppercase tracking-wider text-stone-400 font-medium">
            Manage
          </p>
          {SECTIONS.map((s) => (
            <NavItem key={s.href} section={s} />
          ))}

          <div className="mt-auto p-3">
            <p className="text-[11px] text-stone-400 leading-relaxed">
              The studio manages RootLink&apos;s UI theming and content.{" "}
              <Link href="/docs/content-studio/CONTENT_STUDIO.md" className="text-primary-600 dark:text-primary-400 hover:underline">
                Spec
              </Link>
            </p>
          </div>
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
                <span className="font-display font-semibold text-primary-700 dark:text-primary-300 text-sm">
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
              <p className="px-3 pb-1 text-[10px] uppercase tracking-wider text-stone-400 font-medium">
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
