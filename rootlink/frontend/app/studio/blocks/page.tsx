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
import { Plus, Trash2, ChevronUp, ChevronDown, Eye, ExternalLink } from "lucide-react";
import { toast } from "sonner";
import { api } from "@/lib/api";
import { BLOCK_REGISTRY, getBlockType, defaultPropsFor } from "@/lib/block-registry";
import { BlockRenderer, type BlockSectionData } from "@/components/blocks";
import { useAuth } from "@/lib/auth-context";
import { Button, Input, Select, Textarea, Tooltip, Modal, EmptyState } from "@/components/ui";
import { ListSkeleton, CardSkeleton, TextSkeleton } from "@/components/ui/LoadingSkeleton";
import { ResizableSplit } from "@/components/ui/ResizableSplit";
import { LoadError } from "@/components/studio/LoadError";

interface BlockPageData {
  id: number;
  slug: string;
  label: string;
  is_published: boolean;
  sections: BlockSectionData[];
}

export default function BlocksPage() {
  const { user } = useAuth();
  const [pages, setPages] = useState<BlockPageData[]>([]);
  const [selectedPageId, setSelectedPageId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [editingSectionId, setEditingSectionId] = useState<number | null>(null);
  const [creatingPage, setCreatingPage] = useState(false);
  const [newPageSlug, setNewPageSlug] = useState("");
  const [newPageLabel, setNewPageLabel] = useState("");

  const fetchPages = useCallback(async () => {
    try {
      const data = await api.blocks.adminListPages();
      setPages(data);
      setLoadError(false);
      if (data.length > 0 && selectedPageId === null) {
        setSelectedPageId(data[0].id);
      }
    } catch {
      setLoadError(true);
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
      toast.success("Page created");
    } catch (e: any) {
      toast.error(e?.message || "Failed to create page");
    }
  };

  const addSection = async (blockTypeId: string) => {
    if (!selectedPage) return;
    try {
      const props = defaultPropsFor(blockTypeId);
      const order = selectedPage.sections.length;
      await api.blocks.addSection(selectedPage.id, { block_type: blockTypeId, props, order });
      await fetchPages();
      toast.success("Section added");
    } catch (e: any) {
      toast.error(e?.message || "Failed to add section");
    }
  };

  const updateSectionProps = async (sectionId: number, props: Record<string, string>) => {
    try {
      await api.blocks.updateSection(sectionId, { props });
      await fetchPages();
    } catch (e: any) {
      toast.error(e?.message || "Failed to update");
    }
  };

  const moveSection = async (sectionId: number, direction: "up" | "down") => {
    if (!selectedPage) return;
    const pageId = selectedPage.id;
    const sections = [...selectedPage.sections].sort((a, b) => a.order - b.order);
    const idx = sections.findIndex((s) => s.id === sectionId);
    if (idx < 0) return;
    const swapIdx = direction === "up" ? idx - 1 : idx + 1;
    if (swapIdx < 0 || swapIdx >= sections.length) return;
    const a = sections[idx];
    const b = sections[swapIdx];
    // Optimistic: swap the two sections' orders in local state immediately.
    // The same swap applied twice is a no-op, so it doubles as the revert.
    const swapOrders = (prev: BlockPageData[]) =>
      prev.map((p) =>
        p.id !== pageId
          ? p
          : {
              ...p,
              sections: p.sections.map((s) =>
                s.id === a.id ? { ...s, order: b.order } : s.id === b.id ? { ...s, order: a.order } : s
              ),
            }
      );
    setPages(swapOrders);
    try {
      await Promise.all([
        api.blocks.updateSection(a.id, { order: b.order }),
        api.blocks.updateSection(b.id, { order: a.order }),
      ]);
    } catch (e: any) {
      setPages(swapOrders); // revert the optimistic swap
      toast.error(e?.message || "Failed to reorder section");
    }
  };

  const deleteSection = async (sectionId: number) => {
    if (!window.confirm("Delete this section? This cannot be undone.")) return;
    try {
      await api.blocks.deleteSection(sectionId);
      await fetchPages();
      toast.info("Section deleted");
    } catch (e: any) {
      toast.error(e?.message || "Failed to delete");
    }
  };

  const togglePublish = async (page: BlockPageData) => {
    try {
      await api.blocks.updatePage(page.id, { is_published: !page.is_published });
      await fetchPages();
      toast.success(page.is_published ? "Unpublished" : "Published");
    } catch (e: any) {
      toast.error(e?.message || "Failed to toggle");
    }
  };

  if (loading) {
    return (
      <div className="flex h-full min-h-[60vh]">
        <div className="hidden lg:block w-64 shrink-0 border-r border-primary-200/40 dark:border-stone-800 p-3">
          <ListSkeleton rows={7} />
        </div>
        <div className="flex-1 p-4 lg:p-6">
          <div className="max-w-4xl mx-auto">
            <TextSkeleton lines={1} className="max-w-xs mb-6" />
            <div className="space-y-4">
              <CardSkeleton />
              <CardSkeleton />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-6 max-w-xl">
        <LoadError onRetry={fetchPages} />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 px-6 py-4 border-b border-primary-200/40 dark:border-stone-800 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-semibold text-stone-800 dark:text-stone-100">
            Blocks
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            Compose pages from reusable blocks — sections, elements, layout
          </p>
        </div>
        <Button size="xs" onClick={() => setCreatingPage(true)}>
          <Plus className="w-3.5 h-3.5" /> New page
        </Button>
      </div>

      {/* Mobile: page list + block palette (stacked) */}
      <div className="lg:hidden shrink-0 border-b border-primary-200/40 dark:border-stone-800 p-3 max-h-[40vh] overflow-y-auto">
        <p className="px-1 pb-2 text-xs uppercase tracking-wider text-stone-400 font-medium">Pages</p>
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
              <span className={`text-xs ${selectedPageId === page.id ? "text-cream/60" : page.is_published ? "text-emerald-500" : "text-stone-400"}`}>
                {page.is_published ? "●" : "○"}
              </span>
            </button>
          ))}
        </div>
        <p className="px-1 pt-2 pb-2 text-xs uppercase tracking-wider text-stone-400 font-medium">Add block</p>
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
              <span className="ml-auto text-xs uppercase text-stone-400">{block.category}</span>
            </button>
          ))}
        </div>
      </div>

      <ResizableSplit
        defaultWidth={256}
        minWidth={192}
        maxWidth={384}
        className="flex-1"
        leftClassName="hidden lg:block"
        left={
          <div className="h-full border-r border-primary-200/40 dark:border-stone-800 p-3 overflow-y-auto">
            {/* Page list */}
            <p className="px-1 pt-1 pb-2 text-xs uppercase tracking-wider text-stone-400 font-medium">
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
              <span className={`text-xs ${selectedPageId === page.id ? "text-cream/60" : page.is_published ? "text-emerald-500" : "text-stone-400"}`}>
                    {page.is_published ? "●" : "○"}
                  </span>
                </button>
              ))}
              {pages.length === 0 && (
                <p className="px-2 py-4 text-xs text-stone-400 text-center">No pages yet</p>
              )}
            </div>

            {/* Block palette */}
            <p className="px-1 pt-2 pb-2 text-xs uppercase tracking-wider text-stone-400 font-medium">
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
                  <span className="ml-auto text-xs uppercase text-stone-400">{block.category}</span>
                </button>
              ))}
            </div>
          </div>
        }
        right={
          <div className="h-full overflow-y-auto p-4 lg:p-6">
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
                  <Button
                    size="xs"
                    variant={selectedPage.is_published ? "secondary" : "primary"}
                    onClick={() => togglePublish(selectedPage)}
                  >
                    {selectedPage.is_published ? "Published" : "Publish"}
                  </Button>
                </div>
              </div>

              {/* Sections */}
              {selectedPage.sections.length === 0 ? (
                <EmptyState title="No sections yet" message="Add a block from the palette on the left." />
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
                              <Tooltip content="Move up">
                                <button
                                  onClick={() => moveSection(section.id, "up")}
                                  disabled={idx === 0}
                                  aria-label="Move section up"
                                  className="p-1 rounded text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 disabled:opacity-30"
                                >
                                  <ChevronUp className="w-3.5 h-3.5" />
                                </button>
                              </Tooltip>
                              <Tooltip content="Move down">
                                <button
                                  onClick={() => moveSection(section.id, "down")}
                                  disabled={idx === arr.length - 1}
                                  aria-label="Move section down"
                                  className="p-1 rounded text-stone-400 hover:text-stone-700 dark:hover:text-stone-200 disabled:opacity-30"
                                >
                                  <ChevronDown className="w-3.5 h-3.5" />
                                </button>
                              </Tooltip>
                              <Button
                                size="xs"
                                variant="ghost"
                                onClick={() => setEditingSectionId(isEditing ? null : section.id)}
                              >
                                {isEditing ? "Done" : "Edit"}
                              </Button>
                              <Tooltip content="Delete section">
                                <button
                                  onClick={() => deleteSection(section.id)}
                                  aria-label="Delete section"
                                  className="p-1 rounded text-stone-400 hover:text-red-500"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </button>
                              </Tooltip>
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
            <EmptyState title="No page selected" message="Select a page or create a new one to start composing." />
          )}
          </div>
        }
      />

      {/* Create page modal */}
      <Modal
        open={creatingPage}
        onClose={() => setCreatingPage(false)}
        title="New page"
        footer={
          <>
            <Button size="xs" variant="ghost" onClick={() => setCreatingPage(false)}>
              Cancel
            </Button>
            <Button
              size="xs"
              onClick={createPage}
              disabled={!newPageSlug.trim() || !newPageLabel.trim()}
            >
              Create
            </Button>
          </>
        }
      >
        <div className="space-y-3">
          <Input
            label="Label"
            id="new-page-label"
            type="text"
            value={newPageLabel}
            onChange={(e) => setNewPageLabel(e.target.value)}
            placeholder="My landing page"
          />
          <div>
            <label
              htmlFor="new-page-slug"
              className="block text-sm font-display font-medium text-stone-700 dark:text-stone-300 tracking-wide mb-1.5"
            >
              Slug (URL)
            </label>
            <div className="flex items-center gap-1">
              <span className="text-sm text-stone-400 font-mono">/p/</span>
              <div className="flex-1">
                <Input
                  id="new-page-slug"
                  type="text"
                  value={newPageSlug}
                  onChange={(e) => setNewPageSlug(e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, "-"))}
                  placeholder="my-landing"
                  className="font-mono"
                />
              </div>
            </div>
          </div>
        </div>
      </Modal>
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
          {field.type === "select" ? (
            <Select
              label={field.label}
              id={`block-field-${field.name}`}
              options={field.options}
              value={props[field.name] || field.default || ""}
              onChange={(e) => setProps((prev) => ({ ...prev, [field.name]: e.target.value }))}
            />
          ) : field.type === "textarea" ? (
            <Textarea
              label={field.label}
              id={`block-field-${field.name}`}
              value={props[field.name] || ""}
              onChange={(e) => setProps((prev) => ({ ...prev, [field.name]: e.target.value }))}
              rows={3}
              className="font-serif"
            />
          ) : (
            <Input
              label={field.label}
              id={`block-field-${field.name}`}
              type="text"
              value={props[field.name] || ""}
              onChange={(e) => setProps((prev) => ({ ...prev, [field.name]: e.target.value }))}
            />
          )}
        </div>
      ))}
      <div className="flex justify-end pt-2">
        <Button size="xs" onClick={() => onSave(props)}>
          Save section
        </Button>
      </div>
    </div>
  );
}
