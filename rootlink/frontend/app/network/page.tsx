"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { Search, MapPin, Users, MessageCircle, Shuffle, User, Sparkles, BarChart3, Globe, Hash } from "lucide-react";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/locale-context";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";
import { ProgressBar } from "@/components/ui/ProgressBar";

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

  // Stats state
  const [regions, setRegions] = useState<{ region: string; count: number }[]>([]);
  const [skills, setSkills] = useState<{ skill: string; count: number }[]>([]);
  const [statsLoading, setStatsLoading] = useState(true);

  useEffect(() => { setToken(localStorage.getItem("token")); }, []);
  useEffect(() => {
    if (!token) return;
    api.auth.me().then(setCurrentUser).catch(() => {});
    api.social.following().then((fl) => setFollowing(new Set(fl.map((u: any) => u.id)))).catch(() => {});
  }, [token]);

  // Fetch stats
  useEffect(() => {
    Promise.all([
      api.users.stats.regions().catch(() => []),
      api.users.stats.skills().catch(() => []),
    ]).then(([r, s]) => {
      setRegions(r);
      setSkills(s);
    }).finally(() => setStatsLoading(false));
  }, []);

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

  const tabs = [
    { id: "match" as const, label: t("network.match_by_interest"), icon: Sparkles },
    { id: "search" as const, label: t("network.search_people"), icon: Search },
    { id: "nearby" as const, label: t("network.nearby"), icon: MapPin },
  ];

  const maxRegionCount = Math.max(...regions.map(r => r.count), 1);
  const maxSkillCount = Math.max(...skills.map(s => s.count), 1);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-12">
      <PageHeader
        icon={<Users className="w-5 h-5 text-primary-500" />}
        title={t("network.title")}
        subtitle={t("network.subtitle")}
      />

      {!token && (
        <div className="bg-amber-50 border border-amber-200 rounded-2xl p-4 mb-6 text-sm text-amber-800">
          <a href="/auth/login" className="font-medium hover:underline">{t("network.sign_in")}</a> {t("network.or")}{" "}
          <a href="/auth/register" className="font-medium hover:underline">{t("network.register")}</a> {t("network.to_discover")}
        </div>
      )}

      <div className="flex gap-2 mb-8 flex-wrap">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm border transition-all ${
              tab === t.id
                ? "bg-primary-500 text-white border-primary-500 shadow-sm"
                : "bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 border-primary-100 dark:border-stone-700 hover:border-primary-300 dark:hover:border-primary-600"
            }`}
          >
            <t.icon className="w-4 h-4" /> {t.label}
          </button>
        ))}
      </div>

      {tab === "search" && (
        <form onSubmit={handleSearch} className="mb-6">
          <div className="relative max-w-xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-stone-400 dark:text-stone-500 w-5 h-5" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("network.search_placeholder")}
              className="w-full pl-12 pr-4 py-2.5 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15"
            />
          </div>
        </form>
      )}

      {tab === "nearby" && geo && (
        <p className="text-sm text-stone-500 mb-4 font-light">
          {t("network.showing_near", { lat: geo.lat.toFixed(2), lng: geo.lng.toFixed(2) })}
        </p>
      )}

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => <CardSkeleton key={i} />)}
        </div>
      ) : users.length === 0 ? (
        <EmptyState
          icon={<Users className="w-7 h-7" />}
          title={tab === "match" ? t("network.no_matches") : t("network.no_users")}
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {users.map((user) => (
            <div key={user.id} className="card-lift p-5">
              <Link href={`/profile/${user.id}`} className="flex items-center gap-3 mb-3">
                <div className="w-12 h-12 rounded-2xl bg-primary-100 dark:bg-primary-950/20 flex items-center justify-center text-primary-700 font-bold shrink-0 text-lg">
                  {user.name?.[0]?.toUpperCase() || "?"}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-stone-800 dark:text-stone-100 truncate">{user.name}</p>
                  {user.location && <p className="text-xs text-stone-00 dark:text-stone-500 truncate">{user.location}</p>}
                </div>
              </Link>
              {user.bio && <p className="text-sm text-stone-500 line-clamp-2 mb-3 font-light">{user.bio}</p>}
              {user.skills && user.skills.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-2">
                  {user.skills.slice(0, 3).map((s: string) => (
                    <Badge key={s} variant="sage" className="text-[11px]">{s}</Badge>
                  ))}
                  {user.skills.length > 3 && <Badge variant="stone" className="text-[11px]">+{user.skills.length - 3}</Badge>}
                </div>
              )}
              {currentUser && currentUser.id !== user.id && (
                <div className="flex gap-2 mt-3">
                  <Button
                    variant={following.has(user.id) ? "secondary" : "primary"}
                    size="sm"
                    onClick={() => handleFollow(user.id)}
                  >
                    {following.has(user.id) ? t("network.unfollow") : t("network.follow")}
                  </Button>
                  <Link href={`/messages?user=${user.id}`}>
                    <Button variant="secondary" size="sm">
                      <MessageCircle className="w-3 h-3" /> {t("network.message")}
                    </Button>
                  </Link>
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Network visualization */}
      {!statsLoading && (regions.length > 0 || skills.length > 0) && (
        <div className="mt-16 grid md:grid-cols-2 gap-8">
          {/* Region distribution */}
          {regions.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Globe className="w-5 h-5 text-primary-500" />
                <h2 className="text-lg font-serif font-bold text-stone-800">{t("network.regions_title") || "Community by region"}</h2>
              </div>
              <Card variant="plain" className="p-5 space-y-2.5">
                {regions.slice(0, 8).map((r) => (
                  <div key={r.region} className="flex items-center gap-3">
                    <span className="text-xs text-stone-500 w-2 text-right font-medium">{r.count}</span>
              <div className="flex-1">
                <div className="flex justify-between mb-0.5">
                  <span className="text-xs text-stone-700 dark:text-stone-300 font-light truncate">{r.region}</span>
                </div>
                <div className="h-2 bg-primary-100 dark:bg-primary-900/30 rounded-full overflow-hidden">
                  <div className="h-full bg-primary-500 rounded-full transition-all"
                    style={{ width: `${(r.count / maxRegionCount) * 100}%` }}
                  />
                </div>
              </div>
                  </div>
                ))}
              </Card>
            </div>
          )}

          {/* Skills distribution */}
          {skills.length > 0 && (
            <div>
              <div className="flex items-center gap-2 mb-4">
                <Hash className="w-5 h-5 text-earth-500" />
                <h2 className="text-lg font-serif font-bold text-stone-800">{t("network.skills_title") || "Top skills"}</h2>
              </div>
              <Card variant="plain" className="p-5 space-y-2.5">
                {skills.slice(0, 10).map((s) => (
                  <div key={s.skill} className="flex items-center gap-3">
                    <span className="text-xs text-stone-500 w-2 text-right font-medium">{s.count}</span>
              <div className="flex-1">
                <div className="flex justify-between mb-0.5">
                  <span className="text-xs text-stone-700 dark:text-stone-300 font-medium capitalize truncate">{s.skill}</span>
                </div>
                <div className="h-2 bg-earth-100 dark:bg-earth-900/30 rounded-full overflow-hidden">
                  <div className="h-full bg-earth-500 rounded-full transition-all"
                    style={{ width: `${(s.count / maxSkillCount) * 100}%` }}
                  />
                </div>
              </div>
                  </div>
                ))}
              </Card>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
