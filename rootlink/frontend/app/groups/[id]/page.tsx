"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import { Users, UserPlus, UserMinus, Hash, Pencil, X, Save } from "lucide-react";
import { api } from "@/lib/api";
import { safeImageUrl } from "@/lib/image-url";
import { useToast } from "@/lib/toast-context";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { CommentSection } from "@/components/CommentSection";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { ImageUpload } from "@/components/ui/ImageUpload";

const MANAGE_ROLES = ["super_admin", "admin", "moderator"];

export default function GroupDetailPage() {
  const params = useParams();
  const router = useRouter();
  const { addToast } = useToast();
  const [group, setGroup] = useState<any>(null);
  const [members, setMembers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [joined, setJoined] = useState(false);
  const [canManage, setCanManage] = useState(false);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({ name: "", description: "", category: "", image_url: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const id = Number(params.id);
    Promise.all([api.groups.get(id), api.groups.members(id)])
      .then(([g, m]) => {
        setGroup(g);
        setMembers(m);
        const token = localStorage.getItem("token");
        if (token) {
          api.auth.me().then((user) => {
            setJoined(m.some((mem: any) => mem.user_id === user.id));
            const mine = m.find((mem: any) => mem.user_id === user.id);
            setCanManage(
              g.created_by === user.id ||
              MANAGE_ROLES.includes(user.role) ||
              (mine && (mine.role === "admin" || mine.role === "moderator"))
            );
          }).catch(() => {});
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [params.id]);

  const startEdit = () => {
    setForm({
      name: group.name || "",
      description: group.description || "",
      category: group.category || "",
      image_url: group.image_url || "",
    });
    setEditing(true);
  };

  const handleSaveEdit = async () => {
    setSaving(true);
    try {
      const updated = await api.groups.update(group.id, form);
      setGroup(updated);
      setEditing(false);
      addToast("success", "Group updated");
    } catch (err: any) {
      addToast("error", err.message);
    }
    setSaving(false);
  };

  const handleJoin = async () => {
    const token = localStorage.getItem("token");
    if (!token) { router.push("/auth/login"); return; }
    try {
      await api.groups.join(group.id);
      setJoined(true);
      setMembers(await api.groups.members(group.id));
    } catch (err: any) {
      addToast("error", err.message || "Failed to join group");
    }
  };

  const handleLeave = async () => {
    try {
      await api.groups.leave(group.id);
      setJoined(false);
      setMembers(members.filter((m) => m.user_id !== undefined));
    } catch (err: any) {
      addToast("error", err.message || "Failed to leave group");
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
      <Breadcrumbs items={[{ label: "Groups", href: "/groups" }, { label: group.name }]} />

      <Card variant="plain" className="p-8 mt-6">
        {/* Cover banner */}
        {group.image_url && !editing && (
          <div className="w-full h-44 rounded-xl overflow-hidden mb-6 bg-primary-50 dark:bg-primary-950/20">
            <img src={safeImageUrl(group.image_url, "/images/placeholder-card.svg")} alt={group.name} className="w-full h-full object-cover" />
          </div>
        )}

        {editing ? (
          <div className="space-y-4">
            <h2 className="text-lg font-serif font-bold text-stone-800 dark:text-stone-100">Edit group</h2>
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Name</label>
              <input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })}
                className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Description</label>
              <textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3}
                className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm" />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">Cover image</label>
              {form.image_url ? (
                <div className="relative inline-block">
                  <img src={safeImageUrl(form.image_url)} alt="Cover" className="max-h-40 rounded-xl object-cover border border-stone-200 dark:border-stone-700" />
                  <button type="button" onClick={() => setForm({ ...form, image_url: "" })} className="absolute top-2 right-2 p-1 rounded-full bg-stone-900/70 text-white hover:bg-stone-900" aria-label="Remove cover">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              ) : (
                <ImageUpload label="" requireLicense onUpload={(urls) => setForm({ ...form, image_url: urls.large })} onError={(m) => addToast("error", m)} />
              )}
            </div>
            <div className="flex items-center gap-2">
              <Button variant="primary" size="sm" onClick={handleSaveEdit} disabled={saving}>
                <Save className="w-4 h-4 mr-1" /> {saving ? "Saving..." : "Save"}
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setEditing(false)}>Cancel</Button>
            </div>
          </div>
        ) : (
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-3 mb-1">
                {!group.image_url && (
                  <div className="w-12 h-12 rounded-2xl bg-primary-100 dark:bg-primary-950/20 flex items-center justify-center">
                    <Hash className="w-6 h-6 text-primary-500" />
                  </div>
                )}
                <div>
                  <h1 className="text-3xl font-serif font-bold text-stone-800 dark:text-stone-100">{group.name}</h1>
                  {group.category && <Badge variant="sage" className="mt-1">{group.category}</Badge>}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2">
              {canManage && (
                <Button variant="secondary" size="sm" onClick={startEdit}>
                  <Pencil className="w-4 h-4 mr-1" /> Edit
                </Button>
              )}
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
          </div>
        )}

        {!editing && group.description && (
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
