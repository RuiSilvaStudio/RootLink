"use client";

import { useState, useEffect, useRef } from "react";
import Link from "next/link";
import { Users, Plus, Search, ExternalLink, Hash, MessageCircle, Calendar } from "lucide-react";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/locale-context";
import { useToast } from "@/lib/toast-context";
import { useDirtyGuard } from "@/lib/use-dirty-guard";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";

export default function GroupsPage() {
  const [groups, setGroups] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [family, setFamily] = useState("");
  const [category, setCategory] = useState("");
  const [families, setFamilies] = useState<any[]>([]);
  const [familyCategories, setFamilyCategories] = useState<any[]>([]);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [suggesting, setSuggesting] = useState(false);
  const dirty = !!(name || slug || description);
  useDirtyGuard(dirty);
  const { t, locale } = useLocale();
  const { addToast } = useToast();

  useEffect(() => {
    api.groups.list().then(setGroups).catch(() => {}).finally(() => setLoading(false));
    api.taxonomy.families().then(setFamilies).catch(() => {});
  }, []);

  const handleFamilyChange = (famValue: string) => {
    setFamily(famValue);
    setCategory("");
    if (famValue) {
      api.taxonomy.categories(famValue).then(setFamilyCategories).catch(() => setFamilyCategories([]));
    } else {
      setFamilyCategories([]);
    }
  };

  const suggestTimer = useRef<ReturnType<typeof setTimeout>>();
  useEffect(() => {
    if (suggestTimer.current) clearTimeout(suggestTimer.current);
    const q = `${name} ${description}`.trim();
    if (!q || q.length < 3) { setSuggestions([]); return; }
    setSuggesting(true);
    suggestTimer.current = setTimeout(async () => {
      try {
        const results = await api.groups.search(q);
        setSuggestions(results);
      } catch {} finally { setSuggesting(false); }
    }, 400);
    return () => { if (suggestTimer.current) clearTimeout(suggestTimer.current); };
  }, [name, description]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const group = await api.groups.create({ name, slug, description, family: family || undefined, category: category || undefined });
      setGroups([group, ...groups]);
      setShowForm(false);
      setName("");
      setSlug("");
      setDescription("");
      setSuggestions([]);
    } catch (err: any) {
      addToast("error", err.message);
    }
  };

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-8 py-12">
      <PageHeader
        icon={<Users className="w-5 h-5 text-primary-500" />}
        title={t("groups.title")}
        subtitle={t("groups.subtitle")}
        action={
          <Button variant="primary" size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="w-4 h-4" /> {t("groups.new_group")}
          </Button>
        }
      />

      {/* Hero description */}
      <Card variant="plain" className="p-6 mb-8 bg-gradient-to-br from-primary-50 to-white border-primary-100">
        <div className="grid md:grid-cols-3 gap-6">
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center shrink-0">
              <MessageCircle className="w-5 h-5 text-primary-600" />
            </div>
            <div>
              <h3 className="font-semibold text-stone-800 text-sm">{t("groups.hero_discuss") || "Discuss & Share"}</h3>
              <p className="text-xs text-stone-500 mt-1 font-light leading-relaxed">{t("groups.hero_discuss_desc") || "Exchange tips, ask questions, and share your projects with like-minded people."}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-earth-100 flex items-center justify-center shrink-0">
              <Calendar className="w-5 h-5 text-earth-600" />
            </div>
            <div>
              <h3 className="font-semibold text-stone-800 text-sm">{t("groups.hero_events") || "Group Events"}</h3>
              <p className="text-xs text-stone-500 mt-1 font-light leading-relaxed">{t("groups.hero_events_desc") || "Organise workshops, meetups, and gatherings for your community."}</p>
            </div>
          </div>
          <div className="flex items-start gap-3">
            <div className="w-10 h-10 rounded-xl bg-green-100 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-green-600" />
            </div>
            <div>
              <h3 className="font-semibold text-stone-800 text-sm">{t("groups.hero_network") || "Grow Together"}</h3>
              <p className="text-xs text-stone-500 mt-1 font-light leading-relaxed">{t("groups.hero_network_desc") || "Connect with fellow gardeners, woodworkers, and homesteaders in your region."}</p>
            </div>
          </div>
        </div>
      </Card>

      {showForm && (
        <Card variant="plain" className="p-6 mb-8 space-y-4">
          <h3 className="font-serif font-bold text-stone-800">{t("groups.new_group")}</h3>
          <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">{t("groups.name_label")}</label>
              <input type="text" value={name} onChange={(e) => { setName(e.target.value); setSlug(e.target.value.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "")); }} required className="w-full px-3 py-2 rounded-xl border border-primary-100 bg-white text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15" />
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">{t("groups.slug_label")}</label>
              <input type="text" value={slug} onChange={(e) => setSlug(e.target.value)} required className="w-full px-3 py-2 rounded-xl border border-primary-100 bg-white text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15" />
            </div>
          </div>
          <div className="grid md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">{t("groups.family_label") || "Family"}</label>
              <select value={family} onChange={(e) => handleFamilyChange(e.target.value)} className="w-full px-3 py-2 rounded-xl border border-primary-100 bg-white text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15">
                <option value="">{t("groups.family_none") || "Select a family..."}</option>
                {families.map((fam) => (
                  <option key={fam.value} value={fam.value}>{locale === "pt" ? fam.label_pt : fam.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 mb-1">{t("groups.category_label")}</label>
              <select value={category} onChange={(e) => setCategory(e.target.value)} disabled={!family} className="w-full px-3 py-2 rounded-xl border border-primary-100 bg-white text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15 disabled:opacity-50">
                <option value="">{t("groups.category_none") || "All categories"}</option>
                {familyCategories.map((cat) => (
                  <option key={cat.value} value={cat.value}>{locale === "pt" ? cat.label_pt : cat.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">{t("groups.description_label")}</label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} className="w-full px-3 py-2 rounded-xl border border-primary-100 bg-white text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15" />
          </div>

          {suggestions.length > 0 && (
            <div className="bg-blue-50 border border-blue-200 rounded-2xl p-4">
              <div className="flex items-center gap-1.5 text-sm font-medium text-blue-800 mb-2">
                <Search className="w-4 h-4" /> {t("groups.similar_groups")}
              </div>
              <div className="space-y-2">
                {suggestions.map((sg) => (
                  <Link key={sg.id} href={`/groups/${sg.id}`}
                    className="flex items-center justify-between bg-white rounded-xl px-4 py-2.5 border border-blue-100 hover:border-blue-300 transition text-sm">
                    <div>
                      <span className="font-medium text-stone-800">{sg.name}</span>
                      {sg.description && <span className="text-stone-500 ml-2 font-light">— {sg.description}</span>}
                    </div>
                    <ExternalLink className="w-3.5 h-3.5 text-blue-500 shrink-0 ml-2" />
                  </Link>
                ))}
              </div>
            </div>
          )}

          <div className="flex items-center gap-3">
            <Button type="submit">{t("groups.create_group")}</Button>
            {suggesting && <span className="text-xs text-stone-400">{t("groups.searching")}</span>}
          </div>
          </form>
        </Card>
      )}

      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3, 4, 5, 6].map((i) => <CardSkeleton key={i} />)}
        </div>
      ) : groups.length === 0 ? (
        <EmptyState
          icon={<Users className="w-7 h-7" />}
          title={t("groups.no_groups")}
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {groups.map((group) => (
            <a key={group.id} href={`/groups/${group.id}`} className="card-lift p-5 group">
              <div className="w-10 h-10 rounded-xl bg-primary-100 flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <Hash className="w-5 h-5 text-primary-500" />
              </div>
              <h3 className="font-semibold text-stone-800 group-hover:text-primary-700 transition">{group.name}</h3>
              <p className="text-sm text-stone-500 mt-1 line-clamp-2 font-light">
                {group.description || t("groups.no_description")}
              </p>
              <div className="mt-3">
                <Badge variant="sage">{group.category}</Badge>
              </div>
            </a>
          ))}
        </div>
      )}
    </div>
  );
}
