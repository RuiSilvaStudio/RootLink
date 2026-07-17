"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { Building, FileText, ShieldCheck, ShieldAlert, Upload, Users, AlertTriangle } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/lib/locale-context";
import { useToast } from "@/lib/toast-context";
import { usePermission } from "@/lib/use-permission";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";
import { Text } from "@/components/ui/Text";

const STATUS_VARIANT: Record<string, "green" | "amber" | "red" | "stone"> = {
  verified: "green",
  pending: "amber",
  more_info_requested: "amber",
  rejected: "red",
};

export default function EntityDashboardPage() {
  const params = useParams();
  const entityId = Number(params.entityId);
  const router = useRouter();
  const { t } = useLocale();
  const { user, loading: authLoading } = useAuth();
  const { addToast } = useToast();
  const { can, my, loading: permLoading } = usePermission();

  const [entity, setEntity] = useState<any>(null);
  const [documents, setDocuments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [reason, setReason] = useState("");

  const load = useCallback(async () => {
    try {
      const [e, docs] = await Promise.all([
        api.entities.get(entityId),
        api.entities.listDocuments(entityId).catch(() => []),
      ]);
      setEntity(e);
      setDocuments(docs);
    } catch {
      setEntity(null);
    } finally {
      setLoading(false);
    }
  }, [entityId]);

  useEffect(() => {
    if (!authLoading && !user) {
      router.push("/auth/login");
      return;
    }
    if (user) load();
  }, [authLoading, user, load, router]);

  if (loading || authLoading || permLoading) {
    return <div className="max-w-3xl mx-auto px-4 py-16 text-center text-stone-400 font-serif">{t("common.loading")}</div>;
  }
  if (!entity) {
    return <div className="max-w-3xl mx-auto px-4 py-16 text-center text-stone-400 font-serif">{t("entity_detail.not_found")}</div>;
  }

  const { entityKind, rank, entityId: myEntityId } = my();
  const isPlatformSuperAdmin = entityKind === "platform" && rank >= 5;
  const isPlatformAdmin = can("entity.verify_organization_practitioner");
  const isOwnSuperAdmin = entityKind === entity.entity_type && myEntityId === entity.id && rank >= 5;

  const handleUpload = async (file: File) => {
    setUploading(true);
    try {
      await api.entities.uploadDocument(entityId, file);
      addToast("success", t("entity_detail.document_uploaded"));
      load();
    } catch (err: any) {
      addToast("error", err.message || t("entity_detail.upload_failed"));
    } finally {
      setUploading(false);
    }
  };

  const act = async (fn: () => Promise<any>, successMsg: string) => {
    try {
      await fn();
      addToast("success", successMsg);
      setReason("");
      load();
    } catch (err: any) {
      addToast("error", err.message || t("entity_detail.action_failed"));
    }
  };

  const dissolutionPending = !!entity.dissolution_requested_at;
  const dissolved = !!entity.dissolved_at;
  const banned = !!entity.banned_at;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-12">
      <PageHeader
        icon={<Building className="w-5 h-5 text-primary-500" />}
        title={entity.name}
        subtitle={`${entity.entity_type} entity`}
      />

      <div className="flex gap-2 flex-wrap mt-4 mb-8">
        <Badge variant={STATUS_VARIANT[entity.verification_status] || "stone"}>
          {entity.verification_status.replace(/_/g, " ")}
        </Badge>
        {dissolutionPending && <Badge variant="amber">{t("entity_detail.dissolution_pending")}</Badge>}
        {dissolved && <Badge variant="red">{t("entity_detail.dissolved_badge", { date: entity.dissolution_grace_expires_at ? new Date(entity.dissolution_grace_expires_at).toLocaleDateString() : "?" })}</Badge>}
        {banned && <Badge variant="red">{t("entity_detail.banned_badge", { date: entity.ban_cascade_grace_expires_at ? new Date(entity.ban_cascade_grace_expires_at).toLocaleDateString() : "?" })}</Badge>}
        <Link href={`/entity/${entityId}/team`} className="ml-auto">
          <Button variant="secondary" size="sm"><Users className="w-4 h-4" /> {t("entity_detail.manage_team")}</Button>
        </Link>
      </div>

      {entity.verification_status === "more_info_requested" && (
        <div className="mb-6 p-4 rounded-xl border border-amber-200 bg-amber-50/60 dark:bg-amber-900/20 dark:border-amber-700/40 text-sm text-amber-700 dark:text-amber-300 font-serif flex gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
          {t("entity_detail.more_info_banner")}
        </div>
      )}

      {/* Documents */}
      <section className="mb-8 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/60 dark:border-stone-700 p-6">
        <h2 className="font-display font-semibold text-stone-800 dark:text-stone-100 mb-4 flex items-center gap-2">
          <FileText className="w-4 h-4 text-primary-500" /> {t("entity_detail.documents_heading")}
        </h2>

        {entity.verification_status !== "verified" && (
          <label className="inline-flex items-center gap-2 mb-4 cursor-pointer">
            <input
              type="file"
              accept="application/pdf,image/jpeg,image/png,image/webp"
              className="hidden"
              disabled={uploading}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleUpload(f);
                e.target.value = "";
              }}
            />
            <span className="inline-flex items-center gap-2 px-4 py-2 text-sm rounded-xl border border-primary-300/60 text-primary-700 hover:bg-primary-50 dark:border-primary-600/60 dark:text-primary-300 transition">
              <Upload className="w-4 h-4" /> {uploading ? t("entity_detail.uploading") : t("entity_detail.upload_document")}
            </span>
          </label>
        )}

        {documents.length === 0 ? (
          <Text k="entity_detail.no_documents" as="p" className="text-sm text-stone-400 font-serif" />
        ) : (
          <ul className="space-y-2">
            {documents.map((d) => (
              <li key={d.id} className="flex items-center justify-between text-sm">
                <a
                  href={api.entities.documentServeUrl(entityId, d.id)}
                  target="_blank"
                  rel="noreferrer"
                  className="text-primary-700 dark:text-primary-300 hover:underline font-serif truncate"
                >
                  {d.filename}
                </a>
                <span className="text-stone-400 text-xs">{(d.size_bytes / 1024).toFixed(0)} KB</span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* Staff verification decisions */}
      {isPlatformAdmin && entity.verification_status !== "verified" && (
        <section className="mb-8 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/60 dark:border-stone-700 p-6">
          <h2 className="font-display font-semibold text-stone-800 dark:text-stone-100 mb-4 flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-primary-500" /> {t("entity_detail.staff_review_heading")}
          </h2>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder={t("entity_detail.review_reason_placeholder")}
            className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm mb-3"
            rows={2}
          />
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" onClick={() => act(() => api.entities.approveVerification(entityId, reason || undefined), t("entity_detail.entity_verified"))} data-rl-text="entity_detail.approve">
              {t("entity_detail.approve")}
            </Button>
            <Button size="sm" variant="secondary" onClick={() => act(() => api.entities.requestMoreInfo(entityId, reason || undefined), t("entity_detail.more_info_requested"))} data-rl-text="entity_detail.request_more_info">
              {t("entity_detail.request_more_info")}
            </Button>
            <Button size="sm" variant="danger" onClick={() => act(() => api.entities.rejectVerification(entityId, reason || undefined), t("entity_detail.verification_rejected"))} data-rl-text="entity_detail.reject">
              {t("entity_detail.reject")}
            </Button>
          </div>
        </section>
      )}

      {/* Dissolution */}
      {(entity.entity_type === "organization" || entity.entity_type === "partners" || entity.entity_type === "suppliers") &&
        entity.verification_status === "verified" && !dissolved && (
          <section className="mb-8 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/60 dark:border-stone-700 p-6">
            <h2 className="font-display font-semibold text-stone-800 dark:text-stone-100 mb-2 flex items-center gap-2">
              <ShieldAlert className="w-4 h-4 text-rust-500" /> {t("entity_detail.dissolution_heading")}
            </h2>
            <Text k="entity_detail.dissolution_hint" as="p" className="text-xs text-stone-400 font-serif mb-3" />
            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("entity_detail.dissolution_reason_placeholder")}
              className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm mb-3"
              rows={2}
            />
            <div className="flex gap-2 flex-wrap">
              {(isOwnSuperAdmin || isPlatformSuperAdmin) && !dissolutionPending && (
                <Button size="sm" variant="danger" onClick={() => act(() => api.entities.dissolve(entityId, reason || undefined), isPlatformSuperAdmin ? t("entity_detail.entity_dissolved") : t("entity_detail.dissolution_requested"))}>
                  {isPlatformSuperAdmin ? t("entity_detail.dissolve_now") : t("entity_detail.request_dissolution")}
                </Button>
              )}
              {isPlatformSuperAdmin && dissolutionPending && (
                <>
                  <Button size="sm" variant="danger" onClick={() => act(() => api.entities.approveDissolution(entityId, reason || undefined), t("entity_detail.dissolution_approved"))} data-rl-text="entity_detail.approve_dissolution">
                    {t("entity_detail.approve_dissolution")}
                  </Button>
                  <Button size="sm" variant="secondary" onClick={() => act(() => api.entities.rejectDissolution(entityId, reason || undefined), t("entity_detail.dissolution_request_rejected"))} data-rl-text="entity_detail.reject_dissolution_request">
                    {t("entity_detail.reject_dissolution_request")}
                  </Button>
                </>
              )}
            </div>
          </section>
        )}

      {dissolved && isPlatformSuperAdmin && (
        <section className="mb-8 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/60 dark:border-stone-700 p-6">
          <Text k="entity_detail.reverse_dissolution_heading" as="h2" className="font-display font-semibold text-stone-800 dark:text-stone-100 mb-2" />
          <Text k="entity_detail.reverse_dissolution_hint" as="p" className="text-xs text-stone-400 font-serif mb-3" />
          <Button size="sm" variant="secondary" onClick={() => act(() => api.entities.reverseDissolution(entityId, reason || undefined), t("entity_detail.dissolution_reversed"))} data-rl-text="entity_detail.reverse_dissolution">
            {t("entity_detail.reverse_dissolution")}
          </Button>
        </section>
      )}

      {isPlatformSuperAdmin && (
        <section className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/60 dark:border-stone-700 p-6">
          <Text k="entity_detail.ban_heading" as="h2" className="font-display font-semibold text-stone-800 dark:text-stone-100 mb-2" />
          <div className="flex gap-2">
            {!banned ? (
              <Button size="sm" variant="danger" onClick={() => act(() => api.entities.ban(entityId, reason || undefined), t("entity_detail.entity_banned"))} data-rl-text="entity_detail.ban_entity">
                {t("entity_detail.ban_entity")}
              </Button>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => act(() => api.entities.unban(entityId, reason || undefined), t("entity_detail.entity_unbanned"))} data-rl-text="entity_detail.unban_entity">
                {t("entity_detail.unban_entity")}
              </Button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
