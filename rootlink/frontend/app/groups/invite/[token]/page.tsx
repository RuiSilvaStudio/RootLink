"use client";

/**
 * Invite landing — /groups/invite/[token]
 * Where an invite link/QR actually leads. Previously this page didn't exist,
 * making invites unusable end-to-end.
 */

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import type { GroupInviteInfo } from "@/lib/groups-types";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/lib/locale-context";
import { useToast } from "@/lib/toast-context";
import { Button } from "@/components/ui/Button";
import { LoadError } from "@/components/studio/LoadError";
import { safeImageUrl } from "@/lib/image-url";
import { Text } from "@/components/ui/Text";
import { Ticket } from "lucide-react";

export default function GroupInvitePage() {
  const params = useParams();
  const token = params.token as string;
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { t } = useLocale();
  const { addToast } = useToast();

  const [info, setInfo] = useState<GroupInviteInfo | null>(null);
  const [invalid, setInvalid] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [accepting, setAccepting] = useState(false);

  const load = useCallback(async () => {
    setLoadError(false);
    try {
      setInfo(await api.groups.getInviteInfo(token));
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      if (/not found/i.test(msg)) setInvalid(true);
      else setLoadError(true);
    }
  }, [token]);

  useEffect(() => { load(); }, [load]);

  const accept = async () => {
    setAccepting(true);
    try {
      await api.groups.acceptInvite(token);
      addToast("success", t("groups.invite.accepted_toast"));
      router.push(`/groups/${info?.group.slug}`);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "";
      if (/already a member/i.test(msg)) {
        addToast("info", t("groups.invite.already_member"));
        router.push(`/groups/${info?.group.slug}`);
      } else if (/different account/i.test(msg)) {
        addToast("error", t("groups.invite.wrong_account"));
      } else if (/expired/i.test(msg)) {
        addToast("error", t("groups.invite.expired"));
        await load();
      } else {
        addToast("error", msg || t("groups.invite.error"));
      }
    } finally {
      setAccepting(false);
    }
  };

  const statusMessage =
    info?.status === "expired" ? t("groups.invite.expired")
      : info?.status === "accepted" ? t("groups.invite.used")
        : info?.status === "cancelled" ? t("groups.invite.cancelled")
          : null;

  return (
    <div className="min-h-screen bg-cream dark:bg-stone-950 grid place-items-center px-4 py-10">
      <div className="w-full max-w-md">
        {invalid && (
          <div className="text-center">
            <Text k="groups.invite.invalid" as="p" className="font-display text-lg text-stone-500" />
            <Link href="/groups" data-rl-text="groups.back_to_groups"
              className="text-rust-500 text-sm hover:underline mt-2 inline-block">
              ← {t("groups.back_to_groups")}
            </Link>
          </div>
        )}
        {loadError && <LoadError message={t("groups.group_load_error")} onRetry={load} />}
        {!invalid && !loadError && !info && (
          <div className="rounded-3xl overflow-hidden border border-primary-100 dark:border-stone-800" aria-busy="true">
            <div className="h-36 skeleton-shimmer" />
            <div className="p-6 space-y-3">
              <div className="h-6 w-2/3 skeleton-shimmer rounded" />
              <div className="h-4 w-full skeleton-shimmer rounded" />
              <div className="h-10 w-1/2 skeleton-shimmer rounded-xl" />
            </div>
          </div>
        )}
        {info && (
          <div className="rounded-3xl overflow-hidden border border-primary-100 dark:border-stone-800 bg-white dark:bg-stone-900 shadow-sm">
            {info.group.image_url && (
              <img src={safeImageUrl(info.group.image_url)} alt="" className="w-full h-36 object-cover" />
            )}
            <div className="p-6 text-center">
              <div className="w-12 h-12 rounded-full bg-primary-100 dark:bg-primary-900/40 mx-auto grid place-items-center -mt-12 mb-3 relative z-10 border-4 border-white dark:border-stone-900">
                {info.group.logo_url ? (
                  <img src={safeImageUrl(info.group.logo_url)} alt="" className="w-full h-full rounded-full object-cover" />
                ) : (
                  <Ticket className="w-5 h-5 text-primary-500" aria-hidden />
                )}
              </div>
              <Text k="groups.invite.title" as="p" className="text-xs font-display font-medium tracking-widest uppercase text-earth-500" />
              <h1 className="font-display text-2xl font-semibold text-primary-800 dark:text-primary-200 mt-2">
                {info.group.name}
              </h1>
              <p className="text-sm text-stone-500 mt-1">{t("groups.invite.message", { name: info.group.name })}</p>
              {info.group.description && (
                <p className="text-sm text-stone-500 mt-3 font-serif leading-relaxed">{info.group.description}</p>
              )}

              <div className="mt-6">
                {statusMessage ? (
                  <>
                    <p className="text-sm text-amber-600 dark:text-amber-400 font-medium">{statusMessage}</p>
                    <Link href={`/groups/${info.group.slug}`} data-rl-text="groups.invite.see_group"
                      className="text-rust-500 text-sm hover:underline mt-2 inline-block">
                      {t("groups.invite.see_group")} →
                    </Link>
                  </>
                ) : !authLoading && !user ? (
                  <>
                    <Text k="groups.invite.login_first" as="p" className="text-sm text-stone-500 mb-3" />
                    <Link href={`/auth/login?next=${encodeURIComponent(`/groups/invite/${token}`)}`}>
                      <Button>{t("groups.invite.login")}</Button>
                    </Link>
                  </>
                ) : (
                  <Button onClick={accept} disabled={accepting || authLoading} loading={accepting} data-rl-text="groups.invite.accept">
                    {accepting ? t("groups.invite.accepting") : t("groups.invite.accept")}
                  </Button>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
