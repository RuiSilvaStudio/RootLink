"use client";

import { ShieldCheck } from "lucide-react";
import { LegalDocument } from "@/components/legal/LegalDocument";
import { PageSkeleton } from "@/components/ui";
import { privacidade } from "@/content/legal/privacidade";
import { useLegalDoc } from "@/lib/use-legal-doc";

export default function PrivacidadePage() {
  const { doc, draft, loading } = useLegalDoc("privacidade", privacidade);

  if (loading) return <PageSkeleton />;

  return (
    <LegalDocument
      doc={doc}
      draft={draft}
      icon={<ShieldCheck className="w-6 h-6 text-primary-700 dark:text-primary-400" />}
    />
  );
}
