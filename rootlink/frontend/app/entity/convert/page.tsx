"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, AlertTriangle, ArrowDown } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import { usePermission } from "@/lib/use-permission";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";

// Post-Phase-6 decision (docs/roles-permissions/phase0-decisions.md Addendum
// 5, decision 2): individual<->professional conversion now requires a
// mandatory LIVE, computed before/after comparison (fetched from
// GET /api/entity-conversion/preview, never a static/hardcoded template)
// plus an explicit confirm step, before the real conversion endpoint is
// ever called. `professional -> organization` keeps its original static
// "one-way" messaging + checkbox — that direction's bootstrap-to-super-
// admin logic is unrelated and untouched, and the preview endpoint only
// supports to=individual|professional (see app/api/entity_conversion.py).

type PreviewState = {
  to: "individual" | "professional";
  current: Record<string, any>;
  projected: Record<string, any>;
  rank_capped: boolean;
} | null;

const FIELD_LABELS: Record<string, string> = {
  entity_kind: "Account type",
  rank_label: "Rank",
  is_verified: "Verified",
  can_self_publish: "Trusted publisher (self-publish)",
  can_edit_copy: "Copy editor",
  email_verified: "Email verified",
};

// Fields shown in the comparison table, in order. Deliberately a display
// concern only — the actual data always comes live from the preview
// endpoint's `current`/`projected` objects, never hardcoded here.
const COMPARISON_ROWS = ["entity_kind", "rank_label", "is_verified", "can_self_publish", "can_edit_copy", "email_verified"];

function formatValue(v: any): string {
  if (v === null || v === undefined) return "—";
  if (typeof v === "boolean") return v ? "Yes" : "No";
  return String(v);
}

function ComparisonTable({ preview }: { preview: NonNullable<PreviewState> }) {
  return (
    <div className="rounded-xl border border-stone-200 dark:border-stone-700 overflow-hidden">
      <table className="w-full text-sm">
        <thead>
          <tr className="bg-stone-50 dark:bg-stone-800 text-left text-xs text-stone-500 uppercase tracking-wide">
            <th className="px-3 py-2">Field</th>
            <th className="px-3 py-2">Now</th>
            <th className="px-3 py-2">After conversion</th>
          </tr>
        </thead>
        <tbody>
          {COMPARISON_ROWS.map((field) => {
            const before = formatValue(preview.current[field]);
            const after = formatValue(preview.projected[field]);
            const changed = before !== after;
            return (
              <tr key={field} className="border-t border-stone-100 dark:border-stone-800">
                <td className="px-3 py-2 text-stone-500">{FIELD_LABELS[field] || field}</td>
                <td className="px-3 py-2">{before}</td>
                <td className={`px-3 py-2 ${changed ? "font-semibold" : ""} ${field === "rank_label" && preview.rank_capped ? "text-amber-600 dark:text-amber-400" : ""}`}>
                  {after}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
      {preview.rank_capped && (
        <p className="text-xs text-amber-700 dark:text-amber-400 bg-amber-50/60 dark:bg-amber-900/20 px-3 py-2 font-serif flex items-center gap-1">
          <ArrowDown className="w-3.5 h-3.5 shrink-0" />
          Your rank is above what this account type allows — it will be capped down, not reset.
        </p>
      )}
    </div>
  );
}

export default function EntityConvertPage() {
  const router = useRouter();
  const { user, loading: authLoading, refresh } = useAuth();
  const { addToast } = useToast();
  const { my, loading: permLoading } = usePermission();

  const [taxId, setTaxId] = useState("");
  const [activityRegNumber, setActivityRegNumber] = useState("");
  const [orgName, setOrgName] = useState("");

  // Individual -> Professional
  const [previewProf, setPreviewProf] = useState<PreviewState>(null);
  const [previewProfLoading, setPreviewProfLoading] = useState(false);
  const [confirmedProf, setConfirmedProf] = useState(false);
  const [submittingProf, setSubmittingProf] = useState(false);

  // Professional -> Individual
  const [previewInd, setPreviewInd] = useState<PreviewState>(null);
  const [previewIndLoading, setPreviewIndLoading] = useState(false);
  const [confirmedInd, setConfirmedInd] = useState(false);
  const [submittingInd, setSubmittingInd] = useState(false);

  // Professional -> Organization (unchanged static-messaging flow)
  const [confirmedOrg, setConfirmedOrg] = useState(false);
  const [submittingOrg, setSubmittingOrg] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push("/auth/login");
  }, [authLoading, user, router]);

  if (authLoading || permLoading || !user) {
    return <div className="max-w-2xl mx-auto px-4 py-16 text-center text-stone-400 font-serif">Loading…</div>;
  }

  const { entityKind } = my();
  const canConvertToProfessional = entityKind === "individual";
  const canConvertToIndividual = entityKind === "professional";
  const canConvertToOrganization = entityKind === "professional";

  const loadPreviewProfessional = async () => {
    setPreviewProfLoading(true);
    setConfirmedProf(false);
    try {
      const p = await api.entityConversion.preview("professional");
      setPreviewProf(p);
    } catch (err: any) {
      addToast("error", err.message || "Could not load comparison");
      setPreviewProf(null);
    } finally {
      setPreviewProfLoading(false);
    }
  };

  const loadPreviewIndividual = async () => {
    setPreviewIndLoading(true);
    setConfirmedInd(false);
    try {
      const p = await api.entityConversion.preview("individual");
      setPreviewInd(p);
    } catch (err: any) {
      addToast("error", err.message || "Could not load comparison");
      setPreviewInd(null);
    } finally {
      setPreviewIndLoading(false);
    }
  };

  const submitToProfessional = async () => {
    setSubmittingProf(true);
    try {
      await api.entityConversion.toProfessional({
        tax_registration_id: taxId, activity_registration_number: activityRegNumber,
      });
      addToast("success", "Converted to professional");
      await refresh();
      router.push("/profile");
    } catch (err: any) {
      addToast("error", err.message || "Conversion failed");
    } finally {
      setSubmittingProf(false);
    }
  };

  const submitToIndividual = async () => {
    setSubmittingInd(true);
    try {
      await api.entityConversion.toIndividual();
      addToast("success", "Converted to individual");
      await refresh();
      router.push("/profile");
    } catch (err: any) {
      addToast("error", err.message || "Conversion failed");
    } finally {
      setSubmittingInd(false);
    }
  };

  const submitToOrganization = async () => {
    setSubmittingOrg(true);
    try {
      const updated = await api.entityConversion.toOrganization({ organization_name: orgName });
      addToast("success", "Organization created — you&apos;re its first super admin");
      await refresh();
      router.push(updated.entity_id ? `/entity/${updated.entity_id}` : "/profile");
    } catch (err: any) {
      addToast("error", err.message || "Conversion failed");
    } finally {
      setSubmittingOrg(false);
    }
  };

  if (!canConvertToProfessional && !canConvertToIndividual && !canConvertToOrganization) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center text-stone-400 font-serif">
        Entity conversion isn&apos;t available for your current account type
        ({entityKind}). Only individual accounts (→ professional) and
        professional accounts (→ individual or → organization) can convert.
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-8 py-12 space-y-6">
      <PageHeader icon={<ArrowRightLeft className="w-5 h-5 text-primary-500" />} title="Convert account type" />

      <div className="p-4 rounded-xl border border-amber-200 bg-amber-50/60 dark:bg-amber-900/20 dark:border-amber-700/40 text-sm text-amber-700 dark:text-amber-300 font-serif flex gap-2">
        <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
        <div>
          <p className="font-semibold mb-1">This is a one-way action.</p>
          <p>
            Your previously authored content stays yours (ownership persists). Everything
            else — rank, verification, and other flags — is shown in a live comparison below,
            specific to your account right now, before you confirm.
          </p>
        </div>
      </div>

      {canConvertToProfessional && (
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/60 dark:border-stone-700 p-6 space-y-4">
          <h2 className="font-display font-semibold text-stone-800 dark:text-stone-100">Individual → Professional</h2>
          <p className="text-xs text-stone-400 font-serif">
            Requires a verified email plus a tax/business registration ID and an activity registration number
            (ROLES_PERMISSIONS.md §2&apos;s &quot;Verified professional&quot; criteria).
          </p>
          <input
            value={taxId}
            onChange={(e) => setTaxId(e.target.value)}
            placeholder="Tax/business registration ID (e.g. NIF)"
            className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm"
          />
          <input
            value={activityRegNumber}
            onChange={(e) => setActivityRegNumber(e.target.value)}
            placeholder="Activity registration number"
            className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm"
          />

          {!previewProf ? (
            <Button
              variant="secondary"
              disabled={!taxId || !activityRegNumber || previewProfLoading}
              loading={previewProfLoading}
              onClick={loadPreviewProfessional}
            >
              Show before / after comparison
            </Button>
          ) : (
            <>
              <ComparisonTable preview={previewProf} />
              <label className="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-300">
                <input type="checkbox" checked={confirmedProf} onChange={(e) => setConfirmedProf(e.target.checked)} className="w-4 h-4" />
                I have reviewed the comparison above and confirm this one-way change.
              </label>
              <div className="flex gap-2">
                <Button
                  disabled={!confirmedProf || submittingProf}
                  loading={submittingProf}
                  onClick={submitToProfessional}
                >
                  Confirm &amp; convert to professional
                </Button>
                <Button variant="secondary" disabled={submittingProf} onClick={() => setPreviewProf(null)}>
                  Cancel
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {canConvertToIndividual && (
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/60 dark:border-stone-700 p-6 space-y-4">
          <h2 className="font-display font-semibold text-stone-800 dark:text-stone-100">Professional → Individual</h2>
          <p className="text-xs text-stone-400 font-serif">
            No eligibility requirements to convert down. Your rank is preserved if it already fits
            an individual account (contributor or below) — otherwise it&apos;s capped down to
            contributor, not reset to persona.
          </p>

          {!previewInd ? (
            <Button variant="secondary" disabled={previewIndLoading} loading={previewIndLoading} onClick={loadPreviewIndividual}>
              Show before / after comparison
            </Button>
          ) : (
            <>
              <ComparisonTable preview={previewInd} />
              <label className="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-300">
                <input type="checkbox" checked={confirmedInd} onChange={(e) => setConfirmedInd(e.target.checked)} className="w-4 h-4" />
                I have reviewed the comparison above and confirm this one-way change.
              </label>
              <div className="flex gap-2">
                <Button disabled={!confirmedInd || submittingInd} loading={submittingInd} onClick={submitToIndividual}>
                  Confirm &amp; convert to individual
                </Button>
                <Button variant="secondary" disabled={submittingInd} onClick={() => setPreviewInd(null)}>
                  Cancel
                </Button>
              </div>
            </>
          )}
        </div>
      )}

      {canConvertToOrganization && (
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/60 dark:border-stone-700 p-6 space-y-4">
          <h2 className="font-display font-semibold text-stone-800 dark:text-stone-100">Professional → Organization</h2>
          <p className="text-xs text-stone-400 font-serif">
            Creates a brand-new organization entity. You become its first super admin immediately (bootstrap
            rule — no approval step for a new entity&apos;s first assignment). Rank resets as part of that
            bootstrap (you become rank 5, super admin, of the new organization) — this direction is unrelated
            to the individual/professional rank-cap rule above.
          </p>
          <input
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="Organization name"
            className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm"
          />
          <label className="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-300">
            <input type="checkbox" checked={confirmedOrg} onChange={(e) => setConfirmedOrg(e.target.checked)} className="w-4 h-4" />
            I understand this is one-way and my badges (verified, trusted publisher) reset.
          </label>
          <Button disabled={!confirmedOrg || !orgName.trim() || submittingOrg} loading={submittingOrg} onClick={submitToOrganization}>
            Convert to organization
          </Button>
        </div>
      )}
    </div>
  );
}
