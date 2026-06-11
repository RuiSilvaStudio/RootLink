"use client";

import { useEffect, useState } from "react";
import { Key } from "lucide-react";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/locale-context";

const ROLES = ["user", "contributor", "moderator", "admin"];

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
      <h1 className="text-2xl font-bold text-stone-800 mb-6">{t("admin.user_management")}</h1>

      <div className="flex gap-3 mb-4 items-center flex-wrap">
        <form onSubmit={handleSearch} className="flex gap-2">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t("admin.search_user_placeholder")}
            className="border border-stone-300 rounded-lg px-3 py-1.5 text-sm w-56"
          />
          <button type="submit" className="bg-primary-600 text-white px-3 py-1.5 rounded-lg text-sm">
            {t("admin.search")}
          </button>
        </form>
        <select
          value={roleFilter}
          onChange={(e) => setRoleFilter(e.target.value)}
          className="border border-stone-300 rounded-lg px-3 py-1.5 text-sm"
        >
          <option value="">{t("admin.all_roles")}</option>
          {ROLES.map((r) => (
            <option key={r} value={r}>{t("admin.role_" + r)}</option>
          ))}
        </select>
      </div>

      <div className="space-y-2">
        {users.map((u: any) => (
          <div key={u.id} className="flex items-center gap-3 bg-stone-50 rounded-lg p-3 border border-stone-200">
            <div className="w-8 h-8 rounded-full bg-primary-100 text-primary-700 flex items-center justify-center text-sm font-bold shrink-0">
              {u.name.charAt(0).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <p className="font-medium text-stone-800">{u.name}</p>
              <p className="text-xs text-stone-400">{u.email}</p>
            </div>
            <button onClick={() => handleResetPassword(u.id, u.name)} className="p-1.5 text-stone-400 hover:text-primary-600 transition" title={t("admin.reset_password")}>
              <Key className="w-4 h-4" />
            </button>
            <select
              value={u.role}
              onChange={(e) => handleRoleChange(u.id, e.target.value)}
              className="border border-stone-300 rounded-lg px-2 py-1 text-sm"
            >
              {ROLES.map((r) => (
                <option key={r} value={r}>{t("admin.role_" + r)}</option>
              ))}
            </select>
          </div>
        ))}
        {users.length === 0 && (
          <p className="text-stone-400 text-sm py-8 text-center">{t("admin.no_users")}</p>
        )}
      </div>
    </div>
  );
}
