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

import { useState, useEffect, useCallback } from "react";
import { Loader2, Plus, Check, Trash2, Moon, Sun, Copy } from "lucide-react";
import { useToast } from "@/lib/toast-context";
import { ResizableSplit } from "@/components/ui/ResizableSplit";
import { useTheme } from "@/lib/theme-context";
import { api } from "@/lib/api";

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

export default function ThemeManagerPage() {
  const { addToast } = useToast();
  const { refresh: refreshTheme } = useTheme();
  const [themes, setThemes] = useState<ThemeInfo[]>([]);
  const [selectedThemeId, setSelectedThemeId] = useState<number | null>(null);
  const [tokens, setTokens] = useState<TokenInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState<number | null>(null);
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
      if (data.length > 0 && selectedThemeId === null) {
        setSelectedThemeId(data[0].id);
      }
    } catch {} finally {
      setLoading(false);
    }
  }, [selectedThemeId]);

  const fetchTokens = useCallback(async () => {
    if (!selectedThemeId) return;
    try {
      const data = await api.themes.tokens(selectedThemeId);
      setTokens(data);
    } catch {}
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

  const updateToken = async (token: TokenInfo, field: "light_value" | "dark_value", value: string) => {
    setSaving(token.id);
    try {
      // For color tokens, convert hex to RGB channels
      const storedValue = value; // v4: store hex directly
      await api.themes.updateToken(token.id, { [field]: storedValue });
      await fetchTokens();
    } catch (e: any) {
      addToast("error", e?.message || "Failed to update token");
    } finally {
      setSaving(null);
    }
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
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <Loader2 className="w-5 h-5 animate-spin text-stone-400" />
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
        <button
          onClick={() => setCreatingTheme(true)}
          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary-600 hover:bg-primary-700 text-cream transition"
        >
          <Plus className="w-3.5 h-3.5" /> New theme
        </button>
      </div>

      <ResizableSplit
        defaultWidth={224}
        minWidth={160}
        maxWidth={320}
        className="flex-1"
        left={
          <div className="h-full border-r border-primary-200/40 dark:border-stone-800 p-3 overflow-y-auto">
            <p className="px-1 pb-2 text-[10px] uppercase tracking-wider text-stone-400 font-medium">Themes</p>
            {themes.map((theme) => (
              <button
                key={theme.id}
                onClick={() => setSelectedThemeId(theme.id)}
                className={`w-full flex items-center justify-between px-2.5 py-2 rounded-md text-sm transition mb-1 ${
                  selectedThemeId === theme.id
                    ? "bg-primary-600 text-cream"
                    : "text-stone-600 dark:text-stone-300 hover:bg-stone-100 dark:hover:bg-stone-800"
                }`}
              >
                <span className="truncate">{theme.name}</span>
                <span className={`text-[10px] ${selectedThemeId === theme.id ? "text-cream/60" : theme.is_active ? "text-emerald-500" : "text-stone-400"}`}>
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
                    <h2
                      className="font-display text-lg font-semibold text-stone-800 dark:text-stone-100 cursor-pointer hover:text-primary-600 dark:hover:text-primary-400 transition"
                      onClick={() => { setEditingThemeName(true); setRenameValue(selectedTheme.name); }}
                      title="Click to rename"
                    >
                      {selectedTheme.name}
                      {selectedTheme.is_active && <span className="ml-2 text-xs text-emerald-500">Active</span>}
                      {!selectedTheme.is_published && <span className="ml-2 text-xs text-amber-500">Draft</span>}
                    </h2>
                  )}
                  {selectedTheme.description && <p className="text-xs text-stone-500 mt-0.5">{selectedTheme.description}</p>}
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setAddingToken(true); setNewTokenName(""); setNewTokenValue(""); }} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition" title="Add a new token to this theme">
                    <Plus className="w-3.5 h-3.5" /> Add token
                  </button>
                  <button onClick={() => duplicateTheme(selectedTheme)} className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition" title="Duplicate">
                    <Copy className="w-3.5 h-3.5" /> Duplicate
                  </button>
                  {!selectedTheme.is_published && (
                    <button onClick={() => publishTheme(selectedTheme)} className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-stone-200 dark:bg-stone-800 hover:bg-stone-300 dark:hover:bg-stone-700 text-stone-600 dark:text-stone-300 transition">
                      Publish
                    </button>
                  )}
                  {!selectedTheme.is_active && selectedTheme.is_published && (
                    <button onClick={() => activateTheme(selectedTheme)} className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white transition">
                      <Check className="w-3.5 h-3.5" /> Activate
                    </button>
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
                      <label className="block text-[10px] uppercase tracking-wider text-stone-500 mb-1">Token name</label>
                      <input
                        type="text"
                        value={newTokenName}
                        onChange={(e) => setNewTokenName(e.target.value)}
                        placeholder={activeTab === "color" ? "--color-accent" : activeTab === "font" ? "--font-body" : `--${activeTab}-...`}
                        className="w-full px-3 py-2 text-sm rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 focus:outline-none focus:ring-1 focus:ring-primary-500 font-mono"
                        autoFocus
                      />
                    </div>
                    <div className="flex-1">
                      <label className="block text-[10px] uppercase tracking-wider text-stone-500 mb-1">Value</label>
                      {activeTab === "color" ? (
                        <div className="flex items-center gap-2">
                          <input type="color" value={newTokenValue || "#000000"} onChange={(e) => setNewTokenValue(e.target.value)} className="w-10 h-10 rounded-lg border border-stone-200 dark:border-stone-700 cursor-pointer overflow-hidden" />
                          <input type="text" value={newTokenValue} onChange={(e) => setNewTokenValue(e.target.value)} placeholder="#634d33" className="flex-1 px-2 py-2 text-sm font-mono rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 focus:outline-none focus:ring-1 focus:ring-primary-500" />
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
                        <input type="text" value={newTokenValue} onChange={(e) => setNewTokenValue(e.target.value)} placeholder={activeTab === "radius" ? "8px" : activeTab === "size" ? "1rem" : "0.25rem"} className="w-full px-3 py-2 text-sm rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 focus:outline-none focus:ring-1 focus:ring-primary-500 font-mono" />
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button onClick={addToken} disabled={!newTokenName.trim()} className="px-4 py-2 text-xs font-semibold rounded-lg bg-primary-600 hover:bg-primary-700 text-cream disabled:opacity-50">Add</button>
                      <button onClick={() => setAddingToken(false)} className="px-3 py-2 text-xs font-medium rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800">Cancel</button>
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
                            value={toDisplayHex(token.light_value)}
                            onChange={(e) => updateToken(token, "light_value", e.target.value)}
                            disabled={saving === token.id}
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
                            value={toDisplayHex(token.dark_value || token.light_value)}
                            onChange={(e) => updateToken(token, "dark_value", e.target.value)}
                            disabled={saving === token.id}
                            className="w-10 h-10 rounded-lg border border-stone-200 dark:border-stone-700 cursor-pointer overflow-hidden"
                          />
                        </label>
                      </div>
                      <button onClick={() => deleteToken(token)} className="ml-2 p-1 rounded hover:bg-red-50 dark:hover:bg-red-950 text-stone-400 hover:text-red-500 transition" title="Delete token">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
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
                            <input
                              type="text"
                              value={token.light_value}
                              onChange={(e) => updateToken(token, "light_value", e.target.value)}
                              disabled={saving === token.id}
                              className="flex-1 px-3 py-2 text-sm rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 focus:outline-none focus:ring-1 focus:ring-primary-500 font-mono"
                            />
                            <button
                              onClick={() => toggleCustomFont(token.id)}
                              className="text-xs text-stone-400 hover:text-primary-600 transition"
                            >
                              library
                            </button>
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
                              disabled={saving === token.id}
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
                            <button
                              onClick={() => toggleCustomFont(token.id)}
                              className="text-xs text-stone-400 hover:text-primary-600 transition"
                              title="Switch to custom entry"
                            >
                              custom
                            </button>
                          </div>
                        )}
                        <p className="text-lg" style={{ fontFamily: token.light_value }}>
                          The quick brown fox
                        </p>
                        <button onClick={() => deleteToken(token)} className="absolute top-3 right-3 p-1 rounded hover:bg-red-50 dark:hover:bg-red-950 text-stone-400 hover:text-red-500 transition" title="Delete token">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
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
                            value={px}
                            onChange={(e) => updateToken(token, "light_value", e.target.value + "px")}
                            disabled={saving === token.id}
                            className="flex-1 accent-primary-600"
                          />
                          <span className="text-sm font-mono text-stone-500 w-12">{px}px</span>
                          <div className="w-12 h-12 border-2 border-primary-300 dark:border-stone-600 bg-primary-100 dark:bg-primary-900/30" style={{ borderRadius: `${px}px` }} />
                        </div>
                        <button onClick={() => deleteToken(token)} className="absolute top-3 right-3 p-1 rounded hover:bg-red-50 dark:hover:bg-red-950 text-stone-400 hover:text-red-500 transition" title="Delete token">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
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
                            value={rem}
                            onChange={(e) => updateToken(token, "light_value", e.target.value + "rem")}
                            disabled={saving === token.id}
                            className="flex-1 accent-primary-600"
                          />
                          <span className="text-stone-800 dark:text-stone-100" style={{ fontSize: token.light_value }}>
                            Aa
                          </span>
                        </div>
                        <button onClick={() => deleteToken(token)} className="absolute top-3 right-3 p-1 rounded hover:bg-red-50 dark:hover:bg-red-950 text-stone-400 hover:text-red-500 transition" title="Delete token">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
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
                            value={rem}
                            onChange={(e) => updateToken(token, "light_value", e.target.value + "rem")}
                            disabled={saving === token.id}
                            className="flex-1 accent-primary-600"
                          />
                          <div className="flex items-end gap-1 h-8">
                            <span className="w-2 bg-primary-400/70" style={{ height: `calc(${token.light_value} * 2)` }} />
                            <span className="w-2 bg-primary-400/70" style={{ height: `calc(${token.light_value} * 4)` }} />
                            <span className="w-2 bg-primary-400/70" style={{ height: `calc(${token.light_value} * 6)` }} />
                            <span className="w-2 bg-primary-400/70" style={{ height: `calc(${token.light_value} * 8)` }} />
                          </div>
                        </div>
                        <button onClick={() => deleteToken(token)} className="absolute top-3 right-3 p-1 rounded hover:bg-red-50 dark:hover:bg-red-950 text-stone-400 hover:text-red-500 transition" title="Delete token">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
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
      {creatingTheme && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center px-4" onClick={() => setCreatingTheme(false)}>
          <div className="absolute inset-0 bg-stone-950/40 backdrop-blur-sm" />
          <div className="relative w-full max-w-md bg-white dark:bg-stone-900 rounded-2xl shadow-2xl border border-stone-200/60 dark:border-stone-700 p-6" onClick={(e) => e.stopPropagation()}>
            <h2 className="font-display font-semibold text-stone-800 dark:text-stone-100 mb-4">New theme</h2>
            <input
              type="text"
              value={newThemeName}
              onChange={(e) => setNewThemeName(e.target.value)}
              placeholder="e.g. Christmas, Halloween"
              className="w-full px-3 py-2 text-sm rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
              autoFocus
            />
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setCreatingTheme(false)} className="px-3 py-2 text-xs font-medium rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800">Cancel</button>
              <button onClick={createTheme} disabled={!newThemeName.trim()} className="px-4 py-2 text-xs font-semibold rounded-lg bg-primary-600 hover:bg-primary-700 text-cream disabled:opacity-50">Create draft</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
