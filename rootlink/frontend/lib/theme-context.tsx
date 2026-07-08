"use client";

/**
 * Runtime theme provider (Phase 4).
 *
 * Spec: docs/content-studio/CONTENT_STUDIO.md §8 (dark mode safety), §9 (multi-theme).
 *
 * Fetches the active theme from /api/themes/active and injects tokens as CSS
 * custom properties: light values on :root, dark values on .dark. When a new
 * theme is activated (via the dashboard), a refresh() call re-fetches and
 * re-injects — the whole site re-themes without a rebuild.
 *
 * Named tokens with light+dark pairs ensure dark mode is never broken: every
 * color token has both values, and the cascade resolves correctly.
 */

import { createContext, useCallback, useContext, useEffect, useState, ReactNode } from "react";
import { api } from "@/lib/api";

interface ThemeToken {
  token_name: string;
  light_value: string;
  dark_value: string | null;
  category: string;
}

interface ThemeContextType {
  activeThemeId: number | null;
  activeThemeName: string | null;
  tokens: ThemeToken[];
  loading: boolean;
  refresh: () => Promise<void>;
}

const ThemeContext = createContext<ThemeContextType | null>(null);

function applyTokens(tokens: ThemeToken[]) {
  const root = document.documentElement;
  // Light values on :root
  for (const token of tokens) {
    root.style.setProperty(token.token_name, token.light_value);
  }
  // Dark values on .dark (via a <style> tag, since we can't set properties
  // on a class selector via inline styles)
  let darkCss = "";
  for (const token of tokens) {
    if (token.dark_value) {
      darkCss += `    ${token.token_name}: ${token.dark_value};\n`;
    }
  }
  let styleEl = document.getElementById("theme-dark-overrides");
  if (!styleEl) {
    styleEl = document.createElement("style");
    styleEl.id = "theme-dark-overrides";
    document.head.appendChild(styleEl);
  }
  styleEl.textContent = `.dark {\n${darkCss}}`;
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [activeThemeId, setActiveThemeId] = useState<number | null>(null);
  const [activeThemeName, setActiveThemeName] = useState<string | null>(null);
  const [tokens, setTokens] = useState<ThemeToken[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api.themes.active();
      setActiveThemeId(data.id);
      setActiveThemeName(data.name);
      setTokens(data.tokens);
      applyTokens(data.tokens);
    } catch {
      // Non-fatal — static CSS defaults remain
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <ThemeContext.Provider value={{ activeThemeId, activeThemeName, tokens, loading, refresh }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme must be used within ThemeProvider");
  return ctx;
}
