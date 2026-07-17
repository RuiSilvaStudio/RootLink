"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { GroupGraduationRequest } from "@/lib/groups-types";
import { useLocale } from "@/lib/locale-context";
import { useToast } from "@/lib/toast-context";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { LoadError } from "@/components/studio/LoadError";
import { GraduationCap, Check, X, ExternalLink } from "lucide-react";

export default function GraduationReviewPage() {
  const { t } = useLocale();
  const { addToast } = useToast();
  const [requests, setRequests] = useState<GroupGraduationRequest[] | null>(null);
  const [error, setError] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError(false);
    try { setRequests(await api.groups.listGraduationRequests("pending")); }
    catch { setError(true); }
  }, []);

  useEffect(() => { load(); }, [load]);

  const approve = async (r: GroupGraduationRequest) => {
    setBusyId(r.id);
    try {
      await api.groups.approveGraduation(r.id);
      addToast("success", "Graduation approved");
      setRequests(prev => prev?.filter(x => x.id !== r.id) ?? null);
    } catch {
      addToast("error", "Could not approve");
    } finally { setBusyId(null); }
  };

  const reject = async (r: GroupGraduationRequest) => {
    const notes = window.prompt("Rejection reason (optional):") || undefined;
    setBusyId(r.id);
    try {
      await api.groups.rejectGraduation(r.id, notes);
      addToast("success", "Request rejected");
      setRequests(prev => prev?.filter(x => x.id !== r.id) ?? null);
    } catch {
      addToast("error", "Could not reject");
    } finally { setBusyId(null); }
  };

  if (error) return <LoadError message="Could not load requests" onRetry={load} />;

  if (requests === null) {
    return <div className="space-y-3" aria-busy="true">{[0, 1].map(i => <div key={i} className="h-24 rounded-xl skeleton-shimmer" />)}</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 mb-2">
        <GraduationCap className="w-5 h-5 text-primary-500" aria-hidden />
        <h1 className="font-display text-xl font-semibold text-stone-800 dark:text-stone-100" data-rl-text="groups.graduation_admin_title">{t("groups.graduation_admin_title")}</h1>
      </div>

      {requests.length === 0 ? (
        <EmptyState icon={<GraduationCap className="w-7 h-7 text-primary-400" aria-hidden />} title={t("groups.graduation_admin_empty")} />
      ) : (
        requests.map(r => (
          <Card key={r.id} variant="plain" className="p-5 space-y-3">
            <div className="flex items-start justify-between gap-3">
              <div>
                <p className="font-medium text-stone-800 dark:text-stone-100">{r.organization_name}</p>
                <p className="text-sm text-stone-500">NIPC: {r.nipc} · {t(`groups.legal_form_${r.legal_form}`)}</p>
                {r.certificate_url && (
                  <a href={r.certificate_url} target="_blank" rel="noopener noreferrer" className="text-sm text-rust-500 hover:underline inline-flex items-center gap-1 mt-1">
                    Certificate <ExternalLink className="w-3 h-3" aria-hidden />
                  </a>
                )}
                {r.notes && <p className="text-sm text-stone-400 mt-1">{r.notes}</p>}
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <Button size="xs" disabled={busyId === r.id} onClick={() => approve(r)}>
                  <Check className="w-3.5 h-3.5" aria-hidden /> {t("groups.graduation_approve")}
                </Button>
                <Button size="xs" variant="danger" disabled={busyId === r.id} onClick={() => reject(r)}>
                  <X className="w-3.5 h-3.5" aria-hidden /> {t("groups.graduation_reject")}
                </Button>
              </div>
            </div>
          </Card>
        ))
      )}
    </div>
  );
}
