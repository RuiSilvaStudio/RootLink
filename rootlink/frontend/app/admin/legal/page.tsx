"use client";

import { useEffect, useMemo, useState } from "react";
import { ShieldCheck, FileText, Scale, Save, UploadCloud, Plus, Trash2, ChevronUp, ChevronDown, History, ExternalLink } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import { Input, Textarea, Badge } from "@/components/ui";
import {
  ApiLegalDocumentAdmin,
  LEGAL_DOC_LABELS,
  LEGAL_DOC_ROUTES,
  LegalDoc,
} from "@/content/legal/types";
import { blocksToText, textToBlocks, introToText, textToIntro, slugifyHeading, suggestNextVersion } from "@/lib/legal-text";

const SLUGS = ["privacidade", "termos", "legal"] as const;
type Slug = (typeof SLUGS)[number];

const ICONS: Record<Slug, any> = { privacidade: ShieldCheck, termos: FileText, legal: Scale };

type SectionDraft = { id: string; heading: string; body: string };

type FormState = {
  title: string;
  description: string;
  introText: string;
  sections: SectionDraft[];
};

function docToForm(doc: ApiLegalDocumentAdmin): FormState {
  return {
    title: doc.title,
    description: doc.description,
    introText: introToText(doc.intro),
    sections: doc.sections.map((s) => ({ id: s.id, heading: s.heading, body: blocksToText(s.blocks) })),
  };
}

export default function AdminLegalPage() {
  const { user } = useAuth();
  const { addToast } = useToast();
  const isSuperAdmin = user?.role === "super_admin";

  const [active, setActive] = useState<Slug>("privacidade");
  const [docs, setDocs] = useState<Record<Slug, ApiLegalDocumentAdmin> | null>(null);
  const [forms, setForms] = useState<Record<Slug, FormState> | null>(null);
  const [saving, setSaving] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [showPublish, setShowPublish] = useState(false);
  const [publishVersion, setPublishVersion] = useState("");
  const [publishDate, setPublishDate] = useState("");
  const [publishSummary, setPublishSummary] = useState("");

  useEffect(() => {
    if (!isSuperAdmin) return;
    api.adminLegal.list().then((rows) => {
      const byDoc: any = {};
      const byForm: any = {};
      rows.forEach((r) => {
        byDoc[r.slug] = r;
        byForm[r.slug] = docToForm(r);
      });
      setDocs(byDoc);
      setForms(byForm);
    }).catch(() => addToast("error", "Failed to load legal documents"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isSuperAdmin]);

  const doc = docs?.[active];
  const form = forms?.[active];

  const dirty = useMemo(() => {
    if (!doc || !form) return false;
    const original = docToForm(doc);
    return JSON.stringify(original) !== JSON.stringify(form);
  }, [doc, form]);

  if (!isSuperAdmin) {
    return <p className="text-stone-500 font-serif py-8">Only super_admin can manage legal documents.</p>;
  }

  if (!docs || !forms || !form) {
    return (
      <div className="space-y-3">
        {[1, 2, 3].map((i) => <div key={i} className="h-16 rounded-xl bg-stone-100 dark:bg-stone-800 animate-pulse" />)}
      </div>
    );
  }

  const setForm = (updater: (f: FormState) => FormState) => {
    setForms((prev) => (prev ? { ...prev, [active]: updater(prev[active]) } : prev));
  };

  const updateSection = (idx: number, patch: Partial<SectionDraft>) => {
    setForm((f) => ({ ...f, sections: f.sections.map((s, i) => (i === idx ? { ...s, ...patch } : s)) }));
  };

  const addSection = () => {
    setForm((f) => ({
      ...f,
      sections: [...f.sections, { id: slugifyHeading(`nova-seccao-${f.sections.length + 1}`), heading: "Nova secção", body: "" }],
    }));
  };

  const removeSection = (idx: number) => {
    setForm((f) => ({ ...f, sections: f.sections.filter((_, i) => i !== idx) }));
  };

  const moveSection = (idx: number, dir: -1 | 1) => {
    setForm((f) => {
      const next = [...f.sections];
      const target = idx + dir;
      if (target < 0 || target >= next.length) return f;
      [next[idx], next[target]] = [next[target], next[idx]];
      return { ...f, sections: next };
    });
  };

  const saveDraft = async () => {
    if (!form) return;
    setSaving(true);
    try {
      const updated = await api.adminLegal.update(active, {
        title: form.title,
        description: form.description,
        intro: textToIntro(form.introText),
        sections: form.sections.map((s) => ({ id: s.id, heading: s.heading, blocks: textToBlocks(s.body) })),
      });
      setDocs((prev) => (prev ? { ...prev, [active]: updated } : prev));
      setForms((prev) => (prev ? { ...prev, [active]: docToForm(updated) } : prev));
      addToast("success", "Rascunho guardado");
    } catch (err: any) {
      addToast("error", err.message || "Failed to save");
    }
    setSaving(false);
  };

  const openPublish = () => {
    if (!doc) return;
    setPublishVersion(suggestNextVersion(doc.version));
    setPublishDate(new Date().toISOString().slice(0, 10));
    setPublishSummary("");
    setShowPublish(true);
  };

  const publish = async () => {
    if (!publishSummary.trim()) {
      addToast("error", "Descreva o que mudou antes de publicar");
      return;
    }
    setPublishing(true);
    try {
      // Publish always publishes the currently saved draft — save first so
      // in-progress edits in the textarea aren't left behind.
      if (dirty) await saveDraft();
      const updated = await api.adminLegal.publish(active, {
        version: publishVersion,
        effective_date: publishDate,
        summary: publishSummary.trim(),
      });
      setDocs((prev) => (prev ? { ...prev, [active]: updated } : prev));
      setForms((prev) => (prev ? { ...prev, [active]: docToForm(updated) } : prev));
      setShowPublish(false);
      addToast("success", `${LEGAL_DOC_LABELS[active]} publicado (v${publishVersion})`);
    } catch (err: any) {
      addToast("error", err.message || "Failed to publish");
    }
    setPublishing(false);
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-3xl sm:text-4xl font-display font-semibold text-stone-800 dark:text-stone-100 leading-[1.08]">
          Legal documents
        </h1>
        <p className="text-sm text-stone-500 dark:text-stone-400 mt-2 font-serif max-w-2xl">
          Edit the Privacy Policy, Terms of Use and Legal Notice. Saving keeps changes as a draft —
          nothing on the public page changes until you hit <strong>Publish</strong>. Only visible to
          super_admin.
        </p>
      </div>

      {/* Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {SLUGS.map((slug) => {
          const Icon = ICONS[slug];
          const d = docs[slug];
          return (
            <button
              key={slug}
              onClick={() => setActive(slug)}
              className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium font-display transition border ${
                active === slug
                  ? "bg-primary-600 text-white border-primary-600"
                  : "bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 border-stone-200/70 dark:border-stone-700 hover:border-primary-300"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {LEGAL_DOC_LABELS[slug]}
              {d?.has_unpublished_changes && (
                <span className="w-1.5 h-1.5 rounded-full bg-rust-500" title="unpublished changes" />
              )}
            </button>
          );
        })}
      </div>

      {/* Status row */}
      <div className="flex flex-wrap items-center gap-2 mb-6">
        <Badge variant="stone">Versão publicada: {doc?.version}</Badge>
        <Badge variant="stone">Data efetiva: {doc?.effective_date}</Badge>
        {doc?.has_unpublished_changes && <Badge variant="amber">Alterações por publicar</Badge>}
        {!doc?.published_snapshot && <Badge variant="red">Nunca publicado</Badge>}
        <Link
          href={LEGAL_DOC_ROUTES[active]}
          target="_blank"
          className="inline-flex items-center gap-1 text-xs text-primary-700 dark:text-primary-400 hover:underline ml-auto"
        >
          Ver página pública <ExternalLink className="w-3 h-3" />
        </Link>
      </div>

      {/* Form */}
      <div className="space-y-5 max-w-3xl">
        <Input label="Título" value={form.title} onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))} />
        <Input label="Descrição" value={form.description} onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))} />
        <Textarea
          label="Introdução (parágrafos separados por linha em branco)"
          value={form.introText}
          onChange={(e) => setForm((f) => ({ ...f, introText: e.target.value }))}
          rows={4}
        />

        <div>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-sm font-display font-semibold text-stone-600 dark:text-stone-300 uppercase tracking-wider">
              Secções
            </h2>
            <button
              onClick={addSection}
              className="inline-flex items-center gap-1.5 text-xs bg-stone-100 dark:bg-stone-800 text-stone-600 dark:text-stone-300 px-3 py-1.5 rounded-lg hover:bg-stone-200 dark:hover:bg-stone-700 font-medium transition"
            >
              <Plus className="w-3.5 h-3.5" /> Nova secção
            </button>
          </div>

          <div className="space-y-4">
            {form.sections.map((s, idx) => (
              <div key={s.id} className="bg-white dark:bg-stone-900 rounded-xl border border-stone-200/60 dark:border-stone-700 p-4">
                <div className="flex items-center gap-2 mb-2">
                  <Input
                    value={s.heading}
                    onChange={(e) => updateSection(idx, { heading: e.target.value })}
                    className="flex-1"
                  />
                  <button onClick={() => moveSection(idx, -1)} disabled={idx === 0} className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-30 text-stone-500">
                    <ChevronUp className="w-4 h-4" />
                  </button>
                  <button onClick={() => moveSection(idx, 1)} disabled={idx === form.sections.length - 1} className="p-1.5 rounded-lg hover:bg-stone-100 dark:hover:bg-stone-800 disabled:opacity-30 text-stone-500">
                    <ChevronDown className="w-4 h-4" />
                  </button>
                  <button onClick={() => removeSection(idx)} className="p-1.5 rounded-lg hover:bg-rust-50 dark:hover:bg-rust-900/20 text-rust-500">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
                <Textarea
                  value={s.body}
                  onChange={(e) => updateSection(idx, { body: e.target.value })}
                  rows={6}
                  placeholder={"Texto normal para um parágrafo.\n\n- item de lista\n- outro item\n\nDeixe uma linha em branco entre blocos."}
                />
              </div>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 pt-2">
          <button
            onClick={saveDraft}
            disabled={!dirty || saving}
            className="inline-flex items-center gap-1.5 text-sm bg-stone-700 text-white px-4 py-2 rounded-lg hover:bg-stone-800 disabled:opacity-40 font-medium transition"
          >
            <Save className="w-4 h-4" /> {saving ? "A guardar…" : "Guardar rascunho"}
          </button>
          <button
            onClick={openPublish}
            className="inline-flex items-center gap-1.5 text-sm bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 font-medium transition"
          >
            <UploadCloud className="w-4 h-4" /> Publicar…
          </button>
        </div>

        {/* Changelog */}
        {doc && doc.changelog.length > 0 && (
          <div className="pt-6 border-t border-stone-200 dark:border-stone-800">
            <h2 className="flex items-center gap-2 text-xs font-display font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500 mb-3">
              <History className="w-3.5 h-3.5" /> Histórico de publicações
            </h2>
            <ul className="space-y-1.5 text-sm text-stone-500 dark:text-stone-400">
              {[...doc.changelog].reverse().map((entry, i) => (
                <li key={i}>
                  <span className="font-mono text-xs text-stone-400 dark:text-stone-600">{entry.date}</span>{" "}
                  <strong className="text-stone-600 dark:text-stone-300">v{entry.version}</strong> — {entry.summary}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Publish modal */}
      {showPublish && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 p-4" onClick={() => setShowPublish(false)}>
          <div
            className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200 dark:border-stone-700 p-6 w-full max-w-md"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-display font-semibold text-stone-800 dark:text-stone-100 mb-1">
              Publicar {LEGAL_DOC_LABELS[active]}
            </h3>
            <p className="text-sm text-stone-500 dark:text-stone-400 font-serif mb-4">
              Isto torna o rascunho atual visível na página pública imediatamente.
            </p>
            <div className="space-y-3">
              <Input label="Nova versão" value={publishVersion} onChange={(e) => setPublishVersion(e.target.value)} />
              <Input label="Data efetiva" type="date" value={publishDate} onChange={(e) => setPublishDate(e.target.value)} />
              <Textarea
                label="O que mudou? (aparece no histórico)"
                value={publishSummary}
                onChange={(e) => setPublishSummary(e.target.value)}
                rows={3}
                placeholder="Ex.: Clarificado o âmbito da exportação de dados na secção 8."
              />
            </div>
            <div className="flex items-center gap-2 mt-5">
              <button
                onClick={publish}
                disabled={publishing}
                className="inline-flex items-center gap-1.5 text-sm bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 disabled:opacity-40 font-medium transition"
              >
                <UploadCloud className="w-4 h-4" /> {publishing ? "A publicar…" : "Publicar"}
              </button>
              <button
                onClick={() => setShowPublish(false)}
                className="text-sm text-stone-500 dark:text-stone-400 px-4 py-2 hover:text-stone-700 dark:hover:text-stone-200 transition"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
