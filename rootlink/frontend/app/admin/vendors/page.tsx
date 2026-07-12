"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/locale-context";
import { Badge } from "@/components/ui/Badge";
import { Button, EmptyState, Tooltip } from "@/components/ui";
import { ListSkeleton } from "@/components/ui/LoadingSkeleton";
import { LoadError } from "@/components/studio/LoadError";
import { Search, Pencil, Trash2, ExternalLink, X, Check } from "lucide-react";

const SERVICE_TYPES = ["catering", "photography", "entertainment", "logistics", "other"];
const STATUSES = ["pending", "confirmed", "completed"];
const AGREEMENT_STATUSES = ["none", "draft", "signed", "expired"];

const statusBadge = (s: string) => {
  if (s === "confirmed") return "green" as const;
  if (s === "completed") return "blue" as const;
  return "amber" as const;
};

const agreementBadge = (s: string) => {
  if (s === "signed") return "green" as const;
  if (s === "draft") return "amber" as const;
  if (s === "expired") return "red" as const;
  return "stone" as const;
};

export default function AdminVendors() {
  const { t } = useLocale();
  const [vendors, setVendors] = useState<any[]>([]);
  const [search, setSearch] = useState("");
  const [eventId, setEventId] = useState("");
  const [serviceType, setServiceType] = useState("");
  const [status, setStatus] = useState("");
  const [agreementStatus, setAgreementStatus] = useState("");

  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    cost: "",
    status: "",
    agreement_status: "",
    contract_url: "",
    visible_to_attendees: false,
  });
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const fetchVendors = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const params: any = {};
      if (search) params.q = search;
      if (eventId) params.event_id = Number(eventId);
      if (serviceType) params.service_type = serviceType;
      if (status) params.status = status;
      if (agreementStatus) params.agreement_status = agreementStatus;
      const data = await api.admin.listVendors(params);
      setVendors(data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchVendors(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchVendors();
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t("admin.delete_vendor_confirm"))) return;
    await api.admin.deleteVendor(id);
    fetchVendors();
  };

  const startEdit = (v: any) => {
    setEditId(v.id);
    setEditForm({
      cost: String(v.cost ?? ""),
      status: v.status,
      agreement_status: v.agreement_status,
      contract_url: v.contract_url || "",
      visible_to_attendees: v.visible_to_attendees,
    });
  };

  const cancelEdit = () => setEditId(null);

  const saveEdit = async () => {
    if (editId === null) return;
    await api.admin.updateVendor(editId, {
      cost: editForm.cost ? Number(editForm.cost) : null,
      status: editForm.status,
      agreement_status: editForm.agreement_status,
      contract_url: editForm.contract_url || null,
      visible_to_attendees: editForm.visible_to_attendees,
    });
    setEditId(null);
    fetchVendors();
  };

  const formatMoney = (cents: number | null) => {
    if (cents == null) return "—";
    return (cents / 100).toFixed(2) + " EUR";
  };

  if (loading) return <div className="p-6"><ListSkeleton rows={6} /></div>;
  if (loadError) return <div className="p-6 max-w-xl"><LoadError onRetry={fetchVendors} /></div>;

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 px-6 py-4 border-b border-primary-200/40 dark:border-stone-800">
        <h1 className="font-display text-xl font-semibold text-stone-800 dark:text-stone-100">Vendors</h1>
        <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">Manage event vendor applications and listings</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex gap-3 mb-5 items-center flex-wrap">
          <div className="flex gap-2">
            <input
              type="number"
              value={eventId}
              onChange={(e) => setEventId(e.target.value)}
              placeholder={t("admin.event_id")}
              className="border border-stone-200/60 dark:border-stone-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-stone-900 font-serif focus:outline-none focus:ring-2 focus:ring-primary-500/15 focus:border-primary-400 transition w-28"
            />
            <select
              value={serviceType}
              onChange={(e) => setServiceType(e.target.value)}
              className="border border-stone-200/60 dark:border-stone-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-stone-900 font-serif focus:outline-none focus:ring-2 focus:ring-primary-500/15 focus:border-primary-400 transition"
            >
              <option value="">{t("admin.all_services")}</option>
              {SERVICE_TYPES.map((s) => (
                <option key={s} value={s}>{t("admin.service_" + s)}</option>
              ))}
            </select>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="border border-stone-200/60 dark:border-stone-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-stone-900 font-serif focus:outline-none focus:ring-2 focus:ring-primary-500/15 focus:border-primary-400 transition"
            >
              <option value="">{t("admin.all_statuses")}</option>
              {STATUSES.map((s) => (
                <option key={s} value={s}>{t("admin.status_" + s)}</option>
              ))}
            </select>
            <select
              value={agreementStatus}
              onChange={(e) => setAgreementStatus(e.target.value)}
              className="border border-stone-200/60 dark:border-stone-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-stone-900 font-serif focus:outline-none focus:ring-2 focus:ring-primary-500/15 focus:border-primary-400 transition"
            >
              <option value="">{t("admin.all_agreements")}</option>
              {AGREEMENT_STATUSES.map((s) => (
                <option key={s} value={s}>{t("admin.agreement_" + s)}</option>
              ))}
            </select>
          </div>
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 dark:text-stone-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("admin.search_vendor_placeholder")}
                className="pl-9 pr-3 py-2 border border-stone-200/60 dark:border-stone-700 rounded-xl text-sm bg-white dark:bg-stone-900 font-serif focus:outline-none focus:ring-2 focus:ring-primary-500/15 focus:border-primary-400 transition w-56"
              />
            </div>
            <Button type="submit" size="sm" variant="primary">{t("admin.search")}</Button>
          </form>
        </div>

        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/60 dark:border-stone-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 dark:border-stone-800">
                  <th className="text-left px-4 py-3 text-xs font-display font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider">{t("admin.event")}</th>
                  <th className="text-left px-4 py-3 text-xs font-display font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider">{t("admin.vendor_name")}</th>
                  <th className="text-left px-4 py-3 text-xs font-display font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider hidden sm:table-cell">{t("admin.service")}</th>
                  <th className="text-right px-4 py-3 text-xs font-display font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider">{t("admin.cost")}</th>
                  <th className="text-left px-4 py-3 text-xs font-display font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider">{t("admin.status")}</th>
                  <th className="text-left px-4 py-3 text-xs font-display font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider hidden sm:table-cell">{t("admin.agreement")}</th>
                  <th className="text-left px-4 py-3 text-xs font-display font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider hidden md:table-cell">{t("admin.contract")}</th>
                  <th className="text-center px-4 py-3 text-xs font-display font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider">{t("admin.visible")}</th>
                  <th className="text-left px-4 py-3 text-xs font-display font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider hidden lg:table-cell">{t("admin.date")}</th>
                  <th className="text-right px-4 py-3 text-xs font-display font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider">{t("admin.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {vendors.map((v: any) => (
                  <tr key={v.id} className="border-b border-stone-50 dark:border-stone-800/50 last:border-0 hover:bg-stone-50/50 dark:hover:bg-stone-800/30 transition">
                    <td className="px-4 py-3">
                      <span className="text-stone-600 dark:text-stone-300 font-serif text-xs">#{v.event_id}</span>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-stone-800 dark:text-stone-100 font-serif truncate max-w-[200px]">{v.name}</p>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <Badge variant="sage" className="text-[10px]">{v.service_type}</Badge>
                    </td>
                    <td className="px-4 py-3 text-right font-serif text-stone-700 dark:text-stone-200">{formatMoney(v.cost)}</td>
                    <td className="px-4 py-3">
                      <Badge variant={statusBadge(v.status)} className="text-[10px]">{v.status}</Badge>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <Badge variant={agreementBadge(v.agreement_status)} className="text-[10px]">{v.agreement_status}</Badge>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {v.contract_url ? (
                        <a href={v.contract_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 transition">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      ) : (
                        <span className="text-stone-300 dark:text-stone-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center">
                      {v.visible_to_attendees ? (
                        <Check className="w-4 h-4 text-emerald-500 mx-auto" />
                      ) : (
                        <span className="text-stone-300 dark:text-stone-600">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-xs text-stone-400 dark:text-stone-500 font-serif">{v.created_at ? new Date(v.created_at).toLocaleDateString() : "—"}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Tooltip content={t("admin.edit")}>
                          <Button size="xs" variant="ghost" onClick={() => startEdit(v)} aria-label={t("admin.edit")}>
                            <Pencil className="w-4 h-4" />
                          </Button>
                        </Tooltip>
                        <Tooltip content={t("admin.delete")}>
                          <Button size="xs" variant="danger" onClick={() => handleDelete(v.id)} aria-label={t("admin.delete")}>
                            <Trash2 className="w-4 h-4" />
                          </Button>
                        </Tooltip>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {vendors.length === 0 && (
            <EmptyState title="No results" message={t("admin.no_vendors")} />
          )}
        </div>
      </div>

      {editId !== null && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 dark:bg-black/50" onClick={cancelEdit}>
          <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/60 dark:border-stone-800 shadow-xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-display font-semibold text-stone-800 dark:text-stone-100">{t("admin.edit_vendor")}</h2>
              <button onClick={cancelEdit} className="p-1 text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:hover:text-stone-300 transition">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-xs font-display font-medium text-stone-500 dark:text-stone-400 mb-1">{t("admin.cost")} (EUR)</label>
                <input
                  type="number"
                  value={editForm.cost}
                  onChange={(e) => setEditForm({ ...editForm, cost: e.target.value })}
                  className="w-full border border-stone-200/60 dark:border-stone-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-stone-900 font-serif focus:outline-none focus:ring-2 focus:ring-primary-500/15 focus:border-primary-400 transition"
                />
              </div>
              <div>
                <label className="block text-xs font-display font-medium text-stone-500 dark:text-stone-400 mb-1">{t("admin.status")}</label>
                <select
                  value={editForm.status}
                  onChange={(e) => setEditForm({ ...editForm, status: e.target.value })}
                  className="w-full border border-stone-200/60 dark:border-stone-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-stone-900 font-serif focus:outline-none focus:ring-2 focus:ring-primary-500/15 focus:border-primary-400 transition"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{t("admin.status_" + s)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-display font-medium text-stone-500 dark:text-stone-400 mb-1">{t("admin.agreement")}</label>
                <select
                  value={editForm.agreement_status}
                  onChange={(e) => setEditForm({ ...editForm, agreement_status: e.target.value })}
                  className="w-full border border-stone-200/60 dark:border-stone-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-stone-900 font-serif focus:outline-none focus:ring-2 focus:ring-primary-500/15 focus:border-primary-400 transition"
                >
                  {AGREEMENT_STATUSES.map((s) => (
                    <option key={s} value={s}>{t("admin.agreement_" + s)}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-display font-medium text-stone-500 dark:text-stone-400 mb-1">{t("admin.contract_url")}</label>
                <input
                  type="url"
                  value={editForm.contract_url}
                  onChange={(e) => setEditForm({ ...editForm, contract_url: e.target.value })}
                  placeholder="https://..."
                  className="w-full border border-stone-200/60 dark:border-stone-700 rounded-xl px-3 py-2 text-sm bg-white dark:bg-stone-900 font-serif focus:outline-none focus:ring-2 focus:ring-primary-500/15 focus:border-primary-400 transition"
                />
              </div>
              <div className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={editForm.visible_to_attendees}
                  onChange={(e) => setEditForm({ ...editForm, visible_to_attendees: e.target.checked })}
                  className="rounded border-stone-300 dark:border-stone-600 text-primary-600 focus:ring-primary-500"
                />
                <label className="text-sm text-stone-600 dark:text-stone-300 font-serif">{t("admin.visible_to_attendees")}</label>
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button
                onClick={cancelEdit}
                className="px-4 py-2 text-sm font-display font-medium text-stone-600 dark:text-stone-300 bg-stone-100/60 dark:bg-stone-800/60 border border-stone-200/40 dark:border-stone-700 rounded-xl hover:bg-stone-100 dark:hover:bg-stone-800 transition"
              >
                {t("admin.cancel")}
              </button>
              <button
                onClick={saveEdit}
                className="px-4 py-2 text-sm font-display font-medium text-cream bg-primary-600 rounded-xl hover:bg-primary-700 transition"
              >
                {t("admin.save")}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
