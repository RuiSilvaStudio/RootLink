"use client";

/**
 * Wraps a static site-chrome image so it becomes replaceable while Editor
 * Mode is active (super_admin only). Outside editor mode it's a plain <img>.
 *
 * Upload reuses the existing content-addressed pipeline (components/ui/
 * ImageUpload.tsx -> POST /api/images/upload) — no new storage code.
 *
 * Usage: <EditableImage k="home.hero.image" defaultSrc="/images/hero.jpg" defaultAlt="..." />
 */

import { useState } from "react";
import { createPortal } from "react-dom";
import { ImageIcon, X, Link as LinkIcon, RotateCcw } from "lucide-react";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { useEditorMode, ImageValue } from "./editor-mode-provider";

interface EditableImageProps {
  k: string;
  defaultSrc: string;
  defaultAlt: string;
  className?: string;
  imgClassName?: string;
}

export function EditableImage({ k, defaultSrc, defaultAlt, className, imgClassName }: EditableImageProps) {
  const { mode, isSuperAdmin, imageDrafts, committedImages, setImageDraft, revertElement } = useEditorMode();
  const [modalOpen, setModalOpen] = useState(false);

  const current: ImageValue = imageDrafts[k] ?? committedImages[k] ?? { url: defaultSrc, alt: defaultAlt };
  const imgEl = <img src={current.url} alt={current.alt} className={imgClassName} loading="lazy" />;

  if (!isSuperAdmin || mode !== "editor") return imgEl;

  return (
    <>
      <div
        className={`rl-editable-media ${className || ""}`}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setModalOpen(true);
        }}
        role="button"
        tabIndex={0}
      >
        {imgEl}
        <div className="rl-editable-media__badge">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-black/75 text-white text-xs font-medium px-3 py-1.5 backdrop-blur-sm">
            <ImageIcon className="w-3.5 h-3.5" /> Replace image
          </span>
        </div>
      </div>

      {modalOpen && typeof document !== "undefined" && createPortal(
        <ImagePickerModal
          initialAlt={current.alt}
          initialUrl={current.url}
          canRevert={!!committedImages[k]}
          onClose={() => setModalOpen(false)}
          onApply={(value) => {
            setImageDraft(k, value);
            setModalOpen(false);
          }}
          onRevert={async () => {
            await revertElement(k, "image");
            setModalOpen(false);
          }}
        />,
        document.body
      )}
    </>
  );
}

function ImagePickerModal({
  initialAlt,
  initialUrl,
  canRevert,
  onClose,
  onApply,
  onRevert,
}: {
  initialAlt: string;
  initialUrl: string;
  canRevert: boolean;
  onClose: () => void;
  onApply: (value: ImageValue) => void;
  onRevert: () => void;
}) {
  const [url, setUrl] = useState(initialUrl);
  const [alt, setAlt] = useState(initialAlt);

  return (
    <div
      className="fixed inset-0 z-[200] flex items-start justify-center pt-[10vh] px-4"
      onClick={onClose}
    >
      <div className="absolute inset-0 bg-stone-950/40 backdrop-blur-sm" />
      <div
        className="relative w-full max-w-lg bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border border-stone-200/60 dark:border-stone-700 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-stone-100 dark:border-stone-800">
          <h2 className="font-display font-semibold text-stone-800 dark:text-stone-100">Replace image</h2>
          <button onClick={onClose} className="p-1 text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 transition">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {url && (
            <div className="rounded-xl overflow-hidden border border-stone-100 dark:border-stone-800 bg-stone-50 dark:bg-stone-800">
              <img src={url} alt={alt} className="w-full h-40 object-cover" />
            </div>
          )}

          <ImageUpload
            label="Upload a new image"
            onUpload={(urls) => setUrl(urls.medium || urls.large || urls.original)}
          />

          <div className="flex items-center gap-2">
            <div className="flex-1 relative">
              <LinkIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-stone-400" />
              <input
                type="url"
                value={url.startsWith("data:") ? "" : url}
                onChange={(e) => setUrl(e.target.value)}
                placeholder="Or paste an image URL…"
                className="w-full pl-8 pr-3 py-2 text-sm rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1.5">
              Alt text <span className="text-stone-400 font-normal">(required for accessibility)</span>
            </label>
            <input
              type="text"
              value={alt}
              onChange={(e) => setAlt(e.target.value)}
              placeholder="Describe the image for screen readers…"
              className="w-full px-3 py-2 text-sm rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          </div>
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
              onClick={() => onApply({ url, alt })}
              disabled={!url || !alt}
              className="px-4 py-2 text-xs font-semibold rounded-lg bg-primary-600 hover:bg-primary-700 text-cream disabled:opacity-50 transition"
            >
              Apply image
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
