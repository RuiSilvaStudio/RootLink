"use client";

import { useEffect, useRef, useCallback } from "react";

interface ArticleEditorProps {
  data?: any;
  onChange?: (data: any) => void;
  readOnly?: boolean;
}

export default function ArticleEditor({ data, onChange, readOnly = false }: ArticleEditorProps) {
  const editorRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

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
                  const res = await fetch(`${API_URL}/api/images/upload`, {
                    method: "POST",
                    headers: token ? { Authorization: `Bearer ${token}` } : {},
                    body: formData,
                  });
                  const json = await res.json();
                  return { success: 1, file: { url: json.asset ? `${API_URL}${json.asset.path_large}` : json.url } };
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
          linkTool: { class: LinkTool as any },
          marker: { class: Marker as any },
          inlineCode: { class: InlineCode as any },
          checklist: { class: Checklist as any, inlineToolbar: true },
        },
      });

      editorRef.current = editor;
    }

    initEditor();

    return () => {
      mounted = false;
      if (editor && typeof editor.destroy === "function") {
        editor.destroy();
      }
    };
  }, [readOnly]);

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
