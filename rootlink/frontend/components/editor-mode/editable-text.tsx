"use client";

/**
 * Wraps a `t()`-rendered string so it becomes an inline-editable element while
 * Editor Mode is active (super_admin only). Outside editor mode it's a plain
 * text node — zero behavior change for regular visitors.
 *
 * Usage: <EditableText k="home.hero_title" as="h1" className="..." />
 */

import { useEffect, useRef } from "react";
import { RotateCcw } from "lucide-react";
import { useLocale } from "@/lib/locale-context";
import { useEditorMode } from "./editor-mode-provider";

interface EditableTextProps {
  /** The same i18n key you'd normally pass to t() */
  k: string;
  /** Element tag to render — defaults to span */
  as?: keyof JSX.IntrinsicElements;
  className?: string;
  /**
   * Fallback text for keys that aren't real static i18n keys (e.g. per-family
   * generated copy that has no entry in messages/{locale}.json). `t(k)` falls
   * back to returning `k` itself when a key isn't found — if `defaultText` is
   * given and no override exists yet, this is shown instead of the raw key.
   */
  defaultText?: string;
}

export function EditableText({ k, as = "span", className, defaultText }: EditableTextProps) {
  const { t } = useLocale();
  const { mode, isSuperAdmin, textDrafts, committedText, setTextDraft, activeKey, setActiveKey, revertElement } = useEditorMode();
  const ref = useRef<HTMLElement>(null);
  const translated = t(k);
  // Any non-static key we made up (like a per-family description) will come
  // back equal to the raw key from t() when there's no override yet — a real
  // static key found in messages/{locale}.json never equals its own key
  // (unless someone deliberately wrote a translation identical to the key).
  const fallback = defaultText !== undefined && translated === k ? defaultText : translated;
  const value = textDrafts[k] ?? committedText[k] ?? fallback;
  const editing = activeKey === k;

  // Hooks must run unconditionally on every render (Rules of Hooks) — the
  // preview-mode early return happens below, after this effect is declared.
  // Flipping `contentEditable` to true doesn't move browser focus by itself
  // (the element wasn't focusable at the moment of the click that triggered
  // it) — focus it explicitly and park the cursor at the end, once editable.
  useEffect(() => {
    if (!editing || !ref.current) return;
    const el = ref.current;
    el.focus();
    const range = document.createRange();
    range.selectNodeContents(el);
    range.collapse(false);
    const sel = window.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }, [editing]);

  if (!isSuperAdmin || mode !== "editor") {
    const Plain = as as any;
    return <Plain className={className}>{value}</Plain>;
  }

  const Tag = as as any;
  // Only offer "revert to default" once there's actually a saved override to
  // revert — mirrors EditableImage/EditableIcon's `canRevert` check — and
  // never while actively editing (it unmounts on click-to-edit, so it can
  // never end up as stray markup inside the contentEditable region).
  const canRevert = !editing && !!committedText[k];

  return (
    <Tag
      ref={ref}
      className={`${className || ""} rl-editable-text ${editing ? "rl-editable-text--active" : ""}`}
      contentEditable={editing}
      suppressContentEditableWarning
      onClick={(e: React.MouseEvent) => {
        // Always guard against a default action — this element may be
        // nested inside a <Link>/<a> (e.g. a homepage category card), and
        // without this every click (activating edit, or placing the cursor
        // while already editing) would otherwise navigate away. See
        // docs/LESSONS.md #16 for the same class of bug with modals.
        e.preventDefault();
        if (!editing) {
          e.stopPropagation();
          setActiveKey(k);
        }
      }}
      onBlur={() => {
        const newText = ref.current?.innerText?.trim() ?? "";
        if (newText && newText !== value) setTextDraft(k, newText);
        setActiveKey(null);
      }}
      onKeyDown={(e: React.KeyboardEvent) => {
        if (e.key === "Escape") (e.target as HTMLElement).blur();
      }}
    >
      {value}
      {canRevert && (
        <button
          type="button"
          className="rl-editable-text__revert"
          title="Revert to default"
          aria-label="Revert to default"
          contentEditable={false}
          suppressContentEditableWarning
          onClick={(e: React.MouseEvent) => {
            // Stop this from bubbling to the Tag's own onClick (which would
            // otherwise enter edit mode) or to any ancestor <Link>/<a>.
            e.preventDefault();
            e.stopPropagation();
            revertElement(k, "text", defaultText);
          }}
        >
          <RotateCcw className="w-3 h-3" />
        </button>
      )}
    </Tag>
  );
}
