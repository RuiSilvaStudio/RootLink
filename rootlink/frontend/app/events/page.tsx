"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Calendar, MapPin, Plus, Users, Globe } from "lucide-react";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/locale-context";

export default function EventsPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [category, setCategory] = useState("");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState("");
  const [location, setLocation] = useState("");
  const [isOnline, setIsOnline] = useState(false);
  const [eventCategory, setEventCategory] = useState("");
  const [maxAttendees, setMaxAttendees] = useState("");
  const { t } = useLocale();

  useEffect(() => { setToken(localStorage.getItem("token")); }, []);
  useEffect(() => { loadEvents(); }, [category]);

  const loadEvents = () => {
    setLoading(true);
    api.events.list(true, category || undefined).then(setEvents).catch(() => {}).finally(() => setLoading(false));
  };

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const event = await api.events.create({
        title,
        description,
        date: new Date(date).toISOString(),
        location: location || undefined,
        is_online: isOnline,
        category: eventCategory || undefined,
        max_attendees: maxAttendees ? Number(maxAttendees) : undefined,
      });
      setEvents([event, ...events]);
      setShowForm(false);
      setTitle(""); setDescription(""); setDate(""); setLocation("");
      setIsOnline(false); setEventCategory(""); setMaxAttendees("");
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-stone-800 font-serif">{t("events.title")}</h1>
          <p className="text-stone-500 mt-1">{t("events.subtitle")}</p>
        </div>
        {token && (
          <button
            onClick={() => setShowForm(!showForm)}
            className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition text-sm"
          >
            <Plus className="w-4 h-4" /> {t("events.new_event")}
          </button>
        )}
      </div>

      <div className="flex gap-2 mb-6">
        {[
          ["", t("events.all")],
          ["gardening", t("events.category_gardening")],
          ["woodworking", t("events.category_woodworking")],
          ["craft_trades", t("events.category_craft_trades")],
          ["homesteading", t("events.category_homesteading")],
        ].map(([val, label]) => (
          <button
            key={val}
            onClick={() => setCategory(val)}
            className={`px-3 py-1.5 rounded-lg text-sm border transition ${
              category === val
                ? "bg-primary-600 text-white border-primary-600"
                : "bg-white text-stone-600 border-stone-300 hover:bg-stone-50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {showForm && (
        <form onSubmit={handleCreate} className="bg-white p-6 rounded-xl border border-stone-200 mb-8 space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">{t("events.title_label")}</label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} required className="w-full px-3 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">{t("events.date_label")}</label>
              <input type="datetime-local" value={date} onChange={(e) => setDate(e.target.value)} required className="w-full px-3 py-2 rounded-lg border border-stone-300" />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">{t("events.location_label")}</label>
              <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-stone-300" />
            </div>
          </div>
          <div className="grid md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">{t("events.category_label")}</label>
              <select value={eventCategory} onChange={(e) => setEventCategory(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-stone-300">
                <option value="">{t("events.category_none")}</option>
                <option value="gardening">{t("events.category_gardening")}</option>
                <option value="woodworking">{t("events.category_woodworking")}</option>
                <option value="craft_trades">{t("events.category_craft_trades")}</option>
                <option value="homesteading">{t("events.category_homesteading")}</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">{t("events.max_attendees")}</label>
              <input type="number" value={maxAttendees} onChange={(e) => setMaxAttendees(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-stone-300" />
            </div>
            <div className="flex items-end pb-2">
              <label className="flex items-center gap-2 text-sm text-stone-700">
                <input type="checkbox" checked={isOnline} onChange={(e) => setIsOnline(e.target.checked)} />
                {t("events.online_event")}
              </label>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">{t("events.description_label")}</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full px-3 py-2 rounded-lg border border-stone-300" />
          </div>
          <button type="submit" className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition">
            {t("events.create_event")}
          </button>
        </form>
      )}

      {loading ? (
        <p className="text-stone-500">{t("events.loading")}</p>
      ) : events.length === 0 ? (
        <div className="text-center py-20 text-stone-400">
          <Calendar className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>{t("events.no_events")}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {events.map((event) => (
            <Link
              key={event.id}
              href={`/events/${event.id}`}
              className="block bg-white p-5 rounded-xl border border-stone-200 hover:shadow-md transition"
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <h3 className="font-semibold text-stone-800 text-lg">{event.title}</h3>
                  <p className="text-sm text-stone-500 mt-1">
                    {event.description?.slice(0, 200)}
                  </p>
                </div>
                {event.category && (
                  <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded ml-4 shrink-0">
                    {event.category}
                  </span>
                )}
              </div>
              <div className="flex gap-4 mt-3 text-sm text-stone-500">
                <span className="flex items-center gap-1">
                  <Calendar className="w-4 h-4" />
                  {new Date(event.date).toLocaleDateString("en-US", {
                    weekday: "short", month: "short", day: "numeric", year: "numeric",
                  })}
                </span>
                {event.location && (
                  <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{event.location}</span>
                )}
                {event.is_online && (
                  <span className="flex items-center gap-1"><Globe className="w-4 h-4" />{t("events.online")}</span>
                )}
                <span className="flex items-center gap-1"><Users className="w-4 h-4" />{event.attendee_count}{event.max_attendees ? `/${event.max_attendees}` : ""}</span>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
