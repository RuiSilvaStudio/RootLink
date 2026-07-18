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

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { PenLine, Eye, X, AlertTriangle, Check, Undo2, Save, Upload, Trash2, ChevronDown, FileText, History } from "lucide-react";
import { useOverlay } from "./overlay-provider";
import { Tooltip } from "@/components/ui/Tooltip";
import { BrandIcon } from "@/components/ui/BrandIcon";
import { InspectorPanel } from "./inspector-panel";
import { injectSelectionAgent } from "./selection-agent";
import { api } from "@/lib/api";

export function OverlayShell() {
  const {
    active, canEdit, toggle, iframeUrl, setIframeUrl,
    pendingPrompt, confirmOverride, cancelOverride,
    draftChanges, saveDraft, publishDraft, discardDraft, clearDraftChanges, draftSaving, pageSlug,
    previewMode, setPreviewMode,
    statusFlash, resumableDraft, resumeDraft, dismissResumable, saveState,
  } = useOverlay();
  const pathname = usePathname();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [agentReady, setAgentReady] = useState(false);
  const [iframeError, setIframeError] = useState(false);
  const [reloadKey, setReloadKey] = useState(0);
  const [pages, setPages] = useState<{ slug: string; label: string }[]>([]);
  const [pageMenuOpen, setPageMenuOpen] = useState(false);
  const [pageActiveIndex, setPageActiveIndex] = useState(-1);
  const pageMenuRef = useRef<HTMLDivElement>(null);
  // Inspector dock width — resizable via the left-edge handle (task: 320–560px,
  // persisted). Read from localStorage on mount (SSR-safe: effect only).
  const [inspectorWidth, setInspectorWidth] = useState(384);
  const [inspectorDragging, setInspectorDragging] = useState(false);
  const inspectorDragRef = useRef({ dragging: false, x: 0, w: 0 });
  // The locale inline text edits commit to — same read as the selection
  // agent (localStorage.rootlink_locale, default "pt"). Indicator only.
  const [editLocale, setEditLocale] = useState("pt");

  // Re-read the editing locale each time edit mode activates (the user may
  // have switched the site language since the last session).
  useEffect(() => {
    if (!active) return;
    setEditLocale(localStorage.getItem("rootlink_locale") || "pt");
  }, [active]);

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

  // When the page menu opens, start keyboard navigation on the current page.
  useEffect(() => {
    if (pageMenuOpen) setPageActiveIndex(Math.max(0, pages.findIndex((p) => p.slug === pageSlug)));
  }, [pageMenuOpen, pages, pageSlug]);

  // Inspector width: restore the persisted value once on mount (clamped).
  useEffect(() => {
    const stored = window.localStorage.getItem("rl-inspector-width");
    if (!stored) return;
    const n = parseInt(stored, 10);
    if (!Number.isNaN(n)) setInspectorWidth(Math.min(560, Math.max(320, n)));
  }, []);

  /** Clamp to 320–560px, apply, persist. */
  const applyInspectorWidth = useCallback((w: number) => {
    const clamped = Math.min(560, Math.max(320, Math.round(w)));
    setInspectorWidth(clamped);
    try { window.localStorage.setItem("rl-inspector-width", String(clamped)); } catch {}
  }, []);

  // Drag via pointer capture (document-level listeners would lose the pointer
  // over the iframe; capture keeps events routed to the handle).
  const onHandlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    inspectorDragRef.current = { dragging: true, x: e.clientX, w: inspectorWidth };
    setInspectorDragging(true);
  };
  const onHandlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!inspectorDragRef.current.dragging) return;
    // Handle sits on the dock's LEFT edge — dragging left widens the inspector.
    applyInspectorWidth(inspectorDragRef.current.w + (inspectorDragRef.current.x - e.clientX));
  };
  const onHandlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!inspectorDragRef.current.dragging) return;
    inspectorDragRef.current.dragging = false;
    setInspectorDragging(false);
    try { e.currentTarget.releasePointerCapture(e.pointerId); } catch {}
  };
  const onHandleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (e.key === "ArrowLeft") {
      e.preventDefault();
      applyInspectorWidth(inspectorWidth + 16);
    } else if (e.key === "ArrowRight") {
      e.preventDefault();
      applyInspectorWidth(inspectorWidth - 16);
    } else if (e.key === "Enter") {
      e.preventDefault();
      applyInspectorWidth(384);
    }
  };

  // Keyboard navigation for the page dropdown (fires only while the menu is
  // open; focus stays on the trigger inside this container).
  const onPageMenuKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    if (!pageMenuOpen || pages.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setPageActiveIndex((i) => Math.min(pages.length - 1, i + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setPageActiveIndex((i) => Math.max(0, i - 1));
    } else if (e.key === "Home") {
      e.preventDefault();
      setPageActiveIndex(0);
    } else if (e.key === "End") {
      e.preventDefault();
      setPageActiveIndex(pages.length - 1);
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (pageActiveIndex >= 0 && pageActiveIndex < pages.length) switchPage(pages[pageActiveIndex].slug);
    } else if (e.key === "Escape") {
      // Close ONLY the menu — this is the parent document, not the iframe.
      e.preventDefault();
      e.stopPropagation();
      setPageMenuOpen(false);
    }
  };

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

  // Discard: confirm, then clear state + force iframe remount so the agent
  // re-injects. Discarding throws away the whole page draft — irreversible.
  const handleDiscard = () => {
    const n = draftChanges.length;
    if (!window.confirm(`Discard all ${n} unsaved change${n !== 1 ? "s" : ""} on this page? This cannot be undone.`)) return;
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

  // Iframe load-error timeout: if the page doesn't load within 15s (network
  // error, 404 slug), show an error notice instead of hanging on the spinner.
  useEffect(() => {
    if (!active || !iframeUrl || iframeLoaded) return;
    setIframeError(false);
    const timer = setTimeout(() => setIframeError(true), 15000);
    return () => clearTimeout(timer);
  }, [active, iframeUrl, iframeLoaded, reloadKey]);

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
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium text-stone-300 hover:bg-stone-800 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
            aria-label="Exit edit mode"
          >
            <X className="w-3.5 h-3.5" aria-hidden="true" /> Exit
          </button>
          <span className="flex items-center gap-2 font-display text-sm font-semibold text-primary-300">
            <BrandIcon className="w-4 h-4" />
            Content Studio — Edit Mode
          </span>
          {/* Editing-locale indicator — which language inline text edits save to */}
          <Tooltip content="Inline text edits are saved to this language" side="bottom">
            <span
              className="px-2.5 py-1 rounded-full border border-stone-700 bg-stone-900 text-xs font-medium text-stone-300"
              aria-label={`Inline text edits are saved to this language: ${editLocale.toUpperCase()}`}
            >
              Editing: <span className="text-primary-300">{editLocale.toUpperCase()}</span>
            </span>
          </Tooltip>
          {/* Page navigation dropdown */}
          {pages.length > 0 && (
            <div ref={pageMenuRef} className="relative" onKeyDown={onPageMenuKeyDown}>
              <Tooltip content="Switch page" side="bottom">
                <button
                  onClick={() => setPageMenuOpen((o) => !o)}
                  disabled={draftSaving}
                  className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium text-stone-300 hover:bg-stone-800 transition disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
                  aria-haspopup="listbox"
                  aria-expanded={pageMenuOpen}
                >
                  <FileText className="w-3.5 h-3.5" aria-hidden="true" />
                  {pages.find((p) => p.slug === pageSlug)?.label || pageSlug}
                  <ChevronDown className="w-3.5 h-3.5 text-stone-500" aria-hidden="true" />
                </button>
              </Tooltip>
              {pageMenuOpen && (
                <div
                  role="listbox"
                  aria-label="Pages"
                  className="absolute top-full left-0 mt-1 w-48 max-h-80 overflow-y-auto rounded-lg border border-stone-800 bg-stone-900 shadow-lg z-50"
                >
                  {pages.map((p, i) => (
                    <button
                      key={p.slug}
                      onClick={() => switchPage(p.slug)}
                      role="option"
                      aria-selected={i === pageActiveIndex}
                      className={`w-full text-left px-3 py-2 text-sm transition flex items-center gap-2 ${
                        p.slug === pageSlug
                          ? "bg-primary-600 text-cream"
                          : i === pageActiveIndex
                            ? "text-stone-200 ring-2 ring-primary-400 ring-inset"
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
          {/* Transient status flash ("Draft saved" / "Published" / "Couldn't publish")
               — the provider auto-clears it after ~2.5s. Variant controls color. */}
          {statusFlash && (
            <span
              role="status"
              aria-live="polite"
              className={`flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-medium ${
                statusFlash.variant === "error"
                  ? "border-rust-700 bg-rust-900/40 text-rust-300"
                  : "border-emerald-700 bg-emerald-900/40 text-emerald-300"
              }`}
            >
              {statusFlash.variant === "error"
                ? <AlertTriangle className="w-3 h-3" aria-hidden="true" />
                : <Check className="w-3 h-3" aria-hidden="true" />} {statusFlash.msg}
            </span>
          )}

          {/* Preview toggle — shows the published version (draft changes hidden) */}
          <Tooltip content={previewMode ? "Exit preview" : "Preview as visitor"} side="bottom">
            <button
              onClick={() => setPreviewMode(!previewMode)}
              className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 ${
                previewMode
                  ? "bg-amber-600 text-white"
                  : "text-stone-400 hover:text-stone-200 hover:bg-stone-800"
              }`}
              aria-pressed={previewMode}
            >
              <Eye className="w-3.5 h-3.5" aria-hidden="true" /> {previewMode ? "Previewing" : "Preview"}
            </button>
          </Tooltip>

          {/* Draft controls + autosave indicator (Canva/Figma pattern) */}
          {draftChanges.length > 0 && (
            <>
              <span className="text-xs font-medium flex items-center gap-1.5" role="status" aria-live="polite">
                <span className="text-rust-400">{draftChanges.length} changes</span>
                {saveState === "saving" && (
                  <span className="text-stone-500 flex items-center gap-1">
                    <span className="w-2.5 h-2.5 border border-stone-600 border-t-stone-300 rounded-full animate-spin" aria-hidden="true" /> Saving…
                  </span>
                )}
                {saveState === "saved" && (
                  <span className="text-emerald-400 flex items-center gap-1">
                    <Check className="w-3 h-3" aria-hidden="true" /> Saved
                  </span>
                )}
              </span>
              <Tooltip content="Save draft" side="bottom">
                <button
                  onClick={saveDraft}
                  disabled={draftSaving}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-stone-300 hover:bg-stone-800 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
                >
                  <Save className="w-3.5 h-3.5" aria-hidden="true" /> Save
                </button>
              </Tooltip>
              <button
                onClick={publishDraft}
                disabled={draftSaving}
                className="flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-primary-600 hover:bg-primary-700 text-cream transition disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
              >
                {draftSaving ? <div className="w-3.5 h-3.5 border-2 border-cream/30 border-t-cream rounded-full animate-spin" /> : <Upload className="w-3.5 h-3.5" aria-hidden="true" />} Publish
              </button>
              <Tooltip content="Discard unsaved changes" side="bottom">
                <button
                  onClick={handleDiscard}
                  disabled={draftSaving}
                  className="flex items-center gap-1 px-2 py-1.5 rounded-lg text-xs font-medium text-stone-400 hover:text-red-400 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
                  aria-label="Discard unsaved changes"
                >
                  <Trash2 className="w-3.5 h-3.5" aria-hidden="true" />
                </button>
              </Tooltip>
            </>
          )}

          </div>
      </header>

      {/* ── Resume-draft offer (inline, amber) ─────────── */}
      {resumableDraft && (
        <div className="shrink-0 px-4 py-2.5 border-b border-amber-800/40 bg-amber-950/30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-stone-300">
            <History className="w-4 h-4 text-amber-400 shrink-0" aria-hidden="true" />
            <span>
              This page has a saved draft with {resumableDraft.count} change{resumableDraft.count !== 1 ? "s" : ""} from a previous session.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <button
              onClick={() => void resumeDraft()}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-600 hover:bg-amber-700 text-white transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
            >
              Resume draft
            </button>
            <button
              onClick={dismissResumable}
              className="px-3 py-1.5 rounded-lg text-xs font-medium text-stone-400 hover:text-stone-200 hover:bg-stone-800 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40"
            >
              Ignore
            </button>
          </div>
        </div>
      )}

      {/* ── Override prompt (inline, not modal) ────────── */}
      {pendingPrompt && (
        <div className="shrink-0 px-4 py-2.5 border-b border-rust-800 bg-rust-950/30 flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm text-stone-300 min-w-0">
            <AlertTriangle className="w-4 h-4 text-rust-400 shrink-0" />
            <span className="min-w-0">
              This deviates from the default{" "}
              <code className="text-rust-300 font-mono">{pendingPrompt.property}</code>{" "}
              (was <code className="text-stone-400 font-mono">{pendingPrompt.oldValue}</code>).
            </span>
            {/* Visual preview of the new value — swatch for colors, name for fonts */}
            {pendingPrompt.newValue && (
              <ValuePreview property={pendingPrompt.property} value={pendingPrompt.newValue} />
            )}
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
            <div className="absolute inset-0 flex items-center justify-center bg-stone-950 z-10">
              {iframeError ? (
                <div className="flex flex-col items-center gap-3 px-6 text-center">
                  <AlertTriangle className="w-6 h-6 text-rust-400" aria-hidden="true" />
                  <div className="text-sm text-stone-300 font-serif">
                    Couldn&apos;t load this page for editing.
                  </div>
                  <button
                    onClick={() => {
                      setIframeError(false);
                      setIframeLoaded(false);
                      setReloadKey((k) => k + 1);
                    }}
                    className="mt-1 px-3 py-1.5 rounded-lg text-xs font-semibold bg-primary-600 hover:bg-primary-700 text-cream transition"
                  >
                    Try again
                  </button>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-3">
                  <div className="w-6 h-6 border-2 border-stone-700 border-t-primary-500 rounded-full animate-spin" />
                  <div className="text-sm text-stone-400 font-serif">
                    {iframeLoaded ? "Preparing editor…" : "Loading page…"}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Inspector panel — hidden in preview mode. Resizable via the
            left-edge handle (drag, arrows, Enter/double-click to reset). */}
        {!previewMode && (
          <>
            <div
              role="separator"
              aria-orientation="vertical"
              aria-label="Resize inspector"
              aria-valuemin={320}
              aria-valuemax={560}
              aria-valuenow={inspectorWidth}
              tabIndex={0}
              onPointerDown={onHandlePointerDown}
              onPointerMove={onHandlePointerMove}
              onPointerUp={onHandlePointerUp}
              onPointerCancel={onHandlePointerUp}
              onDoubleClick={() => applyInspectorWidth(384)}
              onKeyDown={onHandleKeyDown}
              className={`w-1.5 shrink-0 cursor-col-resize transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary-500/40 ${
                inspectorDragging ? "bg-rust-500/50" : "bg-stone-900 hover:bg-rust-500/50"
              }`}
            />
            <aside
              style={{ width: inspectorWidth }}
              className="shrink-0 border-l border-stone-800 bg-stone-950 overflow-hidden flex flex-col"
            >
              <InspectorPanel />
            </aside>
          </>
        )}
      </div>
    </div>
  );
}

/** Visual preview of an override value — a color swatch for color properties,
 *  the token name for font/size/spacing. Lets the user SEE what they're about
 *  to confirm instead of confirming blind. */
function ValuePreview({ property, value }: { property: string; value: string }) {
  const isColor = property === "color" || property === "background-color" || property === "border-color";
  if (isColor) {
    return (
      <span className="flex items-center gap-1.5 shrink-0 px-2 py-1 rounded-md bg-stone-900 border border-stone-700">
        <span
          className="w-3.5 h-3.5 rounded border border-stone-600"
          style={{ background: `var(--color-${value}, ${value})` }}
        />
        <code className="text-xs font-mono text-stone-200">{value}</code>
      </span>
    );
  }
  // Font, size, spacing, radius — show the token name in mono
  return (
    <span className="flex items-center gap-1.5 shrink-0 px-2 py-1 rounded-md bg-stone-900 border border-stone-700">
      <code className="text-xs font-mono text-primary-300">{value}</code>
    </span>
  );
}
