"use client";

/**
 * Manage → Members: roles, removal, ownership transfer + pending join requests.
 * Optimistic updates with revert-on-failure + toast (UX contract).
 */

import { useCallback, useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { Group, GroupViewer, GroupMember, GroupJoinRequest } from "@/lib/groups-types";
import { useLocale } from "@/lib/locale-context";
import { useToast } from "@/lib/toast-context";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { LoadError } from "@/components/studio/LoadError";
import { EmptyState } from "@/components/ui/EmptyState";
import { safeImageUrl } from "@/lib/image-url";
import { Crown, UserMinus, Users } from "lucide-react";

export function MembersSection({ group, viewer, onChanged }: {
  group: Group; viewer: GroupViewer; onChanged: () => Promise<void>;
}) {
  const { t } = useLocale();
  const { addToast } = useToast();
  const [members, setMembers] = useState<GroupMember[] | null>(null);
  const [requests, setRequests] = useState<GroupJoinRequest[]>([]);
  const [error, setError] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setError(false);
    try {
      const [ms, reqs] = await Promise.all([
        api.groups.members(group.id),
        api.groups.listJoinRequests(group.id, "pending"),
      ]);
      setMembers(ms);
      setRequests(reqs);
    } catch {
      setError(true);
    }
  }, [group.id]);

  useEffect(() => { load(); }, [load]);

  const displayName = (m: { user_name: string | null; user_id: number }) => m.user_name || `#${m.user_id}`;

  const changeRole = async (m: GroupMember, role: string) => {
    const prev = members;
    setMembers(cur => cur?.map(x => (x.id === m.id ? { ...x, role } : x)) ?? null);
    setBusyId(m.id);
    try {
      await api.groups.updateMemberRole(group.id, m.id, role);
      addToast("success", t("groups.manage.member_updated"));
    } catch (e: unknown) {
      setMembers(prev ?? null);
      addToast("error", (e instanceof Error && e.message) || t("groups.manage.member_error"));
    } finally {
      setBusyId(null);
    }
  };

  const removeMember = async (m: GroupMember) => {
    if (!window.confirm(t("groups.manage.remove_member_confirm", { name: displayName(m) }))) return;
    const prev = members;
    setMembers(cur => cur?.filter(x => x.id !== m.id) ?? null);
    try {
      await api.groups.removeMember(group.id, m.id);
      addToast("success", t("groups.manage.member_removed"));
    } catch (e: unknown) {
      setMembers(prev ?? null);
      addToast("error", (e instanceof Error && e.message) || t("groups.manage.member_error"));
    }
  };

  const transferOwnership = async (m: GroupMember) => {
    if (!window.confirm(t("groups.manage.transfer_confirm", { name: displayName(m) }))) return;
    setBusyId(m.id);
    try {
      await api.groups.transferOwnership(group.id, m.user_id);
      addToast("success", t("groups.manage.transfer_done"));
      await onChanged();
      await load();
    } catch (e: unknown) {
      addToast("error", (e instanceof Error && e.message) || t("groups.manage.transfer_error"));
    } finally {
      setBusyId(null);
    }
  };

  const approveRequest = async (r: GroupJoinRequest) => {
    const prev = requests;
    setRequests(cur => cur.filter(x => x.id !== r.id));
    try {
      await api.groups.approveJoinRequest(group.id, r.id);
      addToast("success", t("groups.manage.request_approved"));
      await load();
    } catch (e: unknown) {
      setRequests(prev);
      addToast("error", (e instanceof Error && e.message) || t("groups.manage.request_error"));
    }
  };

  const declineRequest = async (r: GroupJoinRequest) => {
    if (!window.confirm(t("groups.manage.decline_confirm", { name: displayName(r) }))) return;
    const prev = requests;
    setRequests(cur => cur.filter(x => x.id !== r.id));
    try {
      await api.groups.declineJoinRequest(group.id, r.id);
      addToast("success", t("groups.manage.request_declined"));
    } catch (e: unknown) {
      setRequests(prev);
      addToast("error", (e instanceof Error && e.message) || t("groups.manage.request_error"));
    }
  };

  if (error) return <LoadError message={t("groups.group_load_error")} onRetry={load} />;
  if (members === null) {
    return (
      <div className="space-y-2" aria-busy="true">
        {[0, 1, 2].map(i => <div key={i} className="h-14 rounded-xl2 skeleton-shimmer" />)}
      </div>
    );
  }

  const roleLabel = (role: string) =>
    role === "owner" || role === "admin" ? t("groups.role_owner")
      : role === "staff" || role === "moderator" ? t("groups.role_staff")
        : t("groups.role_member");

  return (
    <div className="max-w-2xl space-y-8">
      {/* Pending requests */}
      {requests.length > 0 && (
        <Card variant="plain" className="p-5 space-y-3">
          <h2 className="font-display font-semibold text-stone-800 dark:text-stone-100">{t("groups.manage.requests_title")}</h2>
          {requests.map(r => (
            <div key={r.id} className="flex items-center gap-3 py-2 border-t border-primary-100 dark:border-stone-800 first:border-t-0">
              <MemberAvatar name={displayName(r)} avatar={r.user_avatar} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-stone-800 dark:text-stone-100 truncate">{displayName(r)}</p>
                {r.note && <p className="text-xs text-stone-500 truncate">{r.note}</p>}
              </div>
              <Button size="xs" onClick={() => approveRequest(r)}>{t("groups.manage.approve")}</Button>
              <Button size="xs" variant="danger" onClick={() => declineRequest(r)}>{t("groups.manage.decline")}</Button>
            </div>
          ))}
        </Card>
      )}

      {/* Members */}
      <Card variant="plain" className="p-5 space-y-1">
        <h2 className="font-display font-semibold text-stone-800 dark:text-stone-100 mb-2">
          {t("groups.manage.members_title")} <span className="text-stone-400 font-normal text-sm">({members.length})</span>
        </h2>
        {members.length === 0 && (
          <EmptyState icon={<Users className="w-7 h-7 text-primary-400" aria-hidden />} title={t("groups.manage.members_title")} className="py-8" />
        )}
        {members.map(m => {
          const isOwnerRow = m.role === "owner" || m.role === "admin";
          const isFounder = m.user_id === group.created_by;
          const isSelf = viewer.member_id === m.id;
          return (
            <div key={m.id} className="flex items-center gap-3 py-2.5 border-t border-primary-100 dark:border-stone-800 first:border-t-0">
              <MemberAvatar name={displayName(m)} avatar={m.user_avatar} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-stone-800 dark:text-stone-100 truncate">
                  {displayName(m)}
                  {isFounder && (
                    <span className="ml-2 text-xs px-1.5 py-0.5 rounded-full bg-earth-500/15 text-earth-500">{t("groups.founder_badge")}</span>
                  )}
                </p>
                <p className="text-xs text-stone-400">{roleLabel(m.role)}</p>
              </div>
              {viewer.is_owner && !isFounder && !isSelf && (
                <div className="flex items-center gap-1.5">
                  {!isOwnerRow && (
                    <Button size="xs" variant="secondary" disabled={busyId === m.id}
                      onClick={() => changeRole(m, m.role === "staff" ? "member" : "staff")}>
                      {m.role === "staff" ? t("groups.manage.demote") : t("groups.manage.promote")}
                    </Button>
                  )}
                  <Button size="xs" variant="secondary" disabled={busyId === m.id} onClick={() => transferOwnership(m)}
                    aria-label={t("groups.manage.transfer_ownership")}>
                    <Crown className="w-3.5 h-3.5" aria-hidden />
                  </Button>
                  <Button size="xs" variant="danger" disabled={busyId === m.id} onClick={() => removeMember(m)}
                    aria-label={t("groups.manage.remove_member")}>
                    <UserMinus className="w-3.5 h-3.5" aria-hidden />
                  </Button>
                </div>
              )}
            </div>
          );
        })}
      </Card>
    </div>
  );
}

function MemberAvatar({ name, avatar }: { name: string; avatar: string | null }) {
  if (avatar) {
    return <img src={safeImageUrl(avatar)} alt="" className="w-9 h-9 rounded-full object-cover border border-primary-200 dark:border-stone-700 shrink-0" />;
  }
  return (
    <div aria-hidden className="w-9 h-9 rounded-full bg-primary-100 dark:bg-primary-900/40 grid place-items-center text-primary-600 dark:text-primary-300 text-sm font-display font-semibold shrink-0">
      {name.charAt(0).toUpperCase()}
    </div>
  );
}
