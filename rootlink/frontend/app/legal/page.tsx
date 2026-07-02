"use client";

import { Scale } from "lucide-react";
import { LegalDocument } from "@/components/legal/LegalDocument";
import { PageSkeleton } from "@/components/ui";
import { legal } from "@/content/legal/legal";
import { useLegalDoc } from "@/lib/use-legal-doc";

export default function LegalPage() {
  const { doc, draft, loading } = useLegalDoc("legal", legal);

  if (loading) return <PageSkeleton />;

  return (
    <LegalDocument
      doc={doc}
      draft={draft}
      icon={<Scale className="w-6 h-6 text-primary-700 dark:text-primary-400" />}
    />
  );
}
