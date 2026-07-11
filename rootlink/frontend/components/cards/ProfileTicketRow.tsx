"use client";

import Link from "next/link";
import { QrCode, CheckCircle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

export function ProfileTicketRow({ ticket, t }: { ticket: any; t: (key: string, ...args: any[]) => string }) {
  return (
    <Link key={ticket.id} href={`/events/${ticket.event_id}`} className="flex items-center gap-3 bg-white dark:bg-stone-900 rounded-xl border border-primary-100/40 dark:border-stone-700/40 p-4 hover:shadow-md transition" data-rl-component="ProfileTicketRow">
      <div className="w-12 h-12 rounded-xl bg-sky-100 flex items-center justify-center shrink-0">
        <QrCode className="w-6 h-6 text-sky-600" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-stone-700 dark:text-stone-300 truncate">{ticket.event_title}</p>
        <p className="text-xs text-stone-400 dark:text-stone-500">{ticket.ticket_type} × {ticket.quantity} — €{(ticket.total_paid / 100).toFixed(0)}</p>
        {ticket.event_date && <p className="text-xs text-stone-400 dark:text-stone-500">{new Date(ticket.event_date).toLocaleDateString()}</p>}
      </div>
      {ticket.checked_in ? (
        <Badge variant="green"><CheckCircle className="w-3 h-3 mr-1" /> {t("profile.checked_in")}</Badge>
      ) : (
        <Badge variant="stone">{t("profile.not_checked_in")}</Badge>
      )}
    </Link>
  );
}
