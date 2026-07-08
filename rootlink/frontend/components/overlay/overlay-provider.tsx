"use client";

/**
 * Content Studio — Visual Overlay Provider.
 *
 * Spec: docs/content-studio/CONTENT_STUDIO.md §3.2 (visual overlay).
 *
 * Manages the overlay's edit-mode state. When active (super_admin, desktop
 * only), the current page renders inside an iframe with a selection agent
 * injected, and the inspector panel docks beside it.
 *
 * The overlay replaces the old inline Content UI Editor
 * (components/editor-mode/) — same concept (edit on the live site) but
 * solves the click-conflict problem with an iframe (complete JS isolation
 * from the page's own handlers).
 */

import { createContext, useCallback, useContext, useState, ReactNode, useEffect } from "react";
import { useAuth } from "@/lib/auth-context";

export interface SelectedElement {
  /** A unique path describing the element's position in the DOM tree */
  path: string;
  /** The element's tag name (h1, div, button, etc.) */
  tagName: string;
  /** A human-readable label (derived from tag + class + text) */
  label: string;
  /** The computed styles snapshot (sent from the iframe's selection agent) */
  computedStyles: Record<string, string>;
  /** The breadcrumb hierarchy (array of {path, label} from root to this element) */
  hierarchy: { path: string; label: string; tagName: string }[];
}

interface OverlayContextType {
  /** Whether the overlay is active (edit mode on) */
  active: boolean;
  /** Whether the user is allowed to use the overlay (super_admin + desktop) */
  canEdit: boolean;
  /** Toggle the overlay on/off */
  toggle: () => void;
  /** The currently selected element (null = nothing selected) */
  selected: SelectedElement | null;
  /** Select an element (called from the iframe via postMessage) */
  select: (el: SelectedElement | null) => void;
  /** The URL currently loaded in the iframe */
  iframeUrl: string;
  /** Set the iframe URL (when entering edit mode on a page) */
  setIframeUrl: (url: string) => void;
}

const OverlayContext = createContext<OverlayContextType | null>(null);

export function OverlayProvider({ children }: { children: ReactNode }) {
  const { user, loading } = useAuth();
  const [active, setActive] = useState(false);
  const [selected, setSelected] = useState<SelectedElement | null>(null);
  const [iframeUrl, setIframeUrl] = useState("");
  const [isDesktop, setIsDesktop] = useState(true);

  // Detect mobile — overlay is desktop-only (mobile = preview, not editing)
  useEffect(() => {
    const checkDesktop = () => {
      setIsDesktop(window.matchMedia("(min-width: 1024px)").matches);
    };
    checkDesktop();
    window.matchMedia("(min-width: 1024px)").addEventListener("change", checkDesktop);
    return () => window.matchMedia("(min-width: 1024px)").removeEventListener("change", checkDesktop);
  }, []);

  // The rank-based super_admin check (mirrors StudioShell)
  const isSuperAdmin = !!user && (user.role === "super_admin" || (user.rank != null && user.rank >= 5));
  const canEdit = !loading && isSuperAdmin && isDesktop;

  // Deactivate if the user loses super_admin or switches to mobile
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
      if (!next) setSelected(null);
      return next;
    });
  }, [canEdit]);

  const select = useCallback((el: SelectedElement | null) => {
    setSelected(el);
  }, []);

  // Listen for postMessage from the iframe's selection agent
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

  return (
    <OverlayContext.Provider value={{ active, canEdit, toggle, selected, select, iframeUrl, setIframeUrl }}>
      {children}
    </OverlayContext.Provider>
  );
}

export function useOverlay() {
  const ctx = useContext(OverlayContext);
  if (!ctx) throw new Error("useOverlay must be used within OverlayProvider");
  return ctx;
}
