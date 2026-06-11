"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Search, MapPin, Users, MessageCircle, Shuffle } from "lucide-react";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/locale-context";

export default function NetworkPage() {
  const { t } = useLocale();
  const [tab, setTab] = useState<"search" | "match" | "nearby">("match");
  const [query, setQuery] = useState("");
  const [users, setUsers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [following, setFollowing] = useState<Set<number>>(new Set());
  const [geo, setGeo] = useState<{ lat: number; lng: number } | null>(null);

  const [token, setToken] = useState<string | null>(null);

  useEffect(() => { setToken(localStorage.getItem("token")); }, []);
  useEffect(() => {
    if (!token) return;
    api.auth.me().then(setCurrentUser).catch(() => {});
    api.social.following().then((fl) => setFollowing(new Set(fl.map((u: any) => u.id)))).catch(() => {});
  }, [token]);

  useEffect(() => {
    if (!token) { setUsers([]); setLoading(false); return; }
    if (tab === "match") {
      setLoading(true);
      api.users.match().then(setUsers).catch(() => {}).finally(() => setLoading(false));
    } else if (tab === "nearby") {
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const g = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            setGeo(g);
            setLoading(true);
            api.users.nearby(g.lat, g.lng).then(setUsers).catch(() => {}).finally(() => setLoading(false));
          },
          () => {
            setGeo({ lat: 35.5, lng: -82.5 });
            setLoading(true);
            api.users.nearby(35.5, -82.5).then(setUsers).catch(() => {}).finally(() => setLoading(false));
          }
        );
      } else {
        setGeo({ lat: 35.5, lng: -82.5 });
        setLoading(true);
        api.users.nearby(35.5, -82.5).then(setUsers).catch(() => {}).finally(() => setLoading(false));
      }
    }
  }, [tab, token]);

  const handleSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    setTab("search");
    setLoading(true);
    api.users.search({ q: query }).then(setUsers).finally(() => setLoading(false));
  };

  const handleFollow = async (userId: number) => {
    try {
      if (following.has(userId)) {
        await api.social.unfollow(userId);
        following.delete(userId);
      } else {
        await api.social.follow(userId);
        following.add(userId);
      }
      setFollowing(new Set(following));
    } catch {}
  };

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-stone-800 font-serif">{t("network.title")}</h1>
        <p className="text-stone-500 mt-1">{t("network.subtitle")}</p>
      </div>

      {!token && (
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-6 text-sm text-amber-800">
          <a href="/auth/login" className="font-medium hover:underline">{t("network.sign_in")}</a> {t("network.or")}{" "}
          <a href="/auth/register" className="font-medium hover:underline">{t("network.register")}</a> {t("network.to_discover")}
        </div>
      )}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button onClick={() => setTab("match")} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm border transition ${tab === "match" ? "bg-primary-600 text-white border-primary-600" : "bg-white text-stone-600 border-stone-300 hover:bg-stone-50"}`}>
          <Shuffle className="w-4 h-4" /> {t("network.match_by_interest")}
        </button>
        <button onClick={() => setTab("search")} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm border transition ${tab === "search" ? "bg-primary-600 text-white border-primary-600" : "bg-white text-stone-600 border-stone-300 hover:bg-stone-50"}`}>
          <Search className="w-4 h-4" /> {t("network.search_people")}
        </button>
        <button onClick={() => setTab("nearby")} className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm border transition ${tab === "nearby" ? "bg-primary-600 text-white border-primary-600" : "bg-white text-stone-600 border-stone-300 hover:bg-stone-50"}`}>
          <MapPin className="w-4 h-4" /> {t("network.nearby")}
        </button>
      </div>

      {tab === "search" && (
        <form onSubmit={handleSearch} className="mb-6">
          <div className="relative max-w-xl">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 w-5 h-5" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("network.search_placeholder")}
              className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
        </form>
      )}

      {tab === "nearby" && geo && (
        <p className="text-sm text-stone-500 mb-4">
          {t("network.showing_near", { lat: geo.lat.toFixed(2), lng: geo.lng.toFixed(2) })}
        </p>
      )}

      {loading ? (
        <p className="text-stone-500 py-8">{t("network.loading")}</p>
      ) : users.length === 0 ? (
        <div className="text-center py-20 text-stone-400">
          <Users className="w-16 h-16 mx-auto mb-4 opacity-50" />
          <p>{tab === "match" ? t("network.no_matches") : t("network.no_users")}</p>
        </div>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {users.map((user) => (
            <div key={user.id} className="bg-white p-5 rounded-xl border border-stone-200 hover:shadow-md transition">
              <Link href={`/profile/${user.id}`} className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-full bg-primary-100 flex items-center justify-center text-primary-700 font-medium shrink-0">
                  {user.name?.[0]?.toUpperCase() || "?"}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-stone-800 truncate">{user.name}</p>
                  {user.location && <p className="text-xs text-stone-400 truncate">{user.location}</p>}
                </div>
              </Link>
              {user.bio && <p className="text-sm text-stone-600 line-clamp-2 mb-3">{user.bio}</p>}
              {user.skills && user.skills.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {user.skills.slice(0, 3).map((s: string) => (
                    <span key={s} className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded">{s}</span>
                  ))}
                  {user.skills.length > 3 && <span className="text-xs text-stone-400">+{user.skills.length - 3}</span>}
                </div>
              )}
              {currentUser && currentUser.id !== user.id && (
                <div className="flex gap-2 mt-3">
                  <button onClick={() => handleFollow(user.id)}
                    className={`text-xs px-3 py-1.5 rounded-lg transition ${following.has(user.id) ? "border border-stone-300 text-stone-600 hover:bg-stone-50" : "bg-primary-600 text-white hover:bg-primary-700"}`}>
                    {following.has(user.id) ? t("network.unfollow") : t("network.follow")}
                  </button>
                  <Link href={`/messages?user=${user.id}`}
                    className="text-xs px-3 py-1.5 rounded-lg border border-stone-300 text-stone-600 hover:bg-stone-50 flex items-center gap-1">
                    <MessageCircle className="w-3 h-3" /> {t("network.message")}
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
