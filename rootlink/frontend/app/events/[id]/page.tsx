"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  Calendar, MapPin, Globe, Users, Edit3, Trash2, CheckCircle, XCircle,
  Clock, Leaf, Heart, Ticket, Tag, Building, Mic, DollarSign, Camera,
  ChevronRight, Star, Shield, Coffee, ParkingCircle, Accessibility,
  MessageSquare, ExternalLink, QrCode, UserCheck, Plus, X, Eye, EyeOff,
} from "lucide-react";
import { api } from "@/lib/api";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CommentSection } from "@/components/CommentSection";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { useLocale } from "@/lib/locale-context";
import { useToast } from "@/lib/toast-context";

const TABS = ["about", "schedule", "venue", "sponsors", "donations", "tickets", "attendees", "vendors", "discussion"] as const;
type Tab = (typeof TABS)[number];

const VISIBILITY_OPTIONS = [
  { value: "all", labelKey: "vis_all", icon: Globe },
  { value: "registered", labelKey: "vis_registered", icon: Users },
  { value: "role_based", labelKey: "vis_role_based", icon: Shield },
  { value: "group_only", labelKey: "vis_group_only", icon: Building },
];

const TICKET_TYPES = [
  { value: "free", labelKey: "ticket_free" },
  { value: "paid", labelKey: "ticket_paid" },
  { value: "donation_based", labelKey: "ticket_donation" },
];

const RECURRENCE_TYPES = [
  { value: "none", labelKey: "recurrence_none" },
  { value: "weekly", labelKey: "recurrence_weekly" },
  { value: "monthly", labelKey: "recurrence_monthly" },
  { value: "semi_annual", labelKey: "recurrence_semi_annual" },
  { value: "annual", labelKey: "recurrence_annual" },
  { value: "open_door", labelKey: "recurrence_open_door" },
];

const DAYS_OF_WEEK = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

const SPONSOR_TIERS = [
  { value: "platinum", labelKey: "sponsor_tier_platinum" },
  { value: "gold", labelKey: "sponsor_tier_gold" },
  { value: "silver", labelKey: "sponsor_tier_silver" },
  { value: "bronze", labelKey: "sponsor_tier_bronze" },
  { value: "media", labelKey: "sponsor_tier_media" },
  { value: "community", labelKey: "sponsor_tier_community" },
];

const SCHEDULE_TYPES = [
  { value: "talk", labelKey: "schedule_type_talk" },
  { value: "workshop", labelKey: "schedule_type_workshop" },
  { value: "break", labelKey: "schedule_type_break" },
  { value: "meal", labelKey: "schedule_type_meal" },
  { value: "networking", labelKey: "schedule_type_networking" },
  { value: "activity", labelKey: "schedule_type_activity" },
];

const VENUE_TYPES = [
  { value: "indoor", labelKey: "venue_indoor" },
  { value: "outdoor", labelKey: "venue_outdoor" },
  { value: "both", labelKey: "venue_both" },
];

const VENDOR_STATUSES = [
  { value: "pending", labelKey: "vendor_status_pending" },
  { value: "confirmed", labelKey: "vendor_status_confirmed" },
  { value: "cancelled", labelKey: "vendor_status_cancelled" },
];

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { t } = useLocale();
  const { addToast } = useToast();

  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState<number | null>(null);
  const [userRole, setUserRole] = useState<string>("");
  const [rsvped, setRsvped] = useState(false);
  const [attendees, setAttendees] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<Tab>("about");
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});

  // Sub-entity state
  const [venue, setVenue] = useState<any>(null);
  const [amenities, setAmenities] = useState<any[]>([]);
  const [schedule, setSchedule] = useState<any[]>([]);
  const [sponsors, setSponsors] = useState<any[]>([]);
  const [vendors, setVendors] = useState<any[]>([]);
  const [donations, setDonations] = useState<any[]>([]);
  const [donationStats, setDonationStats] = useState<any>(null);
  const [myTicket, setMyTicket] = useState<any>(null);
  const [ticket, setTicket] = useState({ ticket_type: "regular", quantity: 1 });
  const [donation, setDonation] = useState({ amount: 0, message: "", donor_name: "", donor_email: "", is_anonymous: false });

  const visibleTiers = (event?.ticket_tiers || []).filter((t: any) => t.price > 0);
  const hasTiers = visibleTiers.length > 0;
  const selectedTierPrice = hasTiers
    ? (visibleTiers.find((t: any) => t.type === ticket.ticket_type)?.price || 0)
    : (event?.ticket_price || 0);

  // Edit forms
  const [venueForm, setVenueForm] = useState<any>({});
  const [showAmenityForm, setShowAmenityForm] = useState(false);
  const [amenityForm, setAmenityForm] = useState<any>({ name: "", included: true });
  const [showScheduleForm, setShowScheduleForm] = useState(false);
  const [scheduleForm, setScheduleForm] = useState<any>({ type: "talk", sort_order: 0 });
  const [showSponsorForm, setShowSponsorForm] = useState(false);
  const [sponsorForm, setSponsorForm] = useState<any>({ tier: "community", visible_to_attendees: true });
  const [showVendorForm, setShowVendorForm] = useState(false);
  const [vendorForm, setVendorForm] = useState<any>({ status: "pending", visible_to_attendees: false });

  const eventId = Number(params.id);
  const isOwner = userId === event?.created_by;
  // TECH_DEBT.md §0 / user-logic-review.md §9 (was missing super_admin).
  const isAdmin = userRole === "admin" || userRole === "moderator" || userRole === "super_admin";

  const loadEvent = useCallback(async () => {
    try {
      const ev = await api.events.get(eventId);
      setEvent(ev);
      setForm(ev);
      const [a, my] = await Promise.all([
        api.events.attendees(eventId),
        api.events.myRsvps().catch(() => []),
      ]);
      setAttendees(a);
      setRsvped(my.some((r: any) => r.event_id === eventId));
    } catch {
      setError(t("events.not_found"));
    } finally {
      setLoading(false);
    }
  }, [eventId, t]);

  const loadSubEntities = useCallback(async () => {
    try {
      const [v, am, sc, sp, vb, dn, ds, tk] = await Promise.all([
        api.events.getVenue(eventId).catch(() => null),
        api.events.getAmenities(eventId).catch(() => []),
        api.events.getSchedule(eventId).catch(() => []),
        api.events.getSponsors(eventId, false).catch(() => []),
        api.events.getVendors(eventId, !isOwner).catch(() => []),
        api.events.getDonations(eventId).catch(() => []),
        api.events.getDonationStats(eventId).catch(() => null),
        api.events.myTicket(eventId).catch(() => null),
      ]);
      setVenue(v);
      setAmenities(am);
      setSchedule(sc);
      setSponsors(sp);
      setVendors(vb);
      setDonations(dn);
      setDonationStats(ds);
      setMyTicket(tk);
    } catch {}
  }, [eventId]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      api.auth.me().then((u) => { setUserId(u.id); setUserRole(u.role); }).catch(() => {});
    }
    loadEvent();
  }, [loadEvent]);

  useEffect(() => {
    if (event) loadSubEntities();
  }, [event, loadSubEntities]);

  const handleRsvp = async () => {
    try {
      await api.events.rsvp(event.id);
      setRsvped(true);
      setAttendees([...attendees, { id: userId }]);
      addToast("success", "RSVP confirmed!");
    } catch (err: any) { addToast("error", err.message); }
  };

  const handleCancelRsvp = async () => {
    await api.events.cancelRsvp(event.id);
    setRsvped(false);
    setAttendees(attendees.filter((a) => a.id !== userId));
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const updated = await api.events.update(event.id, form);
      setEvent(updated);
      setEditing(false);
      addToast("success", "Event updated!");
    } catch (err: any) { addToast("error", err.message); }
  };

  const handleDelete = async () => {
    if (!confirm(t("events.delete_confirm"))) return;
    await api.events.delete(event.id);
    router.push("/events");
  };

  const handleVenueSave = async () => {
    try {
      const v = await api.events.upsertVenue(event.id, venueForm);
      setVenue(v);
      addToast("success", "Venue saved!");
    } catch (err: any) { addToast("error", err.message); }
  };

  const handleAmenityCreate = async () => {
    try {
      const a = await api.events.createAmenity(event.id, amenityForm);
      setAmenities([...amenities, a]);
      setShowAmenityForm(false);
      setAmenityForm({ name: "", included: true });
    } catch (err: any) { addToast("error", err.message); }
  };

  const handleAmenityDelete = async (id: number) => {
    await api.events.deleteAmenity(event.id, id);
    setAmenities(amenities.filter((a) => a.id !== id));
  };

  const handleScheduleCreate = async () => {
    try {
      const s = await api.events.createScheduleItem(event.id, scheduleForm);
      setSchedule([...schedule, s]);
      setShowScheduleForm(false);
      setScheduleForm({ type: "talk", sort_order: 0 });
    } catch (err: any) { addToast("error", err.message); }
  };

  const handleScheduleDelete = async (id: number) => {
    await api.events.deleteScheduleItem(event.id, id);
    setSchedule(schedule.filter((s) => s.id !== id));
  };

  const handleSponsorCreate = async () => {
    try {
      const s = await api.events.createSponsor(event.id, sponsorForm);
      setSponsors([...sponsors, s]);
      setShowSponsorForm(false);
      setSponsorForm({ tier: "community", visible_to_attendees: true });
    } catch (err: any) { addToast("error", err.message); }
  };

  const handleSponsorDelete = async (id: number) => {
    await api.events.deleteSponsor(event.id, id);
    setSponsors(sponsors.filter((s) => s.id !== id));
  };

  const handleVendorCreate = async () => {
    try {
      const v = await api.events.createVendor(event.id, vendorForm);
      setVendors([...vendors, v]);
      setShowVendorForm(false);
      setVendorForm({ status: "pending", visible_to_attendees: false });
    } catch (err: any) { addToast("error", err.message); }
  };

  const handleVendorDelete = async (id: number) => {
    await api.events.deleteVendor(event.id, id);
    setVendors(vendors.filter((v) => v.id !== id));
  };

  const handleDonate = async () => {
    try {
      await api.events.donate(event.id, donation);
      setDonation({ amount: 0, message: "", donor_name: "", donor_email: "", is_anonymous: false });
      const [dn, ds] = await Promise.all([
        api.events.getDonations(event.id),
        api.events.getDonationStats(event.id),
      ]);
      setDonations(dn);
      setDonationStats(ds);
      addToast("success", t("events.donation_thank"));
    } catch (err: any) { addToast("error", err.message); }
  };

  const handlePurchaseTicket = async () => {
    try {
      const tkt = await api.events.purchaseTicket(event.id, ticket);
      setMyTicket(tkt);
      addToast("success", "Ticket purchased!");
    } catch (err: any) { addToast("error", err.message); }
  };

  const handleCheckIn = async (ticketId: number) => {
    try {
      await api.events.checkIn(event.id, ticketId);
      const a = await api.events.attendees(event.id);
      setAttendees(a);
      addToast("success", "Checked in!");
    } catch (err: any) { addToast("error", err.message); }
  };

  if (loading) return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-12 space-y-6">
      <div className="h-8 bg-primary-100 dark:bg-primary-950/20 rounded w-3/4 animate-pulse" />
      <div className="h-4 bg-primary-100 dark:bg-primary-950/20 rounded w-1/2 animate-pulse" />
      <div className="h-64 bg-primary-100 dark:bg-primary-950/20 rounded-2xl animate-pulse" />
    </div>
  );
  if (error) return <div className="text-center py-20 text-stone-500 dark:text-stone-400">{error}</div>;
  if (!event) return null;

  const full = event.max_attendees && attendees.length >= event.max_attendees;
  const visibilityOption = VISIBILITY_OPTIONS.find((v) => v.value === event.visibility);
  const ticketType = TICKET_TYPES.find((tt) => tt.value === event.ticket_type);

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-12">
      <Breadcrumbs items={[{ label: t("events.title"), href: "/events" }, { label: event.title }]} />

      {/* Hero */}
      {event.image_url && (
        <img src={event.image_url} alt="" loading="lazy" className="w-full h-72 object-cover rounded-2xl mb-6 mt-6" />
      )}

      {/* Header */}
      <div className="flex justify-between items-start mt-6">
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-2 flex-wrap">
            <h1 className="text-3xl font-display font-bold text-stone-800">{event.title}</h1>
            {event.category && <Badge variant="sage">{event.category}</Badge>}
            {event.status === "draft" && <Badge variant="stone">Draft</Badge>}
          </div>
          <div className="flex flex-wrap gap-2 mt-1">
            {visibilityOption && (
              <Badge variant="blue" className="flex items-center gap-1">
                {(() => { const Icon = visibilityOption.icon; return <Icon className="w-3 h-3" />; })()}
                {t(`events.${visibilityOption.labelKey}`)}
              </Badge>
            )}
            {event.ticket_type !== "free" && (
              <Badge variant="earth" className="flex items-center gap-1">
                <Tag className="w-3 h-3" />
                {t(`events.${ticketType?.labelKey}`)}
                {event.ticket_price ? ` — €${(event.ticket_price / 100).toFixed(0)}` : ""}
              </Badge>
            )}
            {event.tags?.map((tag: string) => (
              <Badge key={tag} variant="stone">{tag}</Badge>
            ))}
          </div>
        </div>
        {isOwner && (
          <div className="flex gap-2 shrink-0">
            <Button variant="ghost" size="sm" onClick={() => setEditing(true)}><Edit3 className="w-4 h-4" /></Button>
            <Button variant="ghost" size="sm" onClick={handleDelete}><Trash2 className="w-4 h-4 text-red-500" /></Button>
          </div>
        )}
      </div>

      {/* Meta row */}
      <div className="flex flex-wrap gap-4 mt-4 text-sm text-stone-500 dark:text-stone-400">
        {event.recurrence_type && event.recurrence_type !== "none" ? (
          <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4 text-stone-500 dark:text-stone-400" />
            {event.recurrence_type === "open_door"
              ? t("events.recurrence_open_door")
              : `${t("events.recurrence")} — ${t(`events.recurrence_${event.recurrence_type}`)}`}
          </span>
        ) : (
          <span className="flex items-center gap-1.5"><Calendar className="w-4 h-4 text-stone-500 dark:text-stone-400" />
            {new Date(event.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
        {event.end_date && event.recurrence_type !== "open_door" && (
          <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-stone-500 dark:text-stone-400" />
            {new Date(event.end_date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}
          </span>
        )}
        {event.recurrence_type === "open_door" && event.recurrence_config?.weekly_hours && (
          <span className="flex items-center gap-1.5"><Clock className="w-4 h-4 text-stone-500 dark:text-stone-400" />
            {(() => {
              const days = Object.entries(event.recurrence_config.weekly_hours).filter(([, v]) => v);
              return `${days.length} ${t("events.days_open")}`;
            })()}
          </span>
        )}
        {event.location && (
          <span className="flex items-center gap-1.5"><MapPin className="w-4 h-4 text-stone-500 dark:text-stone-400" />{event.location}</span>
        )}
        {event.is_online && (
          <span className="flex items-center gap-1.5"><Globe className="w-4 h-4 text-stone-500 dark:text-stone-400" />{t("events.online")}</span>
        )}
        <button onClick={() => setActiveTab("attendees")} className="flex items-center gap-1.5 hover:text-primary-700 dark:hover:text-primary-400 transition font-medium">
          <Users className="w-4 h-4 text-stone-500 dark:text-stone-400" />{attendees.length}{event.max_attendees ? ` / ${event.max_attendees}` : ""}
        </button>
      </div>

      {/* Action bar */}
      <div className="mt-6 flex gap-3 flex-wrap">
        {event.ticket_type === "paid" && !myTicket && (
          <Button onClick={handlePurchaseTicket} disabled={full}>
            <Ticket className="w-4 h-4" /> {t("events.ticket_purchase")} — €{((hasTiers ? visibleTiers[0]?.price : event.ticket_price) || 0) / 100}
          </Button>
        )}
        {myTicket && (
          <Badge variant="green" className="flex items-center gap-1 px-3 py-1.5 text-sm">
            <Ticket className="w-4 h-4" /> {t("events.ticket_my_ticket")}
          </Badge>
        )}
        {event.ticket_type === "free" && userId && !rsvped && (
          <Button onClick={handleRsvp} disabled={full}>
            <CheckCircle className="w-4 h-4" /> {full ? t("events.full") : t("events.rsvp")}
          </Button>
        )}
        {rsvped && (
          <Button variant="secondary" onClick={handleCancelRsvp}>
            <XCircle className="w-4 h-4" /> {t("events.cancel_rsvp")}
          </Button>
        )}
        {event.ticket_type === "donation_based" && (
          <Button onClick={() => setActiveTab("donations")}>
            <Heart className="w-4 h-4" /> {t("events.donate_now")}
          </Button>
        )}
        {event.url && (
          <a href={event.url} target="_blank" rel="noopener noreferrer">
            <Button variant="secondary"><ExternalLink className="w-4 h-4" /> {t("events.event_link")}</Button>
          </a>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mt-8 border-b border-primary-100 dark:border-stone-800 overflow-x-auto pb-px">
        {TABS.filter((tab) => {
          if (tab === "donations" && event.ticket_type !== "donation_based") return false;
          if (tab === "tickets" && event.ticket_type !== "paid") return false;
          return true;
        }).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? "border-primary-500 text-primary-700 dark:text-primary-400"
                : "border-transparent text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
            }`}
          >
            {t(`events.tab_${tab}`)}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="mt-8">

        {/* ── ABOUT ─────────────────────────────────────────── */}
        {activeTab === "about" && (
          <div className="space-y-6">
            {/* Recurrence info */}
            {event.recurrence_type && event.recurrence_type !== "none" && (
              <Card variant="plain" className="p-6">
                <h3 className="font-display font-bold text-stone-800 dark:text-stone-100 mb-3">{t("events.recurrence")}</h3>
                <div className="flex items-center gap-2 mb-3">
                  <Badge variant={event.recurrence_type === "open_door" ? "green" : "sage"}>
                    {t(`events.recurrence_${event.recurrence_type}`)}
                  </Badge>
                  {event.recurrence_config?.recurrence_end && (
                    <span className="text-sm text-stone-500">
                      {t("events.recurrence_end")}: {new Date(event.recurrence_config.recurrence_end).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}
                    </span>
                  )}
                </div>
                {event.recurrence_type === "open_door" && event.recurrence_config?.weekly_hours && (
                  <div className="mt-3 space-y-1">
                    <p className="text-sm font-medium text-stone-600 dark:text-stone-300 mb-2">{t("events.weekly_hours")}</p>
                    <div className="grid grid-cols-7 gap-1 text-center text-xs">
                      {DAYS_OF_WEEK.map((day) => {
                        const hours = event.recurrence_config.weekly_hours[day];
                        return (
                          <div key={day} className={`rounded-lg p-2 ${hours ? "bg-green-50 dark:bg-green-900/20 text-green-800 dark:text-green-300" : "bg-stone-50 dark:bg-stone-800 text-stone-400 dark:text-stone-500"}`}>
                            <div className="font-medium">{t(`events.day_${day}`)}</div>
                            <div className="mt-0.5">{hours ? `${hours.open}–${hours.close}` : t("events.closed")}</div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </Card>
            )}
            {(event.description || event.description_long) && (
              <Card variant="plain" className="p-6">
                <h3 className="font-display font-bold text-stone-800 dark:text-stone-100 mb-3">{t("events.tab_about")}</h3>
                {event.description && (
                  <p className="text-stone-700 dark:text-stone-300 whitespace-pre-wrap font-light leading-relaxed">{event.description}</p>
                )}
                {event.description_long && (
                  <div className="mt-4 pt-4 border-t border-primary-100 dark:border-stone-800">
                    <p className="text-stone-600 dark:text-stone-300 whitespace-pre-wrap leading-relaxed">{event.description_long}</p>
                  </div>
                )}
              </Card>
            )}
            {(event.contact_email || event.contact_phone || event.requirements) && (
              <Card variant="plain" className="p-6">
                <h3 className="font-display font-bold text-stone-800 dark:text-stone-100 mb-3">Details</h3>
                <div className="space-y-2 text-sm text-stone-600 dark:text-stone-300">
                  {event.contact_email && <p>Contact: {event.contact_email}</p>}
                  {event.contact_phone && <p>Phone: {event.contact_phone}</p>}
                  {event.requirements && (
                    <div className="mt-3 p-3 bg-primary-50 dark:bg-primary-900/20 rounded-xl">
                      <p className="font-medium text-stone-700 dark:text-stone-200 mb-1">{t("events.requirements")}</p>
                      <p className="text-stone-600 dark:text-stone-300 whitespace-pre-wrap">{event.requirements}</p>
                    </div>
                  )}
                </div>
              </Card>
            )}
            {!event.description && !event.description_long && !event.contact_email && (
              <EmptyState icon={<Leaf className="w-7 h-7" />} title="No description yet." />
            )}
          </div>
        )}

        {/* ── SCHEDULE ──────────────────────────────────────── */}
        {activeTab === "schedule" && (
          <div className="space-y-4">
            {event.recurrence_type === "open_door" && event.recurrence_config?.weekly_hours ? (
              <Card variant="plain" className="p-6">
                <h3 className="font-display font-bold text-stone-800 dark:text-stone-100 mb-4">{t("events.weekly_hours")}</h3>
                <div className="space-y-2">
                  {DAYS_OF_WEEK.map((day) => {
                    const hours = event.recurrence_config.weekly_hours[day];
                    return (
                      <div key={day} className="flex items-center gap-3 py-2 border-b border-stone-100 last:border-0">
                        <span className="w-10 font-medium text-stone-600 dark:text-stone-300 text-sm">{t(`events.day_${day}`)}</span>
                        {hours ? (
                          <span className="text-stone-800 dark:text-stone-100 font-serif">{hours.open} — {hours.close}</span>
                        ) : (
                          <span className="text-stone-00 dark:text-stone-500 italic">{t("events.closed")}</span>
                        )}
                      </div>
                    );
                  })}
                </div>
              </Card>
            ) : (
              <>
                {isOwner && (
              <div className="flex justify-end">
                <Button variant="secondary" size="sm" onClick={() => setShowScheduleForm(!showScheduleForm)}>
                  <Plus className="w-4 h-4" /> {t("events.add_schedule_item")}
                </Button>
              </div>
            )}
            {showScheduleForm && (
              <Card variant="plain" className="p-4 space-y-3">
                <div className="grid md:grid-cols-2 gap-3">
                  <input placeholder={t("events.schedule_item_title")} value={scheduleForm.title || ""} onChange={(e) => setScheduleForm({ ...scheduleForm, title: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15" />
                  <select value={scheduleForm.type || "talk"} onChange={(e) => setScheduleForm({ ...scheduleForm, type: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15">
                    {SCHEDULE_TYPES.map((st) => <option key={st.value} value={st.value}>{t(`events.${st.labelKey}`)}</option>)}
                  </select>
                  <input placeholder={t("events.schedule_speaker")} value={scheduleForm.speaker_name || ""} onChange={(e) => setScheduleForm({ ...scheduleForm, speaker_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15" />
                  <input placeholder={t("events.schedule_location")} value={scheduleForm.location || ""} onChange={(e) => setScheduleForm({ ...scheduleForm, location: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15" />
                  <input type="datetime-local" value={scheduleForm.start_time ? new Date(scheduleForm.start_time).toISOString().slice(0, 16) : ""} onChange={(e) => setScheduleForm({ ...scheduleForm, start_time: new Date(e.target.value).toISOString() })}
                    className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15" />
                  <input type="datetime-local" value={scheduleForm.end_time ? new Date(scheduleForm.end_time).toISOString().slice(0, 16) : ""} onChange={(e) => setScheduleForm({ ...scheduleForm, end_time: new Date(e.target.value).toISOString() })}
                    className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15" />
                </div>
                <textarea placeholder={t("events.schedule_description")} value={scheduleForm.description || ""} onChange={(e) => setScheduleForm({ ...scheduleForm, description: e.target.value })} rows={2}
                  className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15" />
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleScheduleCreate}>{t("events.save")}</Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowScheduleForm(false)}>{t("events.cancel")}</Button>
                </div>
              </Card>
            )}
            {schedule.length === 0 ? (
              <EmptyState icon={<Clock className="w-7 h-7" />} title="No schedule yet." />
            ) : (
              <div className="space-y-3">
                {schedule.map((item) => {
                  const start = new Date(item.start_time);
                  const end = item.end_time ? new Date(item.end_time) : null;
                  const typeColors: Record<string, string> = {
                    talk: "bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800",
                    workshop: "bg-earth-50 dark:bg-earth-900/20 border-earth-200 dark:border-earth-800",
                    break: "bg-stone-50 dark:bg-stone-800/50 border-stone-200 dark:border-stone-700",
                    meal: "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800",
                    networking: "bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800",
                    activity: "bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800",
                  };
                  return (
                    <div key={item.id} className={`rounded-xl border p-4 ${typeColors[item.type] || "bg-primary-50 dark:bg-primary-900/20 border-primary-200 dark:border-primary-800"}`}>
                      <div className="flex justify-between items-start">
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="sage">{t(`events.schedule_type_${item.type}`)}</Badge>
                            {item.location && <span className="text-xs text-stone-500 dark:text-stone-400">{item.location}</span>}
                          </div>
                          <h4 className="font-semibold text-stone-800 dark:text-stone-100 mt-1">{item.title}</h4>
                          {item.speaker_name && <p className="text-sm text-stone-500 dark:text-stone-400">{item.speaker_name}</p>}
                          {item.description && <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">{item.description}</p>}
                        </div>
                        <div className="text-right text-sm text-stone-500 dark:text-stone-400 shrink-0 ml-4">
                          <p>{start.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</p>
                          {end && <p>— {end.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}</p>}
                        </div>
                      </div>
                      {isOwner && (
                        <button onClick={() => handleScheduleDelete(item.id)} className="text-xs text-red-400 hover:text-red-600 mt-2">Remove</button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
              </>
            )}
          </div>
        )}

        {/* ── VENUE ─────────────────────────────────────────── */}
        {activeTab === "venue" && (
          <div className="space-y-6">
            {isOwner && (
              <Card variant="plain" className="p-4 space-y-3">
                <h3 className="font-display font-bold text-stone-800 dark:text-stone-100">{t("events.venue_title")}</h3>
                <div className="grid md:grid-cols-2 gap-3">
                  <input placeholder={t("events.venue_name")} value={venueForm.venue_name || venue?.venue_name || ""} onChange={(e) => setVenueForm({ ...venueForm, venue_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15" />
                  <input placeholder={t("events.venue_address")} value={venueForm.address || venue?.address || ""} onChange={(e) => setVenueForm({ ...venueForm, address: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15" />
                  <input placeholder={t("events.venue_city")} value={venueForm.city || venue?.city || ""} onChange={(e) => setVenueForm({ ...venueForm, city: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15" />
                  <input placeholder={t("events.venue_country")} value={venueForm.country || venue?.country || ""} onChange={(e) => setVenueForm({ ...venueForm, country: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15" />
                  <input type="number" placeholder={t("events.venue_capacity")} value={venueForm.capacity || venue?.capacity || ""} onChange={(e) => setVenueForm({ ...venueForm, capacity: e.target.value ? Number(e.target.value) : null })}
                    className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15" />
                  <select value={venueForm.indoor_outdoor || venue?.indoor_outdoor || ""} onChange={(e) => setVenueForm({ ...venueForm, indoor_outdoor: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15">
                    <option value="">{t("events.venue_indoor_outdoor")}</option>
                    {VENUE_TYPES.map((vt) => <option key={vt.value} value={vt.value}>{t(`events.${vt.labelKey}`)}</option>)}
                  </select>
                </div>
                <div className="flex gap-4">
                  <label className="flex items-center gap-2 text-sm text-stone-700 dark:text-stone-300">
                    <input type="checkbox" checked={venueForm.parking ?? venue?.parking ?? false} onChange={(e) => setVenueForm({ ...venueForm, parking: e.target.checked })} className="rounded border-primary-200 dark:border-stone-600 text-primary-500" />
                    {t("events.venue_parking")}
                  </label>
                  <label className="flex items-center gap-2 text-sm text-stone-700 dark:text-stone-300">
                    <input type="checkbox" checked={venueForm.wheelchair_accessible ?? venue?.wheelchair_accessible ?? false} onChange={(e) => setVenueForm({ ...venueForm, wheelchair_accessible: e.target.checked })} className="rounded border-primary-200 dark:border-stone-600 text-primary-500" />
                    {t("events.venue_accessible")}
                  </label>
                </div>
                <input placeholder={t("events.venue_transport")} value={venueForm.public_transport || venue?.public_transport || ""} onChange={(e) => setVenueForm({ ...venueForm, public_transport: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15" />
                <textarea placeholder={t("events.venue_notes")} value={venueForm.notes || venue?.notes || ""} onChange={(e) => setVenueForm({ ...venueForm, notes: e.target.value })} rows={2}
                  className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15" />
                <Button size="sm" onClick={handleVenueSave}>{t("events.save")}</Button>
              </Card>
            )}
            {venue && !isOwner && (
              <Card variant="plain" className="p-6">
                <h3 className="font-display font-bold text-stone-800 dark:text-stone-100 mb-3">{venue.venue_name || t("events.venue_title")}</h3>
                <div className="space-y-2 text-sm text-stone-600 dark:text-stone-300">
                  {venue.address && <p className="flex items-center gap-2"><MapPin className="w-4 h-4 text-stone-500 dark:text-stone-400" />{venue.address}{venue.city ? `, ${venue.city}` : ""}</p>}
                  {venue.capacity && <p className="flex items-center gap-2"><Users className="w-4 h-4 text-stone-500 dark:text-stone-400" />Capacity: {venue.capacity}</p>}
                  {venue.indoor_outdoor && <p className="flex items-center gap-2"><Building className="w-4 h-4 text-stone-500 dark:text-stone-400" />{t(`events.venue_${venue.indoor_outdoor}`)}</p>}
                  <div className="flex gap-4 mt-2">
                    {venue.parking && <Badge variant="sage"><ParkingCircle className="w-3 h-3 mr-1" />Parking</Badge>}
                    {venue.wheelchair_accessible && <Badge variant="sage"><Accessibility className="w-3 h-3 mr-1" />Accessible</Badge>}
                  </div>
                  {venue.public_transport && <p className="text-stone-500 dark:text-stone-400 mt-2">{venue.public_transport}</p>}
                  {venue.notes && <p className="text-stone-500 dark:text-stone-400 mt-2 italic">{venue.notes}</p>}
                </div>
              </Card>
            )}
            {!venue && !isOwner && (
              <EmptyState icon={<MapPin className="w-7 h-7" />} title="No venue details yet." />
            )}
            {/* Amenities */}
            {amenities.length > 0 && (
              <div>
                <h4 className="font-display font-bold text-stone-800 dark:text-stone-100 mb-3">{t("events.tab_amenities")}</h4>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {amenities.map((a) => (
                    <div key={a.id} className="flex items-center gap-3 bg-primary-50 dark:bg-primary-900/20 rounded-xl p-3">
                      <div className="w-8 h-8 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center">
                        <Coffee className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-stone-700 dark:text-stone-200 truncate">{a.name}</p>
                        {a.time_start && <p className="text-xs text-stone-500 dark:text-stone-400">{a.time_start}{a.time_end ? ` — ${a.time_end}` : ""}</p>}
                      </div>
                      {isOwner && (
                        <button onClick={() => handleAmenityDelete(a.id)} className="text-stone-300 dark:text-stone-600 hover:text-red-500 dark:hover:text-red-400"><X className="w-3 h-3" /></button>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
            {isOwner && (
              <div>
                {!showAmenityForm ? (
                  <Button variant="ghost" size="sm" onClick={() => setShowAmenityForm(true)}>
                    <Plus className="w-4 h-4" /> {t("events.add_amenity")}
                  </Button>
                ) : (
                  <Card variant="plain" className="p-4 space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <input placeholder={t("events.amenity_name")} value={amenityForm.name || ""} onChange={(e) => setAmenityForm({ ...amenityForm, name: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15" />
                      <input placeholder={t("events.amenity_time")} value={amenityForm.time_start || ""} onChange={(e) => setAmenityForm({ ...amenityForm, time_start: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15" />
                    </div>
                    <div className="flex gap-2">
                      <Button size="sm" onClick={handleAmenityCreate}>{t("events.save")}</Button>
                      <Button variant="ghost" size="sm" onClick={() => setShowAmenityForm(false)}>{t("events.cancel")}</Button>
                    </div>
                  </Card>
                )}
              </div>
            )}
          </div>
        )}

        {/* ── SPONSORS ──────────────────────────────────────── */}
        {activeTab === "sponsors" && (
          <div className="space-y-6">
            {isOwner && (
              <div className="flex justify-end">
                <Button variant="secondary" size="sm" onClick={() => setShowSponsorForm(!showSponsorForm)}>
                  <Plus className="w-4 h-4" /> {t("events.add_sponsor")}
                </Button>
              </div>
            )}
            {showSponsorForm && (
              <Card variant="plain" className="p-4 space-y-3">
                <div className="grid md:grid-cols-2 gap-3">
                  <input placeholder={t("events.sponsor_name")} value={sponsorForm.name || ""} onChange={(e) => setSponsorForm({ ...sponsorForm, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15" />
                  <select value={sponsorForm.tier || "community"} onChange={(e) => setSponsorForm({ ...sponsorForm, tier: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15">
                    {SPONSOR_TIERS.map((st) => <option key={st.value} value={st.value}>{t(`events.${st.labelKey}`)}</option>)}
                  </select>
                  <input placeholder={t("events.sponsor_logo")} value={sponsorForm.logo_url || ""} onChange={(e) => setSponsorForm({ ...sponsorForm, logo_url: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15" />
                  <input placeholder={t("events.sponsor_website")} value={sponsorForm.website_url || ""} onChange={(e) => setSponsorForm({ ...sponsorForm, website_url: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15" />
                </div>
                <label className="flex items-center gap-2 text-sm text-stone-700 dark:text-stone-300">
                  <input type="checkbox" checked={sponsorForm.visible_to_attendees ?? true} onChange={(e) => setSponsorForm({ ...sponsorForm, visible_to_attendees: e.target.checked })} className="rounded border-primary-200 dark:border-stone-600 text-primary-500" />
                  {t("events.sponsor_visible")}
                </label>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleSponsorCreate}>{t("events.save")}</Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowSponsorForm(false)}>{t("events.cancel")}</Button>
                </div>
              </Card>
            )}
            {sponsors.length === 0 ? (
              <EmptyState icon={<Star className="w-7 h-7" />} title="No sponsors yet." />
            ) : (
              <div className="space-y-4">
                {["platinum", "gold", "silver", "bronze", "media", "community"].map((tier) => {
                  const tierSponsors = sponsors.filter((s) => s.tier === tier && (s.visible_to_attendees || isOwner));
                  if (tierSponsors.length === 0) return null;
                  const tierColors: Record<string, string> = {
                    platinum: "from-slate-100 dark:from-slate-900/40 to-slate-50 dark:to-slate-800/40 border-slate-200 dark:border-slate-700",
                    gold: "from-amber-50 dark:from-amber-900/20 to-yellow-50 dark:to-yellow-900/20 border-amber-200 dark:border-amber-800",
                    silver: "from-gray-50 dark:from-gray-900/40 to-slate-50 dark:to-slate-800/40 border-gray-200 dark:border-gray-700",
                    bronze: "from-orange-50 dark:from-orange-900/20 to-amber-50 dark:to-amber-900/20 border-orange-200 dark:border-orange-800",
                    media: "from-blue-50 dark:from-blue-900/20 to-indigo-50 dark:to-indigo-900/20 border-blue-200 dark:border-blue-800",
                    community: "from-primary-50 dark:from-primary-900/20 to-earth-50 dark:to-earth-900/20 border-primary-200 dark:border-primary-800",
                  };
                  return (
                    <div key={tier}>
                      <h4 className="text-xs font-semibold uppercase tracking-wider text-stone-500 dark:text-stone-400 mb-2">{t(`events.sponsor_tier_${tier}`)}</h4>
                      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                        {tierSponsors.map((s) => (
                          <div key={s.id} className={`bg-gradient-to-br ${tierColors[tier]} border rounded-xl p-4 text-center`}>
                            {s.logo_url ? (
                              <img src={s.logo_url} alt={s.name} className="h-12 mx-auto mb-2 object-contain" />
                            ) : (
                              <div className="h-12 flex items-center justify-center text-stone-300 dark:text-stone-600"><Building className="w-6 h-6" /></div>
                            )}
                            <p className="font-medium text-stone-700 dark:text-stone-200 text-sm">{s.name}</p>
                            {isOwner && (
                              <button onClick={() => handleSponsorDelete(s.id)} className="text-xs text-red-400 hover:text-red-600 mt-1">Remove</button>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── DONATIONS ─────────────────────────────────────── */}
        {activeTab === "donations" && event.ticket_type === "donation_based" && (
          <div className="space-y-6">
            {donationStats && donationStats.goal > 0 && (
              <Card variant="plain" className="p-6">
                <div className="flex justify-between items-end mb-2">
                  <span className="text-2xl font-display font-bold text-stone-800 dark:text-stone-100">€{(donationStats.total_raised / 100).toFixed(0)}</span>
                  <span className="text-sm text-stone-500 dark:text-stone-400">{t("events.donation_count", { count: donationStats.donation_count })}</span>
                </div>
                <div className="w-full bg-primary-100 dark:bg-primary-900/30 rounded-full h-3">
                  <div className="bg-primary-500 h-3 rounded-full transition-all" style={{ width: `${Math.min(donationStats.progress_pct, 100)}%` }} />
                </div>
                <p className="text-xs text-stone-500 dark:text-stone-400 mt-1">{t("events.donation_progress", { goal: `€${(donationStats.goal / 100).toFixed(0)}` })}</p>
              </Card>
            )}
            {event.ticket_type === "donation_based" && (
              <Card variant="plain" className="p-6">
                <h3 className="font-display font-bold text-stone-800 dark:text-stone-100 mb-4">{t("events.donate_now")}</h3>
                <div className="space-y-3">
                  <input type="number" placeholder={t("events.donation_amount")} value={donation.amount ? donation.amount / 100 : ""} onChange={(e) => setDonation({ ...donation, amount: Number(e.target.value) * 100 })}
                    className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15" />
                  <input placeholder={t("events.donation_donor_name")} value={donation.donor_name} onChange={(e) => setDonation({ ...donation, donor_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15" />
                  <input placeholder={t("events.donation_donor_email")} value={donation.donor_email} onChange={(e) => setDonation({ ...donation, donor_email: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15" />
                  <textarea placeholder={t("events.donation_message")} value={donation.message} onChange={(e) => setDonation({ ...donation, message: e.target.value })} rows={2}
                    className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15" />
                  <label className="flex items-center gap-2 text-sm text-stone-700 dark:text-stone-300">
                    <input type="checkbox" checked={donation.is_anonymous} onChange={(e) => setDonation({ ...donation, is_anonymous: e.target.checked })} className="rounded border-primary-200 dark:border-stone-600 text-primary-500" />
                    {t("events.donation_anonymous")}
                  </label>
                  <Button onClick={handleDonate} disabled={!donation.amount}><Heart className="w-4 h-4" /> {t("events.do")}</Button>
                </div>
              </Card>
            )}
            {donations.length === 0 ? (
              <EmptyState icon={<Heart className="w-7 h-7" />} title="No donations yet." />
            ) : (
              <div className="space-y-2">
                {donations.map((d) => (
                  <div key={d.id} className="flex items-center gap-3 bg-primary-50 dark:bg-primary-900/20 rounded-xl p-3">
                    <div className="w-8 h-8 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center text-primary-700 dark:text-primary-400 text-xs font-bold">
                      {d.is_anonymous ? "?" : (d.donor_name?.[0]?.toUpperCase() || "?")}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-stone-700 dark:text-stone-200">{d.is_anonymous ? "Anonymous" : d.donor_name}</p>
                      {d.message && <p className="text-xs text-stone-500 dark:text-stone-400 truncate">{d.message}</p>}
                    </div>
                    <span className="text-sm font-bold text-primary-700 dark:text-primary-400">€{(d.amount / 100).toFixed(0)}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── TICKETS ───────────────────────────────────────── */}
        {activeTab === "tickets" && (
          <div className="space-y-6">
            {event.ticket_type === "paid" && (
              <Card variant="plain" className="p-6">
                <h3 className="font-display font-bold text-stone-800 dark:text-stone-100 mb-4">{t("events.ticket_purchase")}</h3>
                {myTicket ? (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 bg-primary-50 dark:bg-primary-900/20 rounded-xl p-4">
                      <div className="w-16 h-16 bg-white dark:bg-stone-900 rounded-xl flex items-center justify-center border border-primary-100 dark:border-stone-700">
                        <QrCode className="w-10 h-10 text-stone-500 dark:text-stone-400" />
                      </div>
                      <div>
                        <p className="font-medium text-stone-700 dark:text-stone-200">{t(`events.ticket_type_${myTicket.ticket_type}`)} × {myTicket.quantity}</p>
                        <p className="text-sm text-stone-500 dark:text-stone-400">{t("events.ticket_total")}: €{(myTicket.total_paid / 100).toFixed(0)}</p>
                        {myTicket.checked_in && <Badge variant="green">{t("events.ticket_checked_in")}</Badge>}
                      </div>
                    </div>
                    {(isOwner || isAdmin) && !myTicket.checked_in && (
                      <Button size="sm" onClick={() => handleCheckIn(myTicket.id)}>
                        <UserCheck className="w-4 h-4" /> Check In
                      </Button>
                    )}
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div>
                      <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">{t("events.ticket_type_label")}</label>
                      {hasTiers ? (
                        <select value={ticket.ticket_type} onChange={(e) => setTicket({ ...ticket, ticket_type: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15">
                          {visibleTiers.map((tier: any) => (
                            <option key={tier.type} value={tier.type}>{tier.name || tier.type} — €{(tier.price / 100).toFixed(0)}</option>
                          ))}
                        </select>
                      ) : (
                        <select value={ticket.ticket_type} onChange={(e) => setTicket({ ...ticket, ticket_type: e.target.value })}
                          className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15">
                          <option value="regular">{t("events.ticket_type_regular")}</option>
                          <option value="early_bird">{t("events.ticket_type_early_bird")}</option>
                          <option value="vip">{t("events.ticket_type_vip")}</option>
                          <option value="student">{t("events.ticket_type_student")}</option>
                        </select>
                      )}
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">{t("events.ticket_quantity")}</label>
                      <input type="number" min={1} value={ticket.quantity} onChange={(e) => setTicket({ ...ticket, quantity: Number(e.target.value) })}
                        className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15" />
                    </div>
                    <p className="text-sm text-stone-500 dark:text-stone-400">{t("events.ticket_total")}: €{(selectedTierPrice * ticket.quantity / 100).toFixed(0)}</p>
                    <Button onClick={handlePurchaseTicket} disabled={full}>{t("events.ticket_purchase")}</Button>
                  </div>
                )}
              </Card>
            )}
            {event.ticket_type === "free" && (
              <Card variant="plain" className="p-6">
                <p className="text-stone-500 dark:text-stone-400 text-sm">This is a free event. Use RSVP to register your attendance.</p>
              </Card>
            )}
          </div>
        )}

        {/* ── ATTENDEES ─────────────────────────────────────── */}
        {activeTab === "attendees" && (
          <div>
            {attendees.length === 0 ? (
              <EmptyState icon={<Users className="w-7 h-7" />} title={t("events.no_attendees")} />
            ) : (
              <div className="flex flex-wrap gap-2">
                {attendees.map((a: any) => (
                  <div key={a.id} className="flex items-center gap-2 bg-primary-50 dark:bg-primary-900/20 px-3 py-1.5 rounded-full text-sm text-stone-600 dark:text-stone-300">
                    <div className="w-6 h-6 bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded-full flex items-center justify-center text-xs font-medium">
                      {a.name?.[0]?.toUpperCase() || "?"}
                    </div>
                    {a.name}
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── VENDORS ───────────────────────────────────────── */}
        {activeTab === "vendors" && (
          <div className="space-y-4">
            {isOwner && (
              <div className="flex justify-end">
                <Button variant="secondary" size="sm" onClick={() => setShowVendorForm(!showVendorForm)}>
                  <Plus className="w-4 h-4" /> {t("events.add_vendor")}
                </Button>
              </div>
            )}
            {showVendorForm && isOwner && (
              <Card variant="plain" className="p-4 space-y-3">
                <div className="grid md:grid-cols-2 gap-3">
                  <input placeholder={t("events.vendor_name")} value={vendorForm.name || ""} onChange={(e) => setVendorForm({ ...vendorForm, name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15" />
                  <input placeholder={t("events.vendor_service_type")} value={vendorForm.service_type || ""} onChange={(e) => setVendorForm({ ...vendorForm, service_type: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15" />
                  <input placeholder={t("events.vendor_contact_name")} value={vendorForm.contact_name || ""} onChange={(e) => setVendorForm({ ...vendorForm, contact_name: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15" />
                  <input placeholder={t("events.vendor_contact_email")} value={vendorForm.contact_email || ""} onChange={(e) => setVendorForm({ ...vendorForm, contact_email: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15" />
                </div>
                <select value={vendorForm.status || "pending"} onChange={(e) => setVendorForm({ ...vendorForm, status: e.target.value })}
                  className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15">
                  {VENDOR_STATUSES.map((vs) => <option key={vs.value} value={vs.value}>{t(`events.${vs.labelKey}`)}</option>)}
                </select>
                <label className="flex items-center gap-2 text-sm text-stone-700 dark:text-stone-300">
                  <input type="checkbox" checked={vendorForm.visible_to_attendees ?? false} onChange={(e) => setVendorForm({ ...vendorForm, visible_to_attendees: e.target.checked })} className="rounded border-primary-200 dark:border-stone-600 text-primary-500" />
                  {t("events.vendor_visible")}
                </label>
                <div className="flex gap-2">
                  <Button size="sm" onClick={handleVendorCreate}>{t("events.save")}</Button>
                  <Button variant="ghost" size="sm" onClick={() => setShowVendorForm(false)}>{t("events.cancel")}</Button>
                </div>
              </Card>
            )}
            {vendors.length === 0 ? (
              <EmptyState icon={<Building className="w-7 h-7" />} title="No vendors yet." />
            ) : (
              <div className="space-y-2">
                {vendors.map((v) => {
                  const statusColors: Record<string, string> = {
                    pending: "bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
                    confirmed: "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300",
                    cancelled: "bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300",
                  };
                  return (
                    <div key={v.id} className="flex items-center gap-3 bg-primary-50 dark:bg-primary-900/20 rounded-xl p-3">
                      <div className="w-8 h-8 bg-primary-100 dark:bg-primary-900/30 rounded-full flex items-center justify-center">
                        <Building className="w-4 h-4 text-primary-600 dark:text-primary-400" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-medium text-stone-700 dark:text-stone-200">{v.name}</p>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${statusColors[v.status] || ""}`}>{t(`events.vendor_status_${v.status}`)}</span>
                          {v.visible_to_attendees && <Eye className="w-3 h-3 text-stone-500 dark:text-stone-400" />}
                          {!v.visible_to_attendees && <EyeOff className="w-3 h-3 text-stone-300 dark:text-stone-600" />}
                        </div>
                        {v.service_type && <p className="text-xs text-stone-500 dark:text-stone-400">{v.service_type}</p>}
                      </div>
                      {isOwner && (
                        <button onClick={() => handleVendorDelete(v.id)} className="text-stone-300 dark:text-stone-600 hover:text-red-500 dark:hover:text-red-400"><X className="w-3 h-3" /></button>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* ── DISCUSSION ────────────────────────────────────── */}
        {activeTab === "discussion" && (
          <CommentSection entityType="event" entityId={event.id} />
        )}
      </div>

      {/* Edit mode */}
      {editing && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4" onClick={() => setEditing(false)}>
          <div className="bg-white dark:bg-stone-900 rounded-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto p-6 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-xl font-display font-bold text-stone-800 dark:text-stone-100">{t("events.edit_event")}</h2>
            {["title", "description", "location", "category", "url", "image_url", "contact_email", "contact_phone", "requirements"].map((f) => (
              <div key={f}>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1 capitalize">{f.replace(/_/g, " ")}</label>
                {f === "description" || f === "requirements" ? (
                  <textarea value={form[f] || ""} onChange={(e) => setForm({ ...form, [f]: e.target.value })} rows={3} className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15" />
                ) : (
                  <input type="text" value={form[f] || ""} onChange={(e) => setForm({ ...form, [f]: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15" />
                )}
              </div>
            ))}
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">{t("events.date_label")}</label>
                <input type="datetime-local" value={form.date ? new Date(form.date).toISOString().slice(0, 16) : ""} onChange={(e) => setForm({ ...form, date: new Date(e.target.value).toISOString() })} className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">{t("events.end_date_label")}</label>
                <input type="datetime-local" value={form.end_date ? new Date(form.end_date).toISOString().slice(0, 16) : ""} onChange={(e) => setForm({ ...form, end_date: new Date(e.target.value).toISOString() })} className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15" />
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">{t("events.max_attendees")}</label>
                <input type="number" value={form.max_attendees || ""} onChange={(e) => setForm({ ...form, max_attendees: e.target.value ? Number(e.target.value) : null })} className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">{t("events.visibility")}</label>
                <select value={form.visibility || "all"} onChange={(e) => setForm({ ...form, visibility: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15">
                  {VISIBILITY_OPTIONS.map((v) => <option key={v.value} value={v.value}>{t(`events.${v.labelKey}`)}</option>)}
                </select>
              </div>
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">{t("events.ticket_type")}</label>
                <select value={form.ticket_type || "free"} onChange={(e) => setForm({ ...form, ticket_type: e.target.value })} className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15">
                  {TICKET_TYPES.map((tt) => <option key={tt.value} value={tt.value}>{t(`events.${tt.labelKey}`)}</option>)}
                </select>
              </div>
              {form.ticket_type === "paid" && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">{t("events.ticket_price")} (cents)</label>
                    <input type="number" value={form.ticket_price || ""} onChange={(e) => setForm({ ...form, ticket_price: e.target.value ? Number(e.target.value) : null })} className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15" />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">{t("events.ticket_tiers")}</label>
                    <p className="text-xs text-stone-500 dark:text-stone-400 mb-2">{t("events.ticket_tiers_hint")}</p>
                    <div className="space-y-2">
                      {(form.ticket_tiers || []).map((tier: any, i: number) => (
                        <div key={i} className="flex gap-2 items-center">
                          <input placeholder={t("events.tier_name")} value={tier.name} onChange={(e) => { const tiers = [...(form.ticket_tiers || [])]; tiers[i] = { ...tiers[i], name: e.target.value }; setForm({ ...form, ticket_tiers: tiers }); }}
                            className="flex-1 px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15" />
                          <select value={tier.type} onChange={(e) => { const tiers = [...(form.ticket_tiers || [])]; tiers[i] = { ...tiers[i], type: e.target.value }; setForm({ ...form, ticket_tiers: tiers }); }}
                            className="px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15">
                            <option value="regular">{t("events.ticket_type_regular")}</option>
                            <option value="early_bird">{t("events.ticket_type_early_bird")}</option>
                            <option value="vip">{t("events.ticket_type_vip")}</option>
                            <option value="student">{t("events.ticket_type_student")}</option>
                          </select>
                          <input type="number" placeholder={t("events.tier_price")} value={tier.price || ""} onChange={(e) => { const tiers = [...(form.ticket_tiers || [])]; tiers[i] = { ...tiers[i], price: Number(e.target.value) }; setForm({ ...form, ticket_tiers: tiers }); }}
                            className="w-28 px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15" />
                          <button type="button" onClick={() => setForm({ ...form, ticket_tiers: (form.ticket_tiers || []).filter((_: any, j: number) => j !== i) })} className="text-stone-400 dark:text-stone-500 hover:text-red-500 dark:hover:text-red-400 transition">
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      ))}
                      <button type="button" onClick={() => setForm({ ...form, ticket_tiers: [...(form.ticket_tiers || []), { name: "", type: "regular", price: 0 }] })}
                        className="flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium">
                        <Plus className="w-3 h-3" /> {t("events.add_tier")}
                      </button>
                    </div>
                  </div>
                </>
              )}
              {form.ticket_type === "donation_based" && (
                <div>
                  <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">{t("events.donation_goal")} (cents)</label>
                  <input type="number" value={form.donation_goal || ""} onChange={(e) => setForm({ ...form, donation_goal: e.target.value ? Number(e.target.value) : null })} className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15" />
                </div>
              )}
            </div>
            <label className="flex items-center gap-2 text-sm text-stone-700 dark:text-stone-300">
              <input type="checkbox" checked={form.is_online || false} onChange={(e) => setForm({ ...form, is_online: e.target.checked })} className="rounded border-primary-200 dark:border-stone-600 text-primary-500" />
              {t("events.online_event")}
            </label>
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">{t("events.recurrence")}</label>
              <select value={form.recurrence_type || "none"} onChange={(e) => setForm({ ...form, recurrence_type: e.target.value, recurrence_config: e.target.value === "open_door" ? { weekly_hours: (() => { const h: Record<string, any> = {}; DAYS_OF_WEEK.forEach((d) => { h[d] = { open: "09:00", close: "18:00" }; }); return h; })() } : e.target.value === "none" ? null : (form.recurrence_config || {}) })}
                className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15">
                {RECURRENCE_TYPES.map((r) => <option key={r.value} value={r.value}>{t(`events.${r.labelKey}`)}</option>)}
              </select>
              {form.recurrence_type && form.recurrence_type !== "none" && form.recurrence_type !== "open_door" && (
                <div className="mt-2">
                  <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">{t("events.recurrence_end")}</label>
                  <input type="datetime-local" value={form.recurrence_config?.recurrence_end ? new Date(form.recurrence_config.recurrence_end).toISOString().slice(0, 16) : ""}
                    onChange={(e) => setForm({ ...form, recurrence_config: { ...(form.recurrence_config || {}), recurrence_end: e.target.value ? new Date(e.target.value).toISOString() : null } })}
                    className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15" />
                </div>
              )}
              {form.recurrence_type === "open_door" && (
                <div className="mt-3 space-y-2">
                  <p className="text-xs text-stone-500 dark:text-stone-400">{t("events.weekly_hours_hint")}</p>
                  {DAYS_OF_WEEK.map((day) => {
                    const hours = form.recurrence_config?.weekly_hours?.[day];
                    return (
                      <div key={day} className="flex items-center gap-2">
                        <label className="w-10 text-sm font-medium text-stone-600 dark:text-stone-300">{t(`events.day_${day}`)}</label>
                        <input type="checkbox" checked={!!hours} onChange={(e) => {
                          const wh = { ...(form.recurrence_config?.weekly_hours || {}) };
                          wh[day] = e.target.checked ? { open: "09:00", close: "18:00" } : null;
                          setForm({ ...form, recurrence_config: { ...(form.recurrence_config || {}), weekly_hours: wh } });
                        }} className="rounded border-primary-200 dark:border-stone-600 text-primary-500" />
                        {hours && (
                          <>
                            <input type="time" value={hours.open} onChange={(e) => {
                              const wh = { ...(form.recurrence_config?.weekly_hours || {}) };
                              wh[day] = { ...wh[day], open: e.target.value };
                              setForm({ ...form, recurrence_config: { ...(form.recurrence_config || {}), weekly_hours: wh } });
                            }} className="px-2 py-1 rounded-lg border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm" />
                            <span className="text-stone-400 dark:text-stone-500">—</span>
                            <input type="time" value={hours.close} onChange={(e) => {
                              const wh = { ...(form.recurrence_config?.weekly_hours || {}) };
                              wh[day] = { ...wh[day], close: e.target.value };
                              setForm({ ...form, recurrence_config: { ...(form.recurrence_config || {}), weekly_hours: wh } });
                            }} className="px-2 py-1 rounded-lg border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm" />
                          </>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
            <div className="flex gap-3">
              <Button type="submit" onClick={handleUpdate}>{t("events.save")}</Button>
              <Button variant="secondary" onClick={() => setEditing(false)}>{t("events.cancel")}</Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
