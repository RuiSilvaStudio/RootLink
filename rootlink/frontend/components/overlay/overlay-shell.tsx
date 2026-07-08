"use client";

/**
 * Content Studio — Overlay Shell.
 *
 * Spec: docs/content-studio/CONTENT_STUDIO.md §3.2 (visual overlay).
 *
 * When edit mode is active (super_admin + desktop), this component:
 *   1. Renders the current page URL inside an iframe (complete JS isolation).
 *   2. Injects the selection agent into the iframe after load.
 *   3. Docks the inspector panel on the right.
 *   4. Shows a slim top bar with the edit/preview toggle + exit button.
 *
 * When NOT active, renders nothing — zero overhead for regular visitors.
 */

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { PenLine, Eye, X, ExternalLink } from "lucide-react";
import { useOverlay } from "./overlay-provider";
import { InspectorPanel } from "./inspector-panel";
import { injectSelectionAgent } from "./selection-agent";

export function OverlayShell() {
  const { active, canEdit, toggle, iframeUrl, setIframeUrl } = useOverlay();
  const pathname = usePathname();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);

  // Set the iframe URL when entering edit mode (use the current pathname)
  useEffect(() => {
    if (active && !iframeUrl) {
      const base = window.location.origin;
      setIframeUrl(base + pathname);
    }
    if (!active) {
      setIframeUrl("");
      setIframeLoaded(false);
    }
  }, [active, pathname, iframeUrl, setIframeUrl]);

  // Inject the selection agent into the iframe after it loads
  useEffect(() => {
    if (!active || !iframeLoaded || !iframeRef.current) return;
    const iframe = iframeRef.current;
    try {
      const iframeWindow = iframe.contentWindow;
      if (!iframeWindow) return;
      // Inject the selection agent script into the iframe
      const script = iframeWindow.document.createElement("script");
      script.textContent = `(${injectSelectionAgent.toString()})()`;
      iframeWindow.document.body.appendChild(script);
    } catch {
      // Cross-origin — can't inject (shouldn't happen since same-origin)
    }
  }, [active, iframeLoaded]);

  // Reload the iframe when the URL changes
  useEffect(() => {
    if (iframeRef.current && iframeUrl) {
      iframeRef.current.src = iframeUrl;
      setIframeLoaded(false);
    }
  }, [iframeUrl]);

  if (!canEdit) return null;
  if (!active) return null;

  return (
    <div className="fixed inset-0 z-[9999] flex flex-col bg-stone-950">
      {/* ── Top bar ─────────────────────────────────────── */}
      <header className="h-12 shrink-0 flex items-center justify-between px-4 border-b border-stone-800 bg-stone-950">
        <div className="flex items-center gap-3">
          <button
            onClick={toggle}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-stone-300 hover:bg-stone-800 transition"
          >
            <X className="w-3.5 h-3.5" /> Exit
          </button>
          <span className="font-display text-sm font-semibold text-primary-300">
            Content Studio — Edit Mode
          </span>
        </div>
        <div className="flex items-center gap-2">
          {iframeUrl && (
            <a
              href={iframeUrl}
              target="_blank"
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-stone-400 hover:text-stone-200 transition"
            >
              <ExternalLink className="w-3.5 h-3.5" /> Open in new tab
            </a>
          )}
        </div>
      </header>

      {/* ── Iframe + Inspector ──────────────────────────── */}
      <div className="flex-1 flex min-h-0">
        {/* Iframe — the real page */}
        <div className="flex-1 relative bg-white">
          {iframeUrl && (
            <iframe
              ref={iframeRef}
              onLoad={() => setIframeLoaded(true)}
              className="w-full h-full border-0"
              title="Content Studio Preview"
            />
          )}
          {!iframeLoaded && (
            <div className="absolute inset-0 flex items-center justify-center bg-stone-100">
              <div className="animate-pulse-soft text-stone-400 font-serif">Loading page…</div>
            </div>
          )}
        </div>

        {/* Inspector panel — docked on the right */}
        <aside className="w-96 shrink-0 border-l border-stone-800 bg-stone-950 overflow-hidden flex flex-col">
          <InspectorPanel />
        </aside>
      </div>
    </div>
  );
}
