"use client";

/**
 * Content Studio — Overlay Shell (Phase 3).
 *
 * Spec: docs/content-studio/CONTENT_STUDIO.md §3.2, §6 (override guardrail),
 * §7 (draft→publish).
 *
 * Extended in Phase 3 with:
 *   - Override prompt (inline, not modal) when a change deviates from default
 *   - Draft controls (change count, save, publish, discard, preview-as-visitor)
 */

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { PenLine, Eye, X, ExternalLink, AlertTriangle, Check, Undo2, Save, Upload, Trash2 } from "lucide-react";
import { useOverlay } from "./overlay-provider";
import { InspectorPanel } from "./inspector-panel";
import { injectSelectionAgent } from "./selection-agent";

export function OverlayShell() {
  const {
    active, canEdit, toggle, iframeUrl, setIframeUrl,
    pendingPrompt, confirmOverride, cancelOverride,
    draftChanges, previewMode, setPreviewMode,
    saveDraft, publishDraft, discardDraft, draftSaving, pageSlug,
  } = useOverlay();
  const pathname = usePathname();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);

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

  useEffect(() => {
    if (!active || !iframeLoaded || !iframeRef.current) return;
    const iframe = iframeRef.current;
    try {
      const iframeWindow = iframe.contentWindow;
      if (!iframeWindow) return;
      const script = iframeWindow.document.createElement("script");
      script.textContent = `(${injectSelectionAgent.toString()})()`;
      iframeWindow.document.body.appendChild(script);
    } catch {}
  }, [active, iframeLoaded]);

  useEffect(() => {
    if (iframeRef.current && iframeUrl) {
      iframeRef.current.src = iframeUrl;
      setIframeLoaded(false);
    }
  }, [iframeUrl]);

  if (!canEdit || !active) return null;

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
          {/* Preview toggle */}
          <button
            onClick={() => setPreviewMode(!previewMode)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
              previewMode
                ? "bg-amber-600 text-white"
                : "text-stone-400 hover:text-stone-200 hover:bg-stone-800"
            }`}
            title="Preview as visitor"
          >
            <Eye className="w-3.5 h-3.5" /> {previewMode ? "Previewing" : "Preview"}
          </button>

          {/* Draft controls */}
          {draftChanges.length > 0 && (
            <>
              <span className="text-xs text-rust-400 font-medium">
                {draftChanges.length} unsaved
              </span>
              <button
                onClick={saveDraft}
                disabled={draftSaving}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-stone-300 hover:bg-stone-800 transition"
                title="Save draft"
              >
                <Save className="w-3.5 h-3.5" /> Save
              </button>
              <button
                onClick={publishDraft}
                disabled={draftSaving}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-primary-600 hover:bg-primary-700 text-cream transition disabled:opacity-50"
                title="Publish"
              >
                {draftSaving ? "..." : <Upload className="w-3.5 h-3.5" />} Publish
              </button>
              <button
                onClick={discardDraft}
                disabled={draftSaving}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-stone-400 hover:text-red-400 transition"
                title="Discard"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
          )}

          {iframeUrl && (
            <a href={iframeUrl} target="_blank" className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs text-stone-400 hover:text-stone-200 transition">
              <ExternalLink className="w-3.5 h-3.5" />
            </a>
          )}
        </div>
      </header>

      {/* ── Override prompt (inline, not modal) ────────── */}
      {pendingPrompt && (
        <div className="shrink-0 px-4 py-2.5 border-b border-rust-800 bg-rust-950/30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-stone-300">
            <AlertTriangle className="w-4 h-4 text-rust-400 shrink-0" />
            <span>
              This deviates from the default{" "}
              <code className="text-rust-300 font-mono">{pendingPrompt.property}</code>{" "}
              (was <code className="text-stone-400 font-mono">{pendingPrompt.oldValue}</code>).
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={cancelOverride}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition"
            >
              Cancel
            </button>
            <button
              onClick={confirmOverride}
              className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-rust-600 hover:bg-rust-700 text-cream transition"
            >
              <Check className="w-3.5 h-3.5" /> Confirm override
            </button>
          </div>
        </div>
      )}

      {/* ── Iframe + Inspector ──────────────────────────── */}
      <div className="flex-1 flex min-h-0">
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
          {/* Preview overlay — dims the iframe edge when previewing */}
          {previewMode && (
            <div className="absolute top-2 left-2 z-10 px-3 py-1.5 rounded-full bg-amber-600 text-white text-xs font-medium shadow-lg">
              Preview as visitor — draft changes hidden
            </div>
          )}
        </div>

        {/* Inspector panel */}
        <aside className="w-96 shrink-0 border-l border-stone-800 bg-stone-950 overflow-hidden flex flex-col">
          <InspectorPanel />
        </aside>
      </div>
    </div>
  );
}
