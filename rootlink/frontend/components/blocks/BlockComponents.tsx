/**
 * Block components for the Content Studio block registry.
 *
 * Each component receives `props` (a Record<string, string>) and renders
 * the block. Components use the platform's design tokens (CSS vars) so
 * they automatically reflect theme overrides.
 *
 * Spec: docs/content-studio/CONTENT_STUDIO.md §6.
 */

import Link from "next/link";

type BlockProps = { props: Record<string, string> };

export function HeroBlock({ props }: BlockProps) {
  return (
    <section className="py-20 px-6 text-center max-w-4xl mx-auto">
      <h1 className="font-display text-4xl lg:text-5xl font-bold text-primary-700 dark:text-primary-300 leading-tight mb-4">
        {props.title || "Untitled"}
      </h1>
      <p className="text-lg text-stone-600 dark:text-stone-400 font-serif leading-relaxed mb-8 max-w-2xl mx-auto">
        {props.subtitle || ""}
      </p>
      {props.cta_text && (
        <Link
          href={props.cta_href || "/"}
          className="inline-flex items-center gap-2 px-6 py-3 rounded-full bg-primary-600 hover:bg-primary-700 text-cream font-medium transition shadow-sm hover:shadow-md"
        >
          {props.cta_text}
        </Link>
      )}
    </section>
  );
}

export function TextBlock({ props }: BlockProps) {
  return (
    <section className="py-12 px-6 max-w-3xl mx-auto">
      <div className="w-16 h-0.5 bg-primary-300 rounded-full mb-4" />
      <h2 className="font-display text-2xl font-semibold text-primary-700 dark:text-primary-300 mb-4">
        {props.heading || "Untitled"}
      </h2>
      <p className="text-base text-stone-600 dark:text-stone-400 font-serif leading-relaxed whitespace-pre-wrap">
        {props.body || ""}
      </p>
    </section>
  );
}

export function CardGridBlock({ props }: BlockProps) {
  const cards = [
    { title: props.card1_title, desc: props.card1_desc },
    { title: props.card2_title, desc: props.card2_desc },
    { title: props.card3_title, desc: props.card3_desc },
  ];
  return (
    <section className="py-12 px-6 max-w-5xl mx-auto">
      <h2 className="font-display text-2xl font-semibold text-primary-700 dark:text-primary-300 mb-6">
        {props.heading || "Explore"}
      </h2>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {cards.map((card, i) => (
          <div
            key={i}
            className="rounded-xl2 border border-primary-200/60 dark:border-stone-800 bg-white dark:bg-stone-900 p-5 transition hover:border-primary-300 dark:hover:border-primary-700"
          >
            <h3 className="font-display font-semibold text-stone-800 dark:text-stone-100 mb-1">
              {card.title || ""}
            </h3>
            <p className="text-sm text-stone-500 dark:text-stone-400 font-serif leading-relaxed">
              {card.desc || ""}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}

export function CtaBlock({ props }: BlockProps) {
  return (
    <section className="py-16 px-6">
      <div className="max-w-3xl mx-auto rounded-xl2 bg-primary-600 text-cream p-8 lg:p-12 text-center">
        <h2 className="font-display text-2xl lg:text-3xl font-bold mb-2">
          {props.title || ""}
        </h2>
        <p className="text-cream/80 font-serif leading-relaxed mb-6 max-w-xl mx-auto">
          {props.subtitle || ""}
        </p>
        {props.button_text && (
          <Link
            href={props.button_href || "/"}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-cream text-primary-700 font-medium hover:bg-cream/90 transition"
          >
            {props.button_text}
          </Link>
        )}
      </div>
    </section>
  );
}
