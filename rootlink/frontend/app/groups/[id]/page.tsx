"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Users, UserPlus, UserMinus, Hash } from "lucide-react";
import { api } from "@/lib/api";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CommentSection } from "@/components/CommentSection";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";

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
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-12 space-y-4">
        <div className="h-8 bg-primary-100 dark:bg-primary-950/20 rounded w-64 animate-pulse" />
        <div className="h-4 bg-primary-100 dark:bg-primary-950/20 rounded w-96 animate-pulse" />
        <div className="h-32 bg-primary-100 dark:bg-primary-950/20 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (!group) {
    return <div className="max-w-3xl mx-auto px-4 sm:px-8 py-12 text-stone-500">Group not found.</div>;
  }

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-12">
      <Breadcrumbs items={[
        { label: "Groups", href: "/groups" },
        { label: group.name }
      ]} />

      <Card variant="plain" className="p-8 mt-6">
        <div className="flex justify-between items-start">
          <div>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-12 h-12 rounded-2xl bg-primary-100 dark:bg-primary-950/20 flex items-center justify-center">
                <Hash className="w-6 h-6 text-primary-500" />
              </div>
              <div>
                <h1 className="text-3xl font-serif font-bold text-stone-800">{group.name}</h1>
                <Badge variant="sage" className="mt-1">{group.category}</Badge>
              </div>
            </div>
          </div>
          {joined ? (
            <Button variant="danger" size="sm" onClick={handleLeave}>
              <UserMinus className="w-4 h-4" /> Leave
            </Button>
          ) : (
            <Button variant="primary" size="sm" onClick={handleJoin}>
              <UserPlus className="w-4 h-4" /> Join
            </Button>
          )}
        </div>

        {group.description && (
          <p className="text-stone-600 dark:text-stone-300 mt-6 font-light leading-relaxed">{group.description}</p>
        )}

        <div className="mt-8 pt-6 border-t border-primary-100">
          <h2 className="text-sm font-medium text-stone-500 flex items-center gap-1.5 mb-4">
            <Users className="w-4 h-4" /> {members.length} member{members.length !== 1 ? "s" : ""}
          </h2>
          <div className="flex flex-wrap gap-2">
            {members.map((member) => (
              <div key={member.id} className="flex items-center gap-2 bg-primary-50 px-3 py-1.5 rounded-full text-sm text-stone-600 dark:text-stone-300">
                <div className="w-6 h-6 rounded-full bg-primary-100 dark:bg-primary-950/20 flex items-center justify-center">
                  <Users className="w-3 h-3 text-primary-500" />
                </div>
                User #{member.user_id}
                {member.role !== "member" && (
                  <Badge variant="sage" className="text-[10px]">{member.role}</Badge>
                )}
              </div>
            ))}
          </div>
        </div>
      </Card>

      <CommentSection entityType="group" entityId={Number(params.id)} className="mt-8" />
    </div>
  );
}
