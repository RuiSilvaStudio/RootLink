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
  computedStyles: Record<string, string>;
  hierarchy: { path: string; label: string; tagName: string }[];
}

/** A single style change in the current draft. */
export interface DraftChange {
  elementPath: string;
  property: string;
  value: string;
  oldValue: string;
}

/** A pending override prompt (awaiting user confirm/cancel). */
export interface PendingPrompt {
  elementPath: string;
  property: string;
  oldValue: string;
  newValue: string;
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
  requestChange: (elementPath: string, property: string, oldValue: string, newValue: string, elementLabel: string) => void;
  confirmOverride: () => void;
  cancelOverride: () => void;
  previewMode: boolean;
  setPreviewMode: (v: boolean) => void;
  saveDraft: () => Promise<void>;
  publishDraft: () => Promise<void>;
  discardDraft: () => Promise<void>;
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
  const canEdit = !loading && isSuperAdmin && isDesktop;

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

  /** Apply a change (after prompt confirmed or no deviation). */
  const applyChange = useCallback((elementPath: string, property: string, value: string, oldValue: string) => {
    const iframe = document.querySelector("iframe");
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({ type: "overlay:apply-style", property, value }, "*");
    }
    setDraftChanges((prev) => {
      const filtered = prev.filter(
        (c) => !(c.elementPath === elementPath && c.property === property)
      );
      return [...filtered, { elementPath, property, value, oldValue }];
    });
    api.overrides.log({
      page_slug: pageSlug,
      element_path: elementPath,
      property,
      old_value: oldValue,
      new_value: value,
    }).catch(() => {});
  }, [pageSlug]);

  /** Request a style change — the provider checks for deviation and prompts if needed. */
  const requestChange = useCallback((elementPath: string, property: string, oldValue: string, newValue: string, elementLabel: string) => {
    const existing = draftChanges.find(
      (c) => c.elementPath === elementPath && c.property === property
    );
    const originalDefault = existing ? existing.oldValue : oldValue;
    if (newValue !== originalDefault) {
      setPendingChange({ elementPath, property, value: newValue, oldValue: originalDefault });
      setPendingPrompt({ elementPath, property, oldValue: originalDefault, newValue, elementLabel });
    } else {
      applyChange(elementPath, property, newValue, originalDefault);
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
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [active, select]);

  const confirmOverride = useCallback(() => {
    if (!pendingPrompt) return;
    applyChange(pendingPrompt.elementPath, pendingPrompt.property, pendingPrompt.newValue, pendingPrompt.oldValue);
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
    // Reload the iframe to revert visual changes
    setIframeUrl((url) => url);
    const iframe = document.querySelector("iframe");
    if (iframe) iframe.src = iframe.src;
  }, [pageSlug]);

  return (
    <OverlayContext.Provider
      value={{
        active, canEdit, toggle, selected, select, iframeUrl, setIframeUrl,
        draftChanges, pendingPrompt, requestChange,
        confirmOverride, cancelOverride,
        previewMode, setPreviewMode,
        saveDraft, publishDraft, discardDraft, draftSaving, pageSlug,
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
