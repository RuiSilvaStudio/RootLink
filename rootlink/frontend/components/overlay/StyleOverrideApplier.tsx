"use client";

/**
 * StyleOverrideApplier — applies published per-element style overrides
 * to the public page so visitors see the editor's changes.
 *
 * Fetches GET /api/overrides?page=<slug> on mount and route change,
 * then for each override: finds the DOM element via the stored path,
 * translates the token name to CSS (var(--color-X), var(--text-X), etc.),
 * and applies it as an inline style.
 *
 * Mounted in app/layout.tsx alongside ThemeProvider. No-ops inside
 * the overlay's iframe (the overlay applies its own live styles).
 */

import { useEffect } from "react";
import { usePathname } from "next/navigation";
import { api } from "@/lib/api";

const COLOR_PROPS = new Set(["color", "background-color", "border-color"]);

/** Translate a token NAME to the CSS the browser sees — same mapping
 *  as the overlay's inspector handleChange and the selection agent's
 *  applyStyle. Font-family needs async resolution (fetch font library),
 *  handled separately. */
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
    // Don't run inside the overlay's iframe — the overlay handles its own styles.
    if (typeof window !== "undefined" && window.top !== window.self) return;

    const slug = pathname.slice(1) || "home";

    let fontsCache: { name: string; family: string }[] | null = null;

    async function resolveFontFamily(name: string): Promise<string | null> {
      if (!fontsCache) {
        try {
          fontsCache = await api.fonts.list();
        } catch {
          fontsCache = [];
        }
      }
      const font = fontsCache.find((f) => f.name === name);
      return font?.family ?? null;
    }

    async function applyOverrides() {
      let overrides: { element_path: string; property: string; new_value: string }[];
      try {
        overrides = await api.overrides.list(slug);
      } catch {
        return;
      }

      // Wait for the page to render before applying styles.
      // requestAnimationFrame ensures the DOM is ready.
      requestAnimationFrame(async () => {
        for (const o of overrides) {
          const el = document.querySelector(o.element_path) as HTMLElement | null;
          if (!el) continue;

          let css: string;
          if (o.property === "font-family") {
            const family = await resolveFontFamily(o.new_value);
            css = family ?? o.new_value;
          } else {
            css = tokenToCss(o.property, o.new_value);
          }
          el.style.setProperty(o.property, css);
        }
      });
    }

    applyOverrides();
  }, [pathname]);

  return null;
}
