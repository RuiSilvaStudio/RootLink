"use client";

import { useEffect, useState } from "react";
import { Key, Search } from "lucide-react";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/locale-context";
import { Badge } from "@/components/ui/Badge";

const ROLES = ["user", "contributor", "moderator", "admin"];

const roleBadgeVariant = (role: string): "sage" | "earth" | "blue" | "green" | "stone" => {
  if (role === "admin") return "green";
  if (role === "moderator") return "blue";
  if (role === "contributor") return "earth";
  return "stone";
};

export default function AdminUsers() {
  const { t } = useLocale();
  const [users, setUsers] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  const fetchUsers = async () => {
    const params: any = {};
    if (search) params.q = search;
    if (roleFilter) params.role = roleFilter;
    const data = await api.admin.listUsers(params);
    setUsers(data);
  };

  useEffect(() => { fetchUsers(); }, [roleFilter]);

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

  return (
    <div>
      <div className="mb-6">
        <Badge variant="sage" className="mb-3">{t("admin.users")}</Badge>
        <h1 className="text-3xl sm:text-4xl font-display font-semibold text-stone-800 leading-[1.08]">
          {t("admin.user_management")}
        </h1>
      </div>

      {/* Search + filter */}
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

      {/* Compact table */}
      <div className="bg-white rounded-2xl border border-stone-200/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100">
                <th className="text-left px-4 py-3 text-xs font-display font-semibold text-stone-400 uppercase tracking-wider">{t("admin.user_name")}</th>
                <th className="text-left px-4 py-3 text-xs font-display font-semibold text-stone-400 uppercase tracking-wider hidden sm:table-cell">{t("admin.user_email")}</th>
                <th className="text-left px-4 py-3 text-xs font-display font-semibold text-stone-400 uppercase tracking-wider">{t("admin.role")}</th>
                <th className="text-right px-4 py-3 text-xs font-display font-semibold text-stone-400 uppercase tracking-wider">{t("admin.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u: any) => (
                <tr key={u.id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/50 transition">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-primary-100/60 text-primary-700 flex items-center justify-center text-sm font-display font-semibold shrink-0">
                        {u.name.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="font-medium text-stone-800 font-serif truncate">{u.name}</p>
                        <p className="text-xs text-stone-400 sm:hidden font-serif">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-stone-500 font-serif hidden sm:table-cell">{u.email}</td>
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
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => handleResetPassword(u.id, u.name)}
                      className="p-1.5 text-stone-400 hover:text-primary-600 rounded-lg hover:bg-primary-50 transition"
                      title={t("admin.reset_password")}
                    >
                      <Key className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
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
