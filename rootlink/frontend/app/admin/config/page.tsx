"use client";

import { useState, useEffect, useCallback } from "react";
import { Settings, Plus, Trash2, Save, Tag, ChevronDown, ChevronRight } from "lucide-react";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/locale-context";
import { useToast } from "@/lib/toast-context";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

type Family = {
  id: number;
  value: string;
  label: string;
  label_pt: string;
  icon: string | null;
  sort_order: number;
  is_active: boolean;
  categories?: Category[];
};

type Category = {
  id: number;
  family_id: number;
  value: string;
  label: string;
  label_pt: string;
  sort_order: number;
  is_active: boolean;
};

export default function AdminConfigPage() {
  const { t, locale } = useLocale();
  const { addToast } = useToast();
  const [tree, setTree] = useState<Family[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedFamilies, setExpandedFamilies] = useState<Set<number>>(new Set());
  const [newFamily, setNewFamily] = useState({ value: "", label: "", label_pt: "", icon: "" });
  const [newCategory, setNewCategory] = useState<{ [familyId: number]: { value: string; label: string; label_pt: string } }>({});

  const fetchTree = useCallback(async () => {
    try {
      const data = await api.taxonomy.tree();
      setTree(data);
    } catch {
      addToast("error", "Failed to load taxonomy");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchTree();
  }, [fetchTree]);

  const toggleFamily = (id: number) => {
    setExpandedFamilies((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleAddFamily = async () => {
    if (!newFamily.value || !newFamily.label) {
      addToast("error", "Value and English label are required");
      return;
    }
    try {
      await api.taxonomy.adminCreateFamily({
        value: newFamily.value.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""),
        label: newFamily.label,
        label_pt: newFamily.label_pt || newFamily.label,
        icon: newFamily.icon || null,
        sort_order: tree.length + 1,
      });
      setNewFamily({ value: "", label: "", label_pt: "", icon: "" });
      await fetchTree();
      addToast("success", "Family added");
    } catch (err: any) {
      addToast("error", err.message);
    }
  };

  const handleDeleteFamily = async (id: number) => {
    if (!confirm("Delete this family and all its categories?")) return;
    try {
      await api.taxonomy.adminDeleteFamily(id);
      await fetchTree();
      addToast("success", "Family deleted");
    } catch (err: any) {
      addToast("error", err.message);
    }
  };

  const handleAddCategory = async (familyId: number) => {
    const nc = newCategory[familyId];
    if (!nc || !nc.value || !nc.label) {
      addToast("error", "Value and English label are required");
      return;
    }
    try {
      await api.taxonomy.adminCreateCategory(familyId, {
        value: nc.value.toLowerCase().replace(/\s+/g, "_").replace(/[^a-z0-9_]/g, ""),
        label: nc.label,
        label_pt: nc.label_pt || nc.label,
        sort_order: (tree.find((f) => f.id === familyId)?.categories?.length || 0) + 1,
      });
      setNewCategory({ ...newCategory, [familyId]: { value: "", label: "", label_pt: "" } });
      await fetchTree();
      addToast("success", "Category added");
    } catch (err: any) {
      addToast("error", err.message);
    }
  };

  const handleDeleteCategory = async (id: number) => {
    if (!confirm("Delete this category?")) return;
    try {
      await api.taxonomy.adminDeleteCategory(id);
      await fetchTree();
      addToast("success", "Category deleted");
    } catch (err: any) {
      addToast("error", err.message);
    }
  };

  const handleUpdateFamily = async (id: number, field: string, value: string) => {
    try {
      await api.taxonomy.adminUpdateFamily(id, { [field]: value });
    } catch (err: any) {
      addToast("error", err.message);
    }
  };

  const handleUpdateCategory = async (id: number, field: string, value: string) => {
    try {
      await api.taxonomy.adminUpdateCategory(id, { [field]: value });
    } catch (err: any) {
      addToast("error", err.message);
    }
  };

  return (
    <div>
      <div className="mb-6">
        <Badge variant="sage" className="mb-3">
          <Settings className="w-3 h-3 mr-1" />
          {t("admin.config")}
        </Badge>
        <h1 className="text-3xl sm:text-4xl font-display font-semibold text-stone-800 dark:text-stone-100 leading-[1.08]">
          {t("admin.config_title")}
        </h1>
        <p className="mt-3 text-stone-500 font-serif text-sm max-w-lg">
          {t("admin.config_description")}
        </p>
      </div>

      {/* Taxonomy Management */}
      <Card variant="plain" className="p-6 mb-6">
        <div className="flex items-center gap-2 mb-5">
          <Tag className="w-5 h-5 text-primary-500" />
          <h2 className="text-lg font-display font-semibold text-stone-800">
            {t("admin.taxonomy") || "Taxonomy"}
          </h2>
        </div>

        {loading ? (
          <div className="space-y-3 animate-pulse">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-12 bg-primary-100 dark:bg-primary-950/20/40 rounded-xl" />
            ))}
          </div>
        ) : (
          <>
            {/* Families list */}
            <div className="space-y-2 mb-6">
              {tree.map((fam) => (
                <div key={fam.id} className="border border-primary-100/60 rounded-xl overflow-hidden">
                  {/* Family row */}
                  <div className="flex items-center gap-2 bg-primary-50/30 p-3">
                    <button
                      onClick={() => toggleFamily(fam.id)}
                      className="p-1 text-stone-400 hover:text-primary-600 transition"
                      aria-label={expandedFamilies.has(fam.id) ? "Collapse" : "Expand"}
                    >
                      {expandedFamilies.has(fam.id) ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                    </button>
                    <div className="flex-1 grid grid-cols-4 gap-2">
                      <input
                        type="text"
                        value={fam.value}
                        onChange={(e) => {
                          setTree(tree.map((f) => f.id === fam.id ? { ...f, value: e.target.value } : f));
                        }}
                        onBlur={(e) => handleUpdateFamily(fam.id, "value", e.target.value)}
                        className="px-2 py-1.5 rounded-lg border border-primary-100 bg-white text-xs font-mono text-stone-700 focus:border-primary-400 focus:ring-1 focus:ring-primary-500/15"
                        aria-label="Family value"
                      />
                      <input
                        type="text"
                        value={fam.label}
                        onChange={(e) => {
                          setTree(tree.map((f) => f.id === fam.id ? { ...f, label: e.target.value } : f));
                        }}
                        onBlur={(e) => handleUpdateFamily(fam.id, "label", e.target.value)}
                        className="px-2 py-1.5 rounded-lg border border-primary-100 bg-white text-sm text-stone-700 focus:border-primary-400 focus:ring-1 focus:ring-primary-500/15"
                        aria-label="English label"
                      />
                      <input
                        type="text"
                        value={fam.label_pt}
                        onChange={(e) => {
                          setTree(tree.map((f) => f.id === fam.id ? { ...f, label_pt: e.target.value } : f));
                        }}
                        onBlur={(e) => handleUpdateFamily(fam.id, "label_pt", e.target.value)}
                        className="px-2 py-1.5 rounded-lg border border-primary-100 bg-white text-sm text-stone-700 focus:border-primary-400 focus:ring-1 focus:ring-primary-500/15"
                        aria-label="Portuguese label"
                      />
                      <input
                        type="text"
                        value={fam.icon || ""}
                        onChange={(e) => {
                          setTree(tree.map((f) => f.id === fam.id ? { ...f, icon: e.target.value } : f));
                        }}
                        onBlur={(e) => handleUpdateFamily(fam.id, "icon", e.target.value)}
                        className="px-2 py-1.5 rounded-lg border border-primary-100 bg-white text-xs font-mono text-stone-700 focus:border-primary-400 focus:ring-1 focus:ring-primary-500/15"
                        placeholder="Lucide icon"
                        aria-label="Icon name"
                      />
                    </div>
                    <button
                      onClick={() => handleDeleteFamily(fam.id)}
                      className="p-2 text-stone-400 hover:text-red-500 transition shrink-0"
                      aria-label={t("admin.remove_category")}
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>

                  {/* Categories (expanded) */}
                  {expandedFamilies.has(fam.id) && (
                    <div className="p-3 space-y-2 bg-white">
                      {fam.categories?.map((cat) => (
                        <div key={cat.id} className="flex items-center gap-2 pl-8">
                          <div className="flex-1 grid grid-cols-3 gap-2">
                            <input
                              type="text"
                              value={cat.value}
                              onChange={(e) => {
                                setTree(tree.map((f) => f.id === fam.id ? {
                                  ...f,
                                  categories: f.categories?.map((c) => c.id === cat.id ? { ...c, value: e.target.value } : c)
                                } : f));
                              }}
                              onBlur={(e) => handleUpdateCategory(cat.id, "value", e.target.value)}
                              className="px-2 py-1.5 rounded-lg border border-primary-100 bg-white text-xs font-mono text-stone-700 focus:border-primary-400 focus:ring-1 focus:ring-primary-500/15"
                            />
                            <input
                              type="text"
                              value={cat.label}
                              onChange={(e) => {
                                setTree(tree.map((f) => f.id === fam.id ? {
                                  ...f,
                                  categories: f.categories?.map((c) => c.id === cat.id ? { ...c, label: e.target.value } : c)
                                } : f));
                              }}
                              onBlur={(e) => handleUpdateCategory(cat.id, "label", e.target.value)}
                              className="px-2 py-1.5 rounded-lg border border-primary-100 bg-white text-sm text-stone-700 focus:border-primary-400 focus:ring-1 focus:ring-primary-500/15"
                            />
                            <input
                              type="text"
                              value={cat.label_pt}
                              onChange={(e) => {
                                setTree(tree.map((f) => f.id === fam.id ? {
                                  ...f,
                                  categories: f.categories?.map((c) => c.id === cat.id ? { ...c, label_pt: e.target.value } : c)
                                } : f));
                              }}
                              onBlur={(e) => handleUpdateCategory(cat.id, "label_pt", e.target.value)}
                              className="px-2 py-1.5 rounded-lg border border-primary-100 bg-white text-sm text-stone-700 focus:border-primary-400 focus:ring-1 focus:ring-primary-500/15"
                            />
                          </div>
                          <button
                            onClick={() => handleDeleteCategory(cat.id)}
                            className="p-2 text-stone-400 hover:text-red-500 transition shrink-0"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}

                      {/* Add category row */}
                      <div className="flex items-center gap-2 pl-8 pt-2 border-t border-primary-50">
                        <div className="flex-1 grid grid-cols-3 gap-2">
                          <input
                            type="text"
                            value={newCategory[fam.id]?.value || ""}
                            onChange={(e) => setNewCategory({ ...newCategory, [fam.id]: { ...(newCategory[fam.id] || { value: "", label: "", label_pt: "" }), value: e.target.value } })}
                            className="px-2 py-1.5 rounded-lg border border-primary-100 bg-white text-xs font-mono text-stone-700 focus:border-primary-400 focus:ring-1 focus:ring-primary-500/15"
                            placeholder="slug"
                          />
                          <input
                            type="text"
                            value={newCategory[fam.id]?.label || ""}
                            onChange={(e) => setNewCategory({ ...newCategory, [fam.id]: { ...(newCategory[fam.id] || { value: "", label: "", label_pt: "" }), label: e.target.value } })}
                            className="px-2 py-1.5 rounded-lg border border-primary-100 bg-white text-sm text-stone-700 focus:border-primary-400 focus:ring-1 focus:ring-primary-500/15"
                            placeholder="English label"
                          />
                          <input
                            type="text"
                            value={newCategory[fam.id]?.label_pt || ""}
                            onChange={(e) => setNewCategory({ ...newCategory, [fam.id]: { ...(newCategory[fam.id] || { value: "", label: "", label_pt: "" }), label_pt: e.target.value } })}
                            className="px-2 py-1.5 rounded-lg border border-primary-100 bg-white text-sm text-stone-700 focus:border-primary-400 focus:ring-1 focus:ring-primary-500/15"
                            placeholder="Portuguese label"
                          />
                        </div>
                        <Button variant="secondary" size="sm" onClick={() => handleAddCategory(fam.id)}>
                          <Plus className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Add new family */}
            <div className="border-t border-primary-100 pt-4">
              <p className="text-xs font-display font-semibold text-stone-500 uppercase tracking-wider mb-3">
                {t("admin.add_family") || "Add Family"}
              </p>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={newFamily.value}
                  onChange={(e) => setNewFamily({ ...newFamily, value: e.target.value })}
                  className="flex-1 px-3 py-2 rounded-lg border border-primary-100 bg-white text-xs font-mono text-stone-700 focus:border-primary-400 focus:ring-1 focus:ring-primary-500/15"
                  placeholder="family_slug"
                  aria-label="New family value"
                />
                <input
                  type="text"
                  value={newFamily.label}
                  onChange={(e) => setNewFamily({ ...newFamily, label: e.target.value })}
                  className="flex-1 px-3 py-2 rounded-lg border border-primary-100 bg-white text-sm text-stone-700 focus:border-primary-400 focus:ring-1 focus:ring-primary-500/15"
                  placeholder="English label"
                  aria-label="New English label"
                />
                <input
                  type="text"
                  value={newFamily.label_pt}
                  onChange={(e) => setNewFamily({ ...newFamily, label_pt: e.target.value })}
                  className="flex-1 px-3 py-2 rounded-lg border border-primary-100 bg-white text-sm text-stone-700 focus:border-primary-400 focus:ring-1 focus:ring-primary-500/15"
                  placeholder="Portuguese label"
                  aria-label="New Portuguese label"
                />
                <input
                  type="text"
                  value={newFamily.icon}
                  onChange={(e) => setNewFamily({ ...newFamily, icon: e.target.value })}
                  className="w-24 px-3 py-2 rounded-lg border border-primary-100 bg-white text-xs font-mono text-stone-700 focus:border-primary-400 focus:ring-1 focus:ring-primary-500/15"
                  placeholder="Icon"
                  aria-label="Icon name"
                />
                <Button variant="secondary" size="sm" onClick={handleAddFamily}>
                  <Plus className="w-4 h-4" />
                </Button>
              </div>
            </div>
          </>
        )}
      </Card>

      <div className="text-center py-8">
        <p className="text-xs text-stone-400 font-serif italic">
          {t("admin.more_config_coming")}
        </p>
      </div>
    </div>
  );
}
