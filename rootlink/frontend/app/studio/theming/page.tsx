"use client";

/**
 * Content Studio — Theming module.
 *
 * A live theme editor for the platform's CSS custom-property token layer.
 * Color pickers, font selectors, and radius — all with real-time preview
 * (writes to `:root` CSS vars directly) and explicit save/revert (writes
 * to `/api/theme` backend).
 *
 * Spec: docs/content-studio/CONTENT_STUDIO.md §4 (the token model).
 *
 * The page has two panels:
 *   - Left: token categories (Colors, Typography, Radius) with editors.
 *   - Right: live preview of a sample page reflecting the current overrides.
 *
 * Dark mode: the studio's own dark-mode toggle also toggles the preview's
 * `.dark` class, so you can see how overrides look in both modes.
 */

import { useState, useEffect, useCallback, useMemo } from "react";
import { Loader2, Check, RotateCcw, Eye, Sun, Moon } from "lucide-react";
import { useToast } from "@/lib/toast-context";
import { useTheme } from "@/lib/theme-context";
import { api } from "@/lib/api";

// ── Token definitions ──────────────────────────────────────────

interface ColorToken {
  name: string; // --color-primary-600
  label: string; // Primary 600
  group: string; // Primary
  type: "color";
}

interface FontToken {
  name: string;
  label: string;
  group: string;
  type: "font";
  placeholder: string;
}

interface RadiusToken {
  name: string;
  label: string;
  group: string;
  type: "radius";
}

type Token = ColorToken | FontToken | RadiusToken;

const COLOR_TOKENS: ColorToken[] = [
  { name: "--color-primary-500", label: "Primary 500", group: "Primary", type: "color" },
  { name: "--color-primary-600", label: "Primary 600 (main)", group: "Primary", type: "color" },
  { name: "--color-primary-700", label: "Primary 700 (hover)", group: "Primary", type: "color" },
  { name: "--color-earth-500", label: "Earth 500", group: "Earth", type: "color" },
  { name: "--color-earth-600", label: "Earth 600", group: "Earth", type: "color" },
  { name: "--color-rust-500", label: "Rust 500 (emphasis)", group: "Rust", type: "color" },
  { name: "--color-rust-600", label: "Rust 600", group: "Rust", type: "color" },
  { name: "--color-cream", label: "Cream (surface)", group: "Surface", type: "color" },
];

const FONT_TOKENS: FontToken[] = [
  { name: "--font-display", label: "Display (headings)", group: "Typography", type: "font", placeholder: '"Fraunces", Georgia, serif' },
  { name: "--font-serif", label: "Body", group: "Typography", type: "font", placeholder: '"Source Serif 4", Georgia, serif' },
];

const RADIUS_TOKENS: RadiusToken[] = [
  { name: "--radius-xl2", label: "Large radius (xl2)", group: "Radius", type: "radius" },
];

const ALL_TOKENS: Token[] = [...COLOR_TOKENS, ...FONT_TOKENS, ...RADIUS_TOKENS];

// ── Helpers ───────────────────────────────────────────────────

/** Read the current computed value of a CSS custom property from `:root`. */
function getComputedToken(name: string): string {
  if (typeof window === "undefined") return "";
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim();
}

/** Convert an RGB-channel string ("99 77 51") to a hex color (#634d33). */
function rgbChannelsToHex(channels: string): string {
  const parts = channels.split(/\s+/).map(Number);
  if (parts.length < 3 || parts.some(isNaN)) return "#000000";
  return "#" + parts.map((n) => n.toString(16).padStart(2, "0")).join("");
}

/** Convert a hex color (#634d33) to an RGB-channel string ("99 77 51"). */
function hexToRgbChannels(hex: string): string {
  const h = hex.replace("#", "");
  if (h.length !== 6) return "0 0 0";
  const r = parseInt(h.slice(0, 2), 16);
  const g = parseInt(h.slice(2, 4), 16);
  const b = parseInt(h.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

// ── Main component ────────────────────────────────────────────

export default function ThemingPage() {
  const { addToast } = useToast();
  const { overrides, loading, refresh } = useTheme();

  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<"colors" | "typography" | "radius">("colors");
  const [previewDark, setPreviewDark] = useState(false);

  // On mount, detect current dark mode state for the preview
  useEffect(() => {
    setPreviewDark(document.documentElement.classList.contains("dark"));
  }, []);

  /** Get the display value for a token: draft > override > computed default. */
  const getTokenValue = useCallback(
    (token: Token): string => {
      const draft = drafts[token.name];
      if (draft !== undefined) return draft;
      const override = overrides[token.name];
      if (override !== undefined) return override;
      return getComputedToken(token.name);
    },
    [drafts, overrides]
  );

  /** Get the display value as hex (for color inputs). */
  const getColorHex = useCallback(
    (token: ColorToken): string => {
      const val = getTokenValue(token);
      // If it's already a hex, return it. If it's RGB channels, convert.
      if (val.startsWith("#")) return val;
      return rgbChannelsToHex(val);
    },
    [getTokenValue]
  );

  /** Apply a draft override to `:root` for live preview. */
  const applyDraft = useCallback((token: string, value: string) => {
    document.documentElement.style.setProperty(token, value);
  }, []);

  const setDraft = useCallback(
    (token: Token, value: string) => {
      // For color tokens, convert hex to RGB channels
      const storedValue = token.type === "color" ? hexToRgbChannels(value) : value;
      setDrafts((prev) => ({ ...prev, [token.name]: storedValue }));
      applyDraft(token.name, storedValue);
    },
    [applyDraft]
  );

  const isDirty = useCallback(
    (token: Token): boolean => {
      const draft = drafts[token.name];
      if (draft === undefined) return false;
      const override = overrides[token.name];
      if (override !== undefined) return draft !== override;
      // Compare against the computed default
      return draft !== getComputedToken(token.name);
    },
    [drafts, overrides]
  );

  const isModified = useCallback(
    (token: Token): boolean => overrides[token.name] !== undefined,
    [overrides]
  );

  const dirtyTokens = useMemo(() => ALL_TOKENS.filter(isDirty), [isDirty]);
  const dirtyCount = dirtyTokens.length;

  const saveToken = async (token: Token) => {
    const draft = drafts[token.name];
    if (draft === undefined) return;
    setSaving(token.name);
    try {
      await api.theme.set(token.name, draft);
      await refresh();
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[token.name];
        return next;
      });
      addToast("success", `Saved ${token.name}`);
    } catch (e: any) {
      addToast("error", e?.message || "Failed to save");
    } finally {
      setSaving(null);
    }
  };

  const revertToken = async (token: Token) => {
    setSaving(token.name);
    try {
      await api.theme.revert(token.name);
      await refresh();
      // Re-apply the computed default
      const defaultVal = getComputedToken(token.name);
      applyDraft(token.name, defaultVal);
      setDrafts((prev) => {
        const next = { ...prev };
        delete next[token.name];
        return next;
      });
      addToast("info", `Reverted ${token.name}`);
    } catch (e: any) {
      addToast("error", e?.message || "Revert failed");
    } finally {
      setSaving(null);
    }
  };

  const saveAll = async () => {
    const tokens = ALL_TOKENS.filter(isDirty);
    if (tokens.length === 0) return;
    setSaving("all");
    try {
      await Promise.all(tokens.map((t) => api.theme.set(t.name, drafts[t.name])));
      await refresh();
      setDrafts({});
      addToast("success", `${tokens.length} token${tokens.length !== 1 ? "s" : ""} saved`);
    } catch (e: any) {
      addToast("error", e?.message || "Failed to save");
    } finally {
      setSaving(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[60vh]">
        <Loader2 className="w-5 h-5 animate-spin text-stone-400" />
      </div>
    );
  }

  // Group tokens for display
  const colorGroups = Array.from(new Set(COLOR_TOKENS.map((t) => t.group)));
  const activeTokens: Token[] = activeTab === "colors" ? COLOR_TOKENS : activeTab === "typography" ? FONT_TOKENS : RADIUS_TOKENS;

  return (
    <div className="flex flex-col h-full">
      {/* ── Header ─────────────────────────────────────────── */}
      <div className="px-6 py-4 border-b border-primary-200/40 dark:border-stone-800 flex items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-xl font-semibold text-stone-800 dark:text-stone-100">
            Theming
          </h1>
          <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
            Colors, fonts, radii — global theme with real-time preview
          </p>
        </div>
        <div className="flex items-center gap-3">
          {dirtyCount > 0 && (
            <>
              <span className="text-xs font-medium text-rust-600 dark:text-rust-400">
                {dirtyCount} unsaved
              </span>
              <button
                onClick={saveAll}
                disabled={saving === "all"}
                className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg bg-primary-600 hover:bg-primary-700 text-cream disabled:opacity-50 transition"
              >
                {saving === "all" ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
                Save all
              </button>
            </>
          )}
        </div>
      </div>

      <div className="flex-1 flex min-h-0 flex-col lg:flex-row">
        {/* ── Token editor panel ──────────────────────────── */}
        <div className="flex-1 overflow-y-auto p-4 lg:p-6 lg:max-w-xl">
          {/* Tabs */}
          <div className="flex gap-1 mb-6 p-1 rounded-lg bg-stone-100 dark:bg-stone-800/50">
            {(["colors", "typography", "radius"] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition capitalize ${
                  activeTab === tab
                    ? "bg-white dark:bg-stone-900 text-primary-700 dark:text-primary-300 shadow-sm"
                    : "text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Token editors */}
          <div className="space-y-6">
            {activeTab === "colors" &&
              colorGroups.map((group) => (
                <div key={group}>
                  <h3 className="font-display text-sm font-semibold text-stone-700 dark:text-stone-200 mb-3">
                    {group}
                  </h3>
                  <div className="space-y-2">
                    {COLOR_TOKENS.filter((t) => t.group === group).map((token) => (
                      <ColorRow
                        key={token.name}
                        token={token}
                        hex={getColorHex(token)}
                        dirty={isDirty(token)}
                        modified={isModified(token)}
                        saving={saving === token.name || saving === "all"}
                        onChange={(hex) => setDraft(token, hex)}
                        onSave={() => saveToken(token)}
                        onRevert={() => revertToken(token)}
                      />
                    ))}
                  </div>
                </div>
              ))}

            {activeTab === "typography" && (
              <div>
                <h3 className="font-display text-sm font-semibold text-stone-700 dark:text-stone-200 mb-3">
                  Typography
                </h3>
                <div className="space-y-4">
                  {FONT_TOKENS.map((token) => (
                    <FontRow
                      key={token.name}
                      token={token}
                      value={getTokenValue(token)}
                      dirty={isDirty(token)}
                      modified={isModified(token)}
                      saving={saving === token.name || saving === "all"}
                      onChange={(v) => setDraft(token, v)}
                      onSave={() => saveToken(token)}
                      onRevert={() => revertToken(token)}
                    />
                  ))}
                </div>
              </div>
            )}

            {activeTab === "radius" && (
              <div>
                <h3 className="font-display text-sm font-semibold text-stone-700 dark:text-stone-200 mb-3">
                  Radius
                </h3>
                <div className="space-y-2">
                  {RADIUS_TOKENS.map((token) => (
                    <RadiusRow
                      key={token.name}
                      token={token}
                      value={getTokenValue(token)}
                      dirty={isDirty(token)}
                      modified={isModified(token)}
                      saving={saving === token.name || saving === "all"}
                      onChange={(v) => setDraft(token, v)}
                      onSave={() => saveToken(token)}
                      onRevert={() => revertToken(token)}
                    />
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* ── Live preview panel ──────────────────────────── */}
        <div className="lg:w-96 lg:border-l border-t lg:border-t-0 border-primary-200/40 dark:border-stone-800 flex flex-col">
          <div className="px-4 py-3 border-b border-primary-200/30 dark:border-stone-800/50 flex items-center justify-between">
            <span className="flex items-center gap-1.5 text-xs font-medium text-stone-500 dark:text-stone-400">
              <Eye className="w-3.5 h-3.5" />
              Live preview
            </span>
            <button
              onClick={() => {
                const next = !previewDark;
                setPreviewDark(next);
                // Apply dark mode to the preview container, not the whole page
              }}
              className="flex items-center gap-1.5 px-2 py-1 rounded-md text-xs font-medium text-stone-500 hover:text-stone-800 dark:text-stone-400 dark:hover:text-stone-100 hover:bg-stone-100 dark:hover:bg-stone-800 transition"
            >
              {previewDark ? <Moon className="w-3.5 h-3.5" /> : <Sun className="w-3.5 h-3.5" />}
              {previewDark ? "Dark" : "Light"}
            </button>
          </div>

          {/* Preview content — reflects the token overrides live */}
          <div
            className={`flex-1 overflow-y-auto p-5 ${previewDark ? "dark" : ""}`}
            style={previewDark ? { background: "rgb(28 25 23)" } : { background: "rgb(248 246 242)" }}
          >
            <div className={previewDark ? "dark" : ""}>
              <div className="rounded-xl2 bg-white dark:bg-stone-900 border border-primary-200/60 dark:border-stone-800 p-5">
                <h4 className="font-display text-lg font-bold text-primary-700 dark:text-primary-300 mb-2">
                  Preview heading
                </h4>
                <p className="text-sm text-stone-600 dark:text-stone-400 font-serif leading-relaxed mb-4">
                  This text reflects the current theme. Edit a color on the left and watch it change here instantly.
                </p>
                <div className="flex gap-2">
                  <button className="px-4 py-2 text-sm font-semibold rounded-lg bg-primary-600 hover:bg-primary-700 text-cream transition">
                    Primary button
                  </button>
                  <button className="px-4 py-2 text-sm font-semibold rounded-lg bg-rust-500 hover:bg-rust-600 text-cream transition">
                    Rust button
                  </button>
                </div>
                <div className="mt-4 pt-4 border-t border-primary-200/40 dark:border-stone-800">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900 flex items-center justify-center text-primary-600 dark:text-primary-400 font-display font-semibold">
                      R
                    </div>
                    <div>
                      <p className="text-sm font-medium text-stone-700 dark:text-stone-200">RootLink</p>
                      <p className="text-xs text-stone-400">Preview card</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Row components ────────────────────────────────────────────

function ColorRow({
  token,
  hex,
  dirty,
  modified,
  saving,
  onChange,
  onSave,
  onRevert,
}: {
  token: ColorToken;
  hex: string;
  dirty: boolean;
  modified: boolean;
  saving: boolean;
  onChange: (hex: string) => void;
  onSave: () => void;
  onRevert: () => void;
}) {
  return (
    <div
      className={`flex items-center gap-3 p-3 rounded-lg border transition ${
        dirty
          ? "border-rust-300 dark:border-rust-700 bg-rust-50/30 dark:bg-rust-950/10"
          : modified
          ? "border-primary-300/60 dark:border-stone-700"
          : "border-stone-200/60 dark:border-stone-800"
      }`}
    >
      <label className="relative shrink-0">
        <input
          type="color"
          value={hex}
          onChange={(e) => onChange(e.target.value)}
          className="w-10 h-10 rounded-lg border border-stone-200 dark:border-stone-700 cursor-pointer overflow-hidden"
        />
      </label>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-stone-700 dark:text-stone-200">{token.label}</p>
        <code className="text-xs text-stone-400 font-mono">{token.name}</code>
      </div>
      {dirty && (
        <button
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md bg-primary-600 hover:bg-primary-700 text-cream disabled:opacity-50 transition"
        >
          {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
        </button>
      )}
      {modified && !dirty && (
        <button
          onClick={onRevert}
          disabled={saving}
          className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-md text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition"
          title="Revert to default"
        >
          <RotateCcw className="w-3 h-3" />
        </button>
      )}
    </div>
  );
}

function FontRow({
  token,
  value,
  dirty,
  modified,
  saving,
  onChange,
  onSave,
  onRevert,
}: {
  token: FontToken;
  value: string;
  dirty: boolean;
  modified: boolean;
  saving: boolean;
  onChange: (v: string) => void;
  onSave: () => void;
  onRevert: () => void;
}) {
  return (
    <div
      className={`p-4 rounded-lg border transition ${
        dirty
          ? "border-rust-300 dark:border-rust-700 bg-rust-50/30 dark:bg-rust-950/10"
          : modified
          ? "border-primary-300/60 dark:border-stone-700"
          : "border-stone-200/60 dark:border-stone-800"
      }`}
    >
      <div className="flex items-center justify-between mb-2">
        <div>
          <p className="text-sm font-medium text-stone-700 dark:text-stone-200">{token.label}</p>
          <code className="text-xs text-stone-400 font-mono">{token.name}</code>
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <button
              onClick={onSave}
              disabled={saving}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md bg-primary-600 hover:bg-primary-700 text-cream disabled:opacity-50 transition"
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              Save
            </button>
          )}
          {modified && !dirty && (
            <button
              onClick={onRevert}
              disabled={saving}
              className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-md text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition"
            >
              <RotateCcw className="w-3 h-3" /> Revert
            </button>
          )}
        </div>
      </div>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={token.placeholder}
        className="w-full px-3 py-2 text-sm rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 focus:outline-none focus:ring-1 focus:ring-primary-500 font-mono"
      />
      <p
        className="mt-2 text-lg"
        style={{ fontFamily: value || undefined }}
      >
        The quick brown fox jumps over the lazy dog
      </p>
    </div>
  );
}

function RadiusRow({
  token,
  value,
  dirty,
  modified,
  saving,
  onChange,
  onSave,
  onRevert,
}: {
  token: RadiusToken;
  value: string;
  dirty: boolean;
  modified: boolean;
  saving: boolean;
  onChange: (v: string) => void;
  onSave: () => void;
  onRevert: () => void;
}) {
  const px = parseInt(value) || 0;
  return (
    <div
      className={`p-4 rounded-lg border transition ${
        dirty
          ? "border-rust-300 dark:border-rust-700 bg-rust-50/30 dark:bg-rust-950/10"
          : modified
          ? "border-primary-300/60 dark:border-stone-700"
          : "border-stone-200/60 dark:border-stone-800"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-sm font-medium text-stone-700 dark:text-stone-200">{token.label}</p>
          <code className="text-xs text-stone-400 font-mono">{token.name}</code>
        </div>
        <div className="flex items-center gap-2">
          {dirty && (
            <button
              onClick={onSave}
              disabled={saving}
              className="flex items-center gap-1 px-2.5 py-1.5 text-xs font-semibold rounded-md bg-primary-600 hover:bg-primary-700 text-cream disabled:opacity-50 transition"
            >
              {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Check className="w-3 h-3" />}
              Save
            </button>
          )}
          {modified && !dirty && (
            <button
              onClick={onRevert}
              disabled={saving}
              className="flex items-center gap-1 px-2 py-1.5 text-xs font-medium rounded-md text-stone-500 hover:text-stone-800 dark:hover:text-stone-200 transition"
            >
              <RotateCcw className="w-3 h-3" /> Revert
            </button>
          )}
        </div>
      </div>
      <div className="flex items-center gap-4">
        <input
          type="range"
          min="0"
          max="32"
          value={px}
          onChange={(e) => onChange(e.target.value + "px")}
          className="flex-1 accent-primary-600"
        />
        <input
          type="number"
          value={px}
          onChange={(e) => onChange(e.target.value + "px")}
          className="w-16 px-2 py-1 text-sm rounded-lg border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-700 dark:text-stone-200 focus:outline-none focus:ring-1 focus:ring-primary-500"
        />
        <div
          className="w-12 h-12 border-2 border-primary-300 dark:border-stone-600 bg-primary-100 dark:bg-primary-900/30 shrink-0"
          style={{ borderRadius: `${px}px` }}
        />
      </div>
    </div>
  );
}
