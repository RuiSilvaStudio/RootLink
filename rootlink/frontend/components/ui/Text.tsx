"use client";

/**
 * <Text> — the sanctioned way to render editable studio copy.
 *
 * Renders text from the i18n/copy system (t(key)) AND auto-marks the element
 * with `data-rl-text="key"` so the Content Studio's overlay knows:
 *   1. This text is EDITABLE (not a computed value like a count or price).
 *   2. Its copy key (for persisting edits via api.copy.set).
 *
 * Convention (docs/content-studio/CONTENT_STUDIO.md §3.2): editable copy =
 * keyed copy rendered via <Text>. Computed values (counts, prices, dates,
 * usernames) are rendered with plain {expr} — no <Text>, no data-rl-text, so
 * the overlay treats them as read-only.
 *
 * Usage:
 *   <Text k="home.hero_title" as="h1" className="text-4xl ..." />
 *   <Text k="home.hero_subtitle" as="p" className="..." />
 *   <Text k="donate.hero_title" as="h1">{props.title || t("donate.hero_title")}</Text>
 *
 * If children are provided, they override t(k) (lets block props override the
 * default copy). The data-rl-text attribute is always the key, regardless.
 */

import { createElement, ReactNode } from "react";
import { useLocale } from "@/lib/locale-context";

export interface TextProps {
  /** The copy key (e.g. "home.hero_title") — also the data-rl-text value. */
  k: string;
  /** HTML tag to render (h1, h2, p, span, a, button, label, etc.). */
  as?: "h1" | "h2" | "h3" | "h4" | "h5" | "h6" | "p" | "span" | "a" | "button" | "label" | "li" | "strong" | "em" | "small" | "code";
  /** Optional override content (e.g. block props). Falls back to t(k). */
  children?: ReactNode;
  className?: string;
  /** Fallback text when t(k) returns the raw key (no translation found). */
  defaultText?: string;
  [key: string]: any;
}

export function Text({ k, as = "span", children, className, defaultText, ...rest }: TextProps) {
  const { t } = useLocale();
  const translated = t(k);
  const fallback = defaultText !== undefined && translated === k ? defaultText : translated;
  return createElement(as, {
    "data-rl-text": k,
    className,
    ...rest,
  }, children ?? fallback);
}
