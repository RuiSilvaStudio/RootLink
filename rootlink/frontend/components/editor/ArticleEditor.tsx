"use client";

import { useEffect, useRef, useCallback } from "react";

interface ArticleEditorProps {
  data?: any;
  onChange?: (data: any) => void;
  readOnly?: boolean;
  onError?: (message: string) => void;
}

export default function ArticleEditor({ data, onChange, readOnly = false, onError }: ArticleEditorProps) {
  const editorRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;
  const onErrorRef = useRef(onError);
  onErrorRef.current = onError;

  useEffect(() => {
    if (!containerRef.current) return;

    let editor: any = null;
    let mounted = true;

    async function initEditor() {
      const EditorJS = (await import("@editorjs/editorjs")).default;
      const Header = (await import("@editorjs/header")).default;
      const Paragraph = (await import("@editorjs/paragraph")).default;
      const List = (await import("@editorjs/list")).default;
      const Image = (await import("@editorjs/image")).default;
      const Embed = (await import("@editorjs/embed")).default;
      const Quote = (await import("@editorjs/quote")).default;
      const Code = (await import("@editorjs/code")).default;
      const Table = (await import("@editorjs/table")).default;
      const LinkTool = (await import("@editorjs/link")).default;
      const Marker = (await import("@editorjs/marker")).default;
      const InlineCode = (await import("@editorjs/inline-code")).default;
      const Checklist = (await import("@editorjs/checklist")).default;

      if (!mounted) return;

      const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8001";
      const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;

      editor = new EditorJS({
        holder: containerRef.current!,
        readOnly,
        data: data || undefined,
        placeholder: "Start writing your article...",
        onChange: async () => {
          if (onChangeRef.current && editor) {
            const output = await editor.save();
            onChangeRef.current(output);
          }
        },
        tools: {
          header: {
            class: Header as any,
            config: { placeholder: "Heading", levels: [2, 3, 4], defaultLevel: 2 },
          },
          paragraph: {
            class: Paragraph as any,
            inlineToolbar: true,
          },
          list: { class: List as any, inlineToolbar: true },
          image: {
            class: Image as any,
            config: {
              uploader: {
                async uploadByFile(file: File) {
                  const formData = new FormData();
                  formData.append("file", file);
                  try {
                    const res = await fetch(`${API_URL}/api/images/upload`, {
                      method: "POST",
                      headers: token ? { Authorization: `Bearer ${token}` } : {},
                      body: formData,
                    });
                    const json = await res.json().catch(() => null);
                    if (!res.ok) {
                      const detail = json?.detail || `Upload failed (${res.status})`;
                      onErrorRef.current?.(detail);
                      return { success: 0 };
                    }
                    const url = json?.asset?.urls?.large || json?.url;
                    if (!url) {
                      onErrorRef.current?.("Upload succeeded but no image URL was returned.");
                      return { success: 0 };
                    }
                    return { success: 1, file: { url } };
                  } catch (e: any) {
                    onErrorRef.current?.(e?.message || "Network error while uploading image.");
                    return { success: 0 };
                  }
                },
                async uploadByUrl(url: string) {
                  return { success: 1, file: { url } };
                },
              },
            },
          },
          embed: { class: Embed as any, config: { services: { youtube: true, vimeo: true } } },
          quote: { class: Quote as any, inlineToolbar: true },
          code: { class: Code as any },
          table: { class: Table as any, inlineToolbar: true },
          linkTool: { class: LinkTool as any, config: { endpoint: `${API_URL}/api/content/link-preview` } },
          marker: { class: Marker as any },
          inlineCode: { class: InlineCode as any },
          checklist: { class: Checklist as any, inlineToolbar: true },
        },
      });

      editorRef.current = editor;
    }

    initEditor();

    // After Editor.js renders, ensure all links open in a new tab and
    // images get a fallback on repeated load failure.
    const ensureLinkTargets = () => {
      if (!containerRef.current) return;
      const links = containerRef.current.querySelectorAll("a[href]");
      links.forEach((a: Element) => {
        const anchor = a as HTMLAnchorElement;
        anchor.target = "_blank";
        anchor.rel = "noopener noreferrer";
      });
    };

    const handleImageError = (e: Event) => {
      const img = e.target as HTMLImageElement;
      if (!img || !img.src) return;
      const key = img.src;
      const count = (img.dataset.failCount as unknown as number) || 0;
      const next = Number(count) + 1;
      img.dataset.failCount = String(next);
      if (next >= 3) {
        img.src = "/images/placeholder-card.svg";
        img.alt = "Image unavailable";
      }
    };

    // Run after Editor.js has time to render (it's async).
    const interval = setInterval(ensureLinkTargets, 1000);
    setTimeout(ensureLinkTargets, 500);
    setTimeout(ensureLinkTargets, 2000);

    const container = containerRef.current;
    if (container) {
      container.addEventListener("error", handleImageError, true);
    }

    return () => {
      mounted = false;
      clearInterval(interval);
      if (container) {
        container.removeEventListener("error", handleImageError, true);
      }
      if (editor && typeof editor.destroy === "function") {
        editor.destroy();
      }
    };
  }, [readOnly]); // eslint-disable-line react-hooks/exhaustive-deps -- editor re-init only on readOnly; `data` intentionally excluded to avoid rebuilding on every change

  return (
    <div
      ref={containerRef}
      className="prose prose-stone dark:prose-invert max-w-none
        [&_.ce-block__content]:max-w-none
        [&_.ce-toolbar__content]:max-w-none
        [&_.cdx-block]:max-w-none
        dark:[&_.ce-block]:bg-stone-900
        dark:[&_.ce-toolbar]:bg-stone-900
        dark:[&_.ce-popover]:bg-stone-800
        dark:[&_.ce-inline-toolbar]:bg-stone-800"
    />
  );
}

export function useEditorSave() {
  const editorRef = useRef<any>(null);

  const save = useCallback(async () => {
    if (editorRef.current) {
      return await editorRef.current.save();
    }
    return null;
  }, []);

  return { editorRef, save };
}
