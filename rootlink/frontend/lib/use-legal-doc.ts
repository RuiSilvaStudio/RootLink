"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { LegalDoc, apiPublicToLegalDoc } from "@/content/legal/types";

/**
 * Fetches the live published document from the backend
 * (`GET /api/legal/{slug}`). Falls back to the bundled static copy
 * (`content/legal/*.ts`) if it hasn't been published yet (404) or the API
 * is unreachable — the page never renders blank.
 *
 * `draft` is true only while showing the static fallback — once a real
 * published version exists, the "not reviewed yet" banner goes away on its
 * own, since that content genuinely came from the admin Publish workflow.
 */
export function useLegalDoc(slug: "privacidade" | "termos" | "legal", fallback: LegalDoc) {
  const [doc, setDoc] = useState<LegalDoc>(fallback);
  const [draft, setDraft] = useState(true);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    api.legal
      .get(slug)
      .then((res) => {
        if (cancelled) return;
        setDoc(apiPublicToLegalDoc(res));
        setDraft(false);
      })
      .catch(() => {
        if (cancelled) return;
        setDoc(fallback);
        setDraft(true);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [slug]);

  return { doc, draft, loading };
}
