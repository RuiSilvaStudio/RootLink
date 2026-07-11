"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Search, ArrowRight, CornerDownLeft } from "lucide-react";
import { useLocale } from "@/lib/locale-context";

type CommandItem = {
  label: string;
  href: string;
  shortcut?: string;
  section: string;
};

export function CommandPalette() {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [selectedIndex, setSelectedIndex] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);
  const router = useRouter();
  const { t } = useLocale();

  const commands: CommandItem[] = [
    { label: t("nav.search"), href: "/search", section: t("nav.discover"), shortcut: "S" },
    { label: t("nav.groups"), href: "/groups", section: t("nav.discover") },
    { label: t("nav.events"), href: "/events", section: t("nav.discover") },
    { label: t("nav.network"), href: "/network", section: t("nav.discover") },
    { label: t("nav.entities"), href: "/entities", section: t("nav.discover") },
    { label: t("nav.plants"), href: "/plants", section: t("nav.grow") },
    { label: t("nav.learning"), href: "/learning", section: t("nav.grow") },
    { label: t("nav.tools"), href: "/tools", section: t("nav.grow") },
    { label: t("nav.marketplace"), href: "/marketplace", section: t("nav.exchange") },
    { label: t("nav.composting"), href: "/composting", section: t("nav.exchange") },
    { label: t("nav.upcycling"), href: "/upcycling", section: t("nav.exchange") },
    { label: t("nav.feed"), href: "/feed", section: t("nav.connect") },
    { label: t("nav.messages"), href: "/messages", section: t("nav.connect") },
    { label: t("nav.profile"), href: "/profile", section: t("nav.connect") },
    { label: t("nav.notifications"), href: "/notifications", section: t("nav.connect") },
    { label: t("nav.submit"), href: "/submit", section: t("nav.connect") },
    { label: t("nav.admin"), href: "/admin", section: "Account" },
  ];

  const filtered = commands.filter((c) =>
    c.label.toLowerCase().includes(query.toLowerCase())
  );

  const grouped = filtered.reduce<Record<string, CommandItem[]>>((acc, cmd) => {
    if (!acc[cmd.section]) acc[cmd.section] = [];
    acc[cmd.section].push(cmd);
    return acc;
  }, {});

  const flatList = Object.entries(grouped).flatMap(([section, items]) =>
    items.map((item) => ({ ...item, section }))
  );

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === "Escape") {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", handler);
    return () => document.removeEventListener("keydown", handler);
  }, []);

  useEffect(() => {
    if (open) {
      setQuery("");
      setSelectedIndex(0);
      setTimeout(() => inputRef.current?.focus(), 50);
    }
  }, [open]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [query]);

  const selectItem = useCallback((index: number) => {
    const item = flatList[index];
    if (!item) return;
    setOpen(false);
    router.push(item.href);
  }, [flatList, router]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.min(prev + 1, flatList.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSelectedIndex((prev) => Math.max(prev - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      selectItem(selectedIndex);
    }
  };

  useEffect(() => {
    if (!listRef.current) return;
    const selected = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
    selected?.scrollIntoView({ block: "nearest" });
  }, [selectedIndex]);

  if (!open) return null;

  let runningIndex = -1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={t("nav.search")}
      data-rl-dialog
      className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4"
      onClick={() => setOpen(false)}
    >
      <div className="absolute inset-0 bg-stone-950/30 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border border-primary-200/40 dark:border-stone-700 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search input */}
        <div className="flex items-center gap-3 px-4 border-b border-primary-100/40 dark:border-stone-700/50">
          <Search className="w-4 h-4 text-stone-400 shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={t("nav.search") + "..."}
            className="flex-1 py-4 bg-transparent text-stone-800 dark:text-stone-200 text-sm font-serif placeholder:text-stone-400 focus:outline-none"
            role="combobox"
            aria-expanded="true"
            aria-controls="command-list"
            aria-activedescendant={selectedIndex >= 0 ? `cmd-${selectedIndex}` : undefined}
          />
          <kbd className="hidden sm:inline-flex items-center gap-1 px-1.5 py-0.5 text-[10px] font-display text-stone-400 bg-stone-100 dark:bg-stone-800 rounded border border-stone-200 dark:border-stone-700">
            ESC
          </kbd>
        </div>

        {/* Results */}
        <div ref={listRef} id="command-list" role="listbox" className="max-h-[50vh] overflow-y-auto py-2">
          {flatList.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-stone-400 font-serif">
              No results for &quot;{query}&quot;
            </p>
          ) : (
            Object.entries(grouped).map(([section, items]) => (
              <div key={section}>
                <p className="px-4 py-2 text-[10px] font-display font-semibold uppercase tracking-[0.12em] text-stone-400">
                  {section}
                </p>
                {items.map((item) => {
                  runningIndex++;
                  const idx = runningIndex;
                  const isSelected = idx === selectedIndex;
                  return (
                    <button
                      key={item.href}
                      id={`cmd-${idx}`}
                      data-index={idx}
                      role="option"
                      aria-selected={isSelected}
                      onClick={() => selectItem(idx)}
                      className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors ${
                        isSelected
                          ? "bg-primary-50/60 dark:bg-primary-900/20 text-primary-700 dark:text-primary-300"
                          : "text-stone-600 dark:text-stone-400 hover:bg-primary-50/30"
                      }`}
                    >
                      <span className="flex-1 text-sm font-serif">{item.label}</span>
                      {item.shortcut && (
                        <kbd className="text-[10px] font-display text-stone-400">
                          {item.shortcut}
                        </kbd>
                      )}
                      {isSelected && <CornerDownLeft className="w-3 h-3 text-primary-500" />}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2.5 border-t border-primary-100/40 dark:border-stone-700/50 flex items-center justify-between text-[10px] text-stone-400 font-display">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-stone-100 dark:bg-stone-800 rounded border border-stone-200 dark:border-stone-700">↑↓</kbd>
              navigate
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1 py-0.5 bg-stone-100 dark:bg-stone-800 rounded border border-stone-200 dark:border-stone-700">↵</kbd>
              select
            </span>
          </div>
          <span className="flex items-center gap-1">
            <ArrowRight className="w-2.5 h-2.5" /> RootLink
          </span>
        </div>
      </div>
    </div>
  );
}
