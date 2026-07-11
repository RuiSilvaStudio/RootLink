"use client";

import Link from "next/link";
import { Calendar, MapPin, Users, Globe, Clock, Sparkles, Tag, Shield, Building, Heart } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { useLocale } from "@/lib/locale-context";

export function EventListCard({ event, isUpcoming, locale }: { event: any; isUpcoming: boolean; locale: string }) {
  const { t } = useLocale();
  const eventDate = new Date(event.date);
  return (
    <Link
      href={`/events/${event.id}`}
      className={`group rounded-2xl border border-primary-100/40 dark:border-stone-700 bg-white dark:bg-stone-900 overflow-hidden transition-all duration-200 hover:shadow-lg hover:shadow-primary-900/5 dark:hover:shadow-black/20 hover:-translate-y-0.5 animate-fade-in-up ${
        isUpcoming ? "ring-2 ring-primary-200/60 dark:ring-primary-800/40" : ""
      }`}
      data-rl-component="EventListCard"
    >
      {/* Image */}
      <div className="relative h-40 bg-gradient-to-br from-primary-100 to-primary-50 dark:from-primary-900/30 dark:to-primary-950/20 overflow-hidden">
        {event.image_url ? (
          <img
            src={event.image_url}
            alt={event.title}
            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
            onError={(e) => { (e.target as HTMLImageElement).style.display = "none"; }}
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <Calendar className="w-10 h-10 text-primary-200 dark:text-primary-700" />
          </div>
        )}
        {/* Date badge */}
        <div className="absolute top-3 left-3 bg-white/90 dark:bg-stone-800/90 backdrop-blur-sm rounded-xl px-3 py-1.5 shadow-sm">
          <div className="text-center">
            <div className="text-lg font-bold text-stone-800 dark:text-stone-100 leading-none">{eventDate.getDate()}</div>
            <div className="text-[10px] font-medium text-stone-500 dark:text-stone-400 uppercase mt-0.5">
              {eventDate.toLocaleDateString(locale, { month: "short" })}
            </div>
          </div>
        </div>
        {/* Upcoming badge */}
        {isUpcoming && (
          <div className="absolute top-3 right-3 bg-primary-500 text-white text-[10px] font-semibold px-2 py-1 rounded-full flex items-center gap-1 shadow-sm">
            <Sparkles className="w-3 h-3" /> Next
          </div>
        )}
        {/* Category badge */}
        {event.category && (
          <div className="absolute bottom-3 right-3">
            <Badge variant="sage" className="bg-white/90 dark:bg-stone-800/90 backdrop-blur-sm shadow-sm">{event.category}</Badge>
          </div>
        )}
        {/* Status badge */}
        {event.status === "draft" && (
          <div className="absolute bottom-3 left-3">
            <Badge variant="stone" className="bg-white/90 dark:bg-stone-800/90 backdrop-blur-sm shadow-sm">Draft</Badge>
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-semibold text-stone-800 dark:text-stone-100 group-hover:text-primary-700 dark:group-hover:text-primary-400 transition line-clamp-1 font-display">
          {event.title}
        </h3>
        {event.description && (
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-1 line-clamp-2 font-light leading-relaxed">{event.description}</p>
        )}
        <div className="flex items-center gap-3 mt-3 text-xs text-stone-600 dark:text-stone-400 flex-wrap">
          <span className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            {eventDate.toLocaleDateString(locale, {
              weekday: "short", month: "short", day: "numeric",
            })}
          </span>
          {event.location && (
            <span className="flex items-center gap-1">
              <MapPin className="w-3.5 h-3.5" />{event.location}
            </span>
          )}
          {event.is_online && (
            <span className="flex items-center gap-1">
              <Globe className="w-3.5 h-3.5" />{t("events.online")}
            </span>
          )}
        </div>
        <div className="flex items-center gap-2 mt-2 flex-wrap">
          <span className="flex items-center gap-1 text-xs text-stone-600 dark:text-stone-400">
            <Users className="w-3.5 h-3.5" />
            {event.attendee_count}{event.max_attendees ? `/${event.max_attendees}` : ""}
          </span>
          {event.ticket_type === "paid" && event.ticket_price && (
            <Badge variant="earth" className="text-[10px] px-1.5 py-0.5">
              <Tag className="w-2.5 h-2.5 mr-0.5" />€{(event.ticket_price / 100).toFixed(0)}
            </Badge>
          )}
          {event.ticket_type === "donation_based" && (
            <Badge variant="earth" className="text-[10px] px-1.5 py-0.5">
              <Heart className="w-2.5 h-2.5 mr-0.5" />
            </Badge>
          )}
          {event.visibility === "registered" && (
            <Badge variant="blue" className="text-[10px] px-1.5 py-0.5">
              <Shield className="w-2.5 h-2.5" />
            </Badge>
          )}
          {event.visibility === "group_only" && (
            <Badge variant="blue" className="text-[10px] px-1.5 py-0.5">
              <Building className="w-2.5 h-2.5" />
            </Badge>
          )}
        </div>
      </div>
    </Link>
  );
}
