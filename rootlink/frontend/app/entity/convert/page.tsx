"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import { usePermission } from "@/lib/use-permission";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";

export default function EntityConvertPage() {
  const router = useRouter();
  const { user, loading: authLoading, refresh } = useAuth();
  const { addToast } = useToast();
  const { my, loading: permLoading } = usePermission();

  const [taxId, setTaxId] = useState("");
  const [activityRegNumber, setActivityRegNumber] = useState("");
  const [orgName, setOrgName] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (!authLoading && !user) router.push("/auth/login");
  }, [authLoading, user, router]);

  if (authLoading || permLoading || !user) {
    return <div className="max-w-2xl mx-auto px-4 py-16 text-center text-stone-400 font-serif">Loading…</div>;
  }

  const { entityKind } = my();
  const canConvertToProfessional = entityKind === "individual";
  const canConvertToOrganization = entityKind === "professional";

  const whatsLost = (
    <div className="mb-6 p-4 rounded-xl border border-amber-200 bg-amber-50/60 dark:bg-amber-900/20 dark:border-amber-700/40 text-sm text-amber-700 dark:text-amber-300 font-serif flex gap-2">
      <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
      <div>
        <p className="font-semibold mb-1">This is a one-way action.</p>
        <ul className="list-disc list-inside space-y-0.5">
          <li>Your rank resets to the starting rank in the new entity.</li>
          <li>Badges (verified, trusted publisher) do not carry over — they must be re-earned.</li>
          <li>Your previously authored content stays yours (ownership persists).</li>
        </ul>
      </div>
    </div>
  );

  const submitToProfessional = async () => {
    setSubmitting(true);
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
      setSubmitting(false);
    }
  };

  const submitToOrganization = async () => {
    setSubmitting(true);
    try {
      const updated = await api.entityConversion.toOrganization({ organization_name: orgName });
      addToast("success", "Organization created — you&apos;re its first super admin");
      await refresh();
      router.push(updated.entity_id ? `/entity/${updated.entity_id}` : "/profile");
    } catch (err: any) {
      addToast("error", err.message || "Conversion failed");
    } finally {
      setSubmitting(false);
    }
  };

  if (!canConvertToProfessional && !canConvertToOrganization) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-16 text-center text-stone-400 font-serif">
        Entity conversion isn&apos;t available for your current account type
        ({entityKind}). Only individual accounts (→ professional) and
        professional accounts (→ organization) can convert.
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto px-4 sm:px-8 py-12">
      <PageHeader icon={<ArrowRightLeft className="w-5 h-5 text-primary-500" />} title="Convert account type" />

      {whatsLost}

      {canConvertToProfessional && (
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/60 dark:border-stone-700 p-6 space-y-4">
          <h2 className="font-display font-semibold text-stone-800 dark:text-stone-100">Individual → Professional</h2>
          <p className="text-xs text-stone-400 font-serif">
            Requires a verified email plus a tax/business registration ID and an activity registration number
            (final-spec.md §2&apos;s &quot;Verified professional&quot; criteria).
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
          <label className="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-300">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="w-4 h-4" />
            I understand this is one-way and my rank/badges reset.
          </label>
          <Button
            disabled={!confirmed || !taxId || !activityRegNumber || submitting}
            loading={submitting}
            onClick={submitToProfessional}
          >
            Convert to professional
          </Button>
        </div>
      )}

      {canConvertToOrganization && (
        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/60 dark:border-stone-700 p-6 space-y-4">
          <h2 className="font-display font-semibold text-stone-800 dark:text-stone-100">Professional → Organization</h2>
          <p className="text-xs text-stone-400 font-serif">
            Creates a brand-new organization entity. You become its first super admin immediately (bootstrap
            rule — no approval step for a new entity&apos;s first assignment).
          </p>
          <input
            value={orgName}
            onChange={(e) => setOrgName(e.target.value)}
            placeholder="Organization name"
            className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm"
          />
          <label className="flex items-center gap-2 text-sm text-stone-600 dark:text-stone-300">
            <input type="checkbox" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} className="w-4 h-4" />
            I understand this is one-way and my rank/badges reset.
          </label>
          <Button disabled={!confirmed || !orgName.trim() || submitting} loading={submitting} onClick={submitToOrganization}>
            Convert to organization
          </Button>
        </div>
      )}
    </div>
  );
}
