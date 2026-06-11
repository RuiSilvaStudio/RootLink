"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Calendar, MapPin, Globe, Users, Edit3, Trash2, ArrowLeft, CheckCircle, XCircle, Clock } from "lucide-react";
import { api } from "@/lib/api";

export default function EventDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [event, setEvent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [userId, setUserId] = useState<number | null>(null);
  const [rsvped, setRsvped] = useState(false);
  const [attendees, setAttendees] = useState<any[]>([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});
  const [showAttendees, setShowAttendees] = useState(false);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      api.auth.me().then((u) => setUserId(u.id)).catch(() => {});
    }
  }, []);

  useEffect(() => {
    const id = Number(params.id);
    if (!id) return;
    api.events.get(id).then(async (ev) => {
      setEvent(ev);
      setForm(ev);
      setLoading(false);
      const [a, my] = await Promise.all([
        api.events.attendees(id),
        api.events.myRsvps().catch(() => []),
      ]);
      setAttendees(a);
      setRsvped(my.some((r: any) => r.event_id === id));
    }).catch(() => {
      setError("Event not found");
      setLoading(false);
    });
  }, [params.id]);

  const handleRsvp = async () => {
    try {
      await api.events.rsvp(event.id);
      setRsvped(true);
      setAttendees([...attendees, { id: userId }]);
    } catch (err: any) {
      alert(err.message);
    }
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
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleDelete = async () => {
    if (!confirm("Delete this event?")) return;
    await api.events.delete(event.id);
    router.push("/events");
  };

  if (loading) return <div className="text-center py-20 text-stone-500">Loading...</div>;
  if (error) return <div className="text-center py-20 text-stone-400">{error}</div>;
  if (!event) return null;

  const isOwner = userId === event.created_by;
  const full = event.max_attendees && attendees.length >= event.max_attendees;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-stone-500 hover:text-primary-700 mb-6">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      {editing ? (
        <form onSubmit={handleUpdate} className="bg-white p-6 rounded-xl border border-stone-200 space-y-4">
          <h2 className="text-xl font-bold text-stone-800 font-serif">Edit Event</h2>
          {["title", "description", "location", "category", "url", "image_url"].map((f) => (
            <div key={f}>
              <label className="block text-sm font-medium text-stone-700 mb-1 capitalize">{f.replace(/_/g, " ")}</label>
              {f === "description" ? (
                <textarea value={form[f] || ""} onChange={(e) => setForm({ ...form, [f]: e.target.value })} rows={3} className="w-full px-3 py-2 rounded-lg border border-stone-300" />
              ) : (
                <input type="text" value={form[f] || ""} onChange={(e) => setForm({ ...form, [f]: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-stone-300" />
              )}
            </div>
          ))}
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Date</label>
              <input type="datetime-local" value={form.date ? new Date(form.date).toISOString().slice(0, 16) : ""} onChange={(e) => setForm({ ...form, date: new Date(e.target.value).toISOString() })} className="w-full px-3 py-2 rounded-lg border border-stone-300" />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">Max Attendees</label>
              <input type="number" value={form.max_attendees || ""} onChange={(e) => setForm({ ...form, max_attendees: e.target.value ? Number(e.target.value) : null })} className="w-full px-3 py-2 rounded-lg border border-stone-300" />
            </div>
          </div>
          <div className="flex items-center gap-2">
            <input type="checkbox" id="is_online" checked={form.is_online || false} onChange={(e) => setForm({ ...form, is_online: e.target.checked })} />
            <label htmlFor="is_online" className="text-sm text-stone-700">Online event</label>
          </div>
          <div className="flex gap-3">
            <button type="submit" className="bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition">Save</button>
            <button type="button" onClick={() => setEditing(false)} className="text-stone-500 px-4 py-2 border border-stone-300 rounded-lg hover:bg-stone-50 transition">Cancel</button>
          </div>
        </form>
      ) : (
        <>
          {event.image_url && (
            <img src={event.image_url} alt="" className="w-full h-64 object-cover rounded-xl mb-6" />
          )}
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-stone-800 font-serif">{event.title}</h1>
              {event.category && (
                <span className="inline-block mt-2 text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded">{event.category}</span>
              )}
            </div>
            {isOwner && (
              <div className="flex gap-2">
                <button onClick={() => setEditing(true)} className="text-stone-500 hover:text-primary-700 p-2"><Edit3 className="w-5 h-5" /></button>
                <button onClick={handleDelete} className="text-stone-500 hover:text-red-600 p-2"><Trash2 className="w-5 h-5" /></button>
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-4 mt-4 text-sm text-stone-500">
            <span className="flex items-center gap-1"><Calendar className="w-4 h-4" />{new Date(event.date).toLocaleDateString("en-US", { weekday: "long", month: "long", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
            {event.end_date && <span className="flex items-center gap-1"><Clock className="w-4 h-4" />{new Date(event.end_date).toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>}
            {event.location && <span className="flex items-center gap-1"><MapPin className="w-4 h-4" />{event.location}</span>}
            {event.is_online && <span className="flex items-center gap-1"><Globe className="w-4 h-4" />Online</span>}
            <button onClick={() => setShowAttendees(!showAttendees)} className="flex items-center gap-1 hover:text-primary-700"><Users className="w-4 h-4" />{attendees.length}{event.max_attendees ? ` / ${event.max_attendees}` : ""}</button>
          </div>

          {event.description && (
            <p className="mt-6 text-stone-700 whitespace-pre-wrap">{event.description}</p>
          )}

          {event.url && (
            <a href={event.url} target="_blank" rel="noopener noreferrer" className="inline-block mt-4 text-primary-600 hover:underline text-sm">Event link →</a>
          )}

          <div className="mt-8 flex gap-3">
            {userId && !rsvped && (
              <button onClick={handleRsvp} disabled={full} className="flex items-center gap-2 bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition disabled:opacity-50 disabled:cursor-not-allowed">
                <CheckCircle className="w-4 h-4" /> {full ? "Full" : "RSVP"}
              </button>
            )}
            {rsvped && (
              <button onClick={handleCancelRsvp} className="flex items-center gap-2 bg-white text-stone-600 px-6 py-2 rounded-lg border border-stone-300 hover:bg-stone-50 transition">
                <XCircle className="w-4 h-4" /> Cancel RSVP
              </button>
            )}
          </div>

          {showAttendees && (
            <div className="mt-6 bg-white p-4 rounded-xl border border-stone-200">
              <h3 className="font-semibold text-stone-700 mb-3">Attendees ({attendees.length})</h3>
              {attendees.length === 0 ? (
                <p className="text-sm text-stone-400">No attendees yet.</p>
              ) : (
                <div className="space-y-2">
                  {attendees.map((a: any) => (
                    <div key={a.id} className="flex items-center gap-2 text-sm text-stone-600">
                      <div className="w-8 h-8 bg-primary-100 text-primary-700 rounded-full flex items-center justify-center text-xs font-medium">
                        {a.name?.[0]?.toUpperCase() || "?"}
                      </div>
                      {a.name}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </>
      )}
    </div>
  );
}
