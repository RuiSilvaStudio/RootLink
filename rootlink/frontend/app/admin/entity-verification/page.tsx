"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { useToast } from "@/lib/toast-context";
import { Badge } from "@/components/ui/Badge";

const STATUS_TABS = ["pending", "more_info_requested", "rejected", "verified"] as const;

export default function EntityVerificationQueuePage() {
  const { addToast } = useToast();
  const [status, setStatus] = useState<(typeof STATUS_TABS)[number]>("pending");
  const [entities, setEntities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setEntities(await api.entities.verificationQueue(status));
    } catch (err: any) {
      addToast("error", err.message || "Failed to load queue");
      setEntities([]);
    } finally {
      setLoading(false);
    }
  }, [status]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { load(); }, [load]);

  return (
    <div>
      <div className="mb-6">
        <Badge variant="sage" className="mb-3">Entity Verification</Badge>
        <h1 className="text-3xl sm:text-4xl font-display font-semibold text-stone-800 dark:text-stone-100 leading-[1.08] flex items-center gap-2">
          <ShieldCheck className="w-7 h-7 text-primary-500" /> Verification queue
        </h1>
        <p className="text-sm text-stone-500 font-serif mt-2">
          Organizations, partners, and suppliers awaiting document-review verification.
        </p>
      </div>

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
        {loading ? (
          <p className="text-stone-400 text-sm py-8 text-center font-serif">Loading…</p>
        ) : entities.length === 0 ? (
          <p className="text-stone-400 text-sm py-8 text-center font-serif">No entities in this state.</p>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100 dark:border-stone-800">
                <th className="text-left px-4 py-3 text-xs font-display font-semibold text-stone-400 uppercase tracking-wider">Name</th>
                <th className="text-left px-4 py-3 text-xs font-display font-semibold text-stone-400 uppercase tracking-wider">Type</th>
                <th className="text-left px-4 py-3 text-xs font-display font-semibold text-stone-400 uppercase tracking-wider">Tax ID</th>
                <th className="text-right px-4 py-3 text-xs font-display font-semibold text-stone-400 uppercase tracking-wider">Review</th>
              </tr>
            </thead>
            <tbody>
              {entities.map((e) => (
                <tr key={e.id} className="border-b border-stone-50 dark:border-stone-800/60 last:border-0">
                  <td className="px-4 py-3 font-serif text-stone-800 dark:text-stone-100">{e.name}</td>
                  <td className="px-4 py-3"><Badge variant="stone" className="text-[10px]">{e.entity_type}</Badge></td>
                  <td className="px-4 py-3 text-stone-500 font-serif">{e.tax_registration_id || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/entity/${e.id}`} className="text-primary-600 hover:underline">Review</Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
