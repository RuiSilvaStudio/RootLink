"use client";

/**
 * Content UI Editor — core state provider.
 *
 * See discovery/mockups/content-ui-editor/briefing-to-build-local.md for the
 * full design. Summary of the model implemented here:
 *
 *  - Gated on `user.role === "super_admin"` only (strict, no `can_edit_copy`
 *    delegation) — mirrors the `isStaff` idiom in components/nav/NavBar.tsx.
 *  - Edits are held as local "drafts" (per element key) until the user
 *    explicitly clicks "Save changes" — NOT committed on every blur. This
 *    keeps the blast radius of a live-site edit deliberate.
 *  - "Reset page" discards drafts for the page currently being viewed.
 *    Leaving the page (via any <a>/<Link> click or refresh) with unsaved
 *    drafts triggers a confirm via the existing `useDirtyGuard` hook
 *    (lib/use-dirty-guard.ts) — the same guard already used elsewhere in the
 *    app for unsaved-change protection.
 *  - Text drafts are saved through the existing `/api/copy` endpoints
 *    (unchanged, already production-tested). Image/icon drafts are saved
 *    through the new `/api/content-ui` endpoints.
 */

import { createContext, useCallback, useContext, useMemo, useRef, useState, ReactNode } from "react";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/lib/locale-context";
import { useToast } from "@/lib/toast-context";
import { useDirtyGuard } from "@/lib/use-dirty-guard";
import { api } from "@/lib/api";

export type EditorMode = "preview" | "editor";
export type ImageValue = { url: string; alt: string };

interface EditorModeContextType {
  mode: EditorMode;
  isSuperAdmin: boolean;
  toggleMode: () => void;

  // Drafts (unsaved, in-memory only) — take priority over committed values.
  textDrafts: Record<string, string>;
  imageDrafts: Record<string, ImageValue>;
  iconDrafts: Record<string, string>;
  setTextDraft: (key: string, value: string) => void;
  setImageDraft: (key: string, value: ImageValue) => void;
  setIconDraft: (key: string, iconId: string) => void;

  // Committed overrides — the session's local record of the last known-good
  // saved (or reverted) value for a key, so the UI reflects a save/revert
  // immediately without waiting on a refetch of `t()`'s static+override cache.
  committedText: Record<string, string>;
  committedImages: Record<string, ImageValue>;
  committedIcons: Record<string, string>;

  // Revert a single element to its static default (immediate, no confirm —
  // it's a targeted action on one element, not a bulk one). `fallbackText` is
  // used for `text` keys that aren't real static i18n keys (e.g. per-family
  // generated copy) and so have no entry in messages/{locale}.json.
  revertElement: (key: string, type: "text" | "image" | "icon", fallbackText?: string) => Promise<void>;

  dirtyCount: number;
  saving: boolean;
  saveChanges: () => Promise<void>;
  resetPage: () => void;

  // The element currently focused for editing (drives the floating context label).
  activeKey: string | null;
  setActiveKey: (key: string | null) => void;
}

const EditorModeContext = createContext<EditorModeContextType | null>(null);

async function loadStaticDefault(locale: string, key: string): Promise<string | undefined> {
  try {
    const mod = await import(`@/messages/${locale}.json`);
    const messages = mod.default || mod;
    const parts = key.split(".");
    let node: any = messages;
    for (const p of parts) {
      if (node == null) return undefined;
      node = node[p];
    }
    return typeof node === "string" ? node : undefined;
  } catch {
    return undefined;
  }
}

export function EditorModeProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading } = useAuth();
  const { locale, t } = useLocale();
  const { addToast } = useToast();

  const isSuperAdmin = !authLoading && !!user && user.role === "super_admin";

  const [mode, setMode] = useState<EditorMode>("preview");
  const [textDrafts, setTextDrafts] = useState<Record<string, string>>({});
  const [imageDrafts, setImageDrafts] = useState<Record<string, ImageValue>>({});
  const [iconDrafts, setIconDrafts] = useState<Record<string, string>>({});
  const [committedText, setCommittedText] = useState<Record<string, string>>({});
  const [committedImages, setCommittedImages] = useState<Record<string, ImageValue>>({});
  const [committedIcons, setCommittedIcons] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [activeKey, setActiveKey] = useState<string | null>(null);
  const fetchedOverrides = useRef(false);

  const dirtyCount = Object.keys(textDrafts).length + Object.keys(imageDrafts).length + Object.keys(iconDrafts).length;

  const discardAllDrafts = useCallback(() => {
    setTextDrafts({});
    setImageDrafts({});
    setIconDrafts({});
    setActiveKey(null);
  }, []);

  // Leaving the page (in-app link click) with unsaved drafts: browser confirm
  // is the only option here (see lib/use-dirty-guard.ts for why a custom
  // 3-button dialog isn't used) — the message tells the user to press Cancel
  // to go back and save instead. Confirming ("OK") discards the drafts.
  useDirtyGuard(isSuperAdmin && dirtyCount > 0, {
    message: t("editor.leave_confirm"),
    onConfirmedLeave: discardAllDrafts,
  });

  const fetchOverrides = useCallback(async () => {
    if (fetchedOverrides.current) return;
    fetchedOverrides.current = true;
    try {
      const [overrides, textOverrides] = await Promise.all([
        api.contentUi.get(),
        // Text overrides are already merged into t()'s own cache (so visitors
        // see saved copy without this), but committedText also drives
        // EditableText's per-element "revert to default" affordance — that
        // needs its own fetch on entering editor mode, same as images/icons,
        // otherwise it only reflects the current session's own edits and
        // goes stale (shows no revert option) after any page reload.
        api.copy.get(locale),
      ]);
      const images: Record<string, ImageValue> = {};
      const icons: Record<string, string> = {};
      for (const [key, entry] of Object.entries(overrides)) {
        if (entry.kind === "image") images[key] = entry.value;
        if (entry.kind === "icon") icons[key] = entry.value?.iconId;
      }
      setCommittedImages(images);
      setCommittedIcons(icons);
      setCommittedText((prev) => ({ ...textOverrides, ...prev }));
    } catch {
      // Non-fatal — editable elements just fall back to their defaults.
    }
  }, [locale]);

  const toggleMode = useCallback(() => {
    if (!isSuperAdmin) return;
    const next: EditorMode = mode === "preview" ? "editor" : "preview";
    setMode(next);
    if (next === "editor") {
      fetchOverrides();
      addToast("info", "Editor mode active — click any text, image, or icon to edit");
    } else {
      setActiveKey(null);
      addToast("info", dirtyCount > 0 ? `${dirtyCount} unsaved change${dirtyCount !== 1 ? "s" : ""} — remember to save` : "Viewing site as visitors see it");
    }
  }, [isSuperAdmin, mode, fetchOverrides, addToast, dirtyCount]);

  const setTextDraft = useCallback((key: string, value: string) => {
    setTextDrafts((prev) => ({ ...prev, [key]: value }));
  }, []);
  const setImageDraft = useCallback((key: string, value: ImageValue) => {
    setImageDrafts((prev) => ({ ...prev, [key]: value }));
  }, []);
  const setIconDraft = useCallback((key: string, iconId: string) => {
    setIconDrafts((prev) => ({ ...prev, [key]: iconId }));
  }, []);

  const resetPage = useCallback(() => {
    if (!window.confirm(t("editor.reset_confirm"))) return;
    discardAllDrafts();
    addToast("info", "Changes discarded for this page");
  }, [t, discardAllDrafts, addToast]);

  const saveChanges = useCallback(async () => {
    if (dirtyCount === 0) return;
    setSaving(true);
    try {
      await Promise.all([
        ...Object.entries(textDrafts).map(([key, value]) => api.copy.set(key, locale, value)),
        ...Object.entries(imageDrafts).map(([key, value]) => api.contentUi.setImage(key, value)),
        ...Object.entries(iconDrafts).map(([key, iconId]) => api.contentUi.setIcon(key, iconId)),
      ]);
      // Fold saved drafts into committed state so they keep displaying
      // correctly without needing a refetch/refresh (t()'s static+override
      // cache is only fetched once on locale load, not after every save).
      setCommittedText((prev) => ({ ...prev, ...textDrafts }));
      setCommittedImages((prev) => ({ ...prev, ...imageDrafts }));
      setCommittedIcons((prev) => ({ ...prev, ...iconDrafts }));
      const count = dirtyCount;
      setTextDrafts({});
      setImageDrafts({});
      setIconDrafts({});
      addToast("success", `${count} change${count !== 1 ? "s" : ""} saved`);
    } catch (e: any) {
      addToast("error", e?.message || "Failed to save changes");
    } finally {
      setSaving(false);
    }
  }, [dirtyCount, textDrafts, imageDrafts, iconDrafts, locale, addToast]);

  const revertElement = useCallback(
    async (key: string, type: "text" | "image" | "icon", fallbackText?: string) => {
      try {
        if (type === "text") {
          await api.copy.revert(key, locale);
          const staticDefault = (await loadStaticDefault(locale, key)) ?? fallbackText ?? key;
          setCommittedText((prev) => ({ ...prev, [key]: staticDefault }));
          setTextDrafts((prev) => {
            const next = { ...prev };
            delete next[key];
            return next;
          });
        } else {
          await api.contentUi.revert(key);
          if (type === "image") {
            setCommittedImages((prev) => {
              const next = { ...prev };
              delete next[key];
              return next;
            });
            setImageDrafts((prev) => {
              const next = { ...prev };
              delete next[key];
              return next;
            });
          } else {
            setCommittedIcons((prev) => {
              const next = { ...prev };
              delete next[key];
              return next;
            });
            setIconDrafts((prev) => {
              const next = { ...prev };
              delete next[key];
              return next;
            });
          }
        }
        addToast("info", "Reverted to default");
      } catch (e: any) {
        addToast("error", e?.message || "Revert failed");
      }
    },
    [locale, addToast]
  );

  const value = useMemo<EditorModeContextType>(
    () => ({
      mode,
      isSuperAdmin,
      toggleMode,
      textDrafts,
      imageDrafts,
      iconDrafts,
      setTextDraft,
      setImageDraft,
      setIconDraft,
      committedText,
      committedImages,
      committedIcons,
      revertElement,
      dirtyCount,
      saving,
      saveChanges,
      resetPage,
      activeKey,
      setActiveKey,
    }),
    [
      mode, isSuperAdmin, toggleMode, textDrafts, imageDrafts, iconDrafts,
      setTextDraft, setImageDraft, setIconDraft, committedText, committedImages, committedIcons,
      revertElement, dirtyCount, saving, saveChanges, resetPage, activeKey,
    ]
  );

  return <EditorModeContext.Provider value={value}>{children}</EditorModeContext.Provider>;
}

export function useEditorMode() {
  const ctx = useContext(EditorModeContext);
  if (!ctx) throw new Error("useEditorMode must be used within EditorModeProvider");
  return ctx;
}
