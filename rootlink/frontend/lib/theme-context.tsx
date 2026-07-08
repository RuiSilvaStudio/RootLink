"use client";

/**
 * Runtime theme-override provider.
 *
 * Fetches token overrides from `/api/theme` and injects them as CSS custom
 * property values on `:root` — so every component that uses
 * `bg-primary-600` / `var(--color-primary-600)` immediately reflects the
 * studio's theme edits, site-wide, without a rebuild.
 *
 * Spec: docs/content-studio/CONTENT_STUDIO.md §4 (the token model).
 *
 * Fetches once on mount (like locale-context fetches /api/copy). The studio's
 * theming page writes overrides through `api.theme.set()`; after save, a
 * refetch (or the page's own local state) updates the live preview.
 */

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { api } from "@/lib/api";

type ThemeOverrides = Record<string, string>;

interface ThemeContextType {
  overrides: ThemeOverrides;
  loading: boolean;
  refresh: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

/** Apply a set of token overrides to `:root` as CSS custom properties. */
function applyOverrides(overrides: ThemeOverrides) {
  const root = document.documentElement;
  for (const [token, value] of Object.entries(overrides)) {
    root.style.setProperty(token, value);
  }
}

/** Remove all overridden tokens (revert to static defaults). */
function clearOverrides(overrides: ThemeOverrides) {
  const root = document.documentElement;
  for (const token of Object.keys(overrides)) {
    root.style.removeProperty(token);
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [overrides, setOverrides] = useState<ThemeOverrides>({});
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.theme.get();
      setOverrides(data);
      applyOverrides(data);
    } catch {
      // Non-fatal — defaults remain
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <ThemeContext.Provider value={{ overrides, loading, refresh }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
