"use client";

import { useEffect, useState } from "react";
import { Key, LogOut, PenLine, Search, CheckCircle, XCircle } from "lucide-react";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/locale-context";
import { Badge } from "@/components/ui/Badge";

// NOTE: `super_admin` was added to `UserRole` after this page was written and
// wasn't wired in here — a `<select value={u.role}>` with no matching
// `<option>` silently displays the *first* option instead of the real value,
// so a super_admin's row rendered as "user" here even though their actual
// role/access was correct. Fixed 2026-07-04 (see docs/roles-permissions/).
const ROLES = ["user", "contributor", "moderator", "admin", "super_admin"];
const ACCOUNT_TYPES = ["", "individual", "organization", "practitioner"];

const roleBadgeVariant = (role: string): "sage" | "earth" | "blue" | "green" | "stone" | "amber" => {
  if (role === "super_admin") return "amber";
  if (role === "admin") return "green";
  if (role === "moderator") return "blue";
  if (role === "contributor") return "earth";
  return "stone";
};

const accountTypeBadge = (type: string): { variant: "stone" | "blue" | "earth"; label: string } => {
  if (type === "organization") return { variant: "blue", label: "Org" };
  if (type === "practitioner") return { variant: "earth", label: "Practitioner" };
  return { variant: "stone", label: "Individual" };
};

// Enforcement ladder (docs/roles-permissions/ROLES_PERMISSIONS.md §4):
// active → restricted → suspended → banned. Amber for the warning rungs,
// red for the terminal one.
const statusBadgeVariant = (status: string): "amber" | "red" | "stone" => {
  if (status === "restricted" || status === "suspended") return "amber";
  if (status === "banned") return "red";
  return "stone";
};

// Which ladder transitions are valid from each rung.
const STATUS_TRANSITIONS: Record<string, string[]> = {
  active: ["restrict", "suspend", "ban"],
  restricted: ["lift_restriction", "suspend", "ban"],
  suspended: ["lift_suspension", "ban"],
  banned: ["unban"],
};

export default function AdminUsers() {
  const { t } = useLocale();
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");
  const [accountTypeFilter, setAccountTypeFilter] = useState("");

  const fetchUsers = async () => {
    const params: any = {};
    if (search) params.q = search;
    if (roleFilter) params.role = roleFilter;
    if (accountTypeFilter) params.account_type = accountTypeFilter;
    const data = await api.admin.listUsers(params);
    setUsers(data);
  };

  useEffect(() => { fetchUsers(); }, [roleFilter, accountTypeFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchUsers();
  };

  const handleRoleChange = async (userId: number, role: string) => {
    await api.admin.updateUserRole(userId, role);
    fetchUsers();
  };

  const handleResetPassword = async (userId: number, userName: string) => {
    const password = prompt(t("admin.password_prompt", { name: userName }));
    if (!password || password.length < 6) return;
    if (!confirm(t("admin.password_confirm", { name: userName }))) return;
    await api.admin.resetPassword(userId, password);
    alert(t("admin.password_success"));
  };

  const handleVerify = async (userId: number) => {
    await api.admin.verifyUser(userId);
    fetchUsers();
  };

  const handleUnverify = async (userId: number) => {
    await api.admin.unverifyUser(userId);
    fetchUsers();
  };

  // A suspended/banned user keeping a live token would be a half-finished
  // control — always revoke sessions right after those two transitions.
  const revokeSessionsAfterEnforcement = async (userId: number) => {
    try {
      await api.admin.revokeUserSessions(userId);
    } catch {
      alert(t("admin.force_logout_failed"));
    }
  };

  const handleStatusAction = async (u: any, action: string) => {
    try {
      if (action === "restrict") {
        const reason = prompt(t("admin.restrict_prompt", { name: u.name }));
        if (reason === null) return;
        if (!confirm(t("admin.restrict_confirm", { name: u.name }))) return;
        await api.admin.restrictUser(u.id, reason);
      } else if (action === "lift_restriction") {
        if (!confirm(t("admin.lift_restriction_confirm", { name: u.name }))) return;
        await api.admin.liftRestriction(u.id);
      } else if (action === "suspend") {
        const daysRaw = prompt(t("admin.suspend_days_prompt", { name: u.name }));
        if (daysRaw === null) return;
        const days = parseInt(daysRaw, 10);
        if (!Number.isFinite(days) || days < 1) {
          alert(t("admin.suspend_days_invalid"));
          return;
        }
        const reason = prompt(t("admin.suspend_reason_prompt", { name: u.name }));
        if (reason === null) return;
        if (!confirm(t("admin.suspend_confirm", { name: u.name, days: String(days) }))) return;
        const until = new Date(Date.now() + days * 24 * 60 * 60 * 1000).toISOString();
        await api.admin.suspendUser(u.id, until, reason);
        await revokeSessionsAfterEnforcement(u.id);
      } else if (action === "lift_suspension") {
        if (!confirm(t("admin.lift_suspension_confirm", { name: u.name }))) return;
        await api.admin.liftSuspension(u.id);
      } else if (action === "ban") {
        const reason = prompt(t("admin.ban_prompt", { name: u.name }));
        if (reason === null) return;
        if (!confirm(t("admin.ban_confirm", { name: u.name }))) return;
        await api.admin.banUser(u.id, reason);
        await revokeSessionsAfterEnforcement(u.id);
      } else if (action === "unban") {
        if (!confirm(t("admin.unban_confirm", { name: u.name }))) return;
        await api.admin.unbanUser(u.id);
      }
      fetchUsers();
    } catch (err: any) {
      alert(t("admin.action_error", { message: err?.message || "" }));
    }
  };

  const handleForceLogout = async (u: any) => {
    if (!confirm(t("admin.force_logout_confirm", { name: u.name }))) return;
    try {
      const res = await api.admin.revokeUserSessions(u.id);
      alert(t("admin.force_logout_success", { count: String(res.revoked_count) }));
    } catch (err: any) {
      alert(t("admin.action_error", { message: err?.message || "" }));
    }
  };

  const handleSelfPublish = async (u: any, grant: boolean) => {
    const key = grant ? "admin.grant_self_publish_confirm" : "admin.revoke_self_publish_confirm";
    if (!confirm(t(key, { name: u.name }))) return;
    try {
      await api.admin.setSelfPublish(u.id, grant);
      fetchUsers();
    } catch (err: any) {
      alert(t("admin.action_error", { message: err?.message || "" }));
    }
  };

  return (
    <div>
      <div className="mb-6">
        <Badge variant="sage" className="mb-3">{t("admin.users")}</Badge>
        <h1 className="text-3xl sm:text-4xl font-display font-semibold text-stone-800 dark:text-stone-100 leading-[1.08]">
          {t("admin.user_management")}
        </h1>
      </div>

      {/* Search + filters */}
      <div className="flex gap-3 mb-5 items-center flex-wrap">
        <form onSubmit={handleSearch} className="flex gap-2">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("admin.search_user_placeholder")}
              className="pl-9 pr-3 py-2 border border-stone-200/60 rounded-xl text-sm bg-white font-serif focus:outline-none focus:ring-2 focus:ring-primary-500/15 focus:border-primary-400 transition w-56"
            />
          </div>
          <button type="submit" className="px-4 py-2 bg-primary-600 text-cream rounded-xl text-sm font-display font-medium hover:bg-primary-700 transition">
            {t("admin.search")}
          </button>
        </form>
        <select
          value={accountTypeFilter}
          onChange={(e) => setAccountTypeFilter(e.target.value)}
          className="border border-stone-200/60 rounded-xl px-3 py-2 text-sm bg-white font-serif focus:outline-none focus:ring-2 focus:ring-primary-500/15 focus:border-primary-400 transition"
        >
          <option value="">{t("admin.all_types")}</option>
          <option value="individual">{t("auth.type_individual")}</option>
          <option value="organization">{t("auth.type_organization")}</option>
          <option value="practitioner">{t("auth.type_practitioner")}</option>
        </select>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="border border-stone-200/60 rounded-xl px-3 py-2 text-sm bg-white font-serif focus:outline-none focus:ring-2 focus:ring-primary-500/15 focus:border-primary-400 transition"
        >
          <option value="">{t("admin.all_roles")}</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>{t("admin.role_" + r)}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-stone-200/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100">
                <th className="text-left px-4 py-3 text-xs font-display font-semibold text-stone-400 uppercase tracking-wider">{t("admin.user_name")}</th>
                <th className="text-left px-4 py-3 text-xs font-display font-semibold text-stone-400 uppercase tracking-wider hidden sm:table-cell">{t("admin.user_email")}</th>
                <th className="text-left px-4 py-3 text-xs font-display font-semibold text-stone-400 uppercase tracking-wider">{t("admin.account_type")}</th>
                <th className="text-left px-4 py-3 text-xs font-display font-semibold text-stone-400 uppercase tracking-wider">{t("admin.role")}</th>
                <th className="text-left px-4 py-3 text-xs font-display font-semibold text-stone-400 uppercase tracking-wider">{t("admin.user_status")}</th>
                <th className="text-right px-4 py-3 text-xs font-display font-semibold text-stone-400 uppercase tracking-wider">{t("admin.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u: any) => {
                const acctBadge = accountTypeBadge(u.account_type);
                const status = u.account_status || "active";
                const transitions = STATUS_TRANSITIONS[status] || [];
                return (
                  <tr key={u.id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/50 transition">
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-950/20/60 text-primary-700 flex items-center justify-center text-sm font-display font-semibold shrink-0">
                          {u.name.charAt(0).toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <div className="flex items-center gap-2">
                            <p className="font-medium text-stone-800 dark:text-stone-100 font-serif truncate">{u.name}</p>
                            {u.is_verified && <CheckCircle className="w-3.5 h-3.5 text-green-500 shrink-0" />}
                          </div>
                          <p className="text-xs text-stone-400 sm:hidden font-serif">{u.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-stone-500 font-serif hidden sm:table-cell">{u.email}</td>
                    <td className="px-4 py-3">
                      <Badge variant={acctBadge.variant} className="text-[9px]">{acctBadge.label}</Badge>
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={u.role}
                        onChange={(e) => handleRoleChange(u.id, e.target.value)}
                        className="text-xs border border-stone-200 rounded-lg px-2 py-1 bg-white font-serif focus:outline-none focus:ring-1 focus:ring-primary-400 transition"
                      >
                        {ROLES.map((r) => (
                          <option key={r} value={r}>{t("admin.role_" + r)}</option>
                        ))}
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-col items-start gap-1.5">
                        {status !== "active" && (
                          <Badge
                            variant={statusBadgeVariant(status)}
                            className="text-[9px]"
                            dot
                          >
                            <span title={status === "suspended" && u.suspended_until ? t("admin.suspended_until", { date: new Date(u.suspended_until).toLocaleDateString() }) : undefined}>
                              {t("admin.status_" + status)}
                            </span>
                          </Badge>
                        )}
                        <select
                          value=""
                          onChange={(e) => { if (e.target.value) handleStatusAction(u, e.target.value); }}
                          aria-label={t("admin.status_action_label", { name: u.name })}
                          className="text-xs border border-stone-200 rounded-lg px-2 py-1 bg-white font-serif focus:outline-none focus:ring-1 focus:ring-primary-400 transition"
                        >
                          <option value="">{t("admin.status_" + status)}</option>
                          {transitions.map((a) => (
                            <option key={a} value={a}>{t("admin.status_action_" + a)}</option>
                          ))}
                        </select>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {u.account_type !== "individual" && (
                          u.is_verified ? (
                            <button
                              onClick={() => handleUnverify(u.id)}
                              className="p-1.5 text-green-500 hover:text-red-500 rounded-lg hover:bg-stone-50 transition"
                              title={t("admin.unverify")}
                            >
                              <CheckCircle className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              onClick={() => handleVerify(u.id)}
                              className="p-1.5 text-stone-400 hover:text-green-500 rounded-lg hover:bg-stone-50 transition"
                              title={t("admin.verify")}
                            >
                              <XCircle className="w-4 h-4" />
                            </button>
                          )
                        )}
                        {u.can_self_publish ? (
                          <button
                            onClick={() => handleSelfPublish(u, false)}
                            className="p-1.5 text-primary-600 hover:text-rust-600 rounded-lg hover:bg-stone-50 transition"
                            title={t("admin.revoke_self_publish")}
                            aria-label={t("admin.revoke_self_publish")}
                          >
                            <PenLine className="w-4 h-4" />
                          </button>
                        ) : (
                          <button
                            onClick={() => handleSelfPublish(u, true)}
                            className="p-1.5 text-stone-400 hover:text-primary-600 rounded-lg hover:bg-stone-50 transition"
                            title={t("admin.grant_self_publish")}
                            aria-label={t("admin.grant_self_publish")}
                          >
                            <PenLine className="w-4 h-4" />
                          </button>
                        )}
                        <button
                          onClick={() => handleResetPassword(u.id, u.name)}
                          className="p-1.5 text-stone-400 hover:text-primary-600 rounded-lg hover:bg-primary-50 transition"
                          title={t("admin.reset_password")}
                          aria-label={t("admin.reset_password")}
                        >
                          <Key className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => handleForceLogout(u)}
                          className="p-1.5 text-stone-400 hover:text-rust-600 rounded-lg hover:bg-rust-50 transition"
                          title={t("admin.force_logout")}
                          aria-label={t("admin.force_logout")}
                        >
                          <LogOut className="w-4 h-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {users.length === 0 && (
          <p className="text-stone-400 text-sm py-8 text-center font-serif">{t("admin.no_users")}</p>
        )}
      </div>
    </div>
  );
}
