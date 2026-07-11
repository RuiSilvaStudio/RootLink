"use client";

/**
 * Content Studio — Theme Manager (Phase 4).
 *
 * Spec: docs/content-studio/CONTENT_STUDIO.md §3.1 (dashboard control room),
 * §8 (dark mode safety), §9 (multi-theme).
 *
 * The dashboard's theme settings where you:
 *   - Define named color tokens (each with light + dark values)
 *   - Create multiple themes (Default, Christmas, Halloween)
 *   - Edit a theme's tokens (full color pickers — this is the dashboard, not
 *     the overlay, so free-form color pickers are appropriate here)
 *   - Publish a theme (draft→publish)
 *   - Activate a theme (makes it the live theme — full palette swap)
 *
 * Dark mode safety: every color token has a light value AND a dark value.
 * The overlay's palette picker only lets users pick token NAMES, so dark
 * mode can never break.
 */

import { useState, useEffect, useCallback, useRef } from "react";
import { Plus, Check, Trash2, Moon, Sun, Copy } from "lucide-react";
import { useToast } from "@/lib/toast-context";
import { Button, Input, Modal, Tooltip } from "@/components/ui";
import { ListSkeleton, CardSkeleton, TextSkeleton } from "@/components/ui/LoadingSkeleton";
import { ResizableSplit } from "@/components/ui/ResizableSplit";
import { useTheme } from "@/lib/theme-context";
import { api } from "@/lib/api";
import { LoadError } from "@/components/studio/LoadError";

interface ThemeInfo {
  id: number;
  name: string;
  description: string | null;
  is_active: boolean;
  is_published: boolean;
}

interface TokenInfo {
  id: number;
  token_name: string;
  light_value: string;
  dark_value: string | null;
  category: string;
}

/** Normalize a color value to hex for display in a color picker.
 *  In v4 all values are hex — this is a pass-through with a safety
 *  fallback for any legacy data. */
function toDisplayHex(value: string): string {
  if (!value) return "#000000";
  if (value.startsWith("#")) return value;
  // Legacy fallback for any old RGB-channel data
  const parts = value.trim().split(/\s+/).map(Number);
  if (parts.length >= 3 && !parts.some(isNaN)) {
    return "#" + parts.map((n) => n.toString(16).padStart(2, "0")).join("");
  }
  return "#000000";
}

const CATEGORIES = ["color", "font", "size", "spacing", "radius"] as const;

/** Quiet empty state for a token category tab. */
function EmptyCategory({ category }: { category: string }) {
  return (
    <p className="text-center py-10 text-sm text-stone-400 dark:text-stone-500 font-serif">
      No {category} tokens yet. Add one with “Add token”.
    </p>
  );
}

export default function ThemeManagerPage() {
  const { addToast } = useToast();
  const { refresh: refreshTheme } = useTheme();
  const [themes, setThemes] = useState<ThemeInfo[]>([]);
  const [selectedThemeId, setSelectedThemeId] = useState<number | null>(null);
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [creatingTheme, setCreatingTheme] = useState(false);
  const [newThemeName, setNewThemeName] = useState("");
  const [activeTab, setActiveTab] = useState<"color" | "font" | "size" | "spacing" | "radius">("color");
  const [addingToken, setAddingToken] = useState(false);
  const [newTokenName, setNewTokenName] = useState("");
  const [newTokenValue, setNewTokenValue] = useState("");
  const [editingThemeName, setEditingThemeName] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const [fonts, setFonts] = useState<{ id: number; name: string; family: string }[]>([]);
  const [customFontTokens, setCustomFontTokens] = useState<Set<number>>(new Set());
  const toggleCustomFont = (tokenId: number) => {
    setCustomFontTokens((prev) => {
      const next = new Set(prev);
      if (next.has(tokenId)) next.delete(tokenId);
      else next.add(tokenId);
      return next;
    });
  };

  const fetchThemes = useCallback(async () => {
    try {
      const data = await api.themes.adminList();
      setThemes(data);
      setLoadError(false);
      if (data.length > 0 && selectedThemeId === null) {
        setSelectedThemeId(data[0].id);
      }
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [selectedThemeId]);

  const fetchTokens = useCallback(async () => {
    if (!selectedThemeId) return;
    try {
      const data = await api.themes.tokens(selectedThemeId);
      setTokens(data);
      setLoadError(false);
    } catch {
      setLoadError(true);
    }
  }, [selectedThemeId]);

  useEffect(() => { fetchThemes(); }, [fetchThemes]);
  useEffect(() => { fetchTokens(); }, [fetchTokens]);
  useEffect(() => { api.fonts.list().then(setFonts).catch(() => {}); }, []);

  const selectedTheme = themes.find((t) => t.id === selectedThemeId);

  const addToken = async () => {
    if (!newTokenName.trim() || !selectedThemeId) return;
    try {
      await api.themes.upsertToken(selectedThemeId, {
        token_name: newTokenName.trim(),
        light_value: newTokenValue || (activeTab === "color" ? "#000000" : activeTab === "font" ? "sans-serif" : "0"),
        category: activeTab,
      });
      setNewTokenName("");
      setNewTokenValue("");
      setAddingToken(false);
      await fetchTokens();
      addToast("success", "Token added");
    } catch (e: any) {
      addToast("error", e?.message || "Failed to add token");
    }
  };

  const deleteToken = async (token: TokenInfo) => {
    if (!confirm(`Delete token "${token.token_name}"?`)) return;
    try {
      await api.themes.removeToken(token.id);
      await fetchTokens();
      addToast("success", "Token deleted");
    } catch (e: any) {
      addToast("error", e?.message || "Failed to delete token");
    }
  };

  const saveThemeName = async () => {
    if (!renameValue.trim() || !selectedThemeId) {
      setEditingThemeName(false);
      return;
    }
    try {
      await api.themes.update(selectedThemeId, { name: renameValue.trim() });
      setEditingThemeName(false);
      await fetchThemes();
    } catch (e: any) {
      addToast("error", e?.message || "Failed to rename theme");
    }
  };

  const deleteTheme = async (theme: ThemeInfo) => {
    if (theme.is_active) return;
    if (!window.confirm(`Delete theme "${theme.name}"? This cannot be undone. All its colors, fonts, and settings will be permanently removed.`)) return;
    try {
      await api.themes.remove(theme.id);
      await fetchThemes();
      const remaining = themes.filter((t) => t.id !== theme.id);
      if (remaining.length > 0) setSelectedThemeId(remaining[0].id);
      addToast("success", `Theme "${theme.name}" deleted`);
    } catch (e: any) {
      addToast("error", e?.message || "Failed to delete theme");
    }
  };

  const createTheme = async () => {
    if (!newThemeName.trim()) return;
    try {
      await api.themes.create({ name: newThemeName });
      setNewThemeName("");
      setCreatingTheme(false);
      await fetchThemes();
      addToast("success", "Theme created (draft)");
    } catch (e: any) {
      addToast("error", e?.message || "Failed to create theme");
    }
  };

  // Debounced token saves: color/range inputs fire a change per drag tick, so
  // the API call waits ~400ms after the last change (per token). Local state
  // updates immediately so the live preview stays instant. Timers are never
  // cleared on token/theme switch — a pending save always lands.
  const saveTimers = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const pendingEdits = useRef<Map<number, { light_value?: string; dark_value?: string }>>(new Map());

  const updateToken = (token: TokenInfo, field: "light_value" | "dark_value", value: string) => {
    // v4: store hex directly — the value goes to the API as-is.
    setTokens((prev) => prev.map((t) => (t.id === token.id ? { ...t, [field]: value } : t)));
    const pending = pendingEdits.current.get(token.id) ?? {};
    pending[field] = value;
    pendingEdits.current.set(token.id, pending);
    const existing = saveTimers.current.get(token.id);
    if (existing) clearTimeout(existing);
    saveTimers.current.set(
      token.id,
      setTimeout(async () => {
        saveTimers.current.delete(token.id);
        const payload = pendingEdits.current.get(token.id);
        pendingEdits.current.delete(token.id);
        if (!payload) return;
        try {
          await api.themes.updateToken(token.id, payload);
        } catch (e: any) {
          addToast("error", e?.message || "Failed to update token");
        }
      }, 400)
    );
  };

  const activateTheme = async (theme: ThemeInfo) => {
    try {
      await api.themes.activate(theme.id);
      await fetchThemes();
      await refreshTheme(); // re-inject tokens site-wide
      addToast("success", `"${theme.name}" is now the active theme`);
    } catch (e: any) {
      addToast("error", e?.message || "Failed to activate theme");
    }
  };

  const publishTheme = async (theme: ThemeInfo) => {
    try {
      await api.themes.update(theme.id, { is_published: true });
      await fetchThemes();
      addToast("success", `"${theme.name}" published`);
    } catch (e: any) {
      addToast("error", e?.message || "Failed to publish theme");
    }
  };

  const duplicateTheme = async (theme: ThemeInfo) => {
    try {
      await api.themes.create({ name: `${theme.name} (copy)`, description: theme.description || undefined, copy_from: theme.id });
      await fetchThemes();
      addToast("success", "Theme duplicated (draft)");
    } catch (e: any) {
      addToast("error", e?.message || "Failed to duplicate theme");
    }
  };

  if (loading) {
    return (
      <div className="flex h-full min-h-[60vh]">
        <div className="hidden lg:block w-56 shrink-0 border-r border-primary-200/40 dark:border-stone-800 p-3">
          <ListSkeleton rows={5} />
        </div>
        <div className="flex-1 p-4 lg:p-6">
          <TextSkeleton lines={1} className="max-w-xs mb-6" />
          <div className="space-y-4 max-w-3xl">
            <CardSkeleton />
            <CardSkeleton />
          </div>
        </div>
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="p-6 max-w-xl">
        <LoadError onRetry={() => { fetchThemes(); fetchTokens(); }} />
      </div>
    );
  }

  const colorTokens = tokens.filter((t) => t.category === "color");
  const fontTokens = tokens.filter((t) => t.category === "font");
  const sizeTokens = tokens.filter((t) => t.category === "size");
  const spacingTokens = tokens.filter((t) => t.category === "spacing");
  const radiusTokens = tokens.filter((t) => t.category === "radius");

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="shrink-0 px-6 py-4 border-b border-primary-200/40 dark:border-stone-800 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-semibold text-stone-800 dark:text-stone-100">Theme Manager</h1>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            Define named color tokens (light + dark), create seasonal themes, publish & activate
          </p>
        </div>
        <Button size="xs" variant="primary" onClick={() => setCreatingTheme(true)}>
          <Plus className="w-3.5 h-3.5" /> New theme
        </Button>
      </div>

      <ResizableSplit
        defaultWidth={224}
        minWidth={160}
        maxWidth={320}
        className="flex-1"
        left={
          <div className="h-full border-r border-primary-200/40 dark:border-stone-800 p-3 overflow-y-auto">
            <p className="px-1 pb-2 text-xs uppercase tracking-wider text-stone-400 dark:text-stone-500 font-medium">Themes</p>
            <p className="px-1 pb-3 text-xs text-stone-400 dark:text-stone-500 leading-relaxed">
              <span className="text-emerald-500">●</span> active · <span className="text-stone-500 dark:text-stone-400">○</span> published · <span className="text-amber-500">draft</span>
            </p>
            {themes.map((theme) => (
              <button
                key={theme.id}
                onClick={() => setSelectedThemeId(theme.id)}
                aria-current={selectedThemeId === theme.id ? "true" : undefined}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-sm transition mb-1 ${
                  selectedThemeId === theme.id
                    ? "bg-primary-600 text-cream"
                    : "text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800"
                }`}
              >
                <span className="truncate">{theme.name}</span>
                <span className={`text-xs ${selectedThemeId === theme.id ? "text-cream/60" : theme.is_active ? "text-emerald-500" : "text-stone-400"}`}>
                  {theme.is_active ? "●" : theme.is_published ? "○" : "draft"}
                </span>
              </button>
            ))}
          </div>
        }
        right={
          <div className="h-full overflow-y-auto p-4 lg:p-6">
          {selectedTheme ? (
            <div className="max-w-3xl">
              {/* Theme header */}
              <div className="flex items-center justify-between mb-6">
                <div>
                  {editingThemeName ? (
                    <div className="flex items-center gap-2">
                      <input
                        type="text"
                        value={renameValue}
                        onChange={(e) => setRenameValue(e.target.value)}
                        onBlur={saveThemeName}
                        onKeyDown={(e) => { if (e.key === "Enter") saveThemeName(); if (e.key === "Escape") setEditingThemeName(false); }}
                        className="font-display text-lg font-semibold text-stone-800 dark:text-stone-100 bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 rounded-lg px-3 py-1 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        autoFocus
                      />
                    </div>
                  ) : (
                    <Tooltip content="Click to rename">
                      <h2
                        className="font-display text-lg font-semibold text-stone-800 dark:text-stone-100 cursor-pointer hover:text-primary-600 dark:hover:text-primary-400 transition"
                        onClick={() => { setEditingThemeName(true); setRenameValue(selectedTheme.name); }}
                      >
                        {selectedTheme.name}
                        {selectedTheme.is_active && <span className="ml-2 text-xs text-emerald-500">Active</span>}
                        {!selectedTheme.is_published && <span className="ml-2 text-xs text-amber-500">Draft</span>}
                      </h2>
                    </Tooltip>
                  )}
                  {selectedTheme.description && <p className="text-xs text-stone-500 mt-0.5">{selectedTheme.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <Tooltip content="Add a new token to this theme">
                    <Button size="xs" variant="ghost" onClick={() => { setAddingToken(true); setNewTokenName(""); setNewTokenValue(""); }}>
                      <Plus className="w-3.5 h-3.5" /> Add token
                    </Button>
                  </Tooltip>
                  <Tooltip content="Duplicate this theme">
                    <Button size="xs" variant="ghost" onClick={() => duplicateTheme(selectedTheme)}>
                      <Copy className="w-3.5 h-3.5" /> Duplicate
                    </Button>
                  </Tooltip>
                  {!selectedTheme.is_published && (
                    <Button size="xs" variant="secondary" onClick={() => publishTheme(selectedTheme)}>
                      Publish
                    </Button>
                  )}
                  {!selectedTheme.is_active && selectedTheme.is_published && (
                    <Button size="xs" variant="primary" onClick={() => activateTheme(selectedTheme)}>
                      <Check className="w-3.5 h-3.5" /> Activate
                    </Button>
                  )}
                  {!selectedTheme.is_active && (
                    <Tooltip content="Delete theme (cannot delete the active theme)">
                      <Button size="xs" variant="danger" onClick={() => deleteTheme(selectedTheme)}>
                        <Trash2 className="w-3.5 h-3.5" /> Delete
                      </Button>
                    </Tooltip>
                  )}
                </div>
              </div>

              {/* Tabs */}
              <div className="flex gap-1 mb-6 p-1 rounded-lg bg-stone-100 dark:bg-stone-800/50">
                {CATEGORIES.map((cat) => {
                  const count = tokens.filter((t) => t.category === cat).length;
                  return (
                    <button
                      key={cat}
                      onClick={() => setActiveTab(cat)}
                      aria-pressed={activeTab === cat}
                      className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition capitalize ${
                        activeTab === cat
                          ? "bg-white dark:bg-stone-900 text-primary-700 dark:text-primary-300 shadow-sm"
                          : "text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
                      }`}
                    >
                      {cat} ({count})
                    </button>
                  );
                })}
              </div>

              {/* Add token inline form */}
              {addingToken && (
                <div className="mb-6 p-4 rounded-lg border border-primary-200/60 dark:border-primary-700/40 bg-primary-50/30 dark:bg-primary-900/20">
                  <div className="flex items-end gap-3">
                    <div className="flex-1">
                      <Input
                        label="Token name"
                        value={newTokenName}
                        onChange={(e) => setNewTokenName(e.target.value)}
                        placeholder={activeTab === "color" ? "--color-accent" : activeTab === "font" ? "--font-body" : `--${activeTab}-...`}
                        className="font-mono"
                        autoFocus
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-sm font-display font-medium text-stone-700 dark:text-stone-300 tracking-wide mb-1.5">Value</label>
                      {activeTab === "color" ? (
                        <div className="flex items-center gap-2">
                          <input type="color" aria-label="New token color" value={newTokenValue || "#000000"} onChange={(e) => setNewTokenValue(e.target.value)} className="w-10 h-10 rounded-lg border border-stone-200 dark:border-stone-700 cursor-pointer overflow-hidden" />
                          <div className="flex-1">
                            <Input aria-label="Hex color value" value={newTokenValue} onChange={(e) => setNewTokenValue(e.target.value)} placeholder="#634d33" className="font-mono" />
                          </div>
                        </div>
                      ) : activeTab === "font" ? (
                        <select
                          value={newTokenValue}
                          onChange={(e) => setNewTokenValue(e.target.value)}
                          className="w-full px-3 py-2 text-sm rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
                        >
                          <option value="">Select a font…</option>
                          {fonts.map((f) => (
                            <option key={f.id} value={f.family} style={{ fontFamily: f.family }}>
                              {f.name}
                            </option>
                          ))}
                          <option value="__custom__">— Custom —</option>
                        </select>
                      ) : (
                        <Input aria-label="Token value" value={newTokenValue} onChange={(e) => setNewTokenValue(e.target.value)} placeholder={activeTab === "radius" ? "8px" : activeTab === "size" ? "1rem" : "0.25rem"} className="font-mono" />
                      )}
                    </div>
                    <div className="flex gap-2">
                      <Button size="xs" variant="primary" onClick={addToken} disabled={!newTokenName.trim()}>Add</Button>
                      <Button size="xs" variant="ghost" onClick={() => setAddingToken(false)}>Cancel</Button>
                    </div>
                  </div>
                </div>
              )}

              {/* Color tokens */}
              {activeTab === "color" && (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-xs text-stone-500 mb-2">
                    <Sun className="w-4 h-4" /> Light mode
                    <span className="mx-2">/</span>
                    <Moon className="w-4 h-4" /> Dark mode
                  </div>
                  {colorTokens.map((token) => (
                    <div key={token.id} className="flex items-center gap-3 p-3 rounded-lg border border-stone-200/60 dark:border-stone-800">
                      <div className="flex-1 min-w-0">
                        <code className="text-xs text-stone-500 dark:text-stone-400 font-mono">{token.token_name}</code>
                      </div>
                      {/* Light value */}
                      <div className="flex items-center gap-2">
                        <label className="relative">
                          <input
                            type="color"
                            aria-label={`${token.token_name} light mode color`}
                            value={toDisplayHex(token.light_value)}
                            onChange={(e) => updateToken(token, "light_value", e.target.value)}
                            className="w-10 h-10 rounded-lg border border-stone-200 dark:border-stone-700 cursor-pointer overflow-hidden"
                          />
                        </label>
                        <Sun className="w-3.5 h-3.5 text-amber-500" />
                      </div>
                      <span className="text-stone-300">/</span>
                      {/* Dark value */}
                      <div className="flex items-center gap-2">
                        <Moon className="w-3.5 h-3.5 text-blue-400" />
                        <label className="relative">
                          <input
                            type="color"
                            aria-label={`${token.token_name} dark mode color`}
                            value={toDisplayHex(token.dark_value || token.light_value)}
                            onChange={(e) => updateToken(token, "dark_value", e.target.value)}
                            className="w-10 h-10 rounded-lg border border-stone-200 dark:border-stone-700 cursor-pointer overflow-hidden"
                          />
                        </label>
                      </div>
                      <Tooltip content="Delete token">
                        <Button size="xs" variant="danger" onClick={() => deleteToken(token)} aria-label={`Delete token ${token.token_name}`}>
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </Tooltip>
                    </div>
                  ))}
                  {colorTokens.length === 0 && <EmptyCategory category="color" />}
                </div>
              )}

              {/* Font tokens */}
              {activeTab === "font" && (
                <div className="space-y-3">
                  {fonts.length === 0 && (
                    <p className="text-xs text-stone-500 font-serif">
                      No fonts in the library yet. Add fonts in <a href="/studio/fonts" className="text-primary-600 underline">Fonts</a> first.
                    </p>
                  )}
                  {fontTokens.map((token) => {
                    const familyMatch = fonts.find((f) => f.family === token.light_value);
                    const isCustom = customFontTokens.has(token.id) || (token.light_value.length > 0 && !familyMatch);
                    return (
                      <div key={token.id} className="p-4 rounded-lg border border-stone-200/60 dark:border-stone-800 relative">
                        <code className="text-xs text-stone-500 dark:text-stone-400 font-mono mb-2 block">{token.token_name}</code>
                        {isCustom ? (
                          <div className="flex items-center gap-2 mb-2">
                            <div className="flex-1">
                              <Input
                                aria-label={`Custom font family for ${token.token_name}`}
                                value={token.light_value}
                                onChange={(e) => updateToken(token, "light_value", e.target.value)}
                                className="font-mono"
                              />
                            </div>
                            <Button size="xs" variant="ghost" onClick={() => toggleCustomFont(token.id)}>
                              library
                            </Button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-2 mb-2">
                            <select
                              value={familyMatch ? familyMatch.id : ""}
                              onChange={(e) => {
                                const id = Number(e.target.value);
                                if (id) {
                                  const f = fonts.find((f) => f.id === id);
                                  if (f) updateToken(token, "light_value", f.family);
                                } else {
                                  toggleCustomFont(token.id);
                                }
                              }}
                              aria-label={`Font for ${token.token_name}`}
                              className="flex-1 px-3 py-2 text-sm rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
                            >
                              <option value="" disabled={!familyMatch}>Select a font…</option>
                              {fonts.map((f) => (
                                <option key={f.id} value={f.id} style={{ fontFamily: f.family }}>
                                  {f.name}
                                </option>
                              ))}
                              <option value="">— Custom —</option>
                            </select>
                            <Tooltip content="Switch to custom entry">
                              <Button size="xs" variant="ghost" onClick={() => toggleCustomFont(token.id)}>
                                custom
                              </Button>
                            </Tooltip>
                          </div>
                        )}
                        <p className="text-lg" style={{ fontFamily: token.light_value }}>
                          The quick brown fox
                        </p>
                        <span className="absolute top-3 right-3">
                          <Tooltip content="Delete token">
                            <Button size="xs" variant="danger" onClick={() => deleteToken(token)} aria-label={`Delete token ${token.token_name}`}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </Tooltip>
                        </span>
                      </div>
                    );
                  })}
                  {fontTokens.length === 0 && <EmptyCategory category="font" />}
                </div>
              )}

              {/* Radius tokens */}
              {activeTab === "radius" && (
                <div className="space-y-3">
                  {radiusTokens.map((token) => {
                    const px = parseInt(token.light_value) || 0;
                    return (
                      <div key={token.id} className="p-4 rounded-lg border border-stone-200/60 dark:border-stone-800 relative">
                        <code className="text-xs text-stone-500 dark:text-stone-400 font-mono mb-3 block">{token.token_name}</code>
                        <div className="flex items-center gap-4">
                          <input
                            type="range"
                            min="0"
                            max="32"
                            aria-label={`${token.token_name} corner radius in pixels`}
                            value={px}
                            onChange={(e) => updateToken(token, "light_value", e.target.value + "px")}
                            className="flex-1 accent-primary-600"
                          />
                          <span className="text-sm font-mono text-stone-500 w-12">{px}px</span>
                          <div className="w-12 h-12 border-2 border-primary-300 dark:border-stone-600 bg-primary-100 dark:bg-primary-900/30" style={{ borderRadius: `${px}px` }} />
                        </div>
                        <span className="absolute top-3 right-3">
                          <Tooltip content="Delete token">
                            <Button size="xs" variant="danger" onClick={() => deleteToken(token)} aria-label={`Delete token ${token.token_name}`}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </Tooltip>
                        </span>
                      </div>
                    );
                  })}
                  {radiusTokens.length === 0 && <EmptyCategory category="radius" />}
                </div>
              )}

              {/* Size tokens (type scale — redefine what each text-* size means) */}
              {activeTab === "size" && (
                <div className="space-y-3">
                  <p className="text-xs text-stone-500 dark:text-stone-400 mb-2 font-serif">
                    Redefine a size here and every element using that text-* class updates site-wide. Same value in light &amp; dark mode.
                  </p>
                  {sizeTokens.map((token) => {
                    const rem = parseFloat(token.light_value) || 0;
                    return (
                      <div key={token.id} className="p-4 rounded-lg border border-stone-200/60 dark:border-stone-800 relative">
                        <div className="flex items-center justify-between mb-3">
                          <code className="text-xs text-stone-500 dark:text-stone-400 font-mono">{token.token_name}</code>
                          <span className="text-sm font-mono text-stone-500">{token.light_value}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <input
                            type="range"
                            min="0.5"
                            max="9"
                            step="0.125"
                            aria-label={`${token.token_name} size in rem`}
                            value={rem}
                            onChange={(e) => updateToken(token, "light_value", e.target.value + "rem")}
                            className="flex-1 accent-primary-600"
                          />
                          <span className="text-stone-800 dark:text-stone-100" style={{ fontSize: token.light_value }}>
                            Aa
                          </span>
                        </div>
                        <span className="absolute top-3 right-3">
                          <Tooltip content="Delete token">
                            <Button size="xs" variant="danger" onClick={() => deleteToken(token)} aria-label={`Delete token ${token.token_name}`}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </Tooltip>
                        </span>
                      </div>
                    );
                  })}
                  {sizeTokens.length === 0 && <EmptyCategory category="size" />}
                </div>
              )}

              {/* Spacing base (scales every spacing utility proportionally) */}
              {activeTab === "spacing" && (
                <div className="space-y-3">
                  <p className="text-xs text-stone-500 dark:text-stone-400 mb-2 font-serif">
                    The spacing base scales every spacing utility (p-4, gap-2, m-8 …) proportionally. One knob for the whole rhythm.
                  </p>
                  {spacingTokens.map((token) => {
                    const rem = parseFloat(token.light_value) || 0;
                    return (
                      <div key={token.id} className="p-4 rounded-lg border border-stone-200/60 dark:border-stone-800 relative">
                        <div className="flex items-center justify-between mb-3">
                          <code className="text-xs text-stone-500 dark:text-stone-400 font-mono">{token.token_name}</code>
                          <span className="text-sm font-mono text-stone-500">{token.light_value}</span>
                        </div>
                        <div className="flex items-center gap-4">
                          <input
                            type="range"
                            min="0.125"
                            max="0.75"
                            step="0.0625"
                            aria-label={`${token.token_name} spacing base in rem`}
                            value={rem}
                            onChange={(e) => updateToken(token, "light_value", e.target.value + "rem")}
                            className="flex-1 accent-primary-600"
                          />
                          <div className="flex items-end gap-1 h-8">
                            <span className="w-2 bg-primary-400/70" style={{ height: `calc(${token.light_value} * 2)` }} />
                            <span className="w-2 bg-primary-400/70" style={{ height: `calc(${token.light_value} * 4)` }} />
                            <span className="w-2 bg-primary-400/70" style={{ height: `calc(${token.light_value} * 6)` }} />
                            <span className="w-2 bg-primary-400/70" style={{ height: `calc(${token.light_value} * 8)` }} />
                          </div>
                        </div>
                        <span className="absolute top-3 right-3">
                          <Tooltip content="Delete token">
                            <Button size="xs" variant="danger" onClick={() => deleteToken(token)} aria-label={`Delete token ${token.token_name}`}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </Tooltip>
                        </span>
                      </div>
                    );
                  })}
                  {spacingTokens.length === 0 && <EmptyCategory category="spacing" />}
                </div>
              )}
            </div>
          ) : (
            <div className="text-center py-20">
              <p className="text-sm text-stone-400 font-serif">Select a theme to edit its tokens.</p>
            </div>
          )}
          </div>
        }
      />

      {/* Create theme modal */}
      <Modal
        open={creatingTheme}
        onClose={() => setCreatingTheme(false)}
        title="New theme"
        footer={
          <>
            <Button size="xs" variant="ghost" onClick={() => setCreatingTheme(false)}>Cancel</Button>
            <Button size="xs" variant="primary" onClick={createTheme} disabled={!newThemeName.trim()}>Create draft</Button>
          </>
        }
      >
        <Input
          label="Theme name"
          value={newThemeName}
          onChange={(e) => setNewThemeName(e.target.value)}
          placeholder="e.g. Christmas, Halloween"
        />
      </Modal>
    </div>
  );
}
