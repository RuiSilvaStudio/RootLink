"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { User, MapPin, Mail, MessageCircle, UserPlus, UserMinus, ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";

export default function PublicProfilePage() {
  const params = useParams();
  const router = useRouter();
  const [profile, setProfile] = useState<any>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [following, setFollowing] = useState(false);

  const userId = Number(params.id);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/auth/login"); return; }

    api.auth.me().then(async (me) => {
      setCurrentUser(me);
      if (me.id === userId) { router.push("/profile"); return; }

      const [user, fl] = await Promise.all([
        api.users.get(userId),
        api.social.following(),
      ]);
      setProfile(user);
      setFollowing(fl.some((u: any) => u.id === userId));
    }).catch(() => router.push("/auth/login"))
    .finally(() => setLoading(false));
  }, [userId]);

  const handleFollow = async () => {
    try {
      if (following) { await api.social.unfollow(userId); setFollowing(false); }
      else { await api.social.follow(userId); setFollowing(true); }
    } catch {}
  };

  if (loading) return <div className="text-center py-20 text-stone-500">Loading...</div>;
  if (!profile) return <div className="text-center py-20 text-stone-400">User not found</div>;

  return (
    <div className="max-w-2xl mx-auto px-4 py-8">
      <button onClick={() => router.back()} className="flex items-center gap-1 text-sm text-stone-500 hover:text-primary-700 mb-6">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div className="flex justify-between items-start mb-8">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-primary-100 flex items-center justify-center">
            <User className="w-8 h-8 text-primary-600" />
          </div>
          <div>
            <h1 className="text-2xl font-bold text-stone-800">{profile.name}</h1>
            {profile.location && (
              <p className="text-sm text-stone-500 flex items-center gap-1 mt-1">
                <MapPin className="w-3 h-3" /> {profile.location}
              </p>
            )}
          </div>
        </div>
        <div className="flex gap-2">
          <button onClick={handleFollow}
            className={`flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm transition ${
              following
                ? "border border-stone-300 text-stone-600 hover:bg-stone-50"
                : "bg-primary-600 text-white hover:bg-primary-700"
            }`}>
            {following ? <UserMinus className="w-3 h-3" /> : <UserPlus className="w-3 h-3" />}
            {following ? "Unfollow" : "Follow"}
          </button>
          <Link href={`/messages?user=${userId}`}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-sm border border-stone-300 text-stone-600 hover:bg-stone-50">
            <MessageCircle className="w-3 h-3" /> Message
          </Link>
        </div>
      </div>

      {profile.bio && <p className="text-stone-600 mb-6">{profile.bio}</p>}

      <div className="grid grid-cols-2 gap-4">
        {profile.skills?.length > 0 && (
          <div className="bg-white p-4 rounded-xl border border-stone-200">
            <p className="text-sm font-medium text-stone-500 mb-2">Skills</p>
            <div className="flex flex-wrap gap-1">
              {profile.skills.map((s: string) => (
                <span key={s} className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded">{s}</span>
              ))}
            </div>
          </div>
        )}
        {profile.interests?.length > 0 && (
          <div className="bg-white p-4 rounded-xl border border-stone-200">
            <p className="text-sm font-medium text-stone-500 mb-2">Interests</p>
            <div className="flex flex-wrap gap-1">
              {profile.interests.map((s: string) => (
                <span key={s} className="text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded">{s}</span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
