"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/locale-context";
import { Badge } from "@/components/ui/Badge";
import { Search, Check, X } from "lucide-react";

export default function AdminTickets() {
  const { t } = useLocale();
  const [tickets, setTickets] = useState<any[]>([]);
  const [stats, setStats] = useState<{ total_tickets: number; total_revenue: number } | null>(null);
  const [eventId, setEventId] = useState("");
  const [ticketType, setTicketType] = useState("all");
  const [paymentStatus, setPaymentStatus] = useState("all");
  const [search, setSearch] = useState("");

  const fetchData = async () => {
    const params: any = {};
    if (eventId) params.event_id = Number(eventId);
    if (ticketType !== "all") params.ticket_type = ticketType;
    if (paymentStatus !== "all") params.payment_status = paymentStatus;
    if (search) params.q = search;
    const [ticketsData, statsData] = await Promise.all([
      api.admin.listTickets(params),
      api.admin.ticketStats(),
    ]);
    setTickets(ticketsData);
    setStats(statsData);
  };

  useEffect(() => { fetchData(); }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    fetchData();
  };

  const formatMoney = (cents: number) => `${(cents / 100).toFixed(2)} EUR`;

  const paymentBadge = (status: string) => {
    const variants: Record<string, "green" | "earth" | "stone"> = {
      completed: "green",
      pending: "earth",
      refunded: "stone",
    };
    return <Badge variant={variants[status] || "stone"} className="text-[10px]">{status}</Badge>;
  };

  const typeBadge = (type: string) => (
    <Badge variant="sage" className="text-[10px]">{type}</Badge>
  );

  return (
    <div>
      <div className="mb-6">
        <Badge variant="sage" className="mb-3">{t("admin.tickets")}</Badge>
        <h1 className="text-3xl sm:text-4xl font-display font-semibold text-stone-800 dark:text-stone-100 leading-[1.08]">
          {t("admin.tickets_management")}
        </h1>
      </div>

      {stats && (
        <div className="flex gap-4 mb-5">
          <div className="bg-white rounded-2xl border border-stone-200/60 px-5 py-3">
            <p className="text-xs text-stone-400 font-display uppercase tracking-wider">{t("admin.total_sold")}</p>
            <p className="text-2xl font-display font-semibold text-stone-800">{stats.total_tickets}</p>
          </div>
          <div className="bg-white rounded-2xl border border-stone-200/60 px-5 py-3">
            <p className="text-xs text-stone-400 font-display uppercase tracking-wider">{t("admin.total_revenue")}</p>
            <p className="text-2xl font-display font-semibold text-stone-800">{formatMoney(stats.total_revenue)}</p>
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-2 mb-5">
        <form onSubmit={handleSearch} className="flex gap-2 flex-wrap">
          <input
            type="number"
            value={eventId}
            onChange={(e) => setEventId(e.target.value)}
            placeholder={t("admin.event_id")}
            className="px-3 py-2 border border-stone-200/60 rounded-xl text-sm bg-white font-serif focus:outline-none focus:ring-2 focus:ring-primary-500/15 focus:border-primary-400 transition w-32"
          />
          <select
            value={ticketType}
            onChange={(e) => setTicketType(e.target.value)}
            className="px-3 py-2 border border-stone-200/60 rounded-xl text-sm bg-white font-serif focus:outline-none focus:ring-2 focus:ring-primary-500/15 focus:border-primary-400 transition"
          >
            <option value="all">{t("admin.all_types")}</option>
            <option value="regular">{t("admin.regular")}</option>
            <option value="early_bird">{t("admin.early_bird")}</option>
            <option value="vip">{t("admin.vip")}</option>
          </select>
          <select
            value={paymentStatus}
            onChange={(e) => setPaymentStatus(e.target.value)}
            className="px-3 py-2 border border-stone-200/60 rounded-xl text-sm bg-white font-serif focus:outline-none focus:ring-2 focus:ring-primary-500/15 focus:border-primary-400 transition"
          >
            <option value="all">{t("admin.all_payments")}</option>
            <option value="completed">{t("admin.completed")}</option>
            <option value="pending">{t("admin.pending")}</option>
            <option value="refunded">{t("admin.refunded")}</option>
          </select>
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
      </div>

      <div className="bg-white rounded-2xl border border-stone-200/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100">
                <th className="text-left px-4 py-3 text-xs font-display font-semibold text-stone-400 uppercase tracking-wider">{t("admin.event")}</th>
                <th className="text-left px-4 py-3 text-xs font-display font-semibold text-stone-400 uppercase tracking-wider">{t("admin.user")}</th>
                <th className="text-left px-4 py-3 text-xs font-display font-semibold text-stone-400 uppercase tracking-wider hidden sm:table-cell">{t("admin.type")}</th>
                <th className="text-right px-4 py-3 text-xs font-display font-semibold text-stone-400 uppercase tracking-wider">{t("admin.price")}</th>
                <th className="text-right px-4 py-3 text-xs font-display font-semibold text-stone-400 uppercase tracking-wider">{t("admin.qty")}</th>
                <th className="text-right px-4 py-3 text-xs font-display font-semibold text-stone-400 uppercase tracking-wider">{t("admin.total")}</th>
                <th className="text-left px-4 py-3 text-xs font-display font-semibold text-stone-400 uppercase tracking-wider hidden sm:table-cell">{t("admin.payment")}</th>
                <th className="text-center px-4 py-3 text-xs font-display font-semibold text-stone-400 uppercase tracking-wider hidden sm:table-cell">{t("admin.checked_in")}</th>
                <th className="text-left px-4 py-3 text-xs font-display font-semibold text-stone-400 uppercase tracking-wider hidden md:table-cell">{t("admin.date")}</th>
              </tr>
            </thead>
            <tbody>
              {tickets.map((tk: any) => (
                <tr key={tk.id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/50 transition">
                  <td className="px-4 py-3">
                    <p className="font-medium text-stone-800 dark:text-stone-100 font-serif truncate max-w-[160px]">{tk.event_title || `#${tk.event_id}`}</p>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-stone-800 dark:text-stone-100 font-serif truncate">{tk.user_name}</p>
                    <p className="text-xs text-stone-400 font-serif truncate">{tk.user_email}</p>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">{typeBadge(tk.ticket_type)}</td>
                  <td className="px-4 py-3 text-right font-serif text-stone-600">{formatMoney(tk.price)}</td>
                  <td className="px-4 py-3 text-right font-serif text-stone-600">{tk.quantity}</td>
                  <td className="px-4 py-3 text-right font-serif font-medium text-stone-800">{formatMoney(tk.total_paid)}</td>
                  <td className="px-4 py-3 hidden sm:table-cell">{paymentBadge(tk.payment_status)}</td>
                  <td className="px-4 py-3 text-center hidden sm:table-cell">
                    {tk.checked_in ? (
                      <Check className="w-4 h-4 text-emerald-500 mx-auto" />
                    ) : (
                      <X className="w-4 h-4 text-stone-300 mx-auto" />
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-stone-400 font-serif hidden md:table-cell">
                    {tk.created_at ? new Date(tk.created_at).toLocaleDateString() : "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {tickets.length === 0 && (
          <p className="text-stone-400 text-sm py-8 text-center font-serif">{t("admin.no_tickets")}</p>
        )}
      </div>
    </div>
  );
}
