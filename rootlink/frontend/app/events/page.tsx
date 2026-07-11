"use client";

import { useState, useEffect } from "react";
import { Calendar, Plus, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/locale-context";
import { useToast } from "@/lib/toast-context";
import { useDirtyGuard } from "@/lib/use-dirty-guard";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { ImageUpload } from "@/components/ui/ImageUpload";
import { FilterPill } from "@/components/ui/DeFacto";
import { Text } from "@/components/ui/Text";
import { EventListCard } from "@/components/cards/EventListCard";
import { BlockRenderer, type BlockSectionData } from "@/components/blocks";

const VISIBILITY_OPTIONS = [
  { value: "all", labelKey: "vis_all" },
  { value: "registered", labelKey: "vis_registered" },
  { value: "role_based", labelKey: "vis_role_based" },
  { value: "group_only", labelKey: "vis_group_only" },
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

const defaultWeeklyHours = () => {
  const hours: Record<string, { open: string; close: string } | null> = {};
  DAYS_OF_WEEK.forEach((d) => { hours[d] = { open: "09:00", close: "18:00" }; });
  return hours;
};

export default function EventsPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState("");
  const [family, setFamily] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [isOnline, setIsOnline] = useState(false);
  const [eventCategory, setEventCategory] = useState("");
  const [eventFamily, setEventFamily] = useState("");
  const [maxAttendees, setMaxAttendees] = useState("");
  const [visibility, setVisibility] = useState("all");
  const [ticketType, setTicketType] = useState("free");
  const [ticketPrice, setTicketPrice] = useState("");
  const [ticketTiers, setTicketTiers] = useState<{ name: string; type: string; price: number }[]>([]);
  const [recurrenceType, setRecurrenceType] = useState("none");
  const [recurrenceConfig, setRecurrenceConfig] = useState<any>({});
  const [descriptionLong, setDescriptionLong] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [families, setFamilies] = useState<any[]>([]);
  const [familyCategories, setFamilyCategories] = useState<any[]>([]);
  const [formFamilyCategories, setFormFamilyCategories] = useState<any[]>([]);
  const [heroSections, setHeroSections] = useState<BlockSectionData[] | null>(null);
  const dirty = !!(title || description || date || location || maxAttendees || eventCategory || isOnline || descriptionLong);
  useDirtyGuard(dirty);
  const { t, locale } = useLocale();
  const { addToast } = useToast();

  useEffect(() => {
    setToken(localStorage.getItem("token"));
    if (new URLSearchParams(window.location.search).get("new") === "1") setShowForm(true);
    api.blocks.getPage("events").then((p) => p?.sections?.length ? setHeroSections(p.sections) : setHeroSections([])).catch(() => setHeroSections([]));
  }, []);
  useEffect(() => {
    api.taxonomy.families().then(setFamilies).catch(() => {});
    loadEvents();
  }, [category, family]); // eslint-disable-line react-hooks/exhaustive-deps

  const loadEvents = () => {
    setLoading(true);
    api.events.list(true, category || undefined, undefined, undefined, family || undefined).then(setEvents).catch(() => {}).finally(() => setLoading(false));
  };

  const handleFormFamilyChange = (famValue: string) => {
    setEventFamily(famValue);
    setEventCategory("");
    if (famValue) {
      api.taxonomy.categories(famValue).then(setFormFamilyCategories).catch(() => setFormFamilyCategories([]));
    } else {
      setFormFamilyCategories([]);
    }
  };

  const handleFilterFamilyChange = (famValue: string) => {
    setFamily(famValue);
    setCategory("");
    if (famValue) {
      api.taxonomy.categories(famValue).then(setFamilyCategories).catch(() => setFamilyCategories([]));
    } else {
      setFamilyCategories([]);
    }
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const event = await api.events.create({
        title,
        description,
        description_long: descriptionLong || undefined,
        date: new Date(date).toISOString(),
        location: location || undefined,
        is_online: isOnline,
        category: eventCategory || undefined,
        family: eventFamily || undefined,
        max_attendees: maxAttendees ? Number(maxAttendees) : undefined,
        visibility,
        ticket_type: ticketType,
        ticket_price: ticketType === "paid" && ticketPrice ? Number(ticketPrice) : undefined,
        ticket_tiers: ticketType === "paid" && ticketTiers.length > 0 ? ticketTiers : undefined,
        recurrence_type: recurrenceType,
        recurrence_config: recurrenceType !== "none" ? recurrenceConfig : undefined,
        image_url: imageUrl || undefined,
      });
      setEvents([event, ...events]);
      setShowForm(false);
      setTitle(""); setDescription(""); setDate(""); setLocation("");
      setIsOnline(false); setEventCategory(""); setEventFamily(""); setMaxAttendees("");
      setVisibility("all"); setTicketType("free"); setTicketPrice(""); setTicketTiers([]);
      setRecurrenceType("none"); setRecurrenceConfig({}); setDescriptionLong(""); setImageUrl("");
    } catch (err: any) {
      addToast("error", err.message);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-12">
      {heroSections && heroSections.length > 0 && (
        <BlockRenderer sections={heroSections} />
      )}

      <PageHeader
        icon={<Calendar className="w-5 h-5 text-primary-500" />}
        title={<Text k="events.title" as="span" />}
        subtitle={<Text k="events.subtitle" as="span" />}
        action={token && (
          <Button variant="primary" size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="w-4 h-4" /> {t("events.new_event")}
          </Button>
        )}
      />

      <div className="flex gap-2 mb-8 flex-wrap mt-8 items-center">
        <FilterPill
          label={t("events.all")}
          active={!family}
          onClick={() => handleFilterFamilyChange("")}
        />
        {families.map((fam) => (
          <FilterPill
            key={fam.value}
            label={locale === "pt" ? fam.label_pt : fam.label}
            active={family === fam.value}
            onClick={() => handleFilterFamilyChange(fam.value)}
          />
        ))}
        {family && familyCategories.length > 0 && (
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="px-3 py-1.5 text-sm rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15"
          >
            <option value="">{t("search.all_categories") || "All categories"}</option>
            {familyCategories.map((cat) => (
              <option key={cat.value} value={cat.value}>{locale === "pt" ? cat.label_pt : cat.label}</option>
            ))}
          </select>
        )}
      </div>

      {showForm && (
        <Card variant="plain" className="p-6 mb-8 space-y-4">
          <h3 className="font-serif font-bold text-stone-800 dark:text-stone-100">{t("events.new_event")}</h3>
          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">{t("events.title_label")}</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15" />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">{t("events.cover_label") || "Cover image"}</label>
            <ImageUpload label="" requireLicense onUpload={(urls) => setImageUrl(urls.large)} onError={(m) => addToast("error", m)} />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">{t("events.date_label")}</label>
              <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} required className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15" />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">{t("events.location_label")}</label>
              <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15" />
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">{t("events.family_label")}</label>
              <select value={eventFamily} onChange={(e) => handleFormFamilyChange(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15">
                <option value="">{t("events.category_none")}</option>
                {families.map((fam) => (
                  <option key={fam.value} value={fam.value}>{locale === "pt" ? fam.label_pt : fam.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">{t("events.category_label")}</label>
              <select value={eventCategory} onChange={(e) => setEventCategory(e.target.value)} disabled={!eventFamily} className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15 disabled:opacity-50">
                <option value="">{t("events.category_none")}</option>
                {formFamilyCategories.map((cat) => (
                  <option key={cat.value} value={cat.value}>{locale === "pt" ? cat.label_pt : cat.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">{t("events.max_attendees")}</label>
              <input type="number" value={maxAttendees} onChange={(e) => setMaxAttendees(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15" />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm text-stone-700 dark:text-stone-300">
                <input type="checkbox" checked={isOnline} onChange={(e) => setIsOnline(e.target.checked)} className="rounded border-primary-200 dark:border-stone-600 text-primary-500 focus:ring-primary-500" />
                {t("events.online_event")}
              </label>
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">{t("events.visibility")}</label>
              <select value={visibility} onChange={(e) => setVisibility(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15">
                {VISIBILITY_OPTIONS.map((v) => <option key={v.value} value={v.value}>{t(`events.${v.labelKey}`)}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">{t("events.ticket_type")}</label>
              <select value={ticketType} onChange={(e) => setTicketType(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15">
                {TICKET_TYPES.map((tt) => <option key={tt.value} value={tt.value}>{t(`events.${tt.labelKey}`)}</option>)}
              </select>
            </div>
            {ticketType === "paid" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">{t("events.ticket_price")} (cents)</label>
                  <input type="number" value={ticketPrice} onChange={(e) => setTicketPrice(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15" />
                </div>
                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">{t("events.ticket_tiers")}</label>
                  <p className="text-xs text-stone-600 dark:text-stone-400 mb-2">{t("events.ticket_tiers_hint")}</p>
                  <div className="space-y-2">
                    {ticketTiers.map((tier, i) => (
                      <div key={i} className="flex gap-2 items-center">
                        <input placeholder={t("events.tier_name")} value={tier.name} onChange={(e) => { const t2 = [...ticketTiers]; t2[i] = { ...t2[i], name: e.target.value }; setTicketTiers(t2); }}
                          className="flex-1 px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15" />
                        <select value={tier.type} onChange={(e) => { const t2 = [...ticketTiers]; t2[i] = { ...t2[i], type: e.target.value }; setTicketTiers(t2); }}
                          className="px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15">
                          <option value="regular">{t("events.ticket_type_regular")}</option>
                          <option value="early_bird">{t("events.ticket_type_early_bird")}</option>
                          <option value="vip">{t("events.ticket_type_vip")}</option>
                          <option value="student">{t("events.ticket_type_student")}</option>
                        </select>
                        <input type="number" placeholder={t("events.tier_price")} value={tier.price || ""} onChange={(e) => { const t2 = [...ticketTiers]; t2[i] = { ...t2[i], price: Number(e.target.value) }; setTicketTiers(t2); }}
                          className="w-28 px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15" />
                        <button type="button" onClick={() => setTicketTiers(ticketTiers.filter((_, j) => j !== i))} className="text-stone-400 dark:text-stone-500 hover:text-red-500 dark:hover:text-red-400 transition">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                    <button type="button" onClick={() => setTicketTiers([...ticketTiers, { name: "", type: "regular", price: 0 }])}
                      className="flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 dark:hover:text-primary-300 font-medium">
                      <Plus className="w-3 h-3" /> {t("events.add_tier")}
                    </button>
                  </div>
                </div>
              </>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">{t("events.recurrence")}</label>
            <select value={recurrenceType} onChange={(e) => { setRecurrenceType(e.target.value); if (e.target.value === "open_door") setRecurrenceConfig({ weekly_hours: defaultWeeklyHours() }); else setRecurrenceConfig({}); }}
              className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15">
              {RECURRENCE_TYPES.map((r) => <option key={r.value} value={r.value}>{t(`events.${r.labelKey}`)}</option>)}
            </select>
            {recurrenceType !== "none" && recurrenceType !== "open_door" && (
              <div className="mt-2">
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">{t("events.recurrence_end")}</label>
                <input type="datetime-local" value={recurrenceConfig.recurrence_end ? new Date(recurrenceConfig.recurrence_end).toISOString().slice(0, 16) : ""}
                  onChange={(e) => setRecurrenceConfig({ ...recurrenceConfig, recurrence_end: e.target.value ? new Date(e.target.value).toISOString() : null })}
                  className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15" />
              </div>
            )}
            {recurrenceType === "open_door" && (
              <div className="mt-3 space-y-2">
                <p className="text-xs text-stone-600 dark:text-stone-400">{t("events.weekly_hours_hint")}</p>
                {DAYS_OF_WEEK.map((day) => {
                  const hours = recurrenceConfig.weekly_hours?.[day];
                  return (
                    <div key={day} className="flex items-center gap-2">
                      <label className="w-10 text-sm font-medium text-stone-600 dark:text-stone-300">{t(`events.day_${day}`)}</label>
                      <input type="checkbox" checked={!!hours} onChange={(e) => {
                        const wh = { ...(recurrenceConfig.weekly_hours || defaultWeeklyHours()) };
                        wh[day] = e.target.checked ? { open: "09:00", close: "18:00" } : null;
                        setRecurrenceConfig({ ...recurrenceConfig, weekly_hours: wh });
                      }} className="rounded border-primary-200 dark:border-stone-600 text-primary-500" />
                      {hours && (
                        <>
                          <input type="time" value={hours.open} onChange={(e) => {
                            const wh = { ...(recurrenceConfig.weekly_hours || {}) };
                            wh[day] = { ...wh[day], open: e.target.value };
                            setRecurrenceConfig({ ...recurrenceConfig, weekly_hours: wh });
                          }} className="px-2 py-1 rounded-lg border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm" />
                          <span className="text-stone-400 dark:text-stone-500">—</span>
                          <input type="time" value={hours.close} onChange={(e) => {
                            const wh = { ...(recurrenceConfig.weekly_hours || {}) };
                            wh[day] = { ...wh[day], close: e.target.value };
                            setRecurrenceConfig({ ...recurrenceConfig, weekly_hours: wh });
                          }} className="px-2 py-1 rounded-lg border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm" />
                        </>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">{t("events.description_label")}</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15" />
          </div>
          <Button type="submit" onClick={handleCreate}>{t("events.create_event")}</Button>
        </Card>
      )}

      {loading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="rounded-2xl bg-stone-100/60 animate-pulse h-72" />
          ))}
        </div>
      ) : events.length === 0 ? (
        <EmptyState
          icon={<Calendar className="w-7 h-7" />}
          title={t("events.no_events")}
        />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {events.map((event, idx) => {
            const eventDate = new Date(event.date);
            const now = new Date();
            const isUpcoming = eventDate > now && idx === 0;
            return (
              <EventListCard key={event.id} event={event} isUpcoming={isUpcoming} locale={locale} />
            );
          })}
        </div>
      )}
    </div>
  );
}
