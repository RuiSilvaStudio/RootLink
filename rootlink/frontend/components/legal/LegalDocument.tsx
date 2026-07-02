"use client";

import Link from "next/link";
import { ReactNode } from "react";
import { ArrowLeft, AlertTriangle, History } from "lucide-react";
import { PageHeader, Badge } from "@/components/ui";
import { LegalDoc, LEGAL_DOC_LABELS, LEGAL_DOC_ROUTES } from "@/content/legal/types";

function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("pt-PT", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

type Props = {
  doc: LegalDoc;
  icon: ReactNode;
  /**
   * Shown while the document hasn't been reviewed/published yet. Defaults to
   * true — flip to false (or delete this prop usage) once a lawyer has
   * signed off and the footer links are switched on in Footer.tsx.
   */
  draft?: boolean;
};

export function LegalDocument({ doc, icon, draft = true }: Props) {
  const otherDocs = (Object.keys(LEGAL_DOC_LABELS) as LegalDoc["slug"][]).filter(
    (slug) => slug !== doc.slug
  );

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-12">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200 transition-colors mb-8"
      >
        <ArrowLeft size={16} />
        Voltar
      </Link>

      {draft && (
        <div className="mb-8 flex items-start gap-3 rounded-xl border border-amber-200 dark:border-amber-800/40 bg-amber-50 dark:bg-amber-900/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-300">
          <AlertTriangle size={18} className="mt-0.5 shrink-0" />
          <p>
            <strong>Rascunho em revisão interna.</strong> Este documento ainda não foi publicado
            oficialmente nem revisto por um advogado — está disponível apenas para avaliação. Não
            constitui aconselhamento jurídico.
          </p>
        </div>
      )}

      <PageHeader icon={icon} title={doc.title} description={doc.description} />

      <div className="mt-6 flex flex-wrap items-center gap-2">
        <Badge variant="stone">Versão {doc.version}</Badge>
        <Badge variant="stone">Última atualização: {formatDate(doc.lastUpdated)}</Badge>
      </div>

      <div className="mt-10 space-y-4 font-serif text-base leading-relaxed text-stone-600 dark:text-stone-400">
        {doc.intro.map((p, i) => (
          <p key={i}>{p}</p>
        ))}
      </div>

      {/* Table of contents */}
      <nav aria-label="Índice" className="mt-8 rounded-xl border border-stone-200 dark:border-stone-800 p-5">
        <p className="text-xs font-display font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500 mb-3">
          Índice
        </p>
        <ol className="space-y-1.5 text-sm">
          {doc.sections.map((s) => (
            <li key={s.id}>
              <a
                href={`#${s.id}`}
                className="text-primary-700 dark:text-primary-400 hover:underline"
              >
                {s.heading}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      {/* Sections */}
      <div className="mt-10 space-y-10">
        {doc.sections.map((s) => (
          <section key={s.id} id={s.id} className="scroll-mt-24">
            <h2 className="text-xl font-display font-semibold text-stone-800 dark:text-stone-100 mb-3">
              {s.heading}
            </h2>
            <div className="space-y-3 font-serif text-base leading-relaxed text-stone-600 dark:text-stone-400">
              {s.blocks.map((b, i) => {
                if (b.type === "p") return <p key={i}>{b.text}</p>;
                if (b.type === "ul")
                  return (
                    <ul key={i} className="list-disc pl-5 space-y-1.5">
                      {b.items.map((item, j) => (
                        <li key={j}>{item}</li>
                      ))}
                    </ul>
                  );
                return (
                  <ol key={i} className="list-decimal pl-5 space-y-1.5">
                    {b.items.map((item, j) => (
                      <li key={j}>{item}</li>
                    ))}
                  </ol>
                );
              })}
            </div>
          </section>
        ))}
      </div>

      {/* Changelog */}
      <section className="mt-14 border-t border-stone-200 dark:border-stone-800 pt-8">
        <h2 className="flex items-center gap-2 text-sm font-display font-semibold uppercase tracking-wider text-stone-400 dark:text-stone-500 mb-4">
          <History size={16} />
          Histórico de alterações
        </h2>
        <ul className="space-y-2 text-sm text-stone-500 dark:text-stone-400">
          {doc.changelog.map((entry, i) => (
            <li key={i} className="flex gap-3">
              <span className="shrink-0 font-mono text-xs text-stone-400 dark:text-stone-600">
                {formatDate(entry.date)}
              </span>
              <span>
                <strong className="text-stone-600 dark:text-stone-300">v{entry.version}</strong>{" "}
                — {entry.summary}
              </span>
            </li>
          ))}
        </ul>
      </section>

      {/* Cross-links */}
      <p className="mt-8 text-sm text-stone-400 dark:text-stone-500">
        Ver também:{" "}
        {otherDocs.map((slug, i) => (
          <span key={slug}>
            <Link href={LEGAL_DOC_ROUTES[slug]} className="text-primary-700 dark:text-primary-400 hover:underline">
              {LEGAL_DOC_LABELS[slug]}
            </Link>
            {i < otherDocs.length - 1 ? " · " : ""}
          </span>
        ))}
      </p>
    </div>
  );
}
