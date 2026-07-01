"use client";

/**
 * Wraps a static icon slot (e.g. a category card icon) so it becomes
 * swappable — from a fixed curated registry, never free-form SVG — while
 * Editor Mode is active (super_admin only).
 *
 * Usage: <EditableIcon k="home.category.plants.icon" defaultIconId="leaf" className="w-7 h-7 text-primary-600" />
 */

import { useState } from "react";
import { createPortal } from "react-dom";
import { X, RotateCcw } from "lucide-react";
import { ICON_LIBRARY, ICON_CATEGORIES, getIconById, IconCategory } from "@/lib/icon-library";
import { useEditorMode } from "./editor-mode-provider";

interface EditableIconProps {
  k: string;
  defaultIconId: string;
  className?: string;
  wrapperClassName?: string;
}

export function EditableIcon({ k, defaultIconId, className, wrapperClassName }: EditableIconProps) {
  const { mode, isSuperAdmin, iconDrafts, committedIcons, setIconDraft, revertElement } = useEditorMode();
  const [modalOpen, setModalOpen] = useState(false);

  const currentId = iconDrafts[k] ?? committedIcons[k] ?? defaultIconId;
  const entry = getIconById(currentId) ?? getIconById(defaultIconId);
  const Icon = entry?.Icon;

  const iconEl = Icon ? <Icon className={className} /> : null;

  if (!isSuperAdmin || mode !== "editor") return iconEl;

  return (
    <>
      <div
        className={`rl-editable-media inline-flex ${wrapperClassName || ""}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setModalOpen(true);
        }}
        role="button"
        tabIndex={0}
      >
        {iconEl}
        <div className="rl-editable-media__badge">
          <span className="w-4 h-4 rounded-full bg-primary-600 text-white flex items-center justify-center text-[10px]">✎</span>
        </div>
      </div>

      {modalOpen && typeof document !== "undefined" && createPortal(
        <IconPickerModal
          currentId={currentId}
          canRevert={!!committedIcons[k]}
          onClose={() => setModalOpen(false)}
          onApply={(iconId) => {
            setIconDraft(k, iconId);
            setModalOpen(false);
          }}
          onRevert={async () => {
            await revertElement(k, "icon");
            setModalOpen(false);
          }}
        />,
        document.body
      )}
    </>
  );
}

function IconPickerModal({
  currentId,
  canRevert,
  onClose,
  onApply,
  onRevert,
}: {
  currentId: string;
  canRevert: boolean;
  onClose: () => void;
  onApply: (iconId: string) => void;
  onRevert: () => void;
}) {
  const [category, setCategory] = useState<IconCategory | "all">("all");
  const [selected, setSelected] = useState(currentId);

  const filtered = category === "all" ? ICON_LIBRARY : ICON_LIBRARY.filter((e) => e.category === category);

  return (
    <div className="fixed inset-0 z-[200] flex items-start justify-center pt-[10vh] px-4" onClick={onClose}>
      <div className="absolute inset-0 bg-stone-950/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-xl bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border border-stone-200/60 dark:border-stone-700 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 dark:border-stone-800">
          <h2 className="font-display font-semibold text-stone-800 dark:text-stone-100">Choose an icon</h2>
          <button onClick={onClose} className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="px-5 pt-4 flex flex-wrap gap-1.5">
          {ICON_CATEGORIES.map((c) => (
            <button
              key={c.value}
              onClick={() => setCategory(c.value)}
              className={`px-3 py-1.5 rounded-full text-xs font-medium transition ${
                category === c.value
                  ? "bg-primary-600 text-cream"
                  : "bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700"
              }`}
            >
              {c.label}
            </button>
          ))}
        </div>

        <div className="p-5 grid grid-cols-6 sm:grid-cols-8 gap-2 max-h-72 overflow-y-auto">
          {filtered.map((entry) => {
            const EntryIcon = entry.Icon;
            const isSelected = selected === entry.id;
            return (
              <button
                key={entry.id}
                onClick={() => setSelected(entry.id)}
                title={entry.label}
                className={`aspect-square rounded-xl flex items-center justify-center border-2 transition ${
                  isSelected
                    ? "border-primary-500 bg-primary-50 dark:bg-primary-950/30 text-primary-600"
                    : "border-transparent bg-stone-50 dark:bg-stone-800 text-stone-500 dark:text-stone-400 hover:border-stone-200 dark:hover:border-stone-600"
                }`}
              >
                <EntryIcon className="w-5 h-5" />
              </button>
            );
          })}
        </div>

        <div className="flex items-center justify-between px-5 py-4 border-t border-stone-100 dark:border-stone-800">
          {canRevert ? (
            <button
              onClick={onRevert}
              className="inline-flex items-center gap-1.5 text-xs font-medium text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition"
            >
              <RotateCcw className="w-3.5 h-3.5" /> Revert to default
            </button>
          ) : <span />}
          <div className="flex items-center gap-2">
            <button onClick={onClose} className="px-3.5 py-2 text-xs font-medium rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 transition">
              Cancel
            </button>
            <button
              onClick={() => onApply(selected)}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-primary-600 hover:bg-primary-700 text-cream transition"
            >
              Apply icon
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
