"use client";

import { createContext, useContext, useEffect, useState, useCallback, ReactNode } from "react";

export type Locale = "pt" | "en";

const LOCALE_KEY = "rootlink_locale";
const FALLBACK_LOCALE: Locale = "pt";

type Messages = Record<string, string | Record<string, any>>;

type LocaleContextType = {
  locale: Locale;
  setLocale: (l: Locale) => void;
  t: (key: string, vars?: Record<string, string | number>) => string;
  loading: boolean;
};

const LocaleContext = createContext<LocaleContextType | null>(null);

async function loadMessages(locale: Locale): Promise<Messages> {
  try {
    const mod = await import(`@/messages/${locale}.json`);
    return mod.default || mod;
  } catch {
    return {};
  }
}

function flatten(obj: Messages, prefix = ""): Record<string, string> {
  let result: Record<string, string> = {};
  for (const [key, val] of Object.entries(obj)) {
    const k = prefix ? `${prefix}.${key}` : key;
    if (typeof val === "string") {
      result[k] = val;
    } else if (val && typeof val === "object") {
      result = { ...result, ...flatten(val as Messages, k) };
    }
  }
  return result;
}

function interpolate(tpl: string, vars?: Record<string, string | number>): string {
  if (!vars) return tpl;
  return tpl.replace(/\{(\w+)\}/g, (_, key) => {
    const val = vars[key];
    return val !== undefined ? String(val) : `{${key}}`;
  });
}

function detectBrowserLocale(): Locale {
  if (typeof navigator === "undefined") return FALLBACK_LOCALE;
  const lang = navigator.language || "";
  if (lang.startsWith("pt")) return "pt";
  return "en";
}

export function LocaleProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<Locale>(FALLBACK_LOCALE);
  const [messages, setMessages] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(LOCALE_KEY) as Locale | null;
    if (stored === "pt" || stored === "en") {
      setLocaleState(stored);
    } else {
      setLocaleState(detectBrowserLocale());
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    loadMessages(locale)
      .then((msgs) => {
        setMessages(flatten(msgs));
        localStorage.setItem(LOCALE_KEY, locale);
        document.documentElement.lang = locale;
      })
      .finally(() => setLoading(false));
  }, [locale]);

  const setLocale = useCallback((l: Locale) => {
    setLocaleState(l);
  }, []);

  const t = useCallback(
    (key: string, vars?: Record<string, string | number>): string => {
      const val = messages[key];
      if (val === undefined) return key;
      return interpolate(val, vars);
    },
    [messages]
  );

  return (
    <LocaleContext.Provider value={{ locale, setLocale, t, loading }}>
      {children}
    </LocaleContext.Provider>
  );
}

export function useLocale() {
  const ctx = useContext(LocaleContext);
  if (!ctx) throw new Error("useLocale must be used within LocaleProvider");
  return ctx;
}
