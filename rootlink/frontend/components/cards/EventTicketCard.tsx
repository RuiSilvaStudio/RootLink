"use client";

import { QrCode } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

export function EventTicketCard({ ticket, t }: {
  ticket: any;
  t: (key: string, ...args: any[]) => string;
}) {
  return (
    <div className="flex items-center gap-3 bg-primary-50 dark:bg-primary-900/20 rounded-xl p-4" data-rl-component="EventTicketCard">
      <div className="w-16 h-16 bg-white dark:bg-stone-900 rounded-xl flex items-center justify-center border border-primary-100 dark:border-stone-700">
        <QrCode className="w-10 h-10 text-stone-500 dark:text-stone-400" />
      </div>
      <div>
        <p className="font-medium text-stone-700 dark:text-stone-200">{t(`events.ticket_type_${ticket.ticket_type}`)} × {ticket.quantity}</p>
        <p className="text-sm text-stone-500 dark:text-stone-400">{t("events.ticket_total")}: €{(ticket.total_paid / 100).toFixed(0)}</p>
        {ticket.checked_in && <Badge variant="green">{t("events.ticket_checked_in")}</Badge>}
      </div>
    </div>
  );
}
