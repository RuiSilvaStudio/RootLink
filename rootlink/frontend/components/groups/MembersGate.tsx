"use client";

/**
 * Members-only gate card + the reusable request-to-join button/modal.
 * `RequestJoinButton` is shared by the landing hero, the CTA and this gate,
 * so "Pedir para entrar" behaves identically everywhere (opens the modal —
 * it never navigates away).
 */

import { useState } from "react";
import { api } from "@/lib/api";
import { useGroup } from "@/lib/group-context";
import { useLocale } from "@/lib/locale-context";
import { useToast } from "@/lib/toast-context";
import { useAuth } from "@/lib/auth-context";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Textarea } from "@/components/ui/Textarea";
import { Modal } from "@/components/ui/Modal";
import { Lock, ArrowRight } from "lucide-react";

export function RequestJoinButton({ size = "sm", hero = false }: { size?: "xs" | "sm" | "md" | "lg"; hero?: boolean }) {
  const { group, viewer, refresh } = useGroup();
  const { t } = useLocale();
  const { addToast } = useToast();
  const { user } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [open, setOpen] = useState(false);
  const [note, setNote] = useState("");

  if (viewer.has_pending_request) {
    return (
      <span className={`text-sm font-medium ${hero ? "px-4 py-2.5 rounded-xl2 bg-cream/10 text-cream backdrop-blur" : "text-amber-600 dark:text-amber-400"}`}>
        {t("groups.request_pending")}
      </span>
    );
  }

  const sendRequest = async () => {
    setBusy(true);
    try {
      await api.groups.createJoinRequest(group.id, note || undefined);
      addToast("success", t("groups.request_sent_toast"));
      setOpen(false);
      await refresh();
    } catch (e: unknown) {
      addToast("error", (e instanceof Error && e.message) || t("groups.request_error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <Button size={size} onClick={() => (user ? setOpen(true) : router.push("/auth/login"))}>
        {t("groups.request_join")} {hero && <ArrowRight className="w-4 h-4" aria-hidden />}
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title={t("groups.request_join")}>
        <div className="space-y-4">
          <Textarea
            label={t("groups.request_note_label")}
            placeholder={t("groups.request_note_placeholder")}
            value={note}
            maxLength={1000}
            rows={3}
            onChange={e => setNote(e.target.value)}
          />
          <div className="flex justify-end gap-2">
            <Button variant="ghost" size="sm" onClick={() => setOpen(false)}>{t("common.cancel")}</Button>
            <Button size="sm" onClick={sendRequest} disabled={busy} loading={busy}>{t("groups.send_request")}</Button>
          </div>
        </div>
      </Modal>
    </>
  );
}

export function MembersGate({ title }: { title?: string }) {
  const { group, viewer, refresh } = useGroup();
  const { t } = useLocale();
  const { addToast } = useToast();
  const { user } = useAuth();
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  const join = async () => {
    if (!user) { router.push("/auth/login"); return; }
    setBusy(true);
    try {
      await api.groups.join(group.id);
      addToast("success", t("groups.joined_toast"));
      await refresh();
    } catch (e: unknown) {
      addToast("error", (e instanceof Error && e.message) || t("groups.join_error"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-primary-200/60 dark:border-stone-700 bg-primary-50/40 dark:bg-primary-900/10 p-8 text-center">
      <div className="w-10 h-10 rounded-full bg-primary-100 dark:bg-primary-900/40 mx-auto grid place-items-center mb-3">
        <Lock className="w-5 h-5 text-primary-500" aria-hidden />
      </div>
      {title && <h3 className="font-display font-semibold text-stone-800 dark:text-stone-100">{title}</h3>}
      <p className="text-sm text-stone-500 mt-1">{t("groups.members_only")}</p>
      <div className="mt-4">
        {group.is_open ? (
          <Button size="sm" onClick={join} disabled={busy} loading={busy}>{t("groups.join")}</Button>
        ) : (
          <RequestJoinButton size="sm" />
        )}
      </div>
    </div>
  );
}
