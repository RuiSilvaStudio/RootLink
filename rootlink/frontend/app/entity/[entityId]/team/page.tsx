"use client";

import { useCallback, useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, Key, Users, UserMinus, UserPlus, ThumbsUp, ThumbsDown } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
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
    return <div className="max-w-4xl mx-auto px-4 py-16 text-center text-stone-400 font-serif">Loading…</div>;
  }
  if (!entity) {
    return <div className="max-w-4xl mx-auto px-4 py-16 text-center text-stone-400 font-serif">Entity not found, or you don&apos;t have access.</div>;
  }

  const { entityKind, rank, entityId: myEntityId } = my();
  const isOwnSuperAdmin = entityKind === entity.entity_type && myEntityId === entity.id && rank >= 5;
  const isPlatformSuperAdmin = entityKind === "platform" && rank >= 5;
  const isPrimaryContact = entity.primary_contact_user_id === user?.id;
  const isRosterManaged = entity.entity_type === "partners" || entity.entity_type === "suppliers";
  const canManageRoster = isRosterManaged && (isPrimaryContact || isPlatformSuperAdmin);
  const canGrantDelegations = isOwnSuperAdmin || isPlatformSuperAdmin;

  const delegableActions = Object.entries(registry).filter(
    ([, entry]: [string, any]) => entry.delegable && entry.entity_scope === "entity"
  );

  const handleAddRoster = async () => {
    const uid = Number(rosterUserId);
    if (!uid) return;
    try {
      await api.entities.addRosterMember(entityId, uid);
      addToast("success", "Member added to roster");
      setRosterUserId("");
      load();
    } catch (err: any) {
      addToast("error", err.message || "Failed to add member");
    }
  };

  const handleRemoveRoster = async (uid: number) => {
    if (!confirm("Remove this member from the roster?")) return;
    try {
      await api.entities.removeRosterMember(entityId, uid);
      addToast("success", "Member removed");
      load();
    } catch (err: any) {
      addToast("error", err.message || "Failed to remove member");
    }
  };

  const handleSubmitRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    const uid = Number(targetUserId);
    if (!uid) return;
    try {
      await api.roleRequests.submit({ target_user_id: uid, to_rank: Number(toRank), reason: reqReason || undefined });
      addToast("success", "Role-change request submitted");
      setTargetUserId("");
      setReqReason("");
      load();
    } catch (err: any) {
      addToast("error", err.message || "Failed to submit request");
    }
  };

  const decide = async (id: number, approve: boolean) => {
    try {
      if (approve) await api.roleRequests.approve(id);
      else await api.roleRequests.reject(id);
      addToast("success", approve ? "Approved" : "Rejected");
      load();
    } catch (err: any) {
      addToast("error", err.message || "Failed to decide");
    }
  };

  const handleGrantDelegation = async (e: React.FormEvent) => {
    e.preventDefault();
    const uid = Number(delGrantee);
    if (!uid || !delAction) return;
    try {
      await api.delegations.create({ grantee_id: uid, action: delAction, entity_id: entityId });
      addToast("success", "Delegation granted");
      setDelGrantee("");
      setDelAction("");
      load();
    } catch (err: any) {
      addToast("error", err.message || "Failed to grant delegation");
    }
  };

  const handleRevoke = async (id: number) => {
    try {
      await api.delegations.revoke(id);
      addToast("success", "Delegation revoked");
      load();
    } catch (err: any) {
      addToast("error", err.message || "Failed to revoke");
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-12">
      <Link href={`/entity/${entityId}`} className="inline-flex items-center gap-1 text-sm text-stone-500 hover:text-primary-700 mb-4 font-serif">
        <ArrowLeft className="w-4 h-4" /> Back to entity
      </Link>
      <PageHeader icon={<Users className="w-5 h-5 text-primary-500" />} title={`${entity.name} — Team`} />

      {/* Members */}
      <section className="mt-8 mb-8 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/60 dark:border-stone-700 p-6">
        <h2 className="font-display font-semibold text-stone-800 dark:text-stone-100 mb-4">Members &amp; ranks</h2>
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-stone-400 uppercase tracking-wide">
              <th className="pb-2">Name</th>
              <th className="pb-2">Rank</th>
              {canManageRoster && <th className="pb-2 text-right">Actions</th>}
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.id} className="border-t border-stone-100 dark:border-stone-800">
                <td className="py-2">{m.name} <span className="text-stone-400 text-xs">{m.email}</span></td>
                <td className="py-2">{m.rank}{m.id === entity.primary_contact_user_id ? " (primary contact)" : ""}</td>
                {canManageRoster && (
                  <td className="py-2 text-right">
                    {m.id !== entity.primary_contact_user_id && (
                      <button onClick={() => handleRemoveRoster(m.id)} className="text-rust-600 hover:text-rust-700 inline-flex items-center gap-1 text-xs">
                        <UserMinus className="w-3.5 h-3.5" /> Remove
                      </button>
                    )}
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
              placeholder="User ID to add"
              className="px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm w-40"
            />
            <Button size="sm" onClick={handleAddRoster}><UserPlus className="w-4 h-4" /> Add to roster</Button>
          </div>
        )}
        {isRosterManaged && !canManageRoster && (
          <p className="text-xs text-stone-400 font-serif mt-3">Only this entity&apos;s primary contact can add/remove roster members.</p>
        )}
      </section>

      {/* Role-change requests */}
      <section className="mb-8 bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/60 dark:border-stone-700 p-6">
        <h2 className="font-display font-semibold text-stone-800 dark:text-stone-100 mb-4">Promote / demote requests</h2>

        <form onSubmit={handleSubmitRequest} className="flex flex-wrap gap-2 mb-5 items-end">
          <div>
            <label className="block text-xs text-stone-500 mb-1">Target user ID</label>
            <input value={targetUserId} onChange={(e) => setTargetUserId(e.target.value)} className="px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm w-32" />
          </div>
          <div>
            <label className="block text-xs text-stone-500 mb-1">New rank (0-5)</label>
            <input type="number" min={0} max={5} value={toRank} onChange={(e) => setToRank(e.target.value)} className="px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm w-24" />
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="block text-xs text-stone-500 mb-1">Reason</label>
            <input value={reqReason} onChange={(e) => setReqReason(e.target.value)} className="px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm w-full" />
          </div>
          <Button type="submit" size="sm">Submit request</Button>
        </form>

        <div className="grid sm:grid-cols-2 gap-6">
          <div>
            <h3 className="text-xs font-display font-semibold text-stone-400 uppercase tracking-wide mb-2">My submitted requests</h3>
            {mineRequests.length === 0 ? (
              <p className="text-sm text-stone-400 font-serif">None yet.</p>
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
            <h3 className="text-xs font-display font-semibold text-stone-400 uppercase tracking-wide mb-2">Awaiting my approval</h3>
            {pendingApproval.length === 0 ? (
              <p className="text-sm text-stone-400 font-serif">None yet.</p>
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

      {/* Delegations */}
      {(canGrantDelegations || delegations.length > 0) && (
        <section className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/60 dark:border-stone-700 p-6">
          <h2 className="font-display font-semibold text-stone-800 dark:text-stone-100 mb-4 flex items-center gap-2">
            <Key className="w-4 h-4 text-primary-500" /> Delegated permissions
          </h2>

          {canGrantDelegations && (
            <form onSubmit={handleGrantDelegation} className="flex flex-wrap gap-2 mb-5 items-end">
              <div>
                <label className="block text-xs text-stone-500 mb-1">User ID</label>
                <input value={delGrantee} onChange={(e) => setDelGrantee(e.target.value)} className="px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm w-32" />
              </div>
              <div className="flex-1 min-w-[220px]">
                <label className="block text-xs text-stone-500 mb-1">Action</label>
                <select value={delAction} onChange={(e) => setDelAction(e.target.value)} className="px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm w-full">
                  <option value="">Select an action…</option>
                  {delegableActions.map(([key]) => (
                    <option key={key} value={key}>{key}</option>
                  ))}
                </select>
              </div>
              <Button type="submit" size="sm">Grant</Button>
            </form>
          )}

          {delegations.length === 0 ? (
            <p className="text-sm text-stone-400 font-serif">No active delegations.</p>
          ) : (
            <ul className="space-y-1 text-sm">
              {delegations.map((d) => (
                <li key={d.id} className="flex items-center justify-between">
                  <span>{d.action} → user #{d.grantee_id}</span>
                  {canGrantDelegations && (
                    <button onClick={() => handleRevoke(d.id)} className="text-rust-600 hover:text-rust-700 text-xs">Revoke</button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}
