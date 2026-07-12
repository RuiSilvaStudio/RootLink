"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { toast } from "sonner";
import {
  Type, Palette, Boxes, Library, Search, BookOpen, AlertTriangle,
  ArrowRight, Palette as PaletteIcon, FileStack, Clock,
} from "lucide-react";
import { api } from "@/lib/api";

interface ActiveTheme {
  id: number;
  name: string;
}

interface SystemStatus {
  activeTheme: ActiveTheme | null;
  staleOverrides: number;
  totalOverrides: number;
}

const MODULES = [
  { label: "Content", href: "/studio/content", icon: Type, description: "Marketing copy, labels, buttons — PT + EN" },
  { label: "Theming", href: "/studio/theming", icon: Palette, description: "Colors, fonts, radii, dark mode" },
  { label: "Blocks", href: "/studio/blocks", icon: Boxes, description: "Compose and rearrange page structure" },
  { label: "Catalog", href: "/studio/catalog", icon: Library, description: "Element type registry and property schemas" },
  { label: "Audit", href: "/studio/audit", icon: Search, description: "Compare components visually, see usage" },
  { label: "Fonts", href: "/studio/fonts", icon: BookOpen, description: "Browse, preview, and manage typefaces" },
  { label: "Overrides", href: "/studio/overrides", icon: AlertTriangle, description: "Deviations from theme defaults" },
];

export default function StudioOverview() {
  const [status, setStatus] = useState<SystemStatus | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchStatus = useCallback(async () => {
    try {
      const [themes, overrides] = await Promise.all([
        api.themes.active().catch(() => null),
        api.overrides.all().catch(() => []),
      ]);
      const staleCount = Array.isArray(overrides) ? overrides.filter((o: { is_stale: boolean }) => o.is_stale).length : 0;
      setStatus({
        activeTheme: themes ? { id: themes.id, name: themes.name } : null,
        staleOverrides: staleCount,
        totalOverrides: Array.isArray(overrides) ? overrides.length : 0,
      });
      setLoading(false);
    } catch {
      // Non-blocking — the overview still works without live status.
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchStatus(); }, [fetchStatus]);

  return (
    <div className="h-full overflow-y-auto">
      {/* Header — same template as every other studio page */}
      <div className="shrink-0 px-6 py-4 border-b border-primary-200/40 dark:border-stone-800">
        <h1 className="font-display text-xl font-semibold text-stone-800 dark:text-stone-100">Studio</h1>
        <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
          Manage the RootLink platform&apos;s UI theming and content.
        </p>
      </div>

      <div className="p-6 max-w-5xl space-y-8">
        {/* ── System status ──────────────────────────────────── */}
        <div className="grid sm:grid-cols-3 gap-3">
          <StatusCard
            icon={<PaletteIcon className="w-4 h-4 text-primary-500" />}
            label="Active theme"
            value={loading ? "—" : status?.activeTheme?.name || "Default"}
            href="/studio/theming"
          />
          <StatusCard
            icon={<FileStack className="w-4 h-4 text-rust-500" />}
            label="Overrides"
            value={loading ? "—" : String(status?.totalOverrides ?? 0)}
            href="/studio/overrides"
          />
          <StatusCard
            icon={<Clock className="w-4 h-4 text-amber-500" />}
            label="Stale overrides"
            value={loading ? "—" : String(status?.staleOverrides ?? 0)}
            href="/studio/overrides"
            highlight={!!status && status.staleOverrides > 0}
          />
        </div>

        {/* ── Shortcuts ───────────────────────────────────────── */}
        <div>
          <h2 className="text-xs uppercase tracking-wider text-stone-400 font-medium mb-3">
            Modules
          </h2>
          <div className="grid sm:grid-cols-2 gap-2">
            {MODULES.map((mod) => {
              const Icon = mod.icon;
              return (
                <Link
                  key={mod.label}
                  href={mod.href}
                  className="group flex items-center gap-3 p-3 rounded-xl2 border border-primary-200/60 dark:border-stone-800 hover:border-primary-300 dark:hover:border-primary-700 bg-white dark:bg-stone-900 transition"
                >
                  <div className="w-8 h-8 rounded-lg bg-primary-50 dark:bg-stone-800 flex items-center justify-center text-primary-600 dark:text-primary-400 shrink-0">
                    <Icon className="w-4 h-4" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-stone-800 dark:text-stone-100">{mod.label}</div>
                    <div className="text-xs text-stone-500 dark:text-stone-400 truncate">{mod.description}</div>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-stone-300 group-hover:text-primary-500 group-hover:translate-x-0.5 transition shrink-0" />
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}

function StatusCard({ icon, label, value, href, highlight }: {
  icon: React.ReactNode;
  label: string;
  value: string;
  href: string;
  highlight?: boolean;
}) {
  return (
    <Link
      href={href}
      className={`flex items-center gap-3 p-4 rounded-xl2 border transition ${
        highlight
          ? "border-amber-300/60 dark:border-amber-800/40 bg-amber-50/30 dark:bg-amber-950/10"
          : "border-primary-200/60 dark:border-stone-800 bg-white dark:bg-stone-900 hover:border-primary-300 dark:hover:border-primary-700"
      }`}
    >
      <div className="w-8 h-8 rounded-lg bg-primary-50 dark:bg-stone-800 flex items-center justify-center shrink-0">
        {icon}
      </div>
      <div className="min-w-0">
        <div className="text-xs text-stone-400">{label}</div>
        <div className="text-sm font-display font-semibold text-stone-800 dark:text-stone-100 truncate">{value}</div>
      </div>
    </Link>
  );
}
