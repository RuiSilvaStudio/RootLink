"use client";

import { useEffect, useState } from "react";
import { ListChecks, Leaf, Utensils, NotebookPen, Scale, File, type LucideIcon } from "lucide-react";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/locale-context";
import { InfoPopover } from "@/components/ui";

const ICONS: Record<string, LucideIcon> = {
  "list-checks": ListChecks,
  leaf: Leaf,
  utensils: Utensils,
  "notebook-pen": NotebookPen,
  scale: Scale,
  file: File,
};

export type Template = {
  id: number;
  key: string;
  label_en: string;
  label_pt: string;
  description_en?: string | null;
  description_pt?: string | null;
  icon?: string | null;
  body?: any;
};

/**
 * Lets an author start from a structured template (CONTENT_PLATFORM.md §5.4).
 * Calls onSelect with the chosen template; the parent seeds the editor with its body.
 */
export function TemplatePicker({ onSelect }: { onSelect: (tpl: Template) => void }) {
  const { t, locale } = useLocale();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.contentTemplates
      .list("article")
      .then(setTemplates)
      .catch(() => setTemplates([]))
      .finally(() => setLoading(false));
  }, []);

  const label = (tpl: Template) => (locale === "pt" ? tpl.label_pt : tpl.label_en);
  const desc = (tpl: Template) => (locale === "pt" ? tpl.description_pt : tpl.description_en) || "";

  return (
    <div>
      <div className="flex items-center gap-2 mb-1">
        <h2 className="text-sm font-medium uppercase tracking-wide text-stone-500 dark:text-stone-400">
          {t("create.start_from_template")}
        </h2>
        <InfoPopover label={t("create.start_from_template")}>
          {t("create.template_help")}
        </InfoPopover>
      </div>
      <p className="text-xs text-stone-400 dark:text-stone-500 mb-4">{t("create.template_subheading")}</p>

      {loading ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="h-24 rounded-xl bg-stone-100 dark:bg-stone-800 animate-pulse" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {templates.map((tpl) => {
            const Icon = (tpl.icon && ICONS[tpl.icon]) || File;
            return (
              <button
                key={tpl.id}
                onClick={() => onSelect(tpl)}
                className="text-left p-4 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 hover:border-primary-400 dark:hover:border-primary-500 hover:shadow-sm transition"
              >
                <Icon className="w-5 h-5 text-primary-600 dark:text-primary-400" />
                <p className="mt-2 text-sm font-medium text-stone-800 dark:text-stone-100">{label(tpl)}</p>
                {desc(tpl) && <p className="text-xs text-stone-500 dark:text-stone-400 leading-snug mt-0.5">{desc(tpl)}</p>}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
