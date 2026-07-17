"use client";

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Group, GroupGraduationRequest } from "@/lib/groups-types";
import { useLocale } from "@/lib/locale-context";
import { useToast } from "@/lib/toast-context";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
import { Textarea } from "@/components/ui/Textarea";
import { LoadError } from "@/components/studio/LoadError";
import { GraduationCap, Check, X, Clock } from "lucide-react";

const LEGAL_FORMS = ["associacao", "cooperativa", "sociedade", "fundacao", "ipss", "misericordia", "outra"] as const;
const NIPC_RE = /^\d{9}$/;

export function GraduationSection({ group, onGraduated }: { group: Group; onGraduated: () => Promise<void> }) {
  const { t, locale } = useLocale();
  const { addToast } = useToast();
  const [request, setRequest] = useState<GroupGraduationRequest | null | undefined>(undefined);
  const [error, setError] = useState(false);
  const [form, setForm] = useState({ nipc: "", legal_form: "associacao", organization_name: "", certificate_url: "", notes: "" });
  const [nipcError, setNipcError] = useState<string | undefined>();
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError(false);
    try { setRequest(await api.groups.getGraduationStatus(group.id)); }
    catch { setError(true); }
  }, [group.id]);

  useEffect(() => { load(); }, [load]);

  // Already formal — no graduation needed
  if (group.group_type !== "organic") {
    return (
      <Card variant="plain" className="p-6 text-center">
        <Check className="w-6 h-6 text-emerald-500 mx-auto mb-2" aria-hidden />
        <p className="text-sm text-stone-500" data-rl-text="groups.graduation_not_eligible">{t("groups.graduation_not_eligible")}</p>
      </Card>
    );
  }

  const submit = async () => {
    if (!NIPC_RE.test(form.nipc)) { setNipcError(t("groups.graduation_nipc_error")); return; }
    if (!form.organization_name.trim()) return;
    setSaving(true);
    try {
      const created = await api.groups.requestGraduation(group.id, {
        nipc: form.nipc,
        legal_form: form.legal_form,
        organization_name: form.organization_name.trim(),
        certificate_url: form.certificate_url || undefined,
        notes: form.notes || undefined,
      });
      setRequest(created);
      addToast("success", t("groups.graduation_submitted"));
    } catch (e: unknown) {
      addToast("error", (e instanceof Error && e.message) || t("groups.graduation_nipc_error"));
    } finally { setSaving(false); }
  };

  const fmtDate = (iso: string | null) => {
    if (!iso) return "";
    try { return new Date(iso).toLocaleDateString(locale === "pt" ? "pt-PT" : "en-GB", { day: "numeric", month: "long", year: "numeric" }); }
    catch { return ""; }
  };

  if (error) return <LoadError message={t("groups.group_load_error")} onRetry={load} />;
  if (request === undefined) return <div className="h-32 skeleton-shimmer rounded-xl" aria-busy="true" />;

  // Pending or past request — show status
  if (request && request.status === "pending") {
    return (
      <Card variant="plain" className="p-6 space-y-3">
        <div className="flex items-center gap-2">
          <Clock className="w-5 h-5 text-amber-500" aria-hidden />
          <p className="text-sm font-medium text-stone-700 dark:text-stone-200" data-rl-text="groups.graduation_pending">{t("groups.graduation_pending")}</p>
        </div>
        <div className="text-sm text-stone-500 space-y-1">
          <p>{t("groups.graduation_org_name_label")}: <b>{request.organization_name}</b></p>
          <p>{t("groups.graduation_nipc_label")}: {request.nipc}</p>
          <p>{t("groups.graduation_legal_form_label")}: {t(`groups.legal_form_${request.legal_form}`)}</p>
          {request.certificate_url && <p><a href={request.certificate_url} target="_blank" rel="noopener noreferrer" className="text-rust-500 hover:underline">{t("groups.graduation_certificate_label")}</a></p>}
          <p className="text-xs text-stone-400">{t("groups.graduation_request_date", { date: fmtDate(request.created_at) })}</p>
        </div>
      </Card>
    );
  }

  if (request && request.status === "approved") {
    return (
      <Card variant="plain" className="p-6 text-center">
        <Check className="w-6 h-6 text-emerald-500 mx-auto mb-2" aria-hidden />
        <p className="text-sm font-medium text-stone-700 dark:text-stone-200" data-rl-text="groups.graduation_approved">{t("groups.graduation_approved")}</p>
      </Card>
    );
  }

  // Rejected — show rejection + allow re-submit
  const showRejection = request && request.status === "rejected";

  // The form (initial or after rejection)
  return (
    <Card variant="plain" className="p-6 space-y-4">
      <div className="flex items-start gap-2">
        <GraduationCap className="w-5 h-5 text-primary-500 shrink-0 mt-0.5" aria-hidden />
        <div>
          <h2 className="font-display font-semibold text-stone-800 dark:text-stone-100" data-rl-text="groups.graduation_title">{t("groups.graduation_title")}</h2>
          <p className="text-sm text-stone-500 mt-1">{t("groups.graduation_help")}</p>
        </div>
      </div>

      {showRejection && (
        <div className="rounded-lg border border-rust-200 dark:border-rust-800 bg-rust-50 dark:bg-rust-950/30 p-3">
          <p className="text-sm text-rust-700 dark:text-rust-300" data-rl-text="groups.graduation_rejected">{t("groups.graduation_rejected")}</p>
          {request!.review_notes && <p className="text-xs text-rust-600 mt-1">{t("groups.graduation_review_notes")}: {request!.review_notes}</p>}
        </div>
      )}

      <div className="space-y-3">
        <Input
          label={t("groups.graduation_org_name_label")}
          placeholder={t("groups.graduation_org_name_placeholder")}
          value={form.organization_name}
          maxLength={255}
          onChange={e => setForm(f => ({ ...f, organization_name: e.target.value }))}
        />
        <Input
          label={t("groups.graduation_nipc_label")}
          placeholder={t("groups.graduation_nipc_placeholder")}
          value={form.nipc}
          error={nipcError}
          maxLength={9}
          inputMode="numeric"
          onChange={e => { setForm(f => ({ ...f, nipc: e.target.value.replace(/\D/g, "").slice(0, 9) })); setNipcError(undefined); }}
        />
        <div>
          <span className="block text-sm font-display font-medium text-stone-700 dark:text-stone-300 tracking-wide mb-1.5" data-rl-text="groups.graduation_legal_form_label">{t("groups.graduation_legal_form_label")}</span>
          <div className="flex flex-wrap gap-1.5">
            {LEGAL_FORMS.map(lf => (
              <button key={lf} aria-pressed={form.legal_form === lf} onClick={() => setForm(f => ({ ...f, legal_form: lf }))}
                className={`px-2.5 py-1 rounded-full text-xs font-medium border transition ${form.legal_form === lf ? "bg-primary-600 text-cream border-primary-600" : "border-primary-200/60 dark:border-stone-700 text-stone-500"}`}>
                {t(`groups.legal_form_${lf}`)}
              </button>
            ))}
          </div>
        </div>
        <Input label={t("groups.graduation_certificate_label")} placeholder={t("groups.graduation_certificate_placeholder")} value={form.certificate_url} onChange={e => setForm(f => ({ ...f, certificate_url: e.target.value }))} />
        <Textarea label={t("groups.graduation_notes_label")} placeholder={t("groups.graduation_notes_placeholder")} value={form.notes} maxLength={2000} rows={3} onChange={e => setForm(f => ({ ...f, notes: e.target.value }))} />
      </div>
      <div className="flex justify-end">
        <Button onClick={submit} disabled={saving || !form.organization_name.trim() || !form.nipc} loading={saving} data-rl-text="groups.graduation_submit">
          {saving ? t("groups.graduation_submitting") : t("groups.graduation_submit")}
        </Button>
      </div>
    </Card>
  );
}
