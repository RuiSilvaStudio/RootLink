"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/locale-context";
import { Badge } from "@/components/ui/Badge";
import { Search } from "lucide-react";

export default function AdminDonations() {
  const { t } = useLocale();
  const [donations, setDonations] = useState<any[]>([]);
  const [stats, setStats] = useState<{ total_raised: number; total_count: number } | null>(null);
  const [eventId, setEventId] = useState("");
  const [isAnonymous, setIsAnonymous] = useState("");
  const [paymentStatus, setPaymentStatus] = useState("");
  const [search, setSearch] = useState("");

  const fetchDonations = async () => {
    const params: any = {};
    if (eventId) params.event_id = Number(eventId);
    if (isAnonymous === "anonymous_only") params.is_anonymous = true;
    else if (isAnonymous === "named_only") params.is_anonymous = false;
    if (paymentStatus) params.payment_status = paymentStatus;
    if (search) params.q = search;
    const data = await api.admin.listDonations(params);
    setDonations(data);
  };

  const fetchStats = async () => {
    const data = await api.admin.donationStats();
    setStats(data);
  };

  useEffect(() => {
    fetchDonations();
    fetchStats();
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchDonations();
  };

  const formatMoney = (cents: number, currency: string) => {
    return (cents / 100).toFixed(2) + " " + currency;
  };

  const paymentBadgeVariant = (status: string) => {
    if (status === "completed") return "green";
    if (status === "pending") return "amber";
    return "stone";
  };

  return (
    <div>
      <div className="mb-6">
        <Badge variant="sage" className="mb-3">{t("admin.donations")}</Badge>
        <h1 className="text-3xl sm:text-4xl font-display font-semibold text-stone-800 dark:text-stone-100 leading-[1.08]">
          {t("admin.donations_title")}
        </h1>
      </div>

      {stats && (
        <div className="flex gap-4 mb-5">
          <div className="bg-white rounded-2xl border border-stone-200/60 px-5 py-3">
            <p className="text-xs text-stone-400 font-display">{t("admin.total_raised")}</p>
            <p className="text-xl font-display font-semibold text-stone-800">{formatMoney(stats.total_raised, "EUR")}</p>
          </div>
          <div className="bg-white rounded-2xl border border-stone-200/60 px-5 py-3">
            <p className="text-xs text-stone-400 font-display">{t("admin.total_donations")}</p>
            <p className="text-xl font-display font-semibold text-stone-800">{stats.total_count}</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-5">
        <form onSubmit={handleSearch} className="flex gap-2 flex-wrap">
          <input
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            placeholder={t("admin.filter_event_id")}
            type="number"
            className="px-3 py-2 border border-stone-200/60 rounded-xl text-sm bg-white font-serif focus:outline-none focus:ring-2 focus:ring-primary-500/15 focus:border-primary-400 transition w-32"
          />
          <select
            value={isAnonymous}
            onChange={(e) => setIsAnonymous(e.target.value)}
            className="px-3 py-2 border border-stone-200/60 rounded-xl text-sm bg-white font-serif focus:outline-none focus:ring-2 focus:ring-primary-500/15 focus:border-primary-400 transition"
          >
            <option value="">{t("admin.all_donors")}</option>
            <option value="anonymous_only">{t("admin.anonymous_only")}</option>
            <option value="named_only">{t("admin.named_only")}</option>
          </select>
          <select
            value={paymentStatus}
            onChange={(e) => setPaymentStatus(e.target.value)}
            className="px-3 py-2 border border-stone-200/60 rounded-xl text-sm bg-white font-serif focus:outline-none focus:ring-2 focus:ring-primary-500/15 focus:border-primary-400 transition"
          >
            <option value="">{t("admin.all_payments")}</option>
            <option value="completed">{t("admin.completed")}</option>
            <option value="pending">{t("admin.pending")}</option>
            <option value="refunded">{t("admin.refunded")}</option>
          </select>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder={t("admin.search_donor_placeholder")}
              className="pl-9 pr-3 py-2 border border-stone-200/60 rounded-xl text-sm bg-white font-serif focus:outline-none focus:ring-2 focus:ring-primary-500/15 focus:border-primary-400 transition w-56"
            />
          </div>
          <button type="submit" className="px-4 py-2 bg-primary-600 text-cream rounded-xl text-sm font-display font-medium hover:bg-primary-700 transition">
            {t("admin.search")}
          </button>
        </form>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100">
                <th className="text-left px-4 py-3 text-xs font-display font-semibold text-stone-400 uppercase tracking-wider">{t("admin.event")}</th>
                <th className="text-left px-4 py-3 text-xs font-display font-semibold text-stone-400 uppercase tracking-wider">{t("admin.donor")}</th>
                <th className="text-right px-4 py-3 text-xs font-display font-semibold text-stone-400 uppercase tracking-wider">{t("admin.amount")}</th>
                <th className="text-left px-4 py-3 text-xs font-display font-semibold text-stone-400 uppercase tracking-wider hidden sm:table-cell">{t("admin.currency")}</th>
                <th className="text-left px-4 py-3 text-xs font-display font-semibold text-stone-400 uppercase tracking-wider hidden md:table-cell">{t("admin.message")}</th>
                <th className="text-left px-4 py-3 text-xs font-display font-semibold text-stone-400 uppercase tracking-wider hidden sm:table-cell">{t("admin.method")}</th>
                <th className="text-left px-4 py-3 text-xs font-display font-semibold text-stone-400 uppercase tracking-wider">{t("admin.payment")}</th>
                <th className="text-left px-4 py-3 text-xs font-display font-semibold text-stone-400 uppercase tracking-wider hidden sm:table-cell">{t("admin.date")}</th>
              </tr>
            </thead>
            <tbody>
              {donations.map((d: any) => (
                <tr key={d.id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/50 transition">
                  <td className="px-4 py-3">
                    <p className="font-medium text-stone-800 dark:text-stone-100 font-serif truncate max-w-[140px]">{d.event_title || `#${d.event_id}`}</p>
                  </td>
                  <td className="px-4 py-3">
                    {d.is_anonymous ? (
                      <em className="text-stone-400 font-serif">{t("admin.anonymous")}</em>
                    ) : (
                      <p className="font-medium text-stone-800 dark:text-stone-100 font-serif truncate max-w-[160px]">{d.donor_name || d.donor_email || "—"}</p>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <span className="font-display font-semibold text-stone-800">{formatMoney(d.amount, d.currency || "EUR")}</span>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="text-stone-500 font-serif">{d.currency || "EUR"}</span>
                  </td>
                  <td className="px-4 py-3 hidden md:table-cell">
                    <p className="text-stone-500 font-serif truncate max-w-[200px]">{d.message ? d.message.length > 50 ? d.message.slice(0, 50) + "…" : d.message : "—"}</p>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="text-stone-500 font-serif">{d.payment_method || "—"}</span>
                  </td>
                  <td className="px-4 py-3">
                    <Badge variant={paymentBadgeVariant(d.payment_status)} className="text-[10px]">{d.payment_status}</Badge>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <span className="text-stone-400 font-serif text-xs">{d.created_at ? new Date(d.created_at).toLocaleDateString() : "—"}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {donations.length === 0 && (
          <p className="text-stone-400 text-sm py-8 text-center font-serif">{t("admin.no_donations")}</p>
        )}
      </div>
    </div>
  );
}
