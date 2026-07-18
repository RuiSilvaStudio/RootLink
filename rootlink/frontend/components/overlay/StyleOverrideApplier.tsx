"use client";

/**
 * StyleOverrideApplier — applies published per-element style overrides
 * to the page so visitors (and the editor's Preview-as-visitor) see them.
 *
 * Fetches GET /api/overrides?page=<slug> on mount and route change,
 * then for each override: finds the DOM element via the stored path,
 * translates the token name to CSS (var(--color-X), var(--text-X), etc.),
 * and applies it as an inline style.
 *
 * Uses a MutationObserver (debounced) to re-apply overrides when new
 * elements appear (async content, React remounts) — the old single-shot
 * requestAnimationFrame missed everything that loaded after frame 1.
 *
 * Mounted in app/layout.tsx alongside ThemeProvider. Runs in the editor
 * iframe too (so Preview-as-visitor shows the live published state).
 */

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api";

const COLOR_PROPS = new Set(["color", "background-color", "border-color"]);

/** Translate a token NAME to the CSS the browser sees — same mapping
 *  as the overlay's inspector handleChange and the selection agent's
 *  applyStyle. */
function tokenToCss(property: string, value: string): string {
  if (COLOR_PROPS.has(property)) return `var(--color-${value})`;
  if (property === "font-size") return `var(--text-${value})`;
  if (property === "padding" || property === "gap") return `calc(var(--spacing) * ${value})`;
  if (property === "border-radius") return `var(--radius-${value})`;
  return value;
}

export function StyleOverrideApplier() {
  const pathname = usePathname();

  useEffect(() => {
    const slug = pathname.slice(1) || "home";
    let fontsCache: { name: string; family: string }[] | null = null;
    let observer: MutationObserver | null = null;
    let debounceTimer: ReturnType<typeof setTimeout> | null = null;
    let overrides: { element_path: string; property: string; new_value: string }[] = [];

    async function resolveFontFamily(name: string): Promise<string | null> {
      if (!fontsCache) {
        try { fontsCache = await api.fonts.list(); } catch { fontsCache = []; }
      }
      return fontsCache.find((f) => f.name === name)?.family ?? null;
    }

    async function applyAll() {
      for (const o of overrides) {
        const el = document.querySelector(o.element_path) as HTMLElement | null;
        if (!el) continue;
        let css: string;
        if (o.property === "font-family") {
          css = (await resolveFontFamily(o.new_value)) ?? o.new_value;
        } else {
          css = tokenToCss(o.property, o.new_value);
        }
        el.style.setProperty(o.property, css);
      }
    }

    async function loadAndApply() {
      try {
        overrides = await api.overrides.list(slug);
      } catch {
        return;
      }
      if (overrides.length === 0) return;
      await applyAll();
    }

    loadAndApply();

    // Watch for new elements appearing (async content, remounts) and
    // re-apply. Debounced to avoid thrashing on rapid DOM changes.
    observer = new MutationObserver(() => {
      if (overrides.length === 0) return;
      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => { applyAll(); }, 150);
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer?.disconnect();
      if (debounceTimer) clearTimeout(debounceTimer);
    };
  }, [pathname]);

  return null;
}
