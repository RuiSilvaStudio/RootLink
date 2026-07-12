"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/locale-context";
import { Badge } from "@/components/ui/Badge";
import { EmptyState } from "@/components/ui";
import { ListSkeleton } from "@/components/ui/LoadingSkeleton";
import { LoadError } from "@/components/studio/LoadError";

const STATUS_TABS = ["pending", "more_info_requested", "rejected", "verified"] as const;

export default function EntityVerificationQueuePage() {
  const { t } = useLocale();
  const [status, setStatus] = useState<(typeof STATUS_TABS)[number]>("pending");
  const [entities, setEntities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      setEntities(await api.entities.verificationQueue(status));
    } catch {
      setLoadError(true);
      setEntities([]);
    } finally {
      setLoading(false);
    }
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  if (loading) return <div className="p-6"><ListSkeleton rows={6} /></div>;
  if (loadError) return <div className="p-6 max-w-xl"><LoadError onRetry={load} /></div>;

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 px-6 py-4 border-b border-primary-200/40 dark:border-stone-800">
        <h1 className="font-display text-xl font-semibold text-stone-800 dark:text-stone-100">Entity Verification</h1>
        <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">Review entity self-registration requests</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex gap-2 mb-5">
          {STATUS_TABS.map((s) => (
            <button
              key={s}
              onClick={() => setStatus(s)}
              className={`px-3 py-1.5 text-xs rounded-lg border transition ${
                status === s ? "bg-primary-600 text-white border-primary-600" : "bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700"
              }`}
            >
              {s.replace(/_/g, " ")}
            </button>
          ))}
        </div>

        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/60 dark:border-stone-700 overflow-hidden">
          {entities.length === 0 ? (
            <EmptyState title="No results" message={t("admin.entity_verification_empty")} />
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 dark:border-stone-800">
                  <th className="text-left px-4 py-3 text-xs font-display font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider">{t("admin.entity_verification_col_name")}</th>
                  <th className="text-left px-4 py-3 text-xs font-display font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider">{t("admin.entity_verification_col_type")}</th>
                  <th className="text-left px-4 py-3 text-xs font-display font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider">{t("admin.entity_verification_col_tax_id")}</th>
                  <th className="text-right px-4 py-3 text-xs font-display font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider">{t("admin.entity_verification_review")}</th>
                </tr>
              </thead>
              <tbody>
                {entities.map((e) => (
                  <tr key={e.id} className="border-b border-stone-50 dark:border-stone-800/60 last:border-0">
                    <td className="px-4 py-3 font-serif text-stone-800 dark:text-stone-100">{e.name}</td>
                    <td className="px-4 py-3"><Badge variant="stone" className="text-[10px]">{e.entity_type}</Badge></td>
                    <td className="px-4 py-3 text-stone-500 dark:text-stone-300 font-serif">{e.tax_registration_id || "—"}</td>
                    <td className="px-4 py-3 text-right">
                      <Link href={`/entity/${e.id}`} className="text-primary-600 hover:underline">{t("admin.entity_verification_review")}</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
