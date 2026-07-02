import { LegalBlock } from "@/content/legal/types";

/**
 * Converts structured `LegalBlock[]` <-> a friendly plain-text format, so
 * non-technical editors (the admin, or a lawyer looking over their shoulder)
 * can edit a legal section as a normal textarea instead of a fussy
 * block-by-block form.
 *
 * Syntax:
 *   - Blocks are separated by a blank line.
 *   - A block where every line starts with "- " is a bullet list.
 *   - A block where every line starts with "1. " (any number) is a numbered list.
 *   - Anything else is a paragraph (line breaks within it are collapsed to spaces).
 */

const UL_PREFIX = /^-\s+/;
const OL_PREFIX = /^\d+\.\s+/;

export function blocksToText(blocks: LegalBlock[]): string {
  return blocks
    .map((b) => {
      if (b.type === "ul") return b.items.map((i) => `- ${i}`).join("\n");
      if (b.type === "ol") return b.items.map((i, idx) => `${idx + 1}. ${i}`).join("\n");
      return b.text;
    })
    .join("\n\n");
}

export function textToBlocks(text: string): LegalBlock[] {
  const chunks = text
    .split(/\n\s*\n/)
    .map((c) => c.trim())
    .filter(Boolean);

  return chunks.map((chunk): LegalBlock => {
    const lines = chunk.split("\n").map((l) => l.trim()).filter(Boolean);

    if (lines.length > 0 && lines.every((l) => UL_PREFIX.test(l))) {
      return { type: "ul", items: lines.map((l) => l.replace(UL_PREFIX, "")) };
    }
    if (lines.length > 0 && lines.every((l) => OL_PREFIX.test(l))) {
      return { type: "ol", items: lines.map((l) => l.replace(OL_PREFIX, "")) };
    }
    return { type: "p", text: lines.join(" ") };
  });
}

export function introToText(intro: string[]): string {
  return intro.join("\n\n");
}

export function textToIntro(text: string): string[] {
  return text
    .split(/\n\s*\n/)
    .map((c) => c.trim().replace(/\s*\n\s*/g, " "))
    .filter(Boolean);
}

/** Slugify a heading into a stable section id (kept if already set, only used for new sections). */
export function slugifyHeading(heading: string): string {
  return (
    heading
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "") // strip accents
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || `section-${Date.now()}`
  );
}

/** Suggests the next version string by bumping the minor number (0.1 -> 0.2, 1.3 -> 1.4). */
export function suggestNextVersion(current: string): string {
  const parts = current.split(".");
  const last = parseInt(parts[parts.length - 1], 10);
  if (Number.isNaN(last)) return current;
  parts[parts.length - 1] = String(last + 1);
  return parts.join(".");
}
