"use client";

/**
 * Content Studio — Blocks module.
 *
 * The block composer: create block-composed pages, add/reorder/edit
 * sections from the block registry, publish, and view live.
 *
 * Spec: docs/content-studio/CONTENT_STUDIO.md §6.
 *
 * Layout: left = page list + section palette; right = the page canvas
 * (sections in order, editable props, live preview via BlockRenderer).
 * Mobile: stacked — page select + sections list + property editor.
 */

import { useState, useEffect, useCallback } from "react";
import { Plus, Trash2, ChevronUp, ChevronDown, Eye, Loader2, ExternalLink } from "lucide-react";
import { useToast } from "@/lib/toast-context";
import { api } from "@/lib/api";
import { BLOCK_REGISTRY, getBlockType, defaultPropsFor } from "@/lib/block-registry";
import { BlockRenderer, type BlockSectionData } from "@/components/blocks";
import { useAuth } from "@/lib/auth-context";

interface BlockPageData {
  id: number;
  slug: string;
  label: string;
  is_published: boolean;
  sections: BlockSectionData[];
}

export default function BlocksPage() {
  const { addToast } = useToast();
  const { user } = useAuth();
  const [pages, setPages] = useState<BlockPageData[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [editingSectionId, setEditingSectionId] = useState<number | null>(null);
  const [creatingPage, setCreatingPage] = useState(false);
  const [newPageSlug, setNewPageSlug] = useState("");
  const [newPageLabel, setNewPageLabel] = useState("");

  const fetchPages = useCallback(async () => {
    try {
      const data = await api.blocks.adminListPages();
      setPages(data);
      if (data.length > 0 && selectedPageId === null) {
        setSelectedPageId(data[0].id);
      }
    } catch {
      // Non-fatal
    } finally {
      setLoading(false);
    }
  }, [selectedPageId]);

  useEffect(() => {
    fetchPages();
  }, [fetchPages]);

  const selectedPage = pages.find((p) => p.id === selectedPageId);

  const createPage = async () => {
    if (!newPageSlug.trim() || !newPageLabel.trim()) return;
    try {
      await api.blocks.createPage({ slug: newPageSlug, label: newPageLabel });
      setNewPageSlug("");
      setNewPageLabel("");
      setCreatingPage(false);
      await fetchPages();
      // Select the newly created page (find by slug)
      const updated = await api.blocks.adminListPages();
      const newPage = updated.find((p) => p.slug === newPageSlug);
      if (newPage) setSelectedPageId(newPage.id);
      addToast("success", "Page created");
    } catch (e: any) {
      addToast("error", e?.message || "Failed to create page");
    }
  };

  const addSection = async (blockTypeId: string) => {
    if (!selectedPage) return;
    try {
      const props = defaultPropsFor(blockTypeId);
      const order = selectedPage.sections.length;
      await api.blocks.addSection(selectedPage.id, { block_type: blockTypeId, props, order });
      await fetchPages();
      addToast("success", "Section added");
    } catch (e: any) {
      addToast("error", e?.message || "Failed to add section");
    }
  };

  const updateSectionProps = async (sectionId: number, props: Record<string, string>) => {
    try {
      await api.blocks.updateSection(sectionId, { props });
      await fetchPages();
    } catch (e: any) {
      addToast("error", e?.message || "Failed to update");
    }
  };

  const moveSection = async (sectionId: number, direction: "up" | "down") => {
    if (!selectedPage) return;
    const sections = [...selectedPage.sections].sort((a, b) => a.order - b.order);
    const idx = sections.findIndex((s) => s.id === sectionId);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sections.length) return;
    const a = sections[idx];
    const b = sections[swapIdx];
    await Promise.all([
      api.blocks.updateSection(a.id, { order: b.order }),
      api.blocks.updateSection(b.id, { order: a.order }),
    ]);
    await fetchPages();
  };

  const deleteSection = async (sectionId: number) => {
    try {
      await api.blocks.deleteSection(sectionId);
      await fetchPages();
      addToast("info", "Section deleted");
    } catch (e: any) {
      addToast("error", e?.message || "Failed to delete");
    }
  };

  const togglePublish = async (page: BlockPageData) => {
    try {
      await api.blocks.updatePage(page.id, { is_published: !page.is_published });
      await fetchPages();
      addToast("success", page.is_published ? "Unpublished" : "Published");
    } catch (e: any) {
      addToast("error", e?.message || "Failed to toggle");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <Loader2 className="w-5 h-5 animate-spin text-stone-400" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-6 py-4 border-b border-primary-200/40 dark:border-stone-800 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-semibold text-stone-800 dark:text-stone-100">
            Blocks
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            Compose pages from reusable blocks — sections, elements, layout
          </p>
        </div>
        <button
          onClick={() => setCreatingPage(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary-600 hover:bg-primary-700 text-cream transition"
        >
          <Plus className="w-3.5 h-3.5" /> New page
        </button>
      </div>

      <div className="flex-1 flex min-h-0 flex-col lg:flex-row">
        {/* Left: page list + block palette */}
        <div className="lg:w-64 shrink-0 border-b lg:border-b-0 lg:border-r border-primary-200/40 dark:border-stone-800 p-3 overflow-y-auto">
          {/* Page list */}
          <p className="px-1 pt-1 pb-2 text-[10px] uppercase tracking-wider text-stone-400 font-medium">
            Pages
          </p>
          <div className="space-y-1 mb-4">
            {pages.map((page) => (
              <button
                key={page.id}
                onClick={() => setSelectedPageId(page.id)}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-sm transition ${
                  selectedPageId === page.id
                    ? "bg-primary-600 text-cream"
                    : "text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800"
                }`}
              >
                <span className="truncate">{page.label}</span>
                <span className={`text-[10px] ${selectedPageId === page.id ? "text-cream/60" : page.is_published ? "text-emerald-500" : "text-stone-400"}`}>
                  {page.is_published ? "●" : "○"}
                </span>
              </button>
            ))}
            {pages.length === 0 && (
              <p className="px-2 py-4 text-xs text-stone-400 text-center">No pages yet</p>
            )}
          </div>

          {/* Block palette */}
          <p className="px-1 pt-2 pb-2 text-[10px] uppercase tracking-wider text-stone-400 font-medium">
            Add block
          </p>
          <div className="space-y-1">
            {BLOCK_REGISTRY.map((block) => (
              <button
                key={block.id}
                onClick={() => addSection(block.id)}
                disabled={!selectedPage}
                className="w-full flex items-center gap-2 px-2.5 py-2 rounded-md text-sm text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800 transition disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <Plus className="w-3.5 h-3.5 shrink-0 text-primary-500" />
                <span>{block.label}</span>
                <span className="ml-auto text-[9px] uppercase text-stone-400">{block.category}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Right: page canvas */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6">
          {selectedPage ? (
            <div className="max-w-4xl mx-auto">
              {/* Page header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="font-display text-lg font-semibold text-stone-800 dark:text-stone-100">
                    {selectedPage.label}
                  </h2>
                  <code className="text-xs text-stone-400 font-mono">/p/{selectedPage.slug}</code>
                </div>
                <div className="flex items-center gap-2">
                  <a
                    href={`/p/${selectedPage.slug}`}
                    target="_blank"
                    className="flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition"
                  >
                    <ExternalLink className="w-3.5 h-3.5" /> View
                  </a>
                  <button
                    onClick={() => togglePublish(selectedPage)}
                    className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg transition ${
                      selectedPage.is_published
                        ? "bg-emerald-600 hover:bg-emerald-700 text-white"
                        : "bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300"
                    }`}
                  >
                    {selectedPage.is_published ? "Published" : "Publish"}
                  </button>
                </div>
              </div>

              {/* Sections */}
              {selectedPage.sections.length === 0 ? (
                <div className="text-center py-20 border-2 border-dashed border-stone-200 dark:border-stone-800 rounded-xl2">
                  <p className="text-sm text-stone-400 font-serif">
                    No sections yet. Add a block from the palette on the left.
                  </p>
                </div>
              ) : (
                <div className="space-y-4">
                  {[...selectedPage.sections]
                    .sort((a, b) => a.order - b.order)
                    .map((section, idx, arr) => {
                      const blockType = getBlockType(section.block_type);
                      const isEditing = editingSectionId === section.id;
                      return (
                        <div
                          key={section.id}
                          className="rounded-xl2 border border-primary-200/60 dark:border-stone-800 bg-white dark:bg-stone-900 overflow-hidden"
                        >
                          {/* Section toolbar */}
                          <div className="flex items-center justify-between px-4 py-2 border-b border-primary-200/30 dark:border-stone-800/50 bg-stone-50/50 dark:bg-stone-800/30">
                            <span className="text-xs font-medium text-stone-500 dark:text-stone-400">
                              {blockType?.label || section.block_type}
                            </span>
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => moveSection(section.id, "up")}
                                disabled={idx === 0}
                                className="p-1 rounded text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 disabled:opacity-30"
                                title="Move up"
                              >
                                <ChevronUp className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => moveSection(section.id, "down")}
                                disabled={idx === arr.length - 1}
                                className="p-1 rounded text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 disabled:opacity-30"
                                title="Move down"
                              >
                                <ChevronDown className="w-3.5 h-3.5" />
                              </button>
                              <button
                                onClick={() => setEditingSectionId(isEditing ? null : section.id)}
                                className="px-2 py-1 text-xs font-medium rounded text-primary-600 dark:text-primary-400 hover:bg-primary-50 dark:hover:bg-primary-950/30"
                              >
                                {isEditing ? "Done" : "Edit"}
                              </button>
                              <button
                                onClick={() => deleteSection(section.id)}
                                className="p-1 rounded text-stone-400 hover:text-red-500"
                                title="Delete section"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>

                          {/* Section content: live preview or property editor */}
                          {isEditing ? (
                            <SectionEditor
                              section={section}
                              onSave={(props) => {
                                updateSectionProps(section.id, props);
                                setEditingSectionId(null);
                              }}
                            />
                          ) : (
                            <div className="p-4">
                              <BlockRenderer sections={[section]} />
                            </div>
                          )}
                        </div>
                      );
                    })}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-20">
              <p className="text-sm text-stone-400 font-serif">
                Select a page or create a new one to start composing.
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Create page modal */}
      {creatingPage && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center px-4"
          onClick={() => setCreatingPage(false)}
        >
          <div className="absolute inset-0 bg-stone-950/40 backdrop-blur-sm" />
          <div
            className="relative w-full max-w-md bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border border-stone-200/60 dark:border-stone-700 p-6"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display font-semibold text-stone-800 dark:text-stone-100 mb-4">
              New page
            </h2>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1.5">
                  Label
                </label>
                <input
                  type="text"
                  value={newPageLabel}
                  onChange={(e) => setNewPageLabel(e.target.value)}
                  placeholder="My landing page"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1.5">
                  Slug (URL)
                </label>
                <div className="flex items-center gap-1">
                  <span className="text-sm text-stone-400 font-mono">/p/</span>
                  <input
                    type="text"
                    value={newPageSlug}
                    onChange={(e) => setNewPageSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                    placeholder="my-landing"
                    className="flex-1 px-3 py-2 text-sm rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 focus:outline-none focus:ring-1 focus:ring-primary-500 font-mono"
                  />
                </div>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={() => setCreatingPage(false)}
                className="px-3 py-2 text-xs font-medium rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800"
              >
                Cancel
              </button>
              <button
                onClick={createPage}
                disabled={!newPageSlug.trim() || !newPageLabel.trim()}
                className="px-4 py-2 text-xs font-semibold rounded-lg bg-primary-600 hover:bg-primary-700 text-cream disabled:opacity-50"
              >
                Create
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/** Property editor for a single section — renders fields from the block registry. */
function SectionEditor({
  section,
  onSave,
}: {
  section: BlockSectionData;
  onSave: (props: Record<string, string>) => void;
}) {
  const blockType = getBlockType(section.block_type);
  const [props, setProps] = useState<Record<string, string>>(section.props || {});

  if (!blockType) return <p className="p-4 text-sm text-stone-400">Unknown block type</p>;

  return (
    <div className="p-4 space-y-3">
      {blockType.fields.map((field) => (
        <div key={field.name}>
          <label className="block text-xs font-medium text-stone-500 dark:text-stone-400 mb-1.5">
            {field.label}
          </label>
          {field.type === "textarea" ? (
            <textarea
              value={props[field.name] || ""}
              onChange={(e) => setProps((prev) => ({ ...prev, [field.name]: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 text-sm rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 focus:outline-none focus:ring-1 focus:ring-primary-500 font-serif resize-y"
            />
          ) : (
            <input
              type="text"
              value={props[field.name] || ""}
              onChange={(e) => setProps((prev) => ({ ...prev, [field.name]: e.target.value }))}
              className="w-full px-3 py-2 text-sm rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
            />
          )}
        </div>
      ))}
      <div className="flex justify-end pt-2">
        <button
          onClick={() => onSave(props)}
          className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary-600 hover:bg-primary-700 text-cream"
        >
          Save section
        </button>
      </div>
    </div>
  );
}
