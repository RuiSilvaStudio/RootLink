"use client";

import { useState, useEffect } from "react";
import { useLocale } from "@/lib/locale-context";
import { SubmitForm } from "@/components/SubmitForm";
import { Badge } from "@/components/ui/Badge";

export default function AdminSubmitPage() {
  const { t } = useLocale();
  const [token, setToken] = useState<string | null>(null);

  useEffect(() => {
    setToken(localStorage.getItem("token"));
  }, []);

  if (!token) {
    return (
      <div className="text-center py-20 text-stone-400 font-serif">
        {t("submit.not_signed_in")}
      </div>
    );
  }

  return (
    <div className="max-w-2xl">
      <div className="mb-6">
        <Badge variant="sage" className="mb-3">{t("admin.submit_url")}</Badge>
        <h1 className="text-3xl sm:text-4xl font-display font-semibold text-stone-800 dark:text-stone-100 leading-[1.08]">
          {t("submit.title")}
        </h1>
        <p className="text-stone-500 text-sm mt-2 font-serif">{t("submit.subtitle")}</p>
      </div>
      <SubmitForm />
    </div>
  );
}
