"use client";

import { useState, useEffect } from "react";
import { useRouter, useParams } from "next/navigation";
import { User, Mail, MapPin, Save, LogOut, Users, UserPlus, UserMinus, Eye } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/lib/locale-context";
import { useToast } from "@/lib/toast-context";
import { PageSkeleton } from "@/components/Skeleton";
import { useDirtyGuard } from "@/lib/use-dirty-guard";

export default function ProfilePage() {
  const router = useRouter();
  const params = useParams();
  const [profile, setProfile] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [following, setFollowing] = useState(false);
  const [followers, setFollowers] = useState<any[]>([]);
  const [followingList, setFollowingList] = useState<any[]>([]);
  const [name, setName] = useState("");
  const [bio, setBio] = useState("");
  const [location, setLocation] = useState("");
  const [skills, setSkills] = useState("");
  const [interests, setInterests] = useState("");
  const [visibleInNetwork, setVisibleInNetwork] = useState(true);

  const userId = params?.id ? Number(params.id) : null;

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token && !userId) {
      router.push("/auth/login");
      return;
    }
    const load = async () => {
      let me: any = null;
      try { me = await api.auth.me(); setCurrentUser(me); } catch { router.push("/auth/login"); return; }

      let target: any;
      if (userId) {
        target = await api.auth.me();
      } else {
        target = me;
      }

      setProfile(target);
      setName(target.name);
      setBio(target.bio || "");
      setLocation(target.location || "");
      setSkills((target.skills || []).join(", "));
      setInterests((target.interests || []).join(", "));
      setVisibleInNetwork(target.visible_in_network !== false);

      if (userId && me.id !== userId) {
        const fl = await api.social.following();
        setFollowing(fl.some((u: any) => u.id === userId));
      }

      const [fws, fls] = await Promise.all([
        api.social.followers(),
        api.social.following(),
      ]);
      setFollowers(fws);
      setFollowingList(fls);
    };
    load().finally(() => setLoading(false));
  }, [userId]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    try {
      const updated = await api.auth.update({
        name, bio, location,
        skills: skills.split(",").map((s: string) => s.trim()).filter(Boolean),
        interests: interests.split(",").map((s: string) => s.trim()).filter(Boolean),
        visible_in_network: visibleInNetwork,
      });
      setProfile(updated);
      addToast("success", t("profile.saved"));
    } catch (err: any) { addToast("error", err.message); } finally { setSaving(false); }
  };

  const handleFollow = async () => {
    if (!userId) return;
    try {
      if (following) {
        await api.social.unfollow(userId);
        setFollowing(false);
      } else {
        await api.social.follow(userId);
        setFollowing(true);
      }
    } catch {}
  };

  const { t } = useLocale();
  const { logout } = useAuth();
  const { addToast } = useToast();
  const handleLogout = () => {
    logout();
    router.push("/");
  };

  const isOwnProfile = currentUser && profile && currentUser.id === profile.id;
  const profileDirty = !!(profile && (
    name !== (profile.name || "")
    || bio !== (profile.bio || "")
    || location !== (profile.location || "")
    || skills !== ((profile.skills || []).join(", "))
    || interests !== ((profile.interests || []).join(", "))
    || visibleInNetwork !== (profile.visible_in_network !== false)
  ));
  useDirtyGuard(profileDirty && isOwnProfile);
  if (loading) return <PageSkeleton />;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center">
            <User className="w-8 h-8 text-primary-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-stone-800">{profile?.name}</h1>
            <p className="text-sm text-stone-500">{t("profile.email")}: {profile?.email}</p>
            <div className="flex gap-4 mt-1 text-xs text-stone-400">
              <span>{t("profile.followers", { count: followers.length })}</span>
              <span>{t("profile.following", { count: followingList.length })}</span>
            </div>
          </div>
        </div>
        <div className="flex gap-2">
          {!isOwnProfile && currentUser && (
            <button onClick={handleFollow}
              className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition ${
                following
                  ? "border border-stone-300 text-stone-600 hover:bg-stone-50"
                  : "bg-primary-600 text-white hover:bg-primary-700"
              }`}>
              {following ? <UserMinus className="w-3 h-3" /> : <UserPlus className="w-3 h-3" />}
              {following ? t("profile.unfollow") : t("profile.follow")}
            </button>
          )}
          {isOwnProfile && (
            <button onClick={handleLogout}
              className="flex items-center gap-1 text-red-600 hover:text-red-700 text-sm">
              <LogOut className="w-4 h-4" /> {t("profile.logout")}
            </button>
          )}
        </div>
      </div>

      {isOwnProfile ? (
        <form onSubmit={handleSave} className="bg-white p-6 rounded-xl border border-stone-200 space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">{t("profile.name")}</label>
            <input type="text" value={name} onChange={(e) => setName(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">{t("profile.bio")}</label>
            <textarea value={bio} onChange={(e) => setBio(e.target.value)} rows={3}
              placeholder={t("profile.bio_placeholder")}
              className="w-full px-3 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">
              <MapPin className="w-3 h-3 inline mr-1" /> {t("profile.location")}
            </label>
            <input type="text" value={location} onChange={(e) => setLocation(e.target.value)}
              placeholder={t("profile.location_placeholder")}
              className="w-full px-3 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">{t("profile.skills")}</label>
            <input type="text" value={skills} onChange={(e) => setSkills(e.target.value)}
              placeholder={t("profile.skills_placeholder")}
              className="w-full px-3 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">{t("profile.interests")}</label>
            <input type="text" value={interests} onChange={(e) => setInterests(e.target.value)}
              placeholder={t("profile.interests_placeholder")}
              className="w-full px-3 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-primary-500" />
          </div>
          <div className="flex items-center gap-3 py-2">
            <label className="flex items-center gap-2 text-sm text-stone-700 cursor-pointer">
              <input type="checkbox" checked={visibleInNetwork} onChange={(e) => setVisibleInNetwork(e.target.checked)}
                className="w-4 h-4 rounded border-stone-300 text-primary-600 focus:ring-primary-500" />
              <Eye className="w-4 h-4 text-stone-400" />
              {t("profile.visible_in_network")}
            </label>
          </div>
          <button type="submit" disabled={saving}
            className="flex items-center gap-2 bg-primary-600 text-white px-6 py-2 rounded-lg hover:bg-primary-700 transition disabled:opacity-50">
            <Save className="w-4 h-4" /> {saving ? t("profile.saving") : t("profile.save_profile")}
          </button>
        </form>
      ) : (
        <div className="bg-white p-6 rounded-xl border border-stone-200">
          {profile?.bio && <p className="text-stone-600">{profile.bio}</p>}
          {profile?.location && (
            <p className="text-sm text-stone-400 mt-2 flex items-center gap-1">
              <MapPin className="w-3 h-3" /> {profile.location}
            </p>
          )}
          {(profile?.skills?.length > 0) && (
            <div className="mt-4">
              <p className="text-sm font-medium text-stone-500 mb-1">{t("profile.skills")}</p>
              <div className="flex flex-wrap gap-1">
                {profile.skills.map((s: string) => (
                  <span key={s} className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded">{s}</span>
                ))}
              </div>
            </div>
          )}
          {(profile?.interests?.length > 0) && (
            <div className="mt-3">
              <p className="text-sm font-medium text-stone-500 mb-1">{t("profile.interests")}</p>
              <div className="flex flex-wrap gap-1">
                {profile.interests.map((s: string) => (
                  <span key={s} className="text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded">{s}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
