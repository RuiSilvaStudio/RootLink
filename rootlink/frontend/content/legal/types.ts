/**
 * Shared content model for the legal pages (Privacidade / Termos / Legal).
 *
 * Why not the Content UI Editor (`EditableText`) for this copy:
 * legal text needs a deliberate, dated, git-audited edit trail — not
 * freeform inline WYSIWYG edits by any super_admin. Editing one of these
 * documents means: edit this file, bump `version`/`lastUpdated`, add a
 * `changelog` entry, and commit — git history is the audit trail.
 *
 * See discovery/mockups/content-ui-editor/briefing-to-build-local.md for
 * the Content UI Editor itself, which intentionally does NOT cover these
 * pages.
 */

export type LegalBlock =
  | { type: "p"; text: string }
  | { type: "ul"; items: string[] }
  | { type: "ol"; items: string[] };

export type LegalSection = {
  id: string;
  heading: string;
  blocks: LegalBlock[];
};

export type LegalChangelogEntry = {
  date: string; // YYYY-MM-DD
  version: string;
  summary: string;
};

export type LegalDoc = {
  /** Route slug, e.g. "privacidade" — used for cross-links between documents. */
  slug: "privacidade" | "termos" | "legal";
  title: string;
  /** Short one-line description shown under the title. */
  description: string;
  version: string;
  effectiveDate: string; // YYYY-MM-DD
  lastUpdated: string; // YYYY-MM-DD
  /** Intro paragraphs shown before the table of contents. */
  intro: string[];
  sections: LegalSection[];
  changelog: LegalChangelogEntry[];
};

export const LEGAL_DOC_LABELS: Record<LegalDoc["slug"], string> = {
  privacidade: "Política de Privacidade",
  termos: "Termos de Utilização",
  legal: "Aviso Legal",
};

export const LEGAL_DOC_ROUTES: Record<LegalDoc["slug"], string> = {
  privacidade: "/privacidade",
  termos: "/termos",
  legal: "/legal",
};

/**
 * Shapes returned by the backend (`/api/legal/*`, `/api/admin/legal/*`) —
 * snake_case, matching `app/schemas/legal.py`. Kept distinct from `LegalDoc`
 * (the frontend's own camelCase shape, used for the static fallback copy in
 * this same folder) — see the `apiPublicToLegalDoc` converter below.
 */
export type ApiLegalDocumentPublic = {
  slug: string;
  title: string;
  description: string;
  intro: string[];
  sections: LegalSection[];
  version: string;
  effective_date: string;
  last_updated: string;
  changelog: LegalChangelogEntry[];
};

export type ApiLegalDocumentAdmin = {
  slug: string;
  title: string;
  description: string;
  intro: string[];
  sections: LegalSection[];
  version: string;
  effective_date: string;
  changelog: LegalChangelogEntry[];
  published_snapshot: {
    title: string;
    description: string;
    intro: string[];
    sections: LegalSection[];
    version: string;
    effective_date: string;
  } | null;
  published_at: string | null;
  has_unpublished_changes: boolean;
  updated_at: string;
};

export function apiPublicToLegalDoc(doc: ApiLegalDocumentPublic): LegalDoc {
  return {
    slug: doc.slug as LegalDoc["slug"],
    title: doc.title,
    description: doc.description,
    version: doc.version,
    effectiveDate: doc.effective_date,
    lastUpdated: doc.last_updated,
    intro: doc.intro,
    sections: doc.sections,
    changelog: doc.changelog,
  };
}
