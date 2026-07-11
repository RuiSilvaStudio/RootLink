"use client";

import Link from "next/link";
import { Rss, FileText, Calendar, Users, BookOpen, MessageSquare, Heart, Ticket, Package } from "lucide-react";
import { Badge } from "@/components/ui/Badge";

const typeIcons: Record<string, any> = {
  content: FileText,
  event: Calendar,
  group: Users,
  course: BookOpen,
  comment: MessageSquare,
  rsvp: Calendar,
  donation: Heart,
  ticket: Ticket,
  listing: Package,
};

const typeColors: Record<string, string> = {
  content: "bg-primary-100 dark:bg-primary-950/20 text-primary-600",
  event: "bg-earth-100 text-earth-600",
  group: "bg-blue-100 text-blue-600",
  course: "bg-green-100 text-green-600",
  comment: "bg-stone-100 text-stone-600 dark:text-stone-300",
  rsvp: "bg-amber-100 text-amber-600",
  donation: "bg-rust-100 text-rust-600",
  ticket: "bg-sky-100 text-sky-600",
  listing: "bg-primary-100 dark:bg-primary-950/20 text-primary-600",
};

const typeLabels: Record<string, string> = {
  content: "Article",
  event: "Event",
  group: "Group",
  course: "Course",
  comment: "Comment",
  rsvp: "RSVP",
  donation: "Donation",
  ticket: "Ticket",
  listing: "Listing",
};

export function FeedItemCard({ item }: { item: any }) {
  const Icon = typeIcons[item.type] || Rss;
  const colorClass = typeColors[item.type] || "bg-primary-100 dark:bg-primary-950/20 text-primary-600";
  const link = item.link || "#";

  return (
    <Link
      href={link}
      data-rl-component="FeedItemCard"
      className="rounded-2xl border border-primary-100/40 bg-white dark:bg-stone-900 p-5 flex items-start gap-4 transition-all hover:shadow-md hover:border-primary-200/60 group"
    >
      <div className={`w-10 h-10 rounded-xl ${colorClass} flex items-center justify-center shrink-0 mt-0.5`}>
        <Icon className="w-5 h-5" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-stone-700 dark:text-stone-300 text-sm">
          <span className="font-medium text-stone-800 dark:text-stone-100 dark:text-stone-200">{item.actor_name}</span>{" "}
          <span className="text-stone-500">{item.action}</span>{" "}
          <span className="font-medium text-primary-700 dark:text-primary-400 group-hover:text-primary-600 transition">{item.target.title}</span>
          {item.type === "donation" && item.amount && (
            <span className="text-stone-500"> — €{(item.amount / 100).toFixed(0)}</span>
          )}
        </p>
        {item.body_preview && (
          <p className="text-xs text-stone-00 dark:text-stone-500 mt-1 italic line-clamp-1">&quot;{item.body_preview}&quot;</p>
        )}
        <p className="text-xs text-stone-00 dark:text-stone-500 mt-1.5">
          {item.created_at ? new Date(item.created_at).toLocaleString() : ""}
        </p>
      </div>
      <Badge variant="stone" className="shrink-0 capitalize">{typeLabels[item.type] || item.type}</Badge>
    </Link>
  );
}
