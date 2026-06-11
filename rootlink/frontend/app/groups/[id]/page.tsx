"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Users, UserPlus, UserMinus, ArrowLeft } from "lucide-react";
import { api } from "@/lib/api";

export default function GroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const [group, setGroup] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [joined, setJoined] = useState(false);

  useEffect(() => {
    const id = Number(params.id);
    Promise.all([
      api.groups.get(id),
      api.groups.members(id),
    ])
      .then(([g, m]) => {
        setGroup(g);
        setMembers(m);
        const token = localStorage.getItem("token");
        if (token) {
          api.auth.me().then((user) => {
            setJoined(m.some((mem: any) => mem.user_id === user.id));
          }).catch(() => {});
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [params.id]);

  const handleJoin = async () => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/auth/login"); return; }
    try {
      await api.groups.join(group.id);
      setJoined(true);
      const m = await api.groups.members(group.id);
      setMembers(m);
    } catch (err: any) {
      alert(err.message || "Failed to join group");
    }
  };

  const handleLeave = async () => {
    try {
      await api.groups.leave(group.id);
      setJoined(false);
      setMembers(members.filter((m) => m.user_id !== undefined));
    } catch (err: any) {
      alert(err.message || "Failed to leave group");
    }
  };

  if (loading) {
    return <div className="max-w-3xl mx-auto px-4 py-8 text-stone-500">Loading...</div>;
  }

  if (!group) {
    return <div className="max-w-3xl mx-auto px-4 py-8 text-stone-500">Group not found.</div>;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <a href="/groups" className="text-sm text-primary-600 hover:underline flex items-center gap-1 mb-6">
        <ArrowLeft className="w-4 h-4" /> Back to groups
      </a>

      <div className="bg-white p-6 rounded-xl border border-stone-200">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-3xl font-bold text-stone-800 font-serif">{group.name}</h1>
            <span className="inline-block mt-2 text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded">
              {group.category}
            </span>
          </div>
          {joined ? (
            <button
              onClick={handleLeave}
              className="flex items-center gap-2 border border-red-300 text-red-600 px-4 py-2 rounded-lg hover:bg-red-50 transition text-sm"
            >
              <UserMinus className="w-4 h-4" /> Leave
            </button>
          ) : (
            <button
              onClick={handleJoin}
              className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition text-sm"
            >
              <UserPlus className="w-4 h-4" /> Join
            </button>
          )}
        </div>

        {group.description && (
          <p className="text-stone-600 mt-4">{group.description}</p>
        )}

        <div className="mt-6 pt-4 border-t border-stone-100">
          <h2 className="text-sm font-medium text-stone-500 flex items-center gap-1 mb-3">
            <Users className="w-4 h-4" /> {members.length} member{members.length !== 1 ? "s" : ""}
          </h2>
          <div className="flex flex-wrap gap-2">
            {members.map((member) => (
              <div key={member.id} className="flex items-center gap-2 bg-stone-50 px-3 py-1.5 rounded-full text-sm text-stone-600">
                <div className="w-6 h-6 rounded-full bg-primary-100 flex items-center justify-center">
                  <Users className="w-3 h-3 text-primary-600" />
                </div>
                User #{member.user_id}
                {member.role !== "member" && (
                  <span className="text-xs text-primary-600 font-medium">{member.role}</span>
                )}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
