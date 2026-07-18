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

import { createContext, useCallback, useContext, useState, ReactNode, useEffect, useRef } from "react";
import { useAuth } from "@/lib/auth-context";
import { api } from "@/lib/api";
import { fontFamilyCSS } from "./constrained-controls";

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
  // P2 polish
  /** Post overlay:redo to the iframe (Ctrl+Shift+Z / Ctrl+Y also work inside it). */
  redo: () => void;
  /** Transient status message ("Draft saved" / "Published" / "Draft discarded" /
   *  "Couldn't publish"); auto-clears after ~2.5s. The variant controls the
   *  chip color (emerald = success, rust = error). */
  statusFlash: { msg: string; variant: "success" | "error" } | null;
  /** A saved (unpublished) draft exists for this page and nothing is staged yet — offer to resume it. */
  resumableDraft: { count: number } | null;
  /** Load the saved draft into draftChanges and re-apply its style changes live in the iframe. */
  resumeDraft: () => Promise<void>;
  /** Hide the resume offer (the saved draft stays on the server untouched). */
  dismissResumable: () => void;
  /** Autosave state: "idle" = no changes / all synced, "saving" = write in
   *  progress, "saved" = server has the latest draft. The header shows this
   *  as a persistent indicator (Canva/Figma pattern). */
  saveState: "idle" | "saving" | "saved";
}

const OverlayContext = createContext<OverlayContextType | null>(null);

// Token NAME → the CSS the browser sees — same mapping as the inspector's
// handleChange and StyleOverrideApplier's tokenToCss. Used when re-applying a
// resumed draft's style changes (the draft stores only the token name).
// Font-family needs async resolution (font library) — handled separately.
const COLOR_PROPS = new Set(["color", "background-color", "border-color"]);
function tokenToCss(property: string, value: string): string {
  if (COLOR_PROPS.has(property)) return `var(--color-${value})`;
  if (property === "font-size") return `var(--text-${value})`;
  if (property === "padding" || property === "gap") return `calc(var(--spacing) * ${value})`;
  if (property === "border-radius") return `var(--radius-${value})`;
  return value;
}

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
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved">("idle");
  const lastSavedRef = useRef<DraftChange[]>([]);
  const autosaveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // The change awaiting prompt confirmation (held so confirm can apply it)
  const [, setPendingChange] = useState<DraftChange | null>(null);
  // P2 polish: transient status message + resumable saved draft.
  const [statusFlash, setStatusFlash] = useState<{ msg: string; variant: "success" | "error" } | null>(null);
  const [resumableDraft, setResumableDraft] = useState<{ count: number } | null>(null);
  // The saved draft's changes, held while the resume offer is showing.
  const savedDraftRef = useRef<DraftChange[] | null>(null);
  // Latest draftChanges/saveDraft for use inside the postMessage listener
  // without re-subscribing it on every change.
  const draftChangesRef = useRef<DraftChange[]>([]);
  const saveDraftRef = useRef<(() => Promise<void>) | null>(null);
  // One flash timer, replaced on each set.
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  /** Show a transient status message; auto-clears after ~2.5s. */
  const flash = useCallback((msg: string, variant: "success" | "error" = "success") => {
    setStatusFlash({ msg, variant });
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setStatusFlash(null), 2500);
  }, []);

  useEffect(() => {
    draftChangesRef.current = draftChanges;
  }, [draftChanges]);

  useEffect(() => () => {
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
  }, []);

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
    // Autosave covers refresh/exit — no need for a "discard?" confirm.
    setActive((prev) => {
      const next = !prev;
      if (!next) {
        setSelected(null);
        setDraftChanges([]);
        setPendingPrompt(null);
        setPreviewMode(false);
        setResumableDraft(null);
        savedDraftRef.current = null;
        lastSavedRef.current = [];
        setSaveState("idle");
      }
      return next;
    });
  }, [canEdit]);

  // NOTE: useDirtyGuard removed — autosave persists the draft continuously,
  // so refresh/tab-close never loses work. The old "Exit and discard?"
  // confirm is unnecessary (Canva/Figma/Gutenberg pattern).

  const select = useCallback((el: SelectedElement | null) => {
    setSelected(el);
  }, []);

  const pageSlug = iframeUrl ? new URL(iframeUrl).pathname.slice(1) || "home" : "home";

  // Page switch invalidates any resume offer (the agent re-injects on the new
  // page and re-triggers the saved-draft check for its slug).
  useEffect(() => {
    setResumableDraft(null);
    savedDraftRef.current = null;
  }, [pageSlug]);

  /** Apply a change (after prompt confirmed or no deviation).
   *  `value` is the theme token NAME (override identity — persisted in the
   *  draft + override log, dark-mode-safe, survives theme swaps). `appliedValue`
   *  is the CSS the browser actually sees (var(--color-...), a font-family
   *  string, var(--size-...)). Defaults to `value` when no translation needed. */
  const applyChange = useCallback((elementPath: string, property: string, value: string, oldValue: string, appliedValue?: string) => {
    const iframe = document.querySelector("iframe");
    if (iframe && iframe.contentWindow) {
      // Carry the element path so the agent targets the CORRECT element —
      // not whatever happens to be selected right now (BUG 10). The user can
      // change the selection between the deviation prompt and Confirm.
      iframe.contentWindow.postMessage({ type: "overlay:apply-style", path: elementPath, property, value, appliedValue }, "*");
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
   *  change AND the published override_logs row (un-publishes — BUG 2). */
  const resetProperty = useCallback((elementPath: string, property: string) => {
    const iframe = document.querySelector("iframe");
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({ type: "overlay:reset-property", property }, "*");
    }
    setDraftChanges((prev) => prev.filter(
      (c) => !(c.kind === "style" && c.elementPath === elementPath && c.property === property)
    ));
    // Un-publish: delete the published override_logs row so the reset persists
    // (previously the old override kept applying forever after reset+publish).
    api.overrides.removeByPath(pageSlug, elementPath, property).catch(() => {});
  }, [pageSlug]);

  /** Request a style change — the provider checks for deviation and prompts if needed. */
  const requestChange = useCallback((elementPath: string, property: string, oldValue: string, newValue: string, elementLabel: string, appliedValue?: string) => {
    const existing = draftChanges.find(
      (c) => c.kind === "style" && c.elementPath === elementPath && c.property === property
    );
    const originalDefault = existing ? existing.oldValue : oldValue;
    // Don't stage no-op changes: picking the already-active swatch shouldn't
    // count as "1 unsaved" (BUG 8). Only apply if the value actually changed.
    if (newValue === originalDefault) return;
    if (newValue !== originalDefault) {
      setPendingChange({ kind: "style", elementPath, property, value: newValue, oldValue: originalDefault });
      setPendingPrompt({ elementPath, property, oldValue: originalDefault, newValue, appliedValue, elementLabel });
    }
  }, [draftChanges]);

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
      } else if (e.data.type === "overlay:request-save") {
        // Ctrl/Cmd+S inside the iframe — save the draft (no-op when nothing
        // is unsaved; saveDraft already guards).
        void saveDraftRef.current?.();
      } else if (e.data.type === "overlay:undo-applied") {
        // The agent reverted a style change visually — drop the matching draft
        // entry so the "N unsaved" counter agrees with the page and Publish
        // doesn't re-apply the reverted change.
        const { path, property } = e.data as { path: string; property: string };
        setDraftChanges((prev) => prev.filter(
          (c) => !(c.kind === "style" && c.elementPath === path && c.property === property)
        ));
      } else if (e.data.type === "overlay:redo-applied") {
        // The agent re-applied a style change visually — re-add (or remove) the
        // matching draft entry to keep the counter in sync.
        const { path, property, value, oldValue } = e.data as { path: string; property: string; value: string | null; oldValue: string };
        setDraftChanges((prev) => {
          const filtered = prev.filter(
            (c) => !(c.kind === "style" && c.elementPath === path && c.property === property)
          );
          if (value !== null) {
            return [...filtered, { kind: "style" as const, elementPath: path, property, value, oldValue }];
          }
          return filtered;
        });
      } else if (e.data.type === "overlay:agent-ready") {
        // The agent just injected — check for a previously saved (unpublished)
        // draft for this page and offer to resume it, but only when nothing is
        // staged yet. Enhancement only: fetch failures are silent.
        api.drafts.get(pageSlug).then((draft) => {
          if (
            draft && draft.status === "draft" &&
            Array.isArray(draft.changes) && draft.changes.length > 0 &&
            draftChangesRef.current.length === 0
          ) {
            // Normalize snake_case keys from legacy drafts (BUG D) —
            // model_dump() used to store element_path/old_value/copy_key;
            // the frontend works with elementPath/oldValue/copyKey.
            const normalized = (draft.changes as Array<Record<string, unknown>>).map((c) => ({
              kind: (c.kind as "style" | "text") ?? "style",
              value: (c.value as string) ?? "",
              oldValue: (c.oldValue ?? c.old_value ?? "") as string,
              elementPath: (c.elementPath ?? c.element_path ?? "") as string,
              property: (c.property as string) ?? "",
              copyKey: (c.copyKey ?? c.copy_key ?? null) as string | null,
              locale: (c.locale as string) ?? null,
            })) as DraftChange[];
            savedDraftRef.current = normalized;
            setResumableDraft({ count: normalized.length });
          }
        }).catch(() => {});
      }
    };
    window.addEventListener("message", handler);
    return () => window.removeEventListener("message", handler);
  }, [active, select, pageSlug]);

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
    setSaveState("saving");
    try {
      await api.drafts.save({ page_slug: pageSlug, changes: draftChanges });
      lastSavedRef.current = [...draftChanges];
      setSaveState("saved");
      flash("Draft saved");
    } catch {
      setSaveState("idle");
      flash("Couldn't save — check connection and try again", "error");
    } finally {
      setDraftSaving(false);
    }
  }, [draftChanges, pageSlug, flash]);

  // ── Autosave (Canva/Figma/Gutenberg pattern) ──────────────────────────────
  // Every 2s of inactivity, persist the draft to the server so a refresh or
  // accidental close doesn't lose work. The draftChanges stay staged (the user
  // can keep editing); only the save-state indicator changes.
  useEffect(() => {
    if (!active || draftChanges.length === 0) return;
    // Skip if the current state matches the last saved state
    if (JSON.stringify(draftChanges) === JSON.stringify(lastSavedRef.current)) return;
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    autosaveTimerRef.current = setTimeout(() => {
      void saveDraftRef.current?.();
    }, 2000);
    return () => { if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current); };
  }, [active, draftChanges]);

  // Latest saveDraft for the postMessage/keydown/autosave listeners (no re-subscribe).
  useEffect(() => {
    saveDraftRef.current = saveDraft;
  }, [saveDraft]);

  // Ctrl/Cmd+S on the parent (focus may be in the inspector, not the iframe):
  // block the browser save dialog and save the draft. Active in edit mode only.
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "s") {
        e.preventDefault();
        void saveDraftRef.current?.();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [active]);

  const publishDraft = useCallback(async () => {
    setDraftSaving(true);
    try {
      await api.drafts.save({ page_slug: pageSlug, changes: draftChanges });
      await api.drafts.publish(pageSlug);
      let succeeded = 0;
      let failed = 0;
      for (const ch of draftChanges) {
        try {
          if (ch.kind === "text" && ch.copyKey && ch.locale) {
            await api.copy.set(ch.copyKey, ch.locale, ch.value);
            succeeded++;
          } else if (ch.kind === "style" && ch.elementPath && ch.property) {
            await api.overrides.log({
              page_slug: pageSlug,
              element_path: ch.elementPath,
              property: ch.property,
              old_value: ch.oldValue,
              new_value: ch.value,
            });
            succeeded++;
          }
        } catch {
          failed++;
        }
      }
      if (failed > 0) {
        flash(`${succeeded} of ${succeeded + failed} changes published — ${failed} failed. Check connection and try again.`, "error");
      } else {
        setDraftChanges([]);
        flash("Published");
      }
    } catch {
      flash("Couldn't publish — check connection and try again", "error");
    } finally {
      setDraftSaving(false);
    }
  }, [draftChanges, pageSlug, flash]);

  const discardDraft = useCallback(async () => {
    try {
      await api.drafts.discard(pageSlug);
    } catch {}
    setDraftChanges([]);
    setPendingPrompt(null);
    // The server draft is gone — any resume offer is now stale.
    setResumableDraft(null);
    savedDraftRef.current = null;
    flash("Draft discarded");
  }, [pageSlug, flash]);

  const clearDraftChanges = useCallback(() => {
    setDraftChanges([]);
    setPendingPrompt(null);
  }, []);

  /** Redo the last undone style change (posts overlay:redo to the iframe —
   *  Ctrl/Cmd+Shift+Z and Ctrl/Cmd+Y inside the iframe do the same). */
  const redo = useCallback(() => {
    const iframe = document.querySelector("iframe");
    if (iframe && iframe.contentWindow) {
      iframe.contentWindow.postMessage({ type: "overlay:redo" }, "*");
    }
  }, []);

  /** Resume the saved draft: load its changes into draftChanges and re-apply
   *  each STYLE change live in the iframe (path-targeted overlay:apply-style)
   *  AND each TEXT change to the DOM element (data-rl-text lookup). */
  const resumeDraft = useCallback(async () => {
    const changes = savedDraftRef.current;
    setResumableDraft(null);
    savedDraftRef.current = null;
    if (!changes || changes.length === 0) return;
    setDraftChanges(changes);
    lastSavedRef.current = [...changes];
    setSaveState("saved");
    const iframe = document.querySelector("iframe");
    const win = iframe?.contentWindow;
    if (!win) return;
    for (const ch of changes) {
      if (ch.kind === "style" && ch.elementPath && ch.property) {
        const appliedValue = ch.property === "font-family"
          ? (await fontFamilyCSS(ch.value)) ?? ch.value
          : tokenToCss(ch.property, ch.value);
        win.postMessage(
          { type: "overlay:apply-style", source: "resume", path: ch.elementPath, property: ch.property, value: ch.value, appliedValue },
          "*"
        );
      } else if (ch.kind === "text" && ch.copyKey && ch.value) {
        // Re-apply text change to the DOM element with this copy key (BUG T1:
        // saved text edits were invisible on resume).
        win.postMessage(
          { type: "overlay:apply-text", copyKey: ch.copyKey, text: ch.value },
          "*"
        );
      }
    }
  }, []);

  /** Hide the resume offer — the saved draft stays on the server untouched. */
  const dismissResumable = useCallback(() => {
    setResumableDraft(null);
    savedDraftRef.current = null;
  }, []);

  return (
    <OverlayContext.Provider
      value={{
        active, canEdit, toggle, selected, select, iframeUrl, setIframeUrl,
        draftChanges, pendingPrompt, requestChange,
        confirmOverride, cancelOverride, resetProperty,
        previewMode, setPreviewMode,
        saveDraft, publishDraft, discardDraft, clearDraftChanges, draftSaving, pageSlug,
        redo, statusFlash, resumableDraft, resumeDraft, dismissResumable, saveState,
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
