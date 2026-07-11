/**
 * Selection Agent — injected into the overlay's iframe.
 *
 * Spec: docs/content-studio/CONTENT_STUDIO.md §3.2 (selection).
 *
 * Runs INSIDE the iframe (the real page). The iframe gives complete JS
 * isolation — the page's own click handlers (tabs, filters, dropdowns) never
 * fire because we intercept at the capture phase.
 *
 * Selection model (site-builder convention):
 *   • Hover      → outline snaps to the nearest tagged component.
 *   • 1st click  → select that component (outline + inspector panel).
 *   • 2nd click  → if the click is on text, edit that text inline on the page
 *                  (contentEditable). No drilling into <div>s / structural tags.
 *   • Esc        → stop editing text; Esc again → jump to the parent component.
 *   • Breadcrumb → jump to any component ancestor.
 *
 * Style application (theme-token model):
 *   The inspector sends a theme VALUE = the token NAME ("primary-600",
 *   "h2", "Routtage") plus an APPLIED VALUE = the CSS the browser should see
 *   ("var(--color-primary-600)", "var(--size-h2)", '"Routtage", sans-serif').
 *   `value` is the override identity (persisted, dark-mode-safe, survives
 *   theme swaps); `appliedValue` is what the DOM gets. The agent also records
 *   the token name in a data-rl-*-token attribute so re-selection can show the
 *   current choice and reset can revert to the Tailwind class default.
 */

export function injectSelectionAgent() {
  if (window.__overlaySelectionAgent) return; // already injected
  window.__overlaySelectionAgent = true;

  let hovered: HTMLElement | null = null;
  let selected: HTMLElement | null = null;
  // The block's text element (the heading/paragraph/button under the cursor).
  // Text-section props (color, font, size) apply to this; block props (bg,
  // padding, radius) apply to `selected`. Null when the block has no text or the
  // block IS the text element (e.g. a Button) — then the Text section reads
  // from `selected` directly.
  let textTarget: HTMLElement | null = null;
  // The text element currently being edited inline (contentEditable), if any.
  let editing: HTMLElement | null = null;
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
  function positionOutline(el: HTMLElement, labelText?: string) {
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
    label.textContent = labelText || (el.hasAttribute("data-rl-component")
      ? el.getAttribute("data-rl-component")!
      : el.tagName.toLowerCase() + (el.getAttribute("class") ? "." + el.getAttribute("class")!.split(" ")[0] : ""));
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

  // ── Component-level selection ───────────────────────────
  // Selection snaps to the nearest element carrying a data-rl-component
  // attribute. The breadcrumb is the chain of component ancestors. Esc jumps
  // up one component; the breadcrumb can jump to any ancestor. There is no
  // "drill into child components" — second click is reserved for editing text.

  function findComponentAncestor(el: HTMLElement | null): HTMLElement | null {
    let cur: HTMLElement | null = el;
    while (cur && cur !== document.body && cur !== document.documentElement) {
      if (cur.hasAttribute && cur.hasAttribute("data-rl-component")) return cur;
      cur = cur.parentElement;
    }
    return null;
  }

  function findParentComponent(el: HTMLElement): HTMLElement | null {
    return findComponentAncestor(el.parentElement);
  }

  function componentLabel(el: HTMLElement): string {
    const name = el.getAttribute("data-rl-component");
    return name || elementLabel(el);
  }

  function buildComponentHierarchy(el: HTMLElement): { path: string; label: string; tagName: string }[] {
    const hierarchy: { path: string; label: string; tagName: string }[] = [];
    let current: HTMLElement | null = findComponentAncestor(el);
    while (current && current !== document.body) {
      hierarchy.unshift({
        path: buildPath(current),
        label: componentLabel(current),
        tagName: current.tagName.toLowerCase(),
      });
      current = findComponentAncestor(current.parentElement);
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

  // ── Computed styles (theme-value-relevant only) ─────────
  // Structural CSS (display, flex, opacity, width/height, box-shadow, z-index,
  // raw margins) is intentionally NOT captured — exposing it in the inspector
  // would invite layout-breaking edits. Only properties that map to a theme
  // value (color, font, spacing scale, radius) are surfaced.
  const RELEVANT_PROPERTIES = [
    "color", "background-color", "border-color",
    "font-family", "font-size", "font-weight", "font-style",
    "letter-spacing", "line-height", "text-align", "text-decoration",
    "padding-top", "padding-right", "padding-bottom", "padding-left",
    "border-radius", "gap",
  ];

  function captureComputedStyles(el: HTMLElement): Record<string, string> {
    const cs = getComputedStyle(el);
    const result: Record<string, string> = {};
    for (const prop of RELEVANT_PROPERTIES) {
      result[prop] = cs.getPropertyValue(prop);
    }
    return result;
  }

  // Tags that can be edited inline as text.
  const TEXT_TAGS = new Set([
    "h1", "h2", "h3", "h4", "h5", "h6", "p", "span", "a",
    "button", "label", "li", "strong", "em", "code", "small",
    "input", "textarea", "select",
  ]);
  const TEXT_SELECTOR = "h1,h2,h3,h4,h5,h6,p,span,a,button,label,li,strong,em,small,input,textarea,select";
  // Properties that belong to the TEXT element (color = text color), not the
  // block container. Changes to these route to `textTarget`; the rest route to
  // `selected` (the block).
  const TEXT_PROPS = new Set([
    "color", "font-family", "font-size", "font-weight", "font-style",
    "text-align", "text-decoration", "letter-spacing", "line-height",
  ]);
  function isTextProp(p: string): boolean { return TEXT_PROPS.has(p); }

  /** Find the text element at/under/above a click target — the SAME logic
   *  double-click uses, so first click identifies text just as well. The target
   *  itself if it's a text tag; else the first text-tag descendant; else the
   *  nearest text-tag ancestor up to the containing block. */
  function findTextAt(target: HTMLElement, component?: HTMLElement | null): HTMLElement | null {
    if (TEXT_TAGS.has(target.tagName.toLowerCase())) return target;
    const child = target.querySelector(TEXT_SELECTOR) as HTMLElement | null;
    if (child) return child;
    let cur: HTMLElement | null = target.parentElement;
    while (cur && cur !== document.body && cur !== document.documentElement) {
      if (component && cur === component) {
        return TEXT_TAGS.has(cur.tagName.toLowerCase()) ? cur : null;
      }
      if (TEXT_TAGS.has(cur.tagName.toLowerCase())) return cur;
      cur = cur.parentElement;
    }
    return null;
  }

  // ── Token-name tracking (which theme value is currently applied) ──
  // When a theme value is applied, we store its NAME in a data-rl-*-token
  // attribute so re-selection can highlight the active swatch/option and reset
  // can revert to the Tailwind class default. For elements with no override we
  // fall back to parsing the Tailwind utility classes (text-primary-600 →
  // "primary-600"). Both paths yield a NAME — no color-format conversion.

  // Map a CSS property → the data-rl-*-token attribute that records its value.
  function tokenAttrFor(property: string): string | null {
    switch (property) {
      case "color": return "data-rl-color-token";
      case "background-color": return "data-rl-bg-token";
      case "border-color": return "data-rl-border-token";
      case "font-family": return "data-rl-font-token";
      case "font-size": return "data-rl-size-token";
      case "padding": return "data-rl-space-token";
      case "gap": return "data-rl-gap-token";
      case "border-radius": return "data-rl-radius-token";
      default: return null;
    }
  }

  // Color families whose Tailwind utilities map 1:1 to named palette tokens.
  const COLOR_FAMILIES = [
    "primary", "earth", "rust", "stone", "cream",
    "green", "blue", "amber", "red", "sky", "orange", "emerald", "teal",
    "cyan", "pink", "purple", "indigo", "violet", "fuchsia", "rose", "lime", "yellow",
  ];
  const FAM_ALT = COLOR_FAMILIES.join("|");
  // Tailwind v4 type-scale / radius names (matched against utility classes).
  const TEXT_SIZE_NAMES = ["xs", "sm", "base", "lg", "xl", "2xl", "3xl", "4xl", "5xl", "6xl", "7xl", "8xl", "9xl"];
  const RADIUS_NAMES = ["none", "sm", "md", "lg", "xl", "2xl", "3xl", "full"];
  const TEXT_SIZE_RE = new RegExp("^text-(" + TEXT_SIZE_NAMES.join("|") + ")$");
  const RADIUS_RE = new RegExp("^rounded-(" + RADIUS_NAMES.join("|") + ")$");

  /** Read the currently-applied theme token NAME for a property (or null).
   *  Prefers the data-rl-*-token attr (set when an override was applied); falls
   *  back to the element's Tailwind utility classes for the default state. Both
   *  paths yield a NAME — never a color/size-format conversion.
   *
   *  For inheritable properties (color, font-*, text-*, etc.), walks up the DOM
   *  tree when the element itself has no explicit token, so inherited values show
   *  their actual source token (e.g. "stone-800") instead of the raw computed rgb.
   *
   *  Color properties are mode-aware: in dark mode the `dark:` variant class is
   *  preferred (so the highlighted swatch matches what's actually rendered),
   *  falling back to the plain class. Opacity modifiers (e.g. bg-primary-900/30)
   *  are tolerated and stripped from the returned name. */
  const INHERITABLE = new Set([
    "color", "font-family", "font-size", "font-weight", "font-style",
    "text-align", "letter-spacing", "line-height",
  ]);
  function readAppliedToken(el: HTMLElement, property: string): string | null {
    const attr = tokenAttrFor(property);
    if (attr && el.hasAttribute(attr)) return el.getAttribute(attr);
    const cls = el.getAttribute("class");
    if (!cls) return null;
    const tokens = cls.split(/\s+/);
    const prefix = property === "color" ? "text" : property === "background-color" ? "bg" : property === "border-color" ? "border" : null;

    // Color properties: collect plain + dark candidates, pick by current mode.
    if (prefix) {
      const isDark = document.documentElement.classList.contains("dark");
      const plainRe = new RegExp("^" + prefix + "-(" + FAM_ALT + ")(-\\d{2,3})?(/[\\d.]+)?$");
      const darkRe = new RegExp("^dark:" + prefix + "-(" + FAM_ALT + ")(-\\d{2,3})?(/[\\d.]+)?$");
      const nameFrom = (m: RegExpMatchArray | null): string | null =>
        m ? (m[2] ? m[1] + m[2] : m[1]) : null;
      let plainName: string | null = null;
      let darkName: string | null = null;
      for (const t of tokens) {
        if (darkName === null) darkName = nameFrom(t.match(darkRe));
        if (plainName === null && !t.includes(":")) plainName = nameFrom(t.match(plainRe));
        if (darkName && plainName) break;
      }
      return isDark ? (darkName ?? plainName) : plainName;
    }

    // Non-color properties (font-size, padding, gap, border-radius): plain
    // utility classes only (skip variant-prefixed ones).
    for (const t of tokens) {
      if (t.includes(":")) continue;
      if (property === "font-size") {
        const m = t.match(TEXT_SIZE_RE);
        if (m) {
          // The base class gives us the token NAME, but at the current
          // breakpoint a responsive variant (e.g. lg:text-8xl) may override
          // it. Compare the element's computed font-size against the --text-*
          // CSS variables to find the ACTUAL effective token.
          const computedPx = parseFloat(getComputedStyle(el).fontSize);
          if (computedPx > 0) {
            for (const sizeName of TEXT_SIZE_NAMES) {
              const tokenVar = getComputedStyle(document.documentElement).getPropertyValue(`--text-${sizeName}`).trim();
              if (tokenVar) {
                const tokenPx = parseFloat(tokenVar);
                if (tokenPx > 0 && Math.abs(computedPx - tokenPx) < 0.5) {
                  return sizeName;
                }
              }
            }
          }
          return m[1];
        }
      }
      if (property === "padding") {
        const m = t.match(/^p-(\d+)$/);
        if (m) return m[1];
      }
      if (property === "gap") {
        const m = t.match(/^gap-(\d+)$/);
        if (m) return m[1];
      }
      if (property === "border-radius") {
        const m = t.match(RADIUS_RE);
        if (m) return m[1];
      }
    }
    if (INHERITABLE.has(property) && el.parentElement) {
      return readAppliedToken(el.parentElement as HTMLElement, property);
    }
    return null;
  }

  // ── Select an element (send data to parent) ─────────────
  function selectElement(el: HTMLElement, textEl?: HTMLElement | null) {
    selected = el;
    // Resolve the block's text element: the one passed in, else the block
    // itself if it's a text tag (e.g. a Button), else the first text inside.
    textTarget = textEl ?? (TEXT_TAGS.has(el.tagName.toLowerCase()) ? el : findTextAt(el));
    const componentName = el.getAttribute("data-rl-component");
    const isTextEl = TEXT_TAGS.has(el.tagName.toLowerCase());
    const textContent = isTextEl ? (el.innerText || el.textContent || "").trim() : "";

    // The block's currently-applied theme token names (for highlighting/reset).
    const appliedTokens: Record<string, string> = {};
    for (const prop of ["color", "background-color", "border-color", "font-family", "font-size", "padding", "gap", "border-radius"]) {
      const name = readAppliedToken(el, prop);
      if (name) {
        const key = prop.startsWith("padding") ? "padding" : prop;
        appliedTokens[key] = name;
      }
    }

    // The text element's data, sent only when it differs from the block (i.e.
    // the block wraps a separate text element like a Card/SectionHeader). When
    // the block IS the text element (Button/Badge), this is null and the
    // inspector reads text props from `selected` directly.
    let textElement: {
      path: string; tagName: string;
      appliedTokens: Record<string, string>;
      computedStyles: Record<string, string>;
      textContent: string;
      copyKey?: string | null;
    } | null = null;
    if (textTarget && textTarget !== el) {
      const teApplied: Record<string, string> = {};
      for (const prop of ["color", "font-family", "font-size", "font-weight", "font-style", "text-align", "text-decoration", "letter-spacing", "line-height"]) {
        const name = readAppliedToken(textTarget, prop);
        if (name) teApplied[prop] = name;
      }
      textElement = {
        path: buildPath(textTarget),
        tagName: textTarget.tagName.toLowerCase(),
        appliedTokens: teApplied,
        computedStyles: captureComputedStyles(textTarget),
        textContent: (textTarget.innerText || textTarget.textContent || "").trim(),
        copyKey: textTarget.getAttribute("data-rl-text"),
      };
    }

    // The copy key (data-rl-text) of the block's text element — present when
    // the text is editable studio copy, null for computed values (counts,
    // prices, dates). Read from textTarget, or the block itself when the block
    // IS the text element (Button/Badge).
    const copyKeyEl = textTarget || el;
    const copyKey = copyKeyEl?.getAttribute("data-rl-text") || null;

    const element = {
      path: buildPath(el),
      tagName: el.tagName.toLowerCase(),
      label: componentName || elementLabel(el),
      componentType: componentName || null,
      computedStyles: captureComputedStyles(el),
      hierarchy: buildComponentHierarchy(el),
      textContent,
      appliedTokens,
      textElement,
      copyKey,
      editing: editing === textTarget || editing === el,
    };
    parent.postMessage({ type: "overlay:select", element }, "*");
  }

  // ── Deselect ─────────────────────────────────────────────
  function deselect() {
    exitTextEdit();
    selected = null;
    textTarget = null;
    hideOutline();
    parent.postMessage({ type: "overlay:deselect" }, "*");
  }

  // ── Inline text editing ──────────────────────────────────
  function onTextEditInput() {
    if (!editing) return;
    parent.postMessage(
      { type: "overlay:text-change", path: buildPath(editing), text: (editing.innerText || "").trim() },
      "*"
    );
  }

  /** Make a text element editable on the page. */
  function enterTextEdit(el: HTMLElement) {
    if (editing && editing !== el) exitTextEdit();
    editing = el;
    el.contentEditable = "true";
    el.addEventListener("input", onTextEditInput);
    // Focus + place the caret at the end (React won't auto-focus an attribute
    // flip — see LESSONS.md #17).
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
    if (selected) selectElement(selected, textTarget); // refresh panel (editing flag)
  }

  /** Stop editing text; keep the element selected. If the text has a copy key
   *  (data-rl-text), commit the edit via api.copy.set (persisted → survives
   *  reload, updates everywhere the key is used). */
  function exitTextEdit() {
    if (!editing) return;
    const el = editing;
    editing = null;
    el.removeEventListener("input", onTextEditInput);
    el.contentEditable = "false";
    // Persist: if the text has a copy key, commit to the copy system.
    const key = el.getAttribute("data-rl-text");
    if (key) {
      const text = (el.innerText || "").trim();
      const locale = localStorage.getItem("rootlink_locale") || "pt";
      parent.postMessage({ type: "overlay:text-commit", key, text, locale }, "*");
    }
    if (selected) selectElement(selected, textTarget);
  }

  // ── Mouse move (hover) ──────────────────────────────────
  // Snaps the outline to the TEXT element when the cursor is directly over
  // text (tight outline + "Block › tag" label), so the user can see exactly
  // which text they're about to click. Falls back to the block outline for
  // non-text areas (a card's padding, an image).
  document.addEventListener("mousemove", (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target === outline || target === label) return;
    if (target === document.body || target === document.documentElement) {
      hideOutline();
      hovered = null;
      return;
    }
    const component = findComponentAncestor(target);
    if (!component) {
      hideOutline();
      hovered = null;
      return;
    }
    // If the cursor is directly over a text element, outline IT (tight). For
    // non-text targets (divs, svgs, images), outline the component (block).
    const textEl = TEXT_TAGS.has(target.tagName.toLowerCase()) ? target : null;
    const outlineEl = textEl || component;
    if (outlineEl === hovered) return;
    hovered = outlineEl;
    const compName = component.getAttribute("data-rl-component") || component.tagName.toLowerCase();
    const labelText = textEl && textEl !== component
      ? `${compName} › ${textEl.tagName.toLowerCase()}`
      : compName;
    positionOutline(outlineEl, labelText);
  }, true);

  // ── Click (select / exit-edit) ───────────────────────────
  document.addEventListener("click", (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target === outline || target === label) return;

    // If editing text and the click is inside the editing element, let it
    // behave normally (place the caret) — don't intercept.
    if (editing && editing.contains(target)) return;

    e.preventDefault();
    e.stopPropagation();

    // Any click outside the editing element ends text editing.
    if (editing) exitTextEdit();

    if (target === document.body || target === document.documentElement) {
      deselect();
      return;
    }
    // 1st click = select the nearest tagged component AND identify the text
    // under the cursor (same logic dblclick uses), so the panel shows the
    // block + its text together. Fall back to the raw element when untagged.
    const component = findComponentAncestor(target);
    const textEl = component ? findTextAt(target, component) : findTextAt(target);
    selectElement(component || target, textEl);
  }, true);

  // ── Double-click (edit text on the page) ───────────────
  // Keeps the block selected; refreshes the identified text to the one under
  // the dblclick and enters inline editing on it. No drilling into <div>s.
  document.addEventListener("dblclick", (e: MouseEvent) => {
    const target = e.target as HTMLElement;
    if (target === outline || target === label) return;
    if (editing && editing.contains(target)) return; // already editing inside
    e.preventDefault();
    e.stopPropagation();
    const component = selected && selected.contains(target) ? selected : (findComponentAncestor(target) || target);
    const textEl = findTextAt(target, findComponentAncestor(target));
    if (textEl) {
      selectElement(component, textEl);
      // Only enter inline editing if the text is editable studio copy (has a
      // data-rl-text key). Computed values (counts, prices, dates) have no
      // key → selected for display but not editable.
      if (textEl.hasAttribute("data-rl-text")) {
        enterTextEdit(textEl);
      }
    }
  }, true);

  // ── Keyboard navigation ─────────────────────────────────
  document.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Escape") {
      if (editing) {
        exitTextEdit();
      } else if (selected) {
        const parent = findParentComponent(selected);
        if (parent) selectElement(parent);
        else deselect();
      } else {
        deselect();
      }
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);

  // ── Undo stack (before-save undo) ───────────────────────
  const undoStack: { el: HTMLElement; property: string; oldValue: string }[] = [];

  /** Apply a theme value. `value` is the token NAME; `appliedValue` is the CSS
   *  the browser sees (var(...) for colors/sizes, a font-family string for
   *  fonts). Text props route to the block's text element; block props to the
   *  block. Defaults `appliedValue` to `value` when no translation is needed. */
  function applyStyle(property: string, value: string, appliedValue?: string) {
    if (!selected) return;
    const isText = isTextProp(property) && textTarget && textTarget !== selected;
    const el = isText ? textTarget! : selected;
    const css = appliedValue ?? value;
    const existing = undoStack.find((u) => u.el === el && u.property === property);
    if (!existing) {
      undoStack.push({
        el,
        property,
        oldValue: el.style.getPropertyValue(property) || getComputedStyle(el).getPropertyValue(property),
      });
    }
    el.style.setProperty(property, css);
    // Record the token NAME so re-selection highlights the active choice and
    // reset can revert to the Tailwind class default.
    const attr = tokenAttrFor(property);
    if (attr) el.setAttribute(attr, value);
    selectElement(selected, textTarget);
  }

  /** Reset a property: remove the inline override + token record → the element
   *  falls back to its Tailwind class (which resolves the theme default).
   *  Routes to the text element for text props, else the block. */
  function resetProperty(property: string) {
    if (!selected) return;
    const isText = isTextProp(property) && textTarget && textTarget !== selected;
    const el = isText ? textTarget! : selected;
    undoStack.push({
      el,
      property,
      oldValue: el.style.getPropertyValue(property) || getComputedStyle(el).getPropertyValue(property),
    });
    el.style.removeProperty(property);
    const attr = tokenAttrFor(property);
    if (attr) el.removeAttribute(attr);
    selectElement(selected, textTarget);
  }

  function undo() {
    const entry = undoStack.pop();
    if (!entry) return;
    if (entry.oldValue) {
      entry.el.style.setProperty(entry.property, entry.oldValue);
    } else {
      entry.el.style.removeProperty(entry.property);
    }
    if (selected === entry.el) selectElement(selected);
  }

  // ── Listen for messages from the parent (inspector) ────
  window.addEventListener("message", (e: MessageEvent) => {
    if (!e.data || typeof e.data !== "object") return;
    switch (e.data.type) {
      case "overlay:apply-style":
        applyStyle(e.data.property, e.data.value, e.data.appliedValue);
        break;
      case "overlay:reset-property":
        resetProperty(e.data.property);
        break;
      case "overlay:undo":
        undo();
        break;
      case "overlay:exit-edit":
        exitTextEdit();
        break;
      case "overlay:select-path": {
        // Select an ancestor by CSS path (breadcrumb click)
        const el = document.querySelector(e.data.path) as HTMLElement | null;
        if (el) {
          if (editing) exitTextEdit();
          selectElement(el);
        }
        break;
      }
    }
  });

  // ── Keyboard: Ctrl+Z for undo ───────────────────────────
  document.addEventListener("keydown", (e: KeyboardEvent) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "z") {
      // While editing text, let the browser undo text edits natively.
      if (editing) return;
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
