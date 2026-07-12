"use client";

/**
 * Studio Command Palette — Cmd/Ctrl+K quick jump between studio modules.
 *
 * Uses cmdk (the same primitive shadcn's Command wraps), themed to RootLink's
 * dark tool-chrome (stone-950 + primary + cream). Opens as a centered dialog
 * overlay with a search input + filtered list of modules.
 *
 * Active on /studio/* routes only. The overlay editor's iframe has its own
 * Esc handler that yields to dialogs — so this palette is safe even when the
 * overlay is open (though the overlay covers the studio, so the shortcut
 * won't fire from the parent document in that case).
 */

import { useEffect, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Type,
  Palette,
  Boxes,
  Library,
  Search,
  BookOpen,
  AlertTriangle,
} from "lucide-react";

const ITEMS = [
  { label: "Overview", href: "/studio", icon: LayoutDashboard },
  { label: "Content", href: "/studio/content", icon: Type },
  { label: "Theming", href: "/studio/theming", icon: Palette },
  { label: "Blocks", href: "/studio/blocks", icon: Boxes },
  { label: "Catalog", href: "/studio/catalog", icon: Library },
  { label: "Audit", href: "/studio/audit", icon: Search },
  { label: "Fonts", href: "/studio/fonts", icon: BookOpen },
  { label: "Overrides", href: "/studio/overrides", icon: AlertTriangle },
];

export function StudioCommandPalette() {
  const [open, setOpen] = useState(false);
  const router = useRouter();

  const close = useCallback(() => setOpen(false), []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setOpen((o) => !o);
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        close();
      }
    };
    window.addEventListener("keydown", onEsc, true);
    return () => window.removeEventListener("keydown", onEsc, true);
  }, [open, close]);

  const go = (href: string) => {
    close();
    router.push(href);
  };

  if (!open || typeof document === "undefined") return null;

  return createPortal(
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-[15vh] px-4"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div className="absolute inset-0 bg-stone-950/50 backdrop-blur-sm" />
      <Command
        role="dialog"
        aria-modal="true"
        aria-label="Studio command palette"
        className="relative w-full max-w-lg rounded-xl2 border border-stone-700 bg-stone-900 shadow-2xl overflow-hidden animate-scale-in"
        onKeyDown={(e: React.KeyboardEvent) => {
          // Prevent the keydown from reaching the overlay agent's greedy
          // Esc handler (LESSONS #43). The capture-phase listener above
          // already handles Esc; this stops bubbling.
          if (e.key === "Escape") e.stopPropagation();
        }}
      >
        <Command.Input
          autoFocus
          placeholder="Jump to…"
          className="w-full px-5 py-4 bg-transparent text-sm font-serif text-stone-100 placeholder:text-stone-500 border-b border-stone-700 focus:outline-none"
        />
        <Command.List className="max-h-80 overflow-y-auto p-2 scrollbar-none">
          <Command.Empty className="px-3 py-6 text-sm text-stone-400 font-serif text-center">
            No results found.
          </Command.Empty>
          {ITEMS.map((item) => {
            const Icon = item.icon;
            return (
              <Command.Item
                key={item.href}
                value={item.label}
                onSelect={() => go(item.href)}
                className="flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-stone-200 cursor-pointer data-[selected=true]:bg-primary-600 data-[selected=true]:text-cream transition-colors"
              >
                <Icon className="w-4 h-4 shrink-0 text-stone-400 data-[selected=true]:text-cream" />
                <span className="flex-1">{item.label}</span>
              </Command.Item>
            );
          })}
        </Command.List>
      </Command>
    </div>,
    document.body
  );
}
