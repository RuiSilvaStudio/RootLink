"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Rss, FileText, Calendar, Users, BookOpen, MessageSquare, Heart, Ticket, UserPlus, ArrowRight, Package } from "lucide-react";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/locale-context";
import { Badge } from "@/components/ui/Badge";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ListSkeleton } from "@/components/ui/LoadingSkeleton";

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

function FeedItem({ item }: { item: any }) {
  const Icon = typeIcons[item.type] || Rss;
  const colorClass = typeColors[item.type] || "bg-primary-100 dark:bg-primary-950/20 text-primary-600";
  const link = item.link || "#";

  return (
    <Link
      href={link}
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

export default function FeedPage() {
  const { t } = useLocale();
  const router = useRouter();
  const [feed, setFeed] = useState<{ following: any[]; discover: any[] }>({ following: [], discover: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      router.push("/auth/login");
      return;
    }
    api.social.feed().then(setFeed).catch(() => {}).finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-12">
      <PageHeader
        icon={<Rss className="w-5 h-5 text-primary-500" />}
        title={t("feed.title")}
        subtitle={t("feed.subtitle")}
      />

      {loading ? (
        <div className="space-y-8">
          <div>
            <div className="h-5 w-32 bg-primary-100 dark:bg-primary-950/20/60 rounded animate-pulse mb-4" />
            <ListSkeleton count={3} />
          </div>
          <div>
            <div className="h-5 w-32 bg-primary-100 dark:bg-primary-950/20/60 rounded animate-pulse mb-4" />
            <ListSkeleton count={4} />
          </div>
        </div>
      ) : (
        <div className="space-y-10 mt-8">
          {/* Following section */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-display font-semibold text-stone-800 dark:text-stone-100 dark:text-stone-200">
                {t("feed.following")}
              </h2>
              <div className="flex-1 h-px bg-primary-100 dark:bg-primary-950/20 dark:bg-primary-800/30" />
              <span className="text-xs text-stone-00 dark:text-stone-500">{feed.following.length}</span>
            </div>

            {feed.following.length === 0 ? (
              <div className="bg-primary-50/40 dark:bg-primary-900/10 rounded-2xl p-6 text-center border border-primary-100/40 dark:border-primary-800/20">
                <p className="text-sm text-stone-500 dark:text-stone-00 dark:text-stone-500 font-serif mb-4">
                  {t("feed.following_empty")}
                </p>
                <Link
                  href="/network"
                  className="inline-flex items-center gap-1.5 text-sm font-display font-medium text-primary-600 dark:text-primary-400 hover:text-primary-700 transition"
                >
                  {t("feed.discover_people")} <ArrowRight className="w-3.5 h-3.5" />
                </Link>
              </div>
            ) : (
              <div className="space-y-3">
                {feed.following.map((item, i) => (
                  <FeedItem key={`f-${i}`} item={item} />
                ))}
              </div>
            )}
          </section>

          {/* Discover section */}
          <section>
            <div className="flex items-center gap-2 mb-4">
              <h2 className="text-lg font-display font-semibold text-stone-800 dark:text-stone-100 dark:text-stone-200">
                {t("feed.discover")}
              </h2>
              <div className="flex-1 h-px bg-primary-100 dark:bg-primary-950/20 dark:bg-primary-800/30" />
              <span className="text-xs text-stone-00 dark:text-stone-500">{feed.discover.length}</span>
            </div>

            {feed.discover.length === 0 ? (
              <EmptyState
                icon={<Rss className="w-7 h-7" />}
                title={t("feed.empty")}
                message={t("feed.empty_desc")}
              />
            ) : (
              <div className="space-y-3">
                {feed.discover.map((item, i) => (
                  <FeedItem key={`d-${i}`} item={item} />
                ))}
              </div>
            )}
          </section>
        </div>
      )}
    </div>
  );
}
