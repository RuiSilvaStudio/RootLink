"use client";

/**
 * Content Studio — Visual Overlay Provider (Phase 3).
 *
 * Spec: docs/content-studio/CONTENT_STUDIO.md §3.2, §6 (override guardrail),
 * §7 (draft→publish).
 *
 * Extended in Phase 3 with:
 *   - Draft change tracking (all changes to a page are one draft)
 *   - Override deviation detection + pending prompt state
 *   - Preview-as-visitor mode
 *   - Save/publish/discard actions
 */

import { createContext, useCallback, useContext, useState, ReactNode, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";

export interface SelectedElement {
  path: string;
  tagName: string;
  label: string;
  // The data-rl-component value of the selected element (null when the
  // selection fell back to a raw, untagged element). The inspector uses this
  // to fetch the element property schema.
  componentType?: string | null;
  computedStyles: Record<string, string>;
  hierarchy: { path: string; label: string; tagName: string }[];
  textContent?: string;
  // The theme token NAME currently applied per property (e.g. { color:
  // "primary-600" }) — read from data-rl-*-token attrs / Tailwind classes by
  // the agent. Lets the inspector highlight the active swatch without any
  // color-format comparison.
  appliedTokens?: Record<string, string>;
  // The block's text element (heading/paragraph/button), when it differs from
  // the block itself. The inspector's Text section (color/font/size) reads
  // from this; changes route to its path. Null when the block IS the text
  // element (Button/Badge) — then text props read from `selected`.
  textElement?: {
    path: string;
    tagName: string;
    appliedTokens: Record<string, string>;
    computedStyles: Record<string, string>;
    textContent: string;
    copyKey?: string | null;
  } | null;
  // The data-rl-text copy key of the block's text (present when the text is
  // editable studio copy; null for computed values like counts/prices/dates).
  copyKey?: string | null;
  // True when this element's text is being edited inline on the page.
  editing?: boolean;
}

/** A single change in the current draft — style override or text edit. */
export interface DraftChange {
  kind: "style" | "text";
  value: string;
  oldValue: string;
  /** style-kind fields */
  elementPath?: string;
  property?: string;
  /** text-kind fields */
  copyKey?: string;
  locale?: string;
}

/** A pending override prompt (awaiting user confirm/cancel). */
export interface PendingPrompt {
  elementPath: string;
  property: string;
  oldValue: string;
  newValue: string;
  appliedValue?: string;
  elementLabel: string;
}

interface OverlayContextType {
  active: boolean;
  canEdit: boolean;
  toggle: () => void;
  selected: SelectedElement | null;
  select: (el: SelectedElement | null) => void;
  iframeUrl: string;
  setIframeUrl: (url: string) => void;
  // Phase 3: draft + override
  draftChanges: DraftChange[];
  pendingPrompt: PendingPrompt | null;
  requestChange: (elementPath: string, property: string, oldValue: string, newValue: string, elementLabel: string, appliedValue?: string) => void;
  confirmOverride: () => void;
  cancelOverride: () => void;
  resetProperty: (elementPath: string, property: string) => void;
  previewMode: boolean;
  setPreviewMode: (v: boolean) => void;
  saveDraft: () => Promise<void>;
  publishDraft: () => Promise<void>;
  discardDraft: () => Promise<void>;
  clearDraftChanges: () => void;
  draftSaving: boolean;
  pageSlug: string;
}

const OverlayContext = createContext<OverlayContextType | null>(null);

export function OverlayProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [active, setActive] = useState(false);
  const [selected, setSelected] = useState<SelectedElement | null>(null);
  const [iframeUrl, setIframeUrl] = useState("");
  const [isDesktop, setIsDesktop] = useState(true);
  const [draftChanges, setDraftChanges] = useState<DraftChange[]>([]);
  const [pendingPrompt, setPendingPrompt] = useState<PendingPrompt | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [draftSaving, setDraftSaving] = useState(false);
  // The change awaiting prompt confirmation (held so confirm can apply it)
  const [, setPendingChange] = useState<DraftChange | null>(null);
  useEffect(() => {
    const checkDesktop = () => setIsDesktop(window.matchMedia("(min-width: 1024px)").matches);
    checkDesktop();
    window.matchMedia("(min-width: 1024px)").addEventListener("change", checkDesktop);
    return () => window.matchMedia("(min-width: 1024px)").removeEventListener("change", checkDesktop);
  }, []);

  const isSuperAdmin = !!user && (user.role === "super_admin" || (user.rank != null && user.rank >= 5));
  const isInIframe = typeof window !== "undefined" && window.top !== window.self;
  const canEdit = !loading && isSuperAdmin && isDesktop && !isInIframe;

  useEffect(() => {
    if (active && !canEdit) {
      setActive(false);
      setSelected(null);
    }
  }, [canEdit, active]);

  const toggle = useCallback(() => {
    if (!canEdit) return;
    setActive((prev) => {
      const next = !prev;
      if (!next) {
        setSelected(null);
        setDraftChanges([]);
        setPendingPrompt(null);
        setPreviewMode(false);
      }
      return next;
    });
  }, [canEdit]);

  const select = useCallback((el: SelectedElement | null) => {
    setSelected(el);
  }, []);

  const pageSlug = iframeUrl ? new URL(iframeUrl).pathname.slice(1) || "home" : "home";

  /** Apply a change (after prompt confirmed or no deviation).
   *  `value` is the theme token NAME (override identity — persisted in the
   *  draft + override log, dark-mode-safe, survives theme swaps). `appliedValue`
   *  is the CSS the browser actually sees (var(--color-...), a font-family
   *  string, var(--size-...)). Defaults to `value` when no translation needed. */
  const applyChange = useCallback((elementPath: string, property: string, value: string, oldValue: string, appliedValue?: string) => {
    const iframe = document.querySelector("iframe");
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({ type: "overlay:apply-style", property, value, appliedValue }, "*");
    }
    setDraftChanges((prev) => {
      const filtered = prev.filter(
        (c) => !(c.kind === "style" && c.elementPath === elementPath && c.property === property)
      );
      return [...filtered, { kind: "style", elementPath, property, value, oldValue }];
    });
  }, []);

  /** Reset a property to its theme default: remove the inline override so the
   *  element falls back to its Tailwind class. Removes the matching draft
   *  change. */
  const resetProperty = useCallback((elementPath: string, property: string) => {
    const iframe = document.querySelector("iframe");
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({ type: "overlay:reset-property", property }, "*");
    }
    setDraftChanges((prev) => prev.filter(
      (c) => !(c.kind === "style" && c.elementPath === elementPath && c.property === property)
    ));
  }, []);

  /** Request a style change — the provider checks for deviation and prompts if needed. */
  const requestChange = useCallback((elementPath: string, property: string, oldValue: string, newValue: string, elementLabel: string, appliedValue?: string) => {
    const existing = draftChanges.find(
      (c) => c.kind === "style" && c.elementPath === elementPath && c.property === property
    );
    const originalDefault = existing ? existing.oldValue : oldValue;
    if (newValue !== originalDefault) {
      setPendingChange({ kind: "style", elementPath, property, value: newValue, oldValue: originalDefault });
      setPendingPrompt({ elementPath, property, oldValue: originalDefault, newValue, appliedValue, elementLabel });
    } else {
      applyChange(elementPath, property, newValue, originalDefault, appliedValue);
    }
  }, [draftChanges, applyChange]);

  // Listen for postMessage from the iframe
  useEffect(() => {
    if (!active) return;
    const handler = (e: MessageEvent) => {
      if (!e.data || typeof e.data !== "object") return;
      if (e.data.type === "overlay:select") {
        select(e.data.element as SelectedElement);
      } else if (e.data.type === "overlay:deselect") {
        select(null);
      } else if (e.data.type === "overlay:text-change") {
        // Live text editing in the iframe — keep the panel's textContent in sync.
        setSelected((prev) => prev && prev.path === e.data.path ? { ...prev, textContent: e.data.text } : prev);
      } else if (e.data.type === "overlay:text-commit") {
        // Stage inline text edits as draft changes — NOT committed yet.
        // They go live only on Publish (matching how style overrides work).
        // Esc exits text editing and keeps the text in the draft.
        const { key, text, locale } = e.data;
        setDraftChanges((prev) => {
          const idx = prev.findIndex(
            (c) => c.kind === "text" && c.copyKey === key
          );
          if (idx >= 0) {
            const next = [...prev];
            next[idx] = { ...next[idx], value: text };
            return next;
          }
          return [...prev, { kind: "text", copyKey: key, locale, value: text, oldValue: "" }];
        });
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [active, select]);

  const confirmOverride = useCallback(() => {
    if (!pendingPrompt) return;
    applyChange(pendingPrompt.elementPath, pendingPrompt.property, pendingPrompt.newValue, pendingPrompt.oldValue, pendingPrompt.appliedValue);
    setPendingPrompt(null);
    setPendingChange(null);
  }, [pendingPrompt, applyChange]);

  const cancelOverride = useCallback(() => {
    // Don't apply the change — the iframe keeps the pre-change value
    setPendingPrompt(null);
    setPendingChange(null);
  }, []);

  const saveDraft = useCallback(async () => {
    if (draftChanges.length === 0) return;
    setDraftSaving(true);
    try {
      await api.drafts.save({ page_slug: pageSlug, changes: draftChanges });
    } finally {
      setDraftSaving(false);
    }
  }, [draftChanges, pageSlug]);

  const publishDraft = useCallback(async () => {
    setDraftSaving(true);
    try {
      await api.drafts.save({ page_slug: pageSlug, changes: draftChanges });
      await api.drafts.publish(pageSlug);
      for (const ch of draftChanges) {
        if (ch.kind === "text" && ch.copyKey && ch.locale) {
          await api.copy.set(ch.copyKey, ch.locale, ch.value).catch(() => {});
        } else if (ch.kind === "style" && ch.elementPath && ch.property) {
          await api.overrides.log({
            page_slug: pageSlug,
            element_path: ch.elementPath,
            property: ch.property,
            old_value: ch.oldValue,
            new_value: ch.value,
          }).catch(() => {});
        }
      }
      setDraftChanges([]);
    } finally {
      setDraftSaving(false);
    }
  }, [draftChanges, pageSlug]);

  const discardDraft = useCallback(async () => {
    try {
      await api.drafts.discard(pageSlug);
    } catch {}
    setDraftChanges([]);
    setPendingPrompt(null);
  }, [pageSlug]);

  const clearDraftChanges = useCallback(() => {
    setDraftChanges([]);
    setPendingPrompt(null);
  }, []);

  return (
    <OverlayContext.Provider
      value={{
        active, canEdit, toggle, selected, select, iframeUrl, setIframeUrl,
        draftChanges, pendingPrompt, requestChange,
        confirmOverride, cancelOverride, resetProperty,
        previewMode, setPreviewMode,
        saveDraft, publishDraft, discardDraft, clearDraftChanges, draftSaving, pageSlug,
      }}
    >
      {children}
    </OverlayContext.Provider>
  );
}

export function useOverlay() {
  const ctx = useContext(OverlayContext);
  if (!ctx) throw new Error("useOverlay must be used within OverlayProvider");
  return ctx;
}
