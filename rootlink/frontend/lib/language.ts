const LANGUAGE_FLAGS: Record<string, string> = {
  pt: "🇵🇹",
  en: "🇬🇧",
  es: "🇪🇸",
  fr: "🇫🇷",
  nl: "🇳🇱",
  it: "🇮🇹",
  de: "🇩🇪",
};

export function flagFor(code?: string | null): string | null {
  if (!code) return null;
  return LANGUAGE_FLAGS[code] ?? null;
}
