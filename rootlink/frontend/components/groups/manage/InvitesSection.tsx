"use client";

/**
 * Manage → Invites: create link/QR invites, COPY the link (previously the
 * token was never shown — the feature was unusable), show a QR code for
 * event flows, cancel pending invites.
 */

import { useCallback, useEffect, useState } from "react";
import QRCode from "qrcode";
import { api } from "@/lib/api";
import type { Group, GroupInvite } from "@/lib/groups-types";
import { useLocale } from "@/lib/locale-context";
import { useToast } from "@/lib/toast-context";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Modal } from "@/components/ui/Modal";
import { LoadError } from "@/components/studio/LoadError";
import { Copy, QrCode, Link2, Ticket } from "lucide-react";

const METHODS = ["link", "qrEvent", "prospectQR"] as const;
const STATUS_FILTERS = ["pending", "accepted", "expired", "cancelled"] as const;

export function InvitesSection({ group }: { group: Group }) {
  const { t, locale } = useLocale();
  const { addToast } = useToast();
  const [invites, setInvites] = useState<GroupInvite[] | null>(null);
  const [error, setError] = useState(false);
  const [statusFilter, setStatusFilter] = useState<string>("pending");
  const [creating, setCreating] = useState<string | null>(null);
  const [qrInvite, setQrInvite] = useState<GroupInvite | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError(false);
    try {
      setInvites(await api.groups.listInvites(group.id, statusFilter === "all" ? undefined : statusFilter));
    } catch {
      setError(true);
    }
  }, [group.id, statusFilter]);

  useEffect(() => { load(); }, [load]);

  const inviteUrl = (inv: GroupInvite) =>
    `${window.location.origin}/groups/invite/${inv.invite_token}`;

  const createInvite = async (method: string) => {
    setCreating(method);
    try {
      const inv = await api.groups.createInvite(group.id, method);
      addToast("success", t("groups.manage.invite_created"));
      setStatusFilter("pending");
      setInvites(prev => prev ? [inv, ...prev] : [inv]);
      // Immediately surface the thing you need: link copied / QR shown
      if (method === "link") copyLink(inv);
      else showQr(inv);
    } catch (e: unknown) {
      addToast("error", (e instanceof Error && e.message) || t("groups.manage.invite_error"));
    } finally {
      setCreating(null);
    }
  };

  const copyLink = async (inv: GroupInvite) => {
    try {
      await navigator.clipboard.writeText(inviteUrl(inv));
      addToast("success", t("groups.manage.link_copied"));
    } catch {
      addToast("error", t("groups.manage.invite_error"));
    }
  };

  const showQr = async (inv: GroupInvite) => {
    try {
      const url = await QRCode.toDataURL(inviteUrl(inv), { width: 480, margin: 2 });
      setQrDataUrl(url);
      setQrInvite(inv);
    } catch {
      addToast("error", t("groups.manage.invite_error"));
    }
  };

  const cancelInvite = async (inv: GroupInvite) => {
    if (!window.confirm(t("groups.manage.cancel_invite_confirm"))) return;
    const prev = invites;
    setInvites(cur => cur?.map(x => (x.id === inv.id ? { ...x, status: "cancelled" } : x)) ?? null);
    try {
      await api.groups.cancelInvite(group.id, inv.id);
      addToast("success", t("groups.manage.invite_cancelled"));
    } catch (e: unknown) {
      setInvites(prev ?? null);
      addToast("error", (e instanceof Error && e.message) || t("groups.manage.invite_error"));
    }
  };

  const statusLabel = (s: string) => t(`groups.manage.status_${s}`);
  const methodLabel = (m: string) =>
    m === "link" ? t("groups.manage.invite_method_link")
      : m === "qrEvent" ? t("groups.manage.invite_method_qrEvent")
        : m === "prospectQR" ? t("groups.manage.invite_method_prospectQR")
          : m;

  const fmtDate = (iso: string | null) => {
    if (!iso) return "";
    try { return new Date(iso).toLocaleDateString(locale === "pt" ? "pt-PT" : "en-GB", { day: "numeric", month: "short" }); }
    catch { return ""; }
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* Create */}
      <Card variant="plain" className="p-5">
        <h2 className="font-display font-semibold text-stone-800 dark:text-stone-100 mb-3">{t("groups.manage.create_invite")}</h2>
        <div className="flex flex-wrap gap-2">
          {METHODS.map(m => (
            <Button key={m} variant="secondary" size="sm" disabled={creating !== null} loading={creating === m} onClick={() => createInvite(m)}>
              {m === "link" ? <Link2 className="w-4 h-4" aria-hidden /> : <QrCode className="w-4 h-4" aria-hidden />} {methodLabel(m)}
            </Button>
          ))}
        </div>
      </Card>

      {/* List */}
      <Card variant="plain" className="p-5">
        <div className="flex items-center justify-between mb-3">
          <h2 className="font-display font-semibold text-stone-800 dark:text-stone-100">{t("groups.manage.invites_title")}</h2>
          <div className="flex gap-1">
            {["all", ...STATUS_FILTERS].map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                aria-pressed={statusFilter === s}
                className={`px-2.5 py-1 rounded-full text-xs font-medium transition ${statusFilter === s ? "bg-primary-600 text-cream" : "text-stone-500 hover:bg-primary-50 dark:hover:bg-primary-900/20"}`}
              >
                {s === "all" ? t("groups.manage.status_all") : statusLabel(s)}
              </button>
            ))}
          </div>
        </div>

        {error && <LoadError message={t("groups.group_load_error")} onRetry={load} />}
        {!error && invites === null && (
          <div className="space-y-2" aria-busy="true">
            {[0, 1].map(i => <div key={i} className="h-12 rounded-xl skeleton-shimmer" />)}
          </div>
        )}
        {!error && invites !== null && invites.length === 0 && (
          <p className="text-sm text-stone-400 py-4 text-center">{t("groups.manage.no_invites")}</p>
        )}
        {!error && invites !== null && invites.map(inv => (
          <div key={inv.id} className="flex items-center gap-3 py-2.5 border-t border-primary-100 dark:border-stone-800 first:border-t-0">
            <Ticket className="w-4 h-4 text-stone-400 shrink-0" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-stone-800 dark:text-stone-100">{methodLabel(inv.method)}</p>
              <p className="text-xs text-stone-400">
                {statusLabel(inv.status)}
                {inv.expires_at && inv.status === "pending" && <> · {t("groups.manage.expires", { date: fmtDate(inv.expires_at) })}</>}
              </p>
            </div>
            {inv.status === "pending" && (
              <div className="flex items-center gap-1.5">
                <Button size="xs" variant="secondary" onClick={() => copyLink(inv)} aria-label={t("groups.manage.copy_link")}>
                  <Copy className="w-3.5 h-3.5" aria-hidden />
                </Button>
                <Button size="xs" variant="secondary" onClick={() => showQr(inv)} aria-label={t("groups.manage.show_qr")}>
                  <QrCode className="w-3.5 h-3.5" aria-hidden />
                </Button>
                <Button size="xs" variant="danger" onClick={() => cancelInvite(inv)}>
                  {t("groups.manage.cancel_invite")}
                </Button>
              </div>
            )}
          </div>
        ))}
      </Card>

      {/* QR modal */}
      <Modal open={!!qrInvite} onClose={() => { setQrInvite(null); setQrDataUrl(null); }} title={t("groups.manage.qr_title")}>
        {qrDataUrl && (
          <div className="text-center">
            <img src={qrDataUrl} alt={t("groups.manage.qr_title")} className="mx-auto w-64 h-64 rounded-xl border border-primary-100 dark:border-stone-800" />
            <p className="text-sm text-stone-500 mt-3">{t("groups.manage.qr_help")}</p>
            {qrInvite && (
              <Button variant="secondary" size="sm" className="mt-3" onClick={() => copyLink(qrInvite)}>
                <Copy className="w-4 h-4" aria-hidden /> {t("groups.manage.copy_link")}
              </Button>
            )}
          </div>
        )}
      </Modal>
    </div>
  );
}
