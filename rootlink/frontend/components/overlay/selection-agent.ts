/**
 * Selection Agent — injected into the overlay's iframe.
 *
 * Spec: docs/content-studio/CONTENT_STUDIO.md §3.2 (selection).
 *
 * This script runs INSIDE the iframe (the real page). It:
 *   1. Adds hover outlines + labels to every visible element.
 *   2. On click, selects the element — captures its computed styles,
 *      builds a breadcrumb hierarchy, and sends the data to the parent
 *      window via postMessage.
 *   3. Supports keyboard navigation (Esc = parent, Tab = first child).
 *   4. Supports double-click to select the parent.
 *
 * The parent window (overlay-provider) listens for these postMessages
 * and updates the inspector panel.
 *
 * This is isolated from the page's own JS — the iframe provides complete
 * separation. The page's click handlers (tabs, filters, dropdowns) never
 * fire because we intercept the click at the capture phase.
 */

export function injectSelectionAgent() {
  if (window.__overlaySelectionAgent) return; // already injected
  window.__overlaySelectionAgent = true;

  let hovered: HTMLElement | null = null;
  let selected: HTMLElement | null = null;
  let outline: HTMLDivElement | null = null;
  let label: HTMLDivElement | null = null;

  // ── Create the hover outline + label elements ────────────
  function createOverlayElements() {
    outline = document.createElement("div");
    outline.style.cssText = `
      position: fixed; pointer-events: none; z-index: 99999;
      border: 2px solid var(--color-rust-500, #a8643d);
      border-radius: 4px; transition: all 0.05s ease-out;
      display: none;
    `;
    label = document.createElement("div");
    label.style.cssText = `
      position: fixed; pointer-events: none; z-index: 100000;
      background: var(--color-rust-500, #a8643d);
      color: var(--color-cream, #f8f6f2);
      font-size: 11px; font-family: monospace; padding: 2px 6px;
      border-radius: 4px 4px 0 0; white-space: nowrap;
      display: none; line-height: 1.4;
    `;
    document.body.appendChild(outline);
    document.body.appendChild(label);
  }

  // ── Position the outline + label on an element ──────────
  function positionOutline(el: HTMLElement) {
    if (!outline || !label) return;
    const rect = el.getBoundingClientRect();
    outline.style.display = "block";
    outline.style.left = rect.left + "px";
    outline.style.top = rect.top + "px";
    outline.style.width = rect.width + "px";
    outline.style.height = rect.height + "px";
    label.style.display = "block";
    label.style.left = rect.left + "px";
    label.style.top = (rect.top - 20) + "px";
    label.textContent = el.tagName.toLowerCase() + (el.getAttribute("class") ? "." + el.getAttribute("class")!.split(" ")[0] : "");
  }

  function hideOutline() {
    if (outline) outline.style.display = "none";
    if (label) label.style.display = "none";
  }

  // ── Build a label for an element ────────────────────────
  function elementLabel(el: HTMLElement): string {
    const tag = el.tagName.toLowerCase();
    const cls = el.getAttribute("class");
    const firstCls = cls ? cls.split(" ")[0] : "";
    const id = el.id ? "#" + el.id : "";
    return tag + (id || (cls ? "." + cls : ""));
  }

  // ── Build the DOM path (breadcrumb hierarchy) ───────────
  function buildHierarchy(el: HTMLElement): { path: string; label: string; tagName: string }[] {
    const hierarchy: { path: string; label: string; tagName: string }[] = [];
    let current: HTMLElement | null = el;
    while (current && current !== document.body) {
      hierarchy.unshift({
        path: buildPath(current),
        label: elementLabel(current),
        tagName: current.tagName.toLowerCase(),
      });
      current = current.parentElement;
    }
    return hierarchy;
  }

  // ── Build a unique CSS-selector-like path for the element ─
  function buildPath(el: HTMLElement): string {
    const parts: string[] = [];
    let current: HTMLElement | null = el;
    while (current && current !== document.body && current !== document.documentElement) {
      let part = current.tagName.toLowerCase();
      if (current.id) {
        part += "#" + current.id;
        parts.unshift(part);
        break;
      }
      const siblings = Array.from(current.parentElement?.children || []);
      const index = siblings.indexOf(current);
      if (index > 0) part += `:nth-child(${index + 1})`;
      parts.unshift(part);
      current = current.parentElement;
    }
    return parts.join(" > ");
  }

  // ── Capture relevant computed styles ────────────────────
  const RELEVANT_PROPERTIES = [
    "color", "background-color", "font-family", "font-size", "font-weight",
    "font-style", "letter-spacing", "line-height", "text-align", "text-decoration",
    "margin-top", "margin-right", "margin-bottom", "margin-left",
    "padding-top", "padding-right", "padding-bottom", "padding-left",
    "border-radius", "border-width", "border-color", "border-style",
    "display", "flex-direction", "justify-content", "align-items", "gap",
    "width", "height", "max-width", "max-height",
    "opacity", "box-shadow", "z-index",
  ];

  function captureComputedStyles(el: HTMLElement): Record<string, string> {
    const cs = getComputedStyle(el);
    const result: Record<string, string> = {};
    for (const prop of RELEVANT_PROPERTIES) {
      result[prop] = cs.getPropertyValue(prop);
    }
    return result;
  }

  // ── Select an element (send data to parent) ─────────────
  function selectElement(el: HTMLElement) {
    selected = el;
    const element = {
      path: buildPath(el),
      tagName: el.tagName.toLowerCase(),
      label: elementLabel(el),
      computedStyles: captureComputedStyles(el),
      hierarchy: buildHierarchy(el),
    };
    parent.postMessage({ type: "overlay:select", element }, "*");
  }

  // ── Deselect ─────────────────────────────────────────────
  function deselect() {
    selected = null;
    hideOutline();
    parent.postMessage({ type: "overlay:deselect" }, "*");
  }

  // ── Mouse move (hover) ──────────────────────────────────
  document.addEventListener("mousemove", (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target === hovered) return;
    // Skip our own overlay elements
    if (target === outline || target === label) return;
    if (target === document.body || target === document.documentElement) {
      hideOutline();
      hovered = null;
      return;
    }
    hovered = target;
    positionOutline(target);
  }, true);

  // ── Click (select) — intercept at capture phase so the page's
  // own handlers never fire (this is the key isolation benefit) ──
  document.addEventListener("click", (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const target = e.target as HTMLElement;
    if (target === outline || target === label) return;
    if (target === document.body || target === document.documentElement) {
      deselect();
      return;
    }
    selectElement(target);
  }, true);

  // ── Double-click (select parent) ────────────────────────
  document.addEventListener("dblclick", (e: MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const target = e.target as HTMLElement;
    if (target.parentElement && target.parentElement !== document.body) {
      selectElement(target.parentElement);
    }
  }, true);

  // ── Keyboard navigation ─────────────────────────────────
  document.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      if (selected && selected.parentElement && selected.parentElement !== document.body) {
        selectElement(selected.parentElement);
      } else {
        deselect();
      }
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  // ── Undo stack (before-save undo) ───────────────────────
  // Each entry is { el, property, oldValue } — we restore oldValue on undo.
  const undoStack: { el: HTMLElement; property: string; oldValue: string }[] = [];

  function applyStyle(property: string, value: string) {
    if (!selected) return;
    const existing = undoStack.find((e) => e.el === selected && e.property === property);
    if (!existing) {
      undoStack.push({
        el: selected,
        property,
        oldValue: selected.style.getPropertyValue(property) || getComputedStyle(selected).getPropertyValue(property),
      });
    }
    // In Tailwind v4, CSS variables are native — hex values and token names
    // can be set directly as CSS custom properties. No mapTokenToCssVar needed.
    selected.style.setProperty(property, value);
    selectElement(selected);
  }

  function undo() {
    const entry = undoStack.pop();
    if (!entry) return;
    if (entry.oldValue) {
      entry.el.style.setProperty(entry.property, entry.oldValue);
    } else {
      entry.el.style.removeProperty(entry.property);
    }
    if (selected === entry.el) {
      selectElement(selected);
    }
  }

  // ── Listen for messages from the parent (inspector) ────
  window.addEventListener("message", (e: MessageEvent) => {
    if (!e.data || typeof e.data !== "object") return;
    switch (e.data.type) {
      case "overlay:apply-style":
        applyStyle(e.data.property, e.data.value);
        break;
      case "overlay:undo":
        undo();
        break;
      case "overlay:select-path":
        // Select an ancestor by CSS path (breadcrumb click)
        const el = document.querySelector(e.data.path) as HTMLElement;
        if (el) selectElement(el);
        break;
    }
  });

  // ── Keyboard: Ctrl+Z for undo ───────────────────────────
  document.addEventListener("keydown", (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "z") {
      undo();
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  createOverlayElements();
  console.log("[Content Studio] Selection agent active");
}

// Augment Window to track injection state
declare global {
  interface Window {
    __overlaySelectionAgent?: boolean;
  }
}
