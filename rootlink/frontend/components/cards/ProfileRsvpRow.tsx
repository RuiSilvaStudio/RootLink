"use client";

import Link from "next/link";
import { Calendar } from "lucide-react";

export function ProfileRsvpRow({ rsvp }: { rsvp: any }) {
  return (
    <Link className="flex items-center gap-3 bg-white dark:bg-stone-900 rounded-xl border border-primary-100/40 dark:border-stone-700/40 p-3 hover:shadow-md transition" data-rl-component="ProfileRsvpRow" href={`/events/${rsvp.event_id}`}>
      <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
        <Calendar className="w-5 h-5 text-amber-600" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium text-stone-700 dark:text-stone-300 truncate">{rsvp.event_title}</p>
        <p className="text-xs text-stone-400 dark:text-stone-500">{rsvp.event_date ? new Date(rsvp.event_date).toLocaleDateString() : ""}{rsvp.event_location ? ` · ${rsvp.event_location}` : ""}</p>
      </div>
    </Link>
  );
}
