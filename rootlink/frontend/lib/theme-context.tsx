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
 * Also fetches active fonts from /api/fonts and injects their Google Fonts
 * URLs as <link> elements so fonts added through the font library actually
 * load on the live site.
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
  for (const token of tokens) {
    root.style.setProperty(token.token_name, token.light_value);
  }
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

function applyFonts(fonts: { name: string; url: string | null }[]) {
  // Idempotent: tag each injected link with data-rl-font so we can
  // skip already-loaded fonts and remove links for deactivated ones.
  const activeUrls = new Set(fonts.filter((f) => f.url).map((f) => f.url!));
  const existing = document.querySelectorAll<HTMLLinkElement>("link[data-rl-font]");
  existing.forEach((el) => {
    if (!activeUrls.has(el.href)) {
      el.remove();
    }
  });
  for (const font of fonts) {
    if (!font.url) continue;
    if (document.querySelector(`link[data-rl-font][href="${font.url}"]`)) continue;
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = font.url;
    link.setAttribute("data-rl-font", font.name);
    document.head.appendChild(link);
  }
}

export function ThemeProvider({ children }: { children: ReactNode }) {
  const [activeThemeId, setActiveThemeId] = useState<number | null>(null);
  const [activeThemeName, setActiveThemeName] = useState<string | null>(null);
  const [tokens, setTokens] = useState<ThemeToken[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const [themeData, fontData] = await Promise.all([
        api.themes.active(),
        api.fonts.list().catch(() => [] as { name: string; url: string | null }[]),
      ]);
      setActiveThemeId(themeData.id);
      setActiveThemeName(themeData.name);
      setTokens(themeData.tokens);
      applyTokens(themeData.tokens);
      applyFonts(fontData as { name: string; url: string | null }[]);
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
