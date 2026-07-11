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
import { PenLine, Eye, X, AlertTriangle, Check, Undo2, Save, Upload, Trash2, ChevronDown, FileText } from "lucide-react";
import { useOverlay } from "./overlay-provider";
import { InspectorPanel } from "./inspector-panel";
import { injectSelectionAgent } from "./selection-agent";
import { api } from "@/lib/api";

export function OverlayShell() {
  const {
    active, canEdit, toggle, iframeUrl, setIframeUrl,
    pendingPrompt, confirmOverride, cancelOverride,
    draftChanges, saveDraft, publishDraft, discardDraft, clearDraftChanges, draftSaving, pageSlug,
    previewMode, setPreviewMode,
  } = useOverlay();
  const pathname = usePathname();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [agentReady, setAgentReady] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [pages, setPages] = useState<{ slug: string; label: string }[]>([]);
  const [pageMenuOpen, setPageMenuOpen] = useState(false);
  const pageMenuRef = useRef<HTMLDivElement>(null);

  // Prevent the page behind the overlay from scrolling.
  useEffect(() => {
    if (!canEdit || !active) return;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = ""; };
  }, [canEdit, active]);

  // Fetch available pages on mount.
  useEffect(() => {
    api.blocks.listPages().then(setPages).catch(() => {});
  }, []);

  // Close page menu on outside click.
  useEffect(() => {
    if (!pageMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (pageMenuRef.current && !pageMenuRef.current.contains(e.target as Node)) setPageMenuOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [pageMenuOpen]);

  // Switch to a different page. Warns if unsaved changes exist.
  const switchPage = (slug: string) => {
    setPageMenuOpen(false);
    if (slug === pageSlug) return;
    if (draftChanges.length > 0) {
      if (!window.confirm(`You have ${draftChanges.length} unsaved change${draftChanges.length !== 1 ? "s" : ""} on this page. Switching will discard them. Continue?`)) return;
      clearDraftChanges();
    }
    if (previewMode) setPreviewMode(false);
    setIframeUrl(`${window.location.origin}/${slug === "home" ? "" : slug}`);
  };

  // Discard: clear state + force iframe remount so the agent re-injects.
  const handleDiscard = () => {
    discardDraft();
    setReloadKey((k) => k + 1);
    setAgentReady(false);
    setIframeLoaded(false);
  };

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

  // Inject the selection agent after the iframe loads + a short settling
  // delay (lets the page's own JS — framer-motion, HeroParticleCanvas, etc.
  // — finish reading layout, so the agent doesn't cause "layout forced"
  // warnings by reading getBoundingClientRect too early).
  useEffect(() => {
    if (!active || !iframeLoaded || !iframeRef.current || previewMode) return;
    const timer = setTimeout(() => {
      const iframe = iframeRef.current;
      if (!iframe) return;
      try {
        const iframeWindow = iframe.contentWindow;
        if (!iframeWindow) return;
        const script = iframeWindow.document.createElement("script");
        script.textContent = `(${injectSelectionAgent.toString()})()`;
        iframeWindow.document.body.appendChild(script);
        setAgentReady(true);
      } catch {}
    }, 600);
    return () => clearTimeout(timer);
  }, [active, iframeLoaded, previewMode]);

  useEffect(() => {
    if (iframeRef.current && iframeUrl) {
      iframeRef.current.src = iframeUrl;
      setIframeLoaded(false);
      setAgentReady(false);
    }
  }, [iframeUrl, reloadKey]);

  // Reload iframe when toggling preview mode — clears/re-applies draft changes
  useEffect(() => {
    if (!active || !iframeRef.current) return;
    iframeRef.current.src = iframeUrl;
    setIframeLoaded(false);
    setAgentReady(false);
  }, [previewMode, active, iframeUrl]);

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
          {/* Page navigation dropdown */}
          {pages.length > 0 && (
            <div ref={pageMenuRef} className="relative">
              <button
                onClick={() => setPageMenuOpen((o) => !o)}
                disabled={draftSaving}
                className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-stone-300 hover:bg-stone-800 transition disabled:opacity-50"
                title="Switch page"
              >
                <FileText className="w-3.5 h-3.5" />
                {pages.find((p) => p.slug === pageSlug)?.label || pageSlug}
                <ChevronDown className="w-3.5 h-3.5 text-stone-500" />
              </button>
              {pageMenuOpen && (
                <div className="absolute top-full left-0 mt-1 w-48 max-h-80 overflow-y-auto rounded-lg border border-stone-800 bg-stone-900 shadow-lg z-50">
                  {pages.map((p) => (
                    <button
                      key={p.slug}
                      onClick={() => switchPage(p.slug)}
                      className={`w-full text-left px-3 py-2 text-sm transition flex items-center gap-2 ${
                        p.slug === pageSlug
                          ? "bg-primary-600 text-cream"
                          : "text-stone-200 hover:bg-stone-800"
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Preview toggle — shows the published version (draft changes hidden) */}
          <button
            onClick={() => setPreviewMode(!previewMode)}
            className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition ${
              previewMode
                ? "bg-amber-600 text-white"
                : "text-stone-400 hover:text-stone-200 hover:bg-stone-800"
            }`}
            title={previewMode ? "Exit preview" : "Preview as visitor"}
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
                onClick={handleDiscard}
                disabled={draftSaving}
                className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-stone-400 hover:text-red-400 transition"
                title="Discard"
              >
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </>
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
              key={reloadKey}
              ref={iframeRef}
              onLoad={() => setIframeLoaded(true)}
              className="w-full h-full border-0"
              title="Content Studio Preview"
            />
          )}
          {previewMode && (
            <div className="absolute top-2 left-2 z-10 px-3 py-1.5 rounded-full bg-amber-600 text-white text-xs font-medium shadow-lg">
              Preview as visitor — draft changes hidden
            </div>
          )}
          {!previewMode && !agentReady && (
            <div className="absolute inset-0 flex items-center justify-center bg-stone-100 z-10">
              <div className="flex flex-col items-center gap-3">
                <div className="w-6 h-6 border-2 border-stone-300 border-t-primary-500 rounded-full animate-spin" />
                <div className="text-sm text-stone-400 font-serif">
                  {iframeLoaded ? "Preparing editor…" : "Loading page…"}
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Inspector panel — hidden in preview mode */}
        {!previewMode && (
          <aside className="w-96 shrink-0 border-l border-stone-800 bg-stone-950 overflow-hidden flex flex-col">
            <InspectorPanel />
          </aside>
        )}
      </div>
    </div>
  );
}
