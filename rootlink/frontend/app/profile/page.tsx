"use client";

import { useState, useEffect, useCallback, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  User, MapPin, Save, LogOut, Users, UserPlus, UserMinus, Eye, EyeOff,
  FileText, Calendar, BookOpen, MessageSquare, Ticket, Heart, Bookmark,
  Settings, Rss, Clock, CheckCircle, QrCode, Shield, Sprout, GraduationCap, Building,
  Package, Tag, Gift, ArrowRightLeft, ShoppingCart,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/lib/locale-context";
import { useToast } from "@/lib/toast-context";
import { useDirtyGuard } from "@/lib/use-dirty-guard";
import { safeImageUrl } from "@/lib/image-url";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { Avatar } from "@/components/ui/Avatar";
import { ImageUpload } from "@/components/ui/ImageUpload";

const TABS = ["about", "activity", "marketplace", "events", "discussions", "settings"] as const;
type Tab = (typeof TABS)[number];

const typeIcons: Record<string, any> = {
  content: FileText,
  event: Calendar,
  group: Users,
  course: BookOpen,
  comment: MessageSquare,
  rsvp: Calendar,
  donation: Heart,
  ticket: Ticket,
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
};

export default function ProfilePageWrapper() {
  return (
    <Suspense fallback={<div className="max-w-3xl mx-auto px-4 py-12"><div className="h-64 bg-primary-100 dark:bg-primary-950/20/40 rounded-2xl animate-pulse" /></div>}>
      <ProfilePage />
    </Suspense>
  );
}

function ProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { t, locale } = useLocale();
  const { logout } = useAuth();
  const { addToast } = useToast();

  const [profile, setProfile] = useState<any>(null);
  const [activity, setActivity] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<Tab>("about");
  const [following, setFollowing] = useState(false);
  const [showFollowers, setShowFollowers] = useState(false);
  const [showFollowing, setShowFollowing] = useState(false);

  // Edit form state
  const [saving, setSaving] = useState(false);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [skills, setSkills] = useState("");
  const [interests, setInterests] = useState("");
  const [visibleInNetwork, setVisibleInNetwork] = useState(true);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [websiteUrl, setWebsiteUrl] = useState("");

  // Entity edit fields
  const [servicesEdit, setServicesEdit] = useState("");
  const [serviceAreaEdit, setServiceAreaEdit] = useState("");
  const [certificationsEdit, setCertificationsEdit] = useState("");
  const [modalityEdit, setModalityEdit] = useState("");

  // Marketplace data
  const [myListings, setMyListings] = useState<any[]>([]);
  const [myOrders, setMyOrders] = useState<any[]>([]);
  const [mySales, setMySales] = useState<any[]>([]);

  const userId = searchParams.get("id") ? Number(searchParams.get("id")) : null;

  // Open a specific tab via ?tab=settings (etc.)
  useEffect(() => {
    const tabParam = searchParams.get("tab");
    if (tabParam && TABS.includes(tabParam as Tab)) {
      setActiveTab(tabParam as Tab);
    }
  }, [searchParams]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token && !userId) {
      router.push("/auth/login");
      return;
    }
    const load = async () => {
      let me: any = null;
      try { me = await api.auth.me(); setCurrentUser(me); } catch { router.push("/auth/login"); return; }

      const targetId = userId || me.id;
      const isOwn = me.id === targetId;

      const [target, act] = await Promise.all([
        isOwn ? me : api.users.get(targetId),
        api.users.activity(targetId).catch(() => null),
      ]);

      setProfile(target);
      setActivity(act);
      setName(target.name);
      setBio(target.bio || "");
      setLocation(target.location || "");
      setSkills((target.skills || []).join(", "));
      setInterests((target.interests || []).join(", "));
      setVisibleInNetwork(target.visible_in_network !== false);
      setAvatarUrl(target.avatar_url || null);
      setWebsiteUrl(target.website_url || "");
      setServicesEdit((target.services || []).join(", "));
      setServiceAreaEdit(target.service_area || "");
      setCertificationsEdit((target.certifications || []).join(", "));
      setModalityEdit(target.modality || "");

      if (!isOwn) {
        const fl = await api.social.following();
        setFollowing(fl.some((u: any) => u.id === targetId));
      }

      // Load marketplace data for own profile
      if (isOwn) {
        Promise.all([
          api.marketplace.my().catch(() => []),
          api.marketplace.myOrders().catch(() => []),
          api.marketplace.mySales().catch(() => []),
        ]).then(([listings, orders, sales]) => {
          setMyListings(listings);
          setMyOrders(orders);
          setMySales(sales);
        });
      }
    };
    load().finally(() => setLoading(false));
  }, [userId]); // eslint-disable-line react-hooks/exhaustive-deps

  const isOwnProfile = currentUser && profile && currentUser.id === profile.id;

  const profileDirty = !!(profile && (
    name !== (profile.name || "")
    || bio !== (profile.bio || "")
    || location !== (profile.location || "")
    || skills !== ((profile.skills || []).join(", "))
    || interests !== ((profile.interests || []).join(", "))
    || visibleInNetwork !== (profile.visible_in_network !== false)
    || avatarUrl !== (profile.avatar_url || null)
    || websiteUrl !== (profile.website_url || "")
  ));
  useDirtyGuard(profileDirty && !!isOwnProfile);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await api.auth.update({
        name, bio, location,
        skills: skills.split(",").map((s: string) => s.trim()).filter(Boolean),
        interests: interests.split(",").map((s: string) => s.trim()).filter(Boolean),
        visible_in_network: visibleInNetwork,
        avatar_url: avatarUrl,
        website_url: websiteUrl || undefined,
        services: servicesEdit ? servicesEdit.split(",").map((s: string) => s.trim()).filter(Boolean) : undefined,
        service_area: serviceAreaEdit || undefined,
        certifications: certificationsEdit ? certificationsEdit.split(",").map((s: string) => s.trim()).filter(Boolean) : undefined,
        modality: modalityEdit || undefined,
      });
      setProfile(updated);
      addToast("success", t("profile.saved"));
    } catch (err: any) { addToast("error", err.message); } finally { setSaving(false); }
  };

  const handleFollow = async () => {
    if (!profile) return;
    try {
      if (following) {
        await api.social.unfollow(profile.id);
        setFollowing(false);
      } else {
        await api.social.follow(profile.id);
        setFollowing(true);
      }
    } catch {}
  };

  const handleLogout = () => {
    logout();
    router.push("/");
  };

  const handleRevokeSessions = async () => {
    // Backend revokes EVERY active session, including this one
    // (app/api/auth_security.py revoke-mine → revoke_all_user_sessions),
    // so be honest in the confirm and log out locally right after.
    if (!confirm(t("profile.revoke_sessions_confirm"))) return;
    try {
      const res = await api.auth.revokeMySessions();
      addToast("success", t("profile.revoke_sessions_done", { count: res.revoked_count }));
      logout();
      router.push("/auth/login");
    } catch (err: any) {
      addToast("error", err.message);
    }
  };

  if (loading) return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-12 space-y-6">
      <div className="flex gap-4">
        <div className="w-20 h-20 rounded-full bg-primary-100 dark:bg-primary-950/20 animate-pulse" />
        <div className="space-y-2 flex-1">
          <div className="h-7 bg-primary-100 dark:bg-primary-950/20 rounded w-48 animate-pulse" />
          <div className="h-4 bg-primary-100 dark:bg-primary-950/20 rounded w-32 animate-pulse" />
        </div>
      </div>
      <div className="h-12 bg-primary-100 dark:bg-primary-950/20/60 rounded-xl animate-pulse" />
      <div className="h-64 bg-primary-100 dark:bg-primary-950/20/40 rounded-2xl animate-pulse" />
    </div>
  );
  if (!profile) return <div className="text-center py-20 text-stone-400 dark:text-stone-500">User not found</div>;

  const stats = activity?.stats || {};
  const visibleTabs = isOwnProfile
    ? TABS
    : (["about", "activity", "discussions"] as Tab[]);

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-12">
      {/* Profile header */}
      <div className="flex justify-between items-start mb-6">
        <div className="flex items-center gap-4">
          <div className="w-20 h-20 rounded-full bg-primary-100 dark:bg-primary-950/20 flex items-center justify-center overflow-hidden shrink-0">
            {safeImageUrl(avatarUrl) ? (
              <img src={safeImageUrl(avatarUrl)} alt={profile.name} className="w-full h-full object-cover" />
            ) : (
              <User className="w-10 h-10 text-primary-600" />
            )}
          </div>
          <div>
            <h1 className="text-2xl font-display font-bold text-stone-800 dark:text-stone-100 dark:text-stone-200 flex items-center gap-2">
              {profile.name}
              {profile.is_verified && (
                <Badge variant="green" className="text-[10px]"><CheckCircle className="w-3 h-3 mr-0.5" /> {t("profile.verified")}</Badge>
              )}
            </h1>
            {profile.account_type !== "individual" && (
              <Badge variant={profile.account_type === "organization" ? "blue" : "earth"} className="mt-1 text-[10px]">
                {profile.account_type === "organization" ? t("auth.type_organization") : t("auth.type_practitioner")}
              </Badge>
            )}
            {isOwnProfile && (
              <p className="text-sm text-stone-400 dark:text-stone-500">{profile.email}</p>
            )}
            {profile.location && (
              <p className="text-sm text-stone-500 flex items-center gap-1 mt-1">
                <MapPin className="w-3 h-3" /> {profile.location}
              </p>
            )}
            {activity?.member_since && (
              <p className="text-xs text-stone-400 dark:text-stone-500 flex items-center gap-1 mt-1">
                <Clock className="w-3 h-3" /> {t("profile.member_since")}: {new Date(activity.member_since).toLocaleDateString()}
              </p>
            )}
            <div className="flex gap-4 mt-2 text-sm text-stone-500">
              <button onClick={() => setShowFollowers(!showFollowers)} className="hover:text-primary-600 transition">
                <span className="font-medium text-stone-700 dark:text-stone-300">{activity?.followers?.length || 0}</span> {t("profile.followers")}
              </button>
              <button onClick={() => setShowFollowing(!showFollowing)} className="hover:text-primary-600 transition">
                <span className="font-medium text-stone-700 dark:text-stone-300">{activity?.following?.length || 0}</span> {t("profile.following")}
              </button>
            </div>
          </div>
        </div>
        <div className="flex gap-2 shrink-0">
          {!isOwnProfile && currentUser && (
            <>
              <button onClick={handleFollow}
                className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition ${
                  following ? "border border-stone-300 text-stone-600 dark:text-stone-300 hover:bg-stone-50" : "bg-primary-600 text-white hover:bg-primary-700"
                }`}>
                {following ? <UserMinus className="w-3 h-3" /> : <UserPlus className="w-3 h-3" />}
                {following ? t("profile.unfollow") : t("profile.follow")}
              </button>
              <Link href={`/messages?user=${profile.id}`}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm border border-stone-300 text-stone-600 dark:text-stone-300 hover:bg-stone-50">
                <MessageSquare className="w-3 h-3" /> {t("profile.message")}
              </Link>
            </>
          )}
          {isOwnProfile && (
            <button onClick={handleLogout}
              className="flex items-center gap-1 text-red-600 hover:text-red-700 text-sm">
              <LogOut className="w-4 h-4" /> {t("profile.logout")}
            </button>
          )}
        </div>
      </div>

      {/* Followers/following expandable lists */}
      {showFollowers && (
        <Card variant="plain" className="p-4 mb-4">
          <p className="text-sm font-display font-semibold text-stone-700 dark:text-stone-300 mb-3">{t("profile.followers")}</p>
          {activity?.followers?.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {activity.followers.map((f: any) => (
                <Link key={f.id} href={`/profile/${f.id}`} className="flex items-center gap-2 bg-primary-50 dark:bg-primary-900/20 px-3 py-1.5 rounded-full text-sm text-stone-600 dark:text-stone-400 dark:text-stone-500 hover:bg-primary-100 dark:bg-primary-950/20 transition">
                  <Avatar fallback={f.name} size="sm" />
                  {f.name}
                </Link>
              ))}
            </div>
          ) : <p className="text-sm text-stone-400 dark:text-stone-500">{t("profile.no_followers")}</p>}
        </Card>
      )}
      {showFollowing && (
        <Card variant="plain" className="p-4 mb-4">
          <p className="text-sm font-display font-semibold text-stone-700 dark:text-stone-300 mb-3">{t("profile.following")}</p>
          {activity?.following?.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {activity.following.map((f: any) => (
                <Link key={f.id} href={`/profile/${f.id}`} className="flex items-center gap-2 bg-primary-50 dark:bg-primary-900/20 px-3 py-1.5 rounded-full text-sm text-stone-600 dark:text-stone-400 dark:text-stone-500 hover:bg-primary-100 dark:bg-primary-950/20 transition">
                  <Avatar fallback={f.name} size="sm" />
                  {f.name}
                </Link>
              ))}
            </div>
          ) : <p className="text-sm text-stone-400 dark:text-stone-500">{t("profile.no_following")}</p>}
        </Card>
      )}

      {/* Stats row */}
      {activity && (
        <div className="flex gap-2 mb-6 flex-wrap">
          {stats.content > 0 && <Badge variant="sage"><FileText className="w-3 h-3 mr-1" /> {stats.content} {t("profile.articles")}</Badge>}
          {stats.events > 0 && <Badge variant="earth"><Calendar className="w-3 h-3 mr-1" /> {stats.events} {t("profile.events_created")}</Badge>}
          {stats.groups > 0 && <Badge variant="blue"><Users className="w-3 h-3 mr-1" /> {stats.groups} {t("profile.groups_created")}</Badge>}
          {stats.courses > 0 && <Badge variant="green"><BookOpen className="w-3 h-3 mr-1" /> {stats.courses} {t("profile.courses_created")}</Badge>}
          {stats.comments > 0 && <Badge variant="stone"><MessageSquare className="w-3 h-3 mr-1" /> {stats.comments} {t("profile.comments")}</Badge>}
          {stats.rsvps > 0 && <Badge variant="amber"><Calendar className="w-3 h-3 mr-1" /> {stats.rsvps} {t("profile.rsvps")}</Badge>}
          {stats.tickets > 0 && <Badge variant="stone"><Ticket className="w-3 h-3 mr-1" /> {stats.tickets} {t("profile.tickets")}</Badge>}
          {stats.donations > 0 && <Badge variant="earth"><Heart className="w-3 h-3 mr-1" /> {stats.donations} {t("profile.donations")}</Badge>}
          {stats.groups_joined > 0 && <Badge variant="sage"><Users className="w-3 h-3 mr-1" /> {stats.groups_joined} {t("profile.groups_joined")}</Badge>}
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-primary-100 dark:border-primary-800/30 overflow-x-auto pb-px">
        {visibleTabs.map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 text-sm font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? "border-primary-500 text-primary-700 dark:text-primary-400"
                : "border-transparent text-stone-400 dark:text-stone-500 hover:text-stone-600 dark:text-stone-300"
            }`}
          >
            {t(`profile.tab_${tab}`)}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div className="mt-4">
        {/* ABOUT TAB */}
        {activeTab === "about" && (
          <div className="space-y-4">
            {/* Entity-specific info */}
            {profile.account_type === "organization" && (
              <Card variant="plain" className="p-6">
                <h3 className="font-display font-semibold text-stone-800 dark:text-stone-100 dark:text-stone-200 mb-3">{t("profile.entity_info")}</h3>
                <div className="space-y-2 text-sm">
                  {profile.entity_type && (
                    <p className="flex items-center gap-2 text-stone-600 dark:text-stone-400 dark:text-stone-500">
                      <Building className="w-4 h-4 text-stone-400 dark:text-stone-500" />
                      <span className="font-medium">{t("profile.entity_type")}:</span>
                      <Badge variant="blue" className="text-[10px]">{t(`auth.entity_${profile.entity_type}`)}</Badge>
                    </p>
                  )}
                  {profile.registration_number && (
                    <p className="flex items-center gap-2 text-stone-600 dark:text-stone-400 dark:text-stone-500">
                      <FileText className="w-4 h-4 text-stone-400 dark:text-stone-500" />
                      <span className="font-medium">{t("auth.registration_number")}:</span> {profile.registration_number}
                    </p>
                  )}
                  {profile.service_area && (
                    <p className="flex items-center gap-2 text-stone-600 dark:text-stone-400 dark:text-stone-500">
                      <MapPin className="w-4 h-4 text-stone-400 dark:text-stone-500" />
                      <span className="font-medium">{t("auth.service_area")}:</span> {profile.service_area}
                    </p>
                  )}
                </div>
                {profile.services?.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-medium text-stone-500 mb-2">{t("auth.services")}</p>
                    <div className="flex flex-wrap gap-2">
                      {profile.services.map((s: string) => (
                        <span key={s} className="text-xs bg-primary-100 dark:bg-primary-950/20 text-primary-700 px-3 py-1 rounded-full">{s}</span>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            )}
            {profile.account_type === "practitioner" && (
              <Card variant="plain" className="p-6">
                <h3 className="font-display font-semibold text-stone-800 dark:text-stone-100 dark:text-stone-200 mb-3">{t("profile.practitioner_info")}</h3>
                {profile.modality && (
                  <p className="text-sm text-stone-600 dark:text-stone-400 dark:text-stone-500 mb-2">
                    <span className="font-medium">{t("auth.modality")}:</span> {profile.modality}
                  </p>
                )}
                {profile.certifications?.length > 0 && (
                  <div className="mt-2">
                    <p className="text-sm font-medium text-stone-500 mb-2">{t("auth.certifications")}</p>
                    <div className="flex flex-wrap gap-2">
                      {profile.certifications.map((c: string) => (
                        <span key={c} className="text-xs bg-earth-100 text-earth-700 px-3 py-1 rounded-full">{c}</span>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            )}
            {profile.bio && (
              <Card variant="plain" className="p-6">
                <h3 className="font-display font-semibold text-stone-800 dark:text-stone-100 dark:text-stone-200 mb-2">{t("profile.about")}</h3>
                <p className="text-stone-600 dark:text-stone-400 dark:text-stone-500 font-serif leading-relaxed">{profile.bio}</p>
              </Card>
            )}
            {profile.skills?.length > 0 && (
              <Card variant="plain" className="p-6">
                <h3 className="font-display font-semibold text-stone-800 dark:text-stone-100 dark:text-stone-200 mb-3">{t("profile.skills")}</h3>
                <div className="flex flex-wrap gap-2">
                  {profile.skills.map((s: string) => (
                    <span key={s} className="text-xs bg-primary-100 dark:bg-primary-950/20 text-primary-700 px-3 py-1 rounded-full">{s}</span>
                  ))}
                </div>
              </Card>
            )}
            {profile.interests?.length > 0 && (
              <Card variant="plain" className="p-6">
                <h3 className="font-display font-semibold text-stone-800 dark:text-stone-100 dark:text-stone-200 mb-3">{t("profile.interests")}</h3>
                <div className="flex flex-wrap gap-2">
                  {profile.interests.map((s: string) => (
                    <span key={s} className="text-xs bg-stone-100 text-stone-600 dark:text-stone-300 px-3 py-1 rounded-full">{s}</span>
                  ))}
                </div>
              </Card>
            )}
            {/* Groups joined */}
            {activity?.groups_joined?.length > 0 && (
              <Card variant="plain" className="p-6">
                <h3 className="font-display font-semibold text-stone-800 dark:text-stone-100 dark:text-stone-200 mb-3">{t("profile.groups_joined")}</h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  {activity.groups_joined.map((g: any) => (
                    <Link key={g.id} href={`/groups/${g.id}`} className="flex items-center gap-3 bg-primary-50/40 dark:bg-primary-900/10 rounded-xl p-3 hover:bg-primary-50 transition">
                      <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-950/20 flex items-center justify-center shrink-0">
                        <Users className="w-5 h-5 text-primary-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-stone-700 dark:text-stone-300 truncate">{g.name}</p>
                        {g.role !== "member" && <Badge variant="sage" className="text-[9px] mt-0.5">{g.role}</Badge>}
                      </div>
                    </Link>
                  ))}
                </div>
              </Card>
            )}
            {!profile.bio && !profile.skills?.length && !profile.interests?.length && !activity?.groups_joined?.length && (
              <EmptyState icon={<User className="w-7 h-7" />} title={t("profile.no_info")} />
            )}
          </div>
        )}

        {/* ACTIVITY TAB */}
        {activeTab === "activity" && (
          <div className="space-y-6">
            {activity?.content?.length > 0 && (
              <div>
                <h3 className="font-display font-semibold text-stone-800 dark:text-stone-100 dark:text-stone-200 mb-3 flex items-center gap-2">
                  <FileText className="w-4 h-4 text-primary-500" /> {t("profile.published_content")}
                </h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  {activity.content.map((c: any) => (
                    <Link key={c.id} href={`/content/${c.id}`} className="card-lift p-4 group">
                      <img src={safeImageUrl(c.image_url, "/images/placeholder-card.svg")} alt={c.title} className="w-full h-24 object-cover rounded-lg mb-3" />
                      <p className="text-sm font-medium text-stone-700 dark:text-stone-300 group-hover:text-primary-700 transition line-clamp-2">{c.title}</p>
                      {c.created_at && <p className="text-xs text-stone-400 dark:text-stone-500 mt-1">{new Date(c.created_at).toLocaleDateString()}</p>}
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {activity?.events?.length > 0 && (
              <div>
                <h3 className="font-display font-semibold text-stone-800 dark:text-stone-100 dark:text-stone-200 mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-earth-500" /> {t("profile.events_created")}
                </h3>
                <div className="space-y-2">
                  {activity.events.map((e: any) => (
                    <Link key={e.id} href={`/events/${e.id}`} className="flex items-center gap-3 bg-white dark:bg-stone-900 rounded-xl border border-primary-100/40 dark:border-stone-700/40 p-3 hover:shadow-md transition">
                      <div className="w-10 h-10 rounded-lg bg-earth-100 flex items-center justify-center shrink-0">
                        <Calendar className="w-5 h-5 text-earth-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-stone-700 dark:text-stone-300 truncate">{e.title}</p>
                        <p className="text-xs text-stone-400 dark:text-stone-500">{e.date ? new Date(e.date).toLocaleDateString() : ""}{e.location ? ` · ${e.location}` : ""}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {activity?.groups?.length > 0 && (
              <div>
                <h3 className="font-display font-semibold text-stone-800 dark:text-stone-100 dark:text-stone-200 mb-3 flex items-center gap-2">
                  <Users className="w-4 h-4 text-blue-500" /> {t("profile.groups_created")}
                </h3>
                <div className="grid sm:grid-cols-2 gap-3">
                  {activity.groups.map((g: any) => (
                    <Link key={g.id} href={`/groups/${g.id}`} className="flex items-center gap-3 bg-white dark:bg-stone-900 rounded-xl border border-primary-100/40 dark:border-stone-700/40 p-3 hover:shadow-md transition">
                      <div className="w-10 h-10 rounded-lg bg-blue-100 flex items-center justify-center shrink-0">
                        <Users className="w-5 h-5 text-blue-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-stone-700 dark:text-stone-300 truncate">{g.name}</p>
                        {g.family && <Badge variant="stone" className="text-[9px] mt-0.5">{g.family}</Badge>}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {activity?.courses?.length > 0 && (
              <div>
                <h3 className="font-display font-semibold text-stone-800 dark:text-stone-100 dark:text-stone-200 mb-3 flex items-center gap-2">
                  <BookOpen className="w-4 h-4 text-green-500" /> {t("profile.courses_created")}
                </h3>
                <div className="space-y-2">
                  {activity.courses.map((c: any) => (
                    <Link key={c.id} href={`/learning/courses/${c.id}`} className="flex items-center gap-3 bg-white dark:bg-stone-900 rounded-xl border border-primary-100/40 dark:border-stone-700/40 p-3 hover:shadow-md transition">
                      <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                        <BookOpen className="w-5 h-5 text-green-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-stone-700 dark:text-stone-300 truncate">{c.title}</p>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded ${c.published ? "bg-green-100 text-green-700" : "bg-amber-100 text-amber-700"}`}>
                          {c.published ? t("learning.published") : t("learning.draft")}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {!activity?.content?.length && !activity?.events?.length && !activity?.groups?.length && !activity?.courses?.length && (
              <EmptyState icon={<Rss className="w-7 h-7" />} title={t("profile.no_activity")} />
            )}
          </div>
        )}

        {/* MARKETPLACE TAB (own profile only) */}
        {activeTab === "marketplace" && isOwnProfile && (
          <div className="space-y-6">
            {/* My listings */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="font-display font-semibold text-stone-800 dark:text-stone-100 dark:text-stone-200 flex items-center gap-2">
                  <Package className="w-4 h-4 text-primary-500" /> {t("marketplace.my_listings")}
                </h3>
                <a href="/marketplace/create" className="text-sm text-primary-600 hover:text-primary-700 font-medium">
                  + {t("marketplace.list_item")}
                </a>
              </div>
              {myListings.length > 0 ? (
                <div className="grid sm:grid-cols-2 gap-3">
                  {myListings.map((lst: any) => (
                    <a key={lst.id} href={`/marketplace/${lst.id}`} className="flex items-center gap-3 bg-white dark:bg-stone-900 rounded-xl border border-primary-100/40 dark:border-stone-700/40 p-3 hover:shadow-md transition">
                      <div className="w-10 h-10 rounded-lg bg-primary-100 dark:bg-primary-950/20 flex items-center justify-center shrink-0">
                        {safeImageUrl(lst.images?.[0]) ? (
                          <img src={safeImageUrl(lst.images?.[0])} alt="" className="w-full h-full object-cover rounded-lg" />
                        ) : (
                          <Package className="w-5 h-5 text-primary-600" />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-stone-700 dark:text-stone-300 truncate">{lst.title}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <span className="text-xs text-stone-400 dark:text-stone-500">
                            {lst.listing_type === "free" ? t("marketplace.free") :
                             lst.listing_type === "swap" ? t("marketplace.swap") :
                             lst.listing_type === "want" ? t("marketplace.wanted") :
                             `€${(lst.price_cents / 100).toFixed(2)}`}
                          </span>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                            lst.status === "active" ? "bg-green-100 text-green-700" :
                            lst.status === "sold" ? "bg-stone-100 text-stone-500" :
                            "bg-amber-100 text-amber-700"
                          }`}>{lst.status}</span>
                          {lst.quantity > 0 && lst.listing_type !== "want" && (
                            <span className="text-[10px] text-stone-400 dark:text-stone-500">{lst.quantity} {t("marketplace.available")}</span>
                          )}
                        </div>
                      </div>
                    </a>
                  ))}
                </div>
              ) : (
                <p className="text-sm text-stone-400 dark:text-stone-500 py-4 text-center font-serif">{t("marketplace.no_listings")}</p>
              )}
            </div>

            {/* My sales */}
            {mySales.length > 0 && (
              <div>
                <h3 className="font-display font-semibold text-stone-800 dark:text-stone-100 dark:text-stone-200 mb-3 flex items-center gap-2">
                  <Tag className="w-4 h-4 text-earth-500" /> {t("marketplace.my_sales")}
                </h3>
                <div className="space-y-2">
                  {mySales.map((sale: any) => (
                    <div key={sale.id} className="flex items-center gap-3 bg-white dark:bg-stone-900 rounded-xl border border-primary-100/40 dark:border-stone-700/40 p-3">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-stone-700 dark:text-stone-300 truncate">{sale.listing_title}</p>
                        <p className="text-xs text-stone-400 dark:text-stone-500">{sale.created_at ? new Date(sale.created_at).toLocaleDateString() : ""}</p>
                      </div>
                      <span className="text-sm font-bold text-primary-700">€{(sale.amount_cents / 100).toFixed(2)}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        sale.payment_status === "paid" ? "bg-green-100 text-green-700" :
                        sale.payment_status === "pending" ? "bg-amber-100 text-amber-700" :
                        "bg-red-100 text-red-700"
                      }`}>{sale.payment_status}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* My purchases */}
            {myOrders.length > 0 && (
              <div>
                <h3 className="font-display font-semibold text-stone-800 dark:text-stone-100 dark:text-stone-200 mb-3 flex items-center gap-2">
                  <ShoppingCart className="w-4 h-4 text-blue-500" /> {t("marketplace.my_purchases")}
                </h3>
                <div className="space-y-2">
                  {myOrders.map((order: any) => (
                    <a key={order.id} href={`/marketplace/${order.listing_id}`} className="flex items-center gap-3 bg-white dark:bg-stone-900 rounded-xl border border-primary-100/40 dark:border-stone-700/40 p-3 hover:shadow-md transition">
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-stone-700 dark:text-stone-300 truncate">{order.listing_title}</p>
                        <p className="text-xs text-stone-400 dark:text-stone-500">{order.created_at ? new Date(order.created_at).toLocaleDateString() : ""}</p>
                      </div>
                      <span className="text-sm font-bold text-primary-700">€{(order.amount_cents / 100).toFixed(2)}</span>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded ${
                        order.payment_status === "paid" ? "bg-green-100 text-green-700" :
                        order.payment_status === "pending" ? "bg-amber-100 text-amber-700" :
                        "bg-red-100 text-red-700"
                      }`}>{order.payment_status}</span>
                    </a>
                  ))}
                </div>
              </div>
            )}

            {/* Seller Stripe onboarding */}
            <div className="bg-primary-50/40 dark:bg-primary-900/10 rounded-2xl p-6 border border-primary-100/40 dark:border-primary-800/20">
              <h3 className="font-display font-semibold text-stone-800 dark:text-stone-100 dark:text-stone-200 mb-2">{t("marketplace.seller_setup")}</h3>
              <p className="text-sm text-stone-500 dark:text-stone-400 dark:text-stone-500 font-serif mb-4">{t("marketplace.seller_setup_desc")}</p>
              <a href="#" onClick={async (e) => {
                e.preventDefault();
                try {
                  const res = await api.marketplace.sellerOnboard();
                  window.location.href = res.url;
                } catch {
                  addToast("error", t("marketplace.not_available_yet"));
                }
              }} className="inline-flex items-center gap-2 text-sm font-display font-medium text-primary-600 hover:text-primary-700 transition">
                <Building className="w-4 h-4" /> {t("marketplace.setup_stripe")}
              </a>
            </div>

            {!myListings.length && !myOrders.length && !mySales.length && (
              <p className="text-center text-stone-400 dark:text-stone-500 py-8 font-serif">{t("marketplace.no_marketplace_activity")}</p>
            )}
          </div>
        )}

        {/* EVENTS TAB (own profile only) */}
        {activeTab === "events" && isOwnProfile && (
          <div className="space-y-6">
            {/* Tickets */}
            {activity?.tickets?.length > 0 && (
              <div>
                <h3 className="font-display font-semibold text-stone-800 dark:text-stone-100 dark:text-stone-200 mb-3 flex items-center gap-2">
                  <Ticket className="w-4 h-4 text-sky-500" /> {t("profile.my_tickets")}
                </h3>
                <div className="space-y-2">
                  {activity.tickets.map((tk: any) => (
                    <Link key={tk.id} href={`/events/${tk.event_id}`} className="flex items-center gap-3 bg-white dark:bg-stone-900 rounded-xl border border-primary-100/40 dark:border-stone-700/40 p-4 hover:shadow-md transition">
                      <div className="w-12 h-12 rounded-xl bg-sky-100 flex items-center justify-center shrink-0">
                        <QrCode className="w-6 h-6 text-sky-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-stone-700 dark:text-stone-300 truncate">{tk.event_title}</p>
                        <p className="text-xs text-stone-400 dark:text-stone-500">{tk.ticket_type} × {tk.quantity} — €{(tk.total_paid / 100).toFixed(0)}</p>
                        {tk.event_date && <p className="text-xs text-stone-400 dark:text-stone-500">{new Date(tk.event_date).toLocaleDateString()}</p>}
                      </div>
                      {tk.checked_in ? (
                        <Badge variant="green"><CheckCircle className="w-3 h-3 mr-1" /> {t("profile.checked_in")}</Badge>
                      ) : (
                        <Badge variant="stone">{t("profile.not_checked_in")}</Badge>
                      )}
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {/* RSVPs */}
            {activity?.rsvps?.length > 0 && (
              <div>
                <h3 className="font-display font-semibold text-stone-800 dark:text-stone-100 dark:text-stone-200 mb-3 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-amber-500" /> {t("profile.my_rsvps")}
                </h3>
                <div className="space-y-2">
                  {activity.rsvps.map((r: any, i: number) => (
                    <Link key={i} href={`/events/${r.event_id}`} className="flex items-center gap-3 bg-white dark:bg-stone-900 rounded-xl border border-primary-100/40 dark:border-stone-700/40 p-3 hover:shadow-md transition">
                      <div className="w-10 h-10 rounded-lg bg-amber-100 flex items-center justify-center shrink-0">
                        <Calendar className="w-5 h-5 text-amber-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-stone-700 dark:text-stone-300 truncate">{r.event_title}</p>
                        <p className="text-xs text-stone-400 dark:text-stone-500">{r.event_date ? new Date(r.event_date).toLocaleDateString() : ""}{r.event_location ? ` · ${r.event_location}` : ""}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {/* Donations */}
            {activity?.donations?.length > 0 && (
              <div>
                <h3 className="font-display font-semibold text-stone-800 dark:text-stone-100 dark:text-stone-200 mb-3 flex items-center gap-2">
                  <Heart className="w-4 h-4 text-rust-500" /> {t("profile.my_donations")}
                </h3>
                <div className="space-y-2">
                  {activity.donations.map((d: any) => (
                    <Link key={d.id} href={`/events/${d.event_id}`} className="flex items-center gap-3 bg-white dark:bg-stone-900 rounded-xl border border-primary-100/40 dark:border-stone-700/40 p-3 hover:shadow-md transition">
                      <div className="w-10 h-10 rounded-lg bg-rust-100 flex items-center justify-center shrink-0">
                        <Heart className="w-5 h-5 text-rust-600" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-medium text-stone-700 dark:text-stone-300 truncate">{d.event_title}</p>
                        <p className="text-xs text-stone-400 dark:text-stone-500">{d.created_at ? new Date(d.created_at).toLocaleDateString() : ""}{d.is_anonymous ? ` · ${t("profile.anonymous")}` : ""}</p>
                      </div>
                      <span className="text-sm font-bold text-rust-600">€{(d.amount / 100).toFixed(0)}</span>
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {/* Enrollments */}
            {activity?.enrollments?.length > 0 && (
              <div>
                <h3 className="font-display font-semibold text-stone-800 dark:text-stone-100 dark:text-stone-200 mb-3 flex items-center gap-2">
                  <GraduationCap className="w-4 h-4 text-green-500" /> {t("profile.my_enrollments")}
                </h3>
                <div className="space-y-2">
                  {activity.enrollments.map((e: any, i: number) => (
                    <Link key={i} href={`/learning/courses/${e.course_id}`} className="flex items-center gap-3 bg-white dark:bg-stone-900 rounded-xl border border-primary-100/40 dark:border-stone-700/40 p-3 hover:shadow-md transition">
                      <div className="w-10 h-10 rounded-lg bg-green-100 flex items-center justify-center shrink-0">
                        <GraduationCap className="w-5 h-5 text-green-600" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-stone-700 dark:text-stone-300 truncate">{e.course_title}</p>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
            {!activity?.tickets?.length && !activity?.rsvps?.length && !activity?.donations?.length && !activity?.enrollments?.length && (
              <EmptyState icon={<Calendar className="w-7 h-7" />} title={t("profile.no_events")} />
            )}
          </div>
        )}

        {/* DISCUSSIONS TAB */}
        {activeTab === "discussions" && (
          <div className="space-y-3">
            {activity?.comments?.length > 0 ? (
              activity.comments.map((cm: any) => {
                const linkMap: Record<string, string> = {
                  content: `/content/${cm.entity_id}`,
                  event: `/events/${cm.entity_id}`,
                  group: `/groups/${cm.entity_id}`,
                  plant: `/plants/${cm.entity_id}`,
                  course: `/learning/courses/${cm.entity_id}`,
                };
                return (
                  <Link key={cm.id} href={linkMap[cm.entity_type] || "#"} className="block bg-white dark:bg-stone-900 rounded-xl border border-primary-100/40 dark:border-stone-700/40 p-4 hover:shadow-md transition">
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="stone" className="text-[9px] capitalize">{cm.entity_type}</Badge>
                      <span className="text-xs text-stone-400 dark:text-stone-500">{cm.created_at ? new Date(cm.created_at).toLocaleDateString() : ""}</span>
                    </div>
                    <p className="text-sm text-stone-600 dark:text-stone-400 dark:text-stone-500 font-serif italic line-clamp-2">&quot;{cm.body}&quot;</p>
                  </Link>
                );
              })
            ) : (
              <EmptyState icon={<MessageSquare className="w-7 h-7" />} title={t("profile.no_comments")} />
            )}
          </div>
        )}

        {/* SETTINGS TAB (own profile only) */}
        {activeTab === "settings" && isOwnProfile && (
          <div className="space-y-6">
            {/* Edit form */}
            <form onSubmit={handleSave} className="bg-white dark:bg-stone-900 p-6 rounded-xl border border-stone-200 dark:border-stone-700 space-y-4">
              {/* Avatar upload */}
              <div className="flex items-center gap-4">
                <div className="w-20 h-20 rounded-full bg-primary-100 dark:bg-primary-950/20 flex items-center justify-center overflow-hidden">
                  {safeImageUrl(avatarUrl) ? (
                    <img src={safeImageUrl(avatarUrl)} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <User className="w-10 h-10 text-primary-600" />
                  )}
                </div>
                <div>
                  <p className="text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">{t("profile.avatar")}</p>
                  <ImageUpload
                    onUpload={(urls) => setAvatarUrl(urls.thumb)}
                    label={t("profile.upload_avatar")}
                    maxSizeMb={5}
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">{t("profile.name")}</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm text-stone-800 dark:text-stone-100 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">{t("profile.bio")}</label>
                <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3}
                  placeholder={t("profile.bio_placeholder")}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm text-stone-800 dark:text-stone-100 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">
                  <MapPin className="w-3 h-3 inline mr-1" /> {t("profile.location")}
                </label>
                <input type="text" value={location} onChange={(e) => setLocation(e.target.value)}
                  placeholder={t("profile.location_placeholder")}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm text-stone-800 dark:text-stone-100 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">{t("profile.skills")}</label>
                  <input type="text" value={skills} onChange={(e) => setSkills(e.target.value)}
                    placeholder={t("profile.skills_placeholder")}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm text-stone-800 dark:text-stone-100 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">{t("profile.interests")}</label>
                  <input type="text" value={interests} onChange={(e) => setInterests(e.target.value)}
                    placeholder={t("profile.interests_placeholder")}
                    className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm text-stone-800 dark:text-stone-100 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-primary-500" />
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">{t("profile.website")}</label>
                <input type="url" value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)}
                  placeholder={t("profile.website_placeholder")}
                  className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm text-stone-800 dark:text-stone-100 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-primary-500" />
              </div>
              {/* Entity-specific edit fields */}
              {profile.account_type === "organization" && (
                <div className="pt-4 border-t border-stone-200 dark:border-stone-700 space-y-4">
                  <p className="text-sm font-display font-semibold text-stone-700 dark:text-stone-300">{t("profile.entity_info")}</p>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">{t("auth.services")}</label>
                    <input type="text" value={servicesEdit} onChange={(e) => setServicesEdit(e.target.value)}
                      placeholder={t("auth.services_placeholder")}
                      className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm text-stone-800 dark:text-stone-100 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">{t("auth.service_area")}</label>
                    <input type="text" value={serviceAreaEdit} onChange={(e) => setServiceAreaEdit(e.target.value)}
                      placeholder={t("auth.service_area_placeholder")}
                      className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm text-stone-800 dark:text-stone-100 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  </div>
                </div>
              )}
              {profile.account_type === "practitioner" && (
                <div className="pt-4 border-t border-stone-200 dark:border-stone-700 space-y-4">
                  <p className="text-sm font-display font-semibold text-stone-700 dark:text-stone-300">{t("profile.practitioner_info")}</p>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">{t("auth.modality")}</label>
                    <input type="text" value={modalityEdit} onChange={(e) => setModalityEdit(e.target.value)}
                      placeholder={t("auth.modality_placeholder")}
                      className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm text-stone-800 dark:text-stone-100 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">{t("auth.certifications")}</label>
                    <input type="text" value={certificationsEdit} onChange={(e) => setCertificationsEdit(e.target.value)}
                      placeholder={t("auth.certifications_placeholder")}
                      className="w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-700 bg-white dark:bg-stone-800 text-sm text-stone-800 dark:text-stone-100 dark:text-stone-200 focus:outline-none focus:ring-2 focus:ring-primary-500" />
                  </div>
                </div>
              )}
              <label className="flex items-center gap-2 text-sm text-stone-700 dark:text-stone-300 cursor-pointer">
                <input type="checkbox" checked={visibleInNetwork} onChange={(e) => setVisibleInNetwork(e.target.checked)}
                  className="w-4 h-4 rounded border-stone-300 text-primary-600 focus:ring-primary-500" />
                {visibleInNetwork ? <Eye className="w-4 h-4 text-stone-400 dark:text-stone-500" /> : <EyeOff className="w-4 h-4 text-stone-400 dark:text-stone-500" />}
                {t("profile.visible_in_network")}
              </label>
              <Button type="submit" disabled={saving} loading={saving}>
                <Save className="w-4 h-4" /> {saving ? t("profile.saving") : t("profile.save_profile")}
              </Button>
            </form>

            {/* Security: self-service force-logout (session.revoke_own) */}
            <div className="bg-white dark:bg-stone-900 p-6 rounded-xl border border-stone-200 dark:border-stone-700">
              <h3 className="font-display font-semibold text-stone-800 dark:text-stone-100 mb-1 flex items-center gap-2">
                <Shield className="w-4 h-4 text-primary-500" /> {t("profile.security")}
              </h3>
              <p className="text-sm text-stone-500 dark:text-stone-400 font-serif mb-4">
                {t("profile.revoke_sessions_desc")}
              </p>
              <button
                type="button"
                onClick={handleRevokeSessions}
                className="flex items-center gap-2 px-4 py-2 rounded-lg border border-red-300 dark:border-red-800/60 text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 transition"
              >
                <LogOut className="w-4 h-4" /> {t("profile.revoke_sessions")}
              </button>
            </div>

            {/* Roles/permissions redesign Phase 5 — entity registration/team/
                conversion entry points. Entity-scoped surfaces live under
                /entity/[entityId]/*, kept architecturally separate from
                /admin/* per docs/roles-permissions/phase0-decisions.md (i). */}
            {profile.entity_id ? (
              <Link href={`/entity/${profile.entity_id}`}
                className="flex items-center gap-3 bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-700 p-4 hover:shadow-md transition group">
                <Building className="w-5 h-5 text-primary-500 group-hover:text-primary-600" />
                <div>
                  <p className="text-sm font-medium text-stone-700 dark:text-stone-300">Manage my entity</p>
                  <p className="text-xs text-stone-400 dark:text-stone-500 font-serif">View verification status, documents, team, and roster</p>
                </div>
              </Link>
            ) : (
              <Link href="/entity/register"
                className="flex items-center gap-3 bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-700 p-4 hover:shadow-md transition group">
                <Building className="w-5 h-5 text-primary-500 group-hover:text-primary-600" />
                <div>
                  <p className="text-sm font-medium text-stone-700 dark:text-stone-300">Register an organization / partner / supplier</p>
                  <p className="text-xs text-stone-400 dark:text-stone-500 font-serif">Self-service registration, pending document verification</p>
                </div>
              </Link>
            )}

            {(profile.entity_kind === "individual" || profile.entity_kind === "professional" || !profile.entity_kind) && (
              <Link href="/entity/convert"
                className="flex items-center gap-3 bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-700 p-4 hover:shadow-md transition group">
                <ArrowRightLeft className="w-5 h-5 text-primary-500 group-hover:text-primary-600" />
                <div>
                  <p className="text-sm font-medium text-stone-700 dark:text-stone-300">Convert account type</p>
                  <p className="text-xs text-stone-400 dark:text-stone-500 font-serif">Individual ↔ professional, or professional → organization</p>
                </div>
              </Link>
            )}

            {/* Feed Settings */}
            <Link href="/settings/feeds"
              className="flex items-center gap-3 bg-white dark:bg-stone-900 rounded-xl border border-stone-200 dark:border-stone-700 p-4 hover:shadow-md transition group">
              <Rss className="w-5 h-5 text-primary-500 group-hover:text-primary-600" />
              <div>
                <p className="text-sm font-medium text-stone-700 dark:text-stone-300">RSS Feed Settings</p>
                <p className="text-xs text-stone-400 dark:text-stone-500 font-serif">Connect your blog or website to import articles</p>
              </div>
            </Link>

            {/* Bookmarks */}
            {activity?.bookmarks?.length > 0 && (
              <div>
                <h3 className="font-display font-semibold text-stone-800 dark:text-stone-100 dark:text-stone-200 mb-3 flex items-center gap-2">
                  <Bookmark className="w-4 h-4 text-primary-500" /> {t("profile.bookmarks")}
                </h3>
                <div className="space-y-2">
                  {activity.bookmarks.map((b: any) => (
                    <Link key={b.id} href={`/content/${b.content_id}`} className="flex items-center gap-3 bg-white dark:bg-stone-900 rounded-xl border border-primary-100/40 dark:border-stone-700/40 p-3 hover:shadow-md transition">
                      <Bookmark className="w-4 h-4 text-primary-400 shrink-0" />
                      <p className="text-sm text-stone-700 dark:text-stone-300 truncate">{b.content_title}</p>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
