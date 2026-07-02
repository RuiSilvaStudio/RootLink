"use client";

import { FileText } from "lucide-react";
import { LegalDocument } from "@/components/legal/LegalDocument";
import { PageSkeleton } from "@/components/ui";
import { termos } from "@/content/legal/termos";
import { useLegalDoc } from "@/lib/use-legal-doc";

export default function TermosPage() {
  const { doc, draft, loading } = useLegalDoc("termos", termos);

  if (loading) return <PageSkeleton />;

  return (
    <LegalDocument
      doc={doc}
      draft={draft}
      icon={<FileText className="w-6 h-6 text-primary-700 dark:text-primary-400" />}
    />
  );
}
