"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Key, PenLine, Send, Users, UserMinus, UserPlus, ThumbsUp, ThumbsDown } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/lib/locale-context";
import { useToast } from "@/lib/toast-context";
import { usePermission } from "@/lib/use-permission";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { PageHeader } from "@/components/ui/PageHeader";

export default function EntityTeamPage() {
  const params = useParams();
  const entityId = Number(params.entityId);
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { t } = useLocale();
  const { addToast } = useToast();
  const { my, loading: permLoading } = usePermission();

  const [entity, setEntity] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [delegations, setDelegations] = useState<any[]>([]);
  const [registry, setRegistry] = useState<Record<string, any>>({});
  const [mineRequests, setMineRequests] = useState<any[]>([]);
  const [pendingApproval, setPendingApproval] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Roster add form (partners/suppliers primary contact only)
  const [rosterUserId, setRosterUserId] = useState("");
  // Role-change request form
  const [targetUserId, setTargetUserId] = useState("");
  const [toRank, setToRank] = useState("2");
  const [reqReason, setReqReason] = useState("");
  // Delegation grant form
  const [delGrantee, setDelGrantee] = useState("");
  const [delAction, setDelAction] = useState("");
  // Notify-members form
  const [notifyMessage, setNotifyMessage] = useState("");
  const [notifySending, setNotifySending] = useState(false);

  const load = useCallback(async () => {
    try {
      const [e, mems, regs, mine, pending] = await Promise.all([
        api.entities.get(entityId),
        api.entities.members(entityId),
        api.permissions.registry(),
        api.roleRequests.list("mine").catch(() => []),
        api.roleRequests.list("pending-approval").catch(() => []),
      ]);
      setEntity(e);
      setMembers(mems);
      setRegistry(regs);
      setMineRequests(mine.filter((r: any) => r.entity_id === entityId));
      setPendingApproval(pending.filter((r: any) => r.entity_id === entityId));
      try {
        setDelegations(await api.delegations.list({ entity_id: entityId }));
      } catch {
        setDelegations([]);
      }
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
    return <div className="max-w-4xl mx-auto px-4 py-16 text-center text-stone-400 font-serif">{t("common.loading")}</div>;
  }
  if (!entity) {
    return <div className="max-w-4xl mx-auto px-4 py-16 text-center text-stone-400 font-serif">{t("entity_team.not_found")}</div>;
  }

  const { entityKind, rank, entityId: myEntityId } = my();
  const isOwnSuperAdmin = entityKind === entity.entity_type && myEntityId === entity.id && rank >= 5;
  const isPlatformSuperAdmin = entityKind === "platform" && rank >= 5;
  const isPrimaryContact = entity.primary_contact_user_id === user?.id;
  const isRosterManaged = entity.entity_type === "partners" || entity.entity_type === "suppliers";
  const canManageRoster = isRosterManaged && (isPrimaryContact || isPlatformSuperAdmin);
  const canGrantDelegations = isOwnSuperAdmin || isPlatformSuperAdmin;
  // Member account actions (password reset, trusted-publisher grant/revoke):
  // the entity's OWN super admin, or platform — mirrors the backend guard.
  const canManageMembers = isOwnSuperAdmin || isPlatformSuperAdmin;
  // Notify members: registry floor for notification.send_to_entity_members
  // is admin(4) — lower than the super-admin(5) member-account actions above
  // — same entity or platform, mirroring the backend's can() gate.
  const isOwnAdmin = entityKind === entity.entity_type && myEntityId === entity.id && rank >= 4;
  const isPlatformAdmin = entityKind === "platform" && rank >= 4;
  const canNotifyMembers = isOwnAdmin || isPlatformAdmin;

  // Role-change request submit form: `user.promote` floor is moderator(3),
  // `user.demote` is admin(4) (registry) — a moderator can only ever
  // request a promote, never a demote, but rank 0-2 can never submit
  // either direction. Gate on the LOWER of the two floors so the form
  // isn't shown to ranks that would always get a 400 from the backend
  // (docs/roles-permissions/ROLES_PERMISSIONS.md §7; backend enforces the
  // real per-direction floor either way — this is UX-only, not a new
  // security boundary). "Awaiting my approval"/"My submitted requests"
  // need no separate gate: both lists are already server-filtered to only
  // what this user actually has.
  const roleRequestFloor = Math.min(
    registry["user.promote"]?.min_rank ?? 3,
    registry["user.demote"]?.min_rank ?? 4,
  );
  const canSubmitRoleRequest =
    (entityKind === entity.entity_type && myEntityId === entity.id && rank >= roleRequestFloor) ||
    (entityKind === "platform" && rank >= roleRequestFloor);
  const roleRequestCandidates = members.filter((m) => m.id !== user?.id);

  const delegableActions = Object.entries(registry).filter(
    ([, entry]: [string, any]) => entry.delegable && entry.entity_scope === "entity"
  );

  const handleAddRoster = async () => {
    const uid = Number(rosterUserId);
    if (!uid) return;
    try {
      await api.entities.addRosterMember(entityId, uid);
      addToast("success", t("entity_team.roster_added"));
      setRosterUserId("");
      load();
    } catch (err: any) {
      addToast("error", err.message || t("entity_team.roster_add_failed"));
    }
  };

  const handleRemoveRoster = async (uid: number) => {
    if (!confirm(t("entity_team.remove_roster_confirm"))) return;
    try {
      await api.entities.removeRosterMember(entityId, uid);
      addToast("success", t("entity_team.roster_removed"));
      load();
    } catch (err: any) {
      addToast("error", err.message || t("entity_team.roster_remove_failed"));
    }
  };

  const handleResetPassword = async (m: any) => {
    const password = prompt(t("entity_team.password_prompt", { name: m.name }));
    if (!password || password.length < 6) return;
    if (!confirm(t("entity_team.password_confirm", { name: m.name }))) return;
    try {
      await api.entities.resetMemberPassword(entityId, m.id, password);
      addToast("success", t("entity_team.password_success"));
    } catch (err: any) {
      addToast("error", err.message || t("entity_team.password_reset_failed"));
    }
  };

  const handleSelfPublish = async (m: any, grant: boolean) => {
    const key = grant ? "entity_team.grant_self_publish_confirm" : "entity_team.revoke_self_publish_confirm";
    if (!confirm(t(key, { name: m.name }))) return;
    try {
      await api.entities.setMemberSelfPublish(entityId, m.id, grant);
      addToast("success", t(grant ? "entity_team.self_publish_granted" : "entity_team.self_publish_revoked"));
      load();
    } catch (err: any) {
      addToast("error", err.message || t("entity_team.self_publish_update_failed"));
    }
  };

  // Stale-delegation stopgap: flag any ACTIVE grant whose grantee's CURRENT
  // rank (members list) is below the delegated action's registry min_rank —
  // purely client-side visibility, no auto-void.
  const staleDelegationInfo = (d: any): { rank: number; min: number } | null => {
    if (d.revoked_at) return null;
    const grantee = members.find((m) => m.id === d.grantee_id);
    const minRank = registry[d.action]?.min_rank;
    if (!grantee || typeof minRank !== "number") return null;
    const granteeRank = grantee.rank ?? 0;
    return granteeRank < minRank ? { rank: granteeRank, min: minRank } : null;
  };

  const NOTIFY_MAX = 500;

  const handleNotifyMembers = async (e: React.FormEvent) => {
    e.preventDefault();
    const msg = notifyMessage.trim();
    if (!msg || notifySending) return;
    // Audience = every member of this entity except the sender.
    const recipientCount = members.filter((m) => m.id !== user?.id).length;
    if (!confirm(t("entity_team.notify_confirm", { count: recipientCount }))) return;
    setNotifySending(true);
    try {
      const res = await api.entities.notifyMembers(entityId, msg);
      addToast("success", t("entity_team.notify_success", { count: res.sent_to }));
      setNotifyMessage("");
    } catch (err: any) {
      addToast("error", err.message || t("entity_team.notify_error"));
    } finally {
      setNotifySending(false);
    }
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const uid = Number(targetUserId);
    if (!uid) return;
    try {
      await api.roleRequests.submit({ target_user_id: uid, to_rank: Number(toRank), reason: reqReason || undefined });
      addToast("success", t("entity_team.role_request_submitted"));
      setTargetUserId("");
      setReqReason("");
      load();
    } catch (err: any) {
      addToast("error", err.message || t("entity_team.role_request_submit_failed"));
    }
  };

  const decide = async (id: number, approve: boolean) => {
    try {
      if (approve) await api.roleRequests.approve(id);
      else await api.roleRequests.reject(id);
      addToast("success", approve ? t("entity_team.approved") : t("entity_team.rejected"));
      load();
    } catch (err: any) {
      addToast("error", err.message || t("entity_team.decision_failed"));
    }
  };

  const handleGrantDelegation = async (e: React.FormEvent) => {
    e.preventDefault();
    const uid = Number(delGrantee);
    if (!uid || !delAction) return;
    try {
      await api.delegations.create({ grantee_id: uid, action: delAction, entity_id: entityId });
      addToast("success", t("entity_team.delegation_granted"));
      setDelGrantee("");
      setDelAction("");
      load();
    } catch (err: any) {
      addToast("error", err.message || t("entity_team.delegation_grant_failed"));
    }
  };

  const handleRevoke = async (id: number) => {
    try {
      await api.delegations.revoke(id);
      addToast("success", t("entity_team.delegation_revoked"));
      load();
    } catch (err: any) {
      addToast("error", err.message || t("entity_team.delegation_revoke_failed"));
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-12">
      <Link href={`/entity/${entityId}`} className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-primary-700 mb-4 font-serif">
        <ArrowLeft className="w-4 h-4" /> {t("entity_team.back_to_entity")}
      </Link>
      <PageHeader icon={<Users className="w-5 h-5 text-primary-500" />} title={t("entity_team.team_title", { name: entity.name })} />

      {/* Members */}
      <section className="mt-8 mb-8 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/60 dark:border-stone-700 p-6">
        <h2 className="font-display font-semibold text-stone-800 dark:text-stone-100 mb-4">{t("entity_team.members_heading")}</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-stone-400 uppercase tracking-wide">
              <th className="pb-2">{t("entity_team.col_name")}</th>
              <th className="pb-2">{t("entity_team.col_rank")}</th>
              {(canManageRoster || canManageMembers) && <th className="pb-2 text-right">{t("entity_team.col_actions")}</th>}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-t border-stone-100 dark:border-stone-800">
                <td className="py-2">
                  {m.name} <span className="text-stone-400 text-xs">{m.email}</span>
                  {m.can_self_publish && (
                    <Badge variant="sage" className="ml-2">{t("entity_team.trusted_publisher")}</Badge>
                  )}
                </td>
                <td className="py-2">{m.rank}{m.id === entity.primary_contact_user_id ? ` (${t("entity_team.primary_contact")})` : ""}</td>
                {(canManageRoster || canManageMembers) && (
                  <td className="py-2 text-right">
                    <span className="inline-flex items-center gap-1">
                      {/* Hidden on your own row: reset your own password via the
                          normal account flow, and self-granting trusted publisher
                          isn't a call you make about yourself. */}
                      {canManageMembers && m.id !== user?.id && (
                        <>
                          <button
                            onClick={() => handleSelfPublish(m, !m.can_self_publish)}
                            className={`p-1.5 rounded-lg hover:bg-stone-50 dark:hover:bg-stone-800 transition ${m.can_self_publish ? "text-primary-600 hover:text-rust-600" : "text-stone-400 hover:text-primary-600"}`}
                            title={t(m.can_self_publish ? "entity_team.revoke_self_publish" : "entity_team.grant_self_publish")}
                            aria-label={t(m.can_self_publish ? "entity_team.revoke_self_publish" : "entity_team.grant_self_publish")}
                          >
                            <PenLine className="w-4 h-4" />
                          </button>
                          <button
                            onClick={() => handleResetPassword(m)}
                            className="p-1.5 text-stone-400 hover:text-primary-600 rounded-lg hover:bg-primary-50 dark:hover:bg-stone-800 transition"
                            title={t("entity_team.reset_password")}
                            aria-label={t("entity_team.reset_password")}
                          >
                            <Key className="w-4 h-4" />
                          </button>
                        </>
                      )}
                      {canManageRoster && m.id !== entity.primary_contact_user_id && (
                        <button onClick={() => handleRemoveRoster(m.id)} className="text-rust-600 hover:text-rust-700 inline-flex items-center gap-1 text-xs">
                          <UserMinus className="w-3.5 h-3.5" /> {t("entity_team.remove")}
                        </button>
                      )}
                    </span>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>

        {canManageRoster && (
          <div className="flex gap-2 mt-4">
            <input
              value={rosterUserId}
              onChange={(e) => setRosterUserId(e.target.value)}
              placeholder={t("entity_team.user_id_add_placeholder")}
              className="px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm w-40"
            />
            <Button size="sm" onClick={handleAddRoster}><UserPlus className="w-4 h-4" /> {t("entity_team.add_to_roster")}</Button>
          </div>
        )}
        {isRosterManaged && !canManageRoster && (
          <p className="text-xs text-stone-400 font-serif mt-3">{t("entity_team.roster_hint")}</p>
        )}
      </section>

      {/* Notify members — registry floor admin(4), lower than the member
          account actions above */}
      {canNotifyMembers && (
        <section className="mb-8 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/60 dark:border-stone-700 p-6">
          <h2 className="font-display font-semibold text-stone-800 dark:text-stone-100 mb-1 flex items-center gap-2">
            <Send className="w-4 h-4 text-primary-500" /> {t("entity_team.notify_members")}
          </h2>
          <p className="text-sm text-stone-500 dark:text-stone-400 font-serif mb-4">
            {t("entity_team.notify_desc", { name: entity.name })}
          </p>
          <form onSubmit={handleNotifyMembers} className="space-y-3">
            <div>
              <label htmlFor="notify-message" className="block text-xs text-stone-500 mb-1">
                {t("entity_team.notify_label")}
              </label>
              <textarea
                id="notify-message"
                value={notifyMessage}
                onChange={(e) => setNotifyMessage(e.target.value)}
                placeholder={t("entity_team.notify_placeholder")}
                rows={3}
                maxLength={NOTIFY_MAX}
                className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary-500/15 focus:border-primary-400 transition"
              />
              <p
                aria-live="polite"
                className={`text-xs mt-1 text-right ${notifyMessage.length >= NOTIFY_MAX ? "text-amber-600" : "text-stone-400"}`}
              >
                {notifyMessage.length}/{NOTIFY_MAX}
              </p>
            </div>
            <Button type="submit" size="sm" disabled={notifySending || !notifyMessage.trim()}>
              <Send className="w-4 h-4" />{" "}
              {notifySending ? t("entity_team.notify_sending") : t("entity_team.notify_send")}
            </Button>
          </form>
        </section>
      )}

      {/* Role-change requests */}
      {(canSubmitRoleRequest || mineRequests.length > 0 || pendingApproval.length > 0) && (
        <section className="mb-8 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/60 dark:border-stone-700 p-6">
          <h2 className="font-display font-semibold text-stone-800 dark:text-stone-100 mb-1">{t("entity_team.role_requests_title")}</h2>

          {canSubmitRoleRequest && (
            <>
              <p className="text-sm text-stone-500 dark:text-stone-400 font-serif mb-4">{t("entity_team.role_requests_hint")}</p>
              <form onSubmit={handleSubmitRequest} className="flex flex-wrap gap-2 mb-5 items-end">
                <div className="flex-1 min-w-[180px]">
                  <label className="block text-xs text-stone-500 mb-1">{t("entity_team.role_requests_target")}</label>
                  <select
                    value={targetUserId}
                    onChange={(e) => setTargetUserId(e.target.value)}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm"
                  >
                    <option value="">{t("entity_team.role_requests_select_member")}</option>
                    {roleRequestCandidates.map((m) => (
                      <option key={m.id} value={m.id}>{m.name} ({t("entity_team.role_requests_rank_label", { rank: m.rank })})</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs text-stone-500 mb-1">{t("entity_team.role_requests_new_rank")}</label>
                  <input type="number" min={0} max={5} value={toRank} onChange={(e) => setToRank(e.target.value)} className="px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm w-24" />
                </div>
                <div className="flex-1 min-w-[160px]">
                  <label className="block text-xs text-stone-500 mb-1">{t("entity_team.role_requests_reason")}</label>
                  <input value={reqReason} onChange={(e) => setReqReason(e.target.value)} className="px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm w-full" />
                </div>
                <Button type="submit" size="sm" disabled={!targetUserId}>{t("entity_team.role_requests_submit")}</Button>
              </form>
            </>
          )}

          <div className="grid sm:grid-cols-2 gap-6">
            <div>
              <h3 className="text-xs font-display font-semibold text-stone-400 uppercase tracking-wide mb-2">{t("entity_team.role_requests_mine")}</h3>
              {mineRequests.length === 0 ? (
                <p className="text-sm text-stone-400 font-serif">{t("entity_team.role_requests_none")}</p>
              ) : (
                <ul className="space-y-1 text-sm">
                  {mineRequests.map((r) => (
                    <li key={r.id} className="flex justify-between">
                      <span>#{r.target_user_id} → rank {r.to_rank}</span>
                      <Badge variant={r.status === "approved" ? "green" : r.status === "rejected" ? "red" : "amber"}>{r.status}</Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <div>
              <h3 className="text-xs font-display font-semibold text-stone-400 uppercase tracking-wide mb-2">{t("entity_team.role_requests_pending")}</h3>
              {pendingApproval.length === 0 ? (
                <p className="text-sm text-stone-400 font-serif">{t("entity_team.role_requests_none")}</p>
              ) : (
                <ul className="space-y-2 text-sm">
                  {pendingApproval.map((r) => (
                    <li key={r.id} className="flex items-center justify-between">
                      <span>#{r.target_user_id} → rank {r.to_rank} ({r.direction})</span>
                      <span className="flex gap-1">
                        <button onClick={() => decide(r.id, true)} className="text-emerald-600 hover:text-emerald-700"><ThumbsUp className="w-4 h-4" /></button>
                        <button onClick={() => decide(r.id, false)} className="text-rust-600 hover:text-rust-700"><ThumbsDown className="w-4 h-4" /></button>
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Delegations */}
      {(canGrantDelegations || delegations.length > 0) && (
        <section className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/60 dark:border-stone-700 p-6">
          <h2 className="font-display font-semibold text-stone-800 dark:text-stone-100 mb-4 flex items-center gap-2">
            <Key className="w-4 h-4 text-primary-500" /> {t("entity_team.delegated_permissions_heading")}
          </h2>

          {canGrantDelegations && (
            <form onSubmit={handleGrantDelegation} className="flex flex-wrap gap-2 mb-5 items-end">
              <div>
                <label className="block text-xs text-stone-500 mb-1">{t("entity_team.delegation_user_id_label")}</label>
                <input value={delGrantee} onChange={(e) => setDelGrantee(e.target.value)} className="px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm w-32" />
              </div>
              <div className="flex-1 min-w-[220px]">
                <label className="block text-xs text-stone-500 mb-1">{t("entity_team.delegation_action_label")}</label>
                <select value={delAction} onChange={(e) => setDelAction(e.target.value)} className="px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm w-full">
                  <option value="">{t("entity_team.delegation_select_action")}</option>
                  {delegableActions.map(([key]) => (
                    <option key={key} value={key}>{key}</option>
                  ))}
                </select>
              </div>
              <Button type="submit" size="sm">{t("entity_team.grant")}</Button>
            </form>
          )}

          {delegations.length === 0 ? (
            <p className="text-sm text-stone-400 font-serif">{t("entity_team.no_active_delegations")}</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {delegations.map((d) => {
                const stale = staleDelegationInfo(d);
                return (
                  <li key={d.id} className="flex items-center justify-between gap-2">
                    <span className="flex items-center gap-2 flex-wrap">
                      {d.action} → user #{d.grantee_id}
                      {stale && (
                        <span title={t("entity_team.stale_delegation_tip", { id: d.grantee_id, rank: stale.rank, min: stale.min })}>
                          <Badge variant="amber">{t("entity_team.stale_delegation")}</Badge>
                        </span>
                      )}
                    </span>
                    {canGrantDelegations && (
                      <button onClick={() => handleRevoke(d.id)} className="text-rust-600 hover:text-rust-700 text-xs">{t("entity_team.revoke")}</button>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
