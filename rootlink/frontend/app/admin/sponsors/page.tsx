"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/locale-context";
import { Badge } from "@/components/ui/Badge";
import { Button, EmptyState, Tooltip } from "@/components/ui";
import { ListSkeleton } from "@/components/ui/LoadingSkeleton";
import { LoadError } from "@/components/studio/LoadError";
import { Search, Pencil, Trash2, X, Check } from "lucide-react";

const tierVariant: Record<string, "sage" | "blue" | "amber" | "earth"> = {
  community: "sage",
  silver: "blue",
  gold: "amber",
  platinum: "earth",
};

const agreementVariant: Record<string, "stone" | "amber" | "green" | "red"> = {
  none: "stone",
  draft: "amber",
  signed: "green",
  expired: "red",
};

export default function AdminSponsors() {
  const { t } = useLocale();
  const [sponsors, setSponsors] = useState<any[]>([]);
  const [eventId, setEventId] = useState("");
  const [tier, setTier] = useState("all");
  const [agreementStatus, setAgreementStatus] = useState("all");
  const [isActive, setIsActive] = useState("all");
  const [search, setSearch] = useState("");
  const [editId, setEditId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState({
    contribution: "",
    agreement_status: "",
    agreement_url: "",
    tier: "",
    is_active: true,
    visible_to_attendees: true,
  });
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const fetchSponsors = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const params: any = {};
      if (eventId) params.event_id = Number(eventId);
      if (tier !== "all") params.tier = tier;
      if (agreementStatus !== "all") params.agreement_status = agreementStatus;
      if (isActive === "active_only") params.is_active = true;
      else if (isActive === "inactive_only") params.is_active = false;
      if (search) params.q = search;
      const data = await api.admin.listSponsors(params);
      setSponsors(data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { fetchSponsors(); }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchSponsors();
  };

  const handleDelete = async (id: number) => {
    if (!confirm(t("admin.delete_confirm_sponsor"))) return;
    await api.admin.deleteSponsor(id);
    fetchSponsors();
  };

  const startEdit = (s: any) => {
    setEditId(s.id);
    setEditForm({
      contribution: String(s.contribution),
      agreement_status: s.agreement_status ?? "none",
      agreement_url: s.agreement_url ?? "",
      tier: s.tier ?? "community",
      is_active: s.is_active ?? true,
      visible_to_attendees: s.visible_to_attendees ?? true,
    });
  };

  const cancelEdit = () => setEditId(null);

  const saveEdit = async (id: number) => {
    await api.admin.updateSponsor(id, {
      contribution: Number(editForm.contribution),
      agreement_status: editForm.agreement_status,
      agreement_url: editForm.agreement_url,
      tier: editForm.tier,
      is_active: editForm.is_active,
      visible_to_attendees: editForm.visible_to_attendees,
    });
    setEditId(null);
    fetchSponsors();
  };

  if (loading) return <div className="p-6"><ListSkeleton rows={6} /></div>;
  if (loadError) return <div className="p-6 max-w-xl"><LoadError onRetry={fetchSponsors} /></div>;

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 px-6 py-4 border-b border-primary-200/40 dark:border-stone-800">
        <h1 className="font-display text-xl font-semibold text-stone-800 dark:text-stone-100">Sponsors</h1>
        <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">Manage sponsor agreements and tiers</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="flex flex-wrap gap-2 mb-5 items-end">
          <input
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            placeholder={t("admin.col_event")}
            className="px-3 py-2 border border-stone-200/60 dark:border-stone-700 rounded-xl text-sm bg-white dark:bg-stone-900 font-serif focus:outline-none focus:ring-2 focus:ring-primary-500/15 focus:border-primary-400 transition w-28"
          />
          <select
            value={tier}
            onChange={(e) => setTier(e.target.value)}
            className="px-3 py-2 border border-stone-200/60 dark:border-stone-700 rounded-xl text-sm bg-white dark:bg-stone-900 font-serif focus:outline-none focus:ring-2 focus:ring-primary-500/15 focus:border-primary-400 transition"
          >
            <option value="all">{t("admin.filter_tier")}</option>
            <option value="community">{t("admin.tier_community")}</option>
            <option value="silver">{t("admin.tier_silver")}</option>
            <option value="gold">{t("admin.tier_gold")}</option>
            <option value="platinum">{t("admin.tier_platinum")}</option>
          </select>
          <select
            value={agreementStatus}
            onChange={(e) => setAgreementStatus(e.target.value)}
            className="px-3 py-2 border border-stone-200/60 dark:border-stone-700 rounded-xl text-sm bg-white dark:bg-stone-900 font-serif focus:outline-none focus:ring-2 focus:ring-primary-500/15 focus:border-primary-400 transition"
          >
            <option value="all">{t("admin.filter_agreement_status")}</option>
            <option value="none">{t("admin.status_none")}</option>
            <option value="draft">{t("admin.status_draft")}</option>
            <option value="signed">{t("admin.status_signed")}</option>
            <option value="expired">{t("admin.status_expired")}</option>
          </select>
          <select
            value={isActive}
            onChange={(e) => setIsActive(e.target.value)}
            className="px-3 py-2 border border-stone-200/60 dark:border-stone-700 rounded-xl text-sm bg-white dark:bg-stone-900 font-serif focus:outline-none focus:ring-2 focus:ring-primary-500/15 focus:border-primary-400 transition"
          >
            <option value="all">{t("admin.filter_active")}</option>
            <option value="active_only">{t("admin.filter_active_only")}</option>
            <option value="inactive_only">{t("admin.filter_inactive_only")}</option>
          </select>
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 dark:text-stone-500" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder={t("admin.search_placeholder")}
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
                  <th className="text-left px-4 py-3 text-xs font-display font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider">{t("admin.col_event")}</th>
                  <th className="text-left px-4 py-3 text-xs font-display font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider">{t("admin.col_name")}</th>
                  <th className="text-left px-4 py-3 text-xs font-display font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider hidden sm:table-cell">{t("admin.col_tier")}</th>
                  <th className="text-left px-4 py-3 text-xs font-display font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider hidden sm:table-cell">{t("admin.col_contribution")}</th>
                  <th className="text-left px-4 py-3 text-xs font-display font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider hidden md:table-cell">{t("admin.col_contact")}</th>
                  <th className="text-left px-4 py-3 text-xs font-display font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider hidden md:table-cell">{t("admin.col_agreement")}</th>
                  <th className="text-center px-4 py-3 text-xs font-display font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider hidden lg:table-cell">{t("admin.col_visible")}</th>
                  <th className="text-left px-4 py-3 text-xs font-display font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider hidden lg:table-cell">{t("admin.col_date")}</th>
                  <th className="text-right px-4 py-3 text-xs font-display font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider">{t("admin.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {sponsors.map((s: any) => (
                  <tr key={s.id} className="border-b border-stone-50 dark:border-stone-800/50 last:border-0 hover:bg-stone-50/50 dark:hover:bg-stone-800/30 transition">
                    <td className="px-4 py-3">
                      <span className="text-stone-600 dark:text-stone-300 font-serif">#{s.event_id}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="font-medium text-stone-800 dark:text-stone-100 font-serif">{s.name}</span>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      {editId === s.id ? (
                        <select
                          value={editForm.tier}
                          onChange={(e) => setEditForm({ ...editForm, tier: e.target.value })}
                          className="px-2 py-1 border border-stone-200/60 dark:border-stone-700 rounded-lg text-xs bg-white dark:bg-stone-900 font-serif focus:outline-none focus:ring-2 focus:ring-primary-500/15"
                        >
                          <option value="community">{t("admin.tier_community")}</option>
                          <option value="silver">{t("admin.tier_silver")}</option>
                          <option value="gold">{t("admin.tier_gold")}</option>
                          <option value="platinum">{t("admin.tier_platinum")}</option>
                        </select>
                      ) : (
                        <Badge variant={tierVariant[s.tier] ?? "sage"} className="text-[10px]">{s.tier}</Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      {editId === s.id ? (
                        <input
                          type="number"
                          value={editForm.contribution}
                          onChange={(e) => setEditForm({ ...editForm, contribution: e.target.value })}
                          className="px-2 py-1 border border-stone-200/60 dark:border-stone-700 rounded-lg text-xs bg-white dark:bg-stone-900 font-serif focus:outline-none focus:ring-2 focus:ring-primary-500/15 w-28"
                        />
                      ) : (
                        <span className="font-serif text-stone-700 dark:text-stone-200">{(s.contribution / 100).toFixed(2)} EUR</span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      <div className="min-w-0">
                        <p className="font-serif text-stone-800 dark:text-stone-100 truncate">{s.contact_name ?? "—"}</p>
                        <p className="text-xs text-stone-400 dark:text-stone-500 font-serif truncate">{s.contact_email ?? ""}</p>
                      </div>
                    </td>
                    <td className="px-4 py-3 hidden md:table-cell">
                      {editId === s.id ? (
                        <select
                          value={editForm.agreement_status}
                          onChange={(e) => setEditForm({ ...editForm, agreement_status: e.target.value })}
                          className="px-2 py-1 border border-stone-200/60 dark:border-stone-700 rounded-lg text-xs bg-white dark:bg-stone-900 font-serif focus:outline-none focus:ring-2 focus:ring-primary-500/15"
                        >
                          <option value="none">{t("admin.status_none")}</option>
                          <option value="draft">{t("admin.status_draft")}</option>
                          <option value="signed">{t("admin.status_signed")}</option>
                          <option value="expired">{t("admin.status_expired")}</option>
                        </select>
                      ) : (
                        <Badge variant={agreementVariant[s.agreement_status] ?? "stone"} className="text-[10px]">
                          {s.agreement_status ?? "none"}
                        </Badge>
                      )}
                    </td>
                    <td className="px-4 py-3 text-center hidden lg:table-cell">
                      {editId === s.id ? (
                        <label className="inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={editForm.visible_to_attendees}
                            onChange={(e) => setEditForm({ ...editForm, visible_to_attendees: e.target.checked })}
                            className="w-4 h-4 rounded border-stone-300 dark:border-stone-600 text-primary-600 focus:ring-primary-500/15"
                          />
                        </label>
                      ) : (
                        <span className={`text-xs font-serif ${s.visible_to_attendees ? "text-green-600 dark:text-emerald-400" : "text-stone-300 dark:text-stone-600"}`}>
                          {s.visible_to_attendees ? "✓" : "—"}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 hidden lg:table-cell">
                      <span className="text-stone-400 dark:text-stone-500 font-serif text-xs">
                        {s.created_at ? new Date(s.created_at).toLocaleDateString() : "—"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {editId === s.id ? (
                        <div className="flex gap-1 justify-end">
                          <Tooltip content={t("admin.save")}>
                            <Button size="xs" variant="primary" onClick={() => saveEdit(s.id)} aria-label={t("admin.save")}>
                              <Check className="w-3.5 h-3.5" />
                            </Button>
                          </Tooltip>
                          <Tooltip content={t("admin.cancel")}>
                            <Button size="xs" variant="ghost" onClick={cancelEdit} aria-label={t("admin.cancel")}>
                              <X className="w-3.5 h-3.5" />
                            </Button>
                          </Tooltip>
                        </div>
                      ) : (
                        <div className="flex gap-1 justify-end">
                          <Tooltip content={t("admin.edit")}>
                            <Button size="xs" variant="ghost" onClick={() => startEdit(s)} aria-label={t("admin.edit")}>
                              <Pencil className="w-3.5 h-3.5" />
                            </Button>
                          </Tooltip>
                          <Tooltip content={t("admin.delete")}>
                            <Button size="xs" variant="danger" onClick={() => handleDelete(s.id)} aria-label={t("admin.delete")}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                          </Tooltip>
                        </div>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {sponsors.length === 0 && (
            <EmptyState title="No results" message={t("admin.no_sponsors")} />
          )}
        </div>
      </div>
    </div>
  );
}
