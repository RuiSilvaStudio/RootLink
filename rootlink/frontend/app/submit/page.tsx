"use client";

import { useState, useEffect } from "react";
import { ArrowLeft, Leaf } from "lucide-react";
import { useLocale } from "@/lib/locale-context";
import { SubmitForm } from "@/components/SubmitForm";
import { Button } from "@/components/ui/Button";
import { Text } from "@/components/ui/Text";
import { api } from "@/lib/api";
import { BlockRenderer, type BlockSectionData } from "@/components/blocks";

export default function SubmitPage() {
  const { t } = useLocale();
  const [token, setToken] = useState<string | null>(null);
  const [heroSections, setHeroSections] = useState<BlockSectionData[] | null>(null);

  useEffect(() => {
    setToken(localStorage.getItem("token"));
    api.blocks.getPage("submit")
      .then((p) => p?.sections?.length ? setHeroSections(p.sections) : setHeroSections([]))
      .catch(() => setHeroSections([]));
  }, []);

  if (!token) {
    return (
      <div className="max-w-2xl mx-auto px-4 sm:px-8 py-20 text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary-50 flex items-center justify-center mx-auto mb-5">
          <Leaf className="w-8 h-8 text-primary-400" />
        </div>
        <p className="text-stone-600 mb-6 font-light">{t("submit.not_signed_in")}</p>
        <div className="flex items-center justify-center gap-3">
          <a href="/auth/login"><Button variant="primary">{t("submit.sign_in")}</Button></a>
          <span className="text-stone-300 text-sm">{t("submit.or")}</span>
          <a href="/auth/register"><Button variant="secondary">{t("submit.create_account")}</Button></a>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-8 py-12">
      {heroSections && heroSections.length > 0 && (
        <BlockRenderer sections={heroSections} />
      )}

      <a href="/search" className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-primary-700 mb-6 transition">
        <ArrowLeft className="w-4 h-4" />
        {t("submit.back_to_search")}
      </a>
      <div className="flex items-center gap-3 mb-2">
        <div className="w-10 h-10 rounded-xl bg-primary-100 dark:bg-primary-950/20 flex items-center justify-center">
          <Leaf className="w-5 h-5 text-primary-500" />
        </div>
        <div>
          <Text k="submit.title" as="h1" className="text-2xl font-serif font-bold text-stone-800" />
          <Text k="submit.subtitle" as="p" className="text-sm text-stone-500 font-light" />
        </div>
      </div>
      <div className="mt-8">
        <div className="bg-stone-100/50 border border-stone-200/40 rounded-2xl px-4 py-2.5 mb-6 text-xs text-stone-400 flex items-center justify-end gap-2">
          <span className="font-light">{t("submit.review_note")}</span>
        </div>
        <SubmitForm />
      </div>
    </div>
  );
}
