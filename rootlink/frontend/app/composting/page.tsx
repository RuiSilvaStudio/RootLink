"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Trash2, MapPin, Users, Plus, Search, Leaf, Clock, Package } from "lucide-react";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/locale-context";
import { useToast } from "@/lib/toast-context";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";
import { ProgressBar } from "@/components/ui/ProgressBar";

const MATERIALS = [
  { value: "food_scraps", labelKey: "waste.material_food_scraps" },
  { value: "yard_waste", labelKey: "waste.material_yard_waste" },
  { value: "coffee_grounds", labelKey: "waste.material_coffee_grounds" },
  { value: "paper_cardboard", labelKey: "waste.material_paper_cardboard" },
  { value: "manure", labelKey: "waste.material_manure" },
  { value: "wood_chips", labelKey: "waste.material_wood_chips" },
];

export default function CompostingPage() {
  const { t } = useLocale();
  const { addToast } = useToast();
  const [hubs, setHubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [challenges, setChallenges] = useState<any[]>([]);

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [capacity, setCapacity] = useState("");
  const [hours, setHours] = useState("");
  const [materials, setMaterials] = useState<string[]>([]);

  useEffect(() => {
    setToken(localStorage.getItem("token"));
    fetchHubs();
    api.waste.challenges().then(setChallenges).catch(() => {});
  }, []);

  const fetchHubs = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.waste.hubs({ q: query || undefined });
      setHubs(data);
    } catch {
      setHubs([]);
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    fetchHubs();
  }, [fetchHubs]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.waste.createHub({
        name, description, location,
        capacity_kg_week: capacity ? parseFloat(capacity) : undefined,
        operating_hours: hours || undefined,
        accepted_materials: materials.length > 0 ? materials : undefined,
      });
      addToast("success", t("waste.hub_created"));
      setShowForm(false);
      setName(""); setDescription(""); setLocation(""); setCapacity(""); setHours(""); setMaterials([]);
      fetchHubs();
    } catch (err: any) {
      addToast("error", err.message);
    }
  };

  const handleJoin = async (hubId: number) => {
    try {
      await api.waste.joinHub(hubId);
      addToast("success", t("waste.joined_hub"));
    } catch (err: any) {
      addToast("error", err.message);
    }
  };

  const toggleMaterial = (mat: string) => {
    setMaterials(materials.includes(mat) ? materials.filter(m => m !== mat) : [...materials, mat]);
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-12">
      <PageHeader
        icon={<Leaf className="w-5 h-5 text-green-600" />}
        title={t("waste.composting_title")}
        subtitle={t("waste.composting_subtitle")}
        action={token && (
          <Button variant="primary" size="sm" onClick={() => setShowForm(!showForm)}>
            <Plus className="w-4 h-4" /> {t("waste.create_hub")}
          </Button>
        )}
      />

      {/* Challenges */}
      {challenges.length > 0 && (
        <div className="mt-8 mb-8 space-y-3">
          {challenges.map((ch) => (
            <Card key={ch.id} variant="plain" className="p-5">
              <div className="flex items-center justify-between mb-3">
                <div>
                  <h3 className="font-display font-semibold text-stone-800">{ch.title}</h3>
                  {ch.description && <p className="text-sm text-stone-500 font-serif mt-1">{ch.description}</p>}
                </div>
                <Badge variant="green">{ch.current_kg.toFixed(1)} / {ch.target_kg} kg</Badge>
              </div>
              <ProgressBar value={ch.progress_pct} showPercent={true} size="sm" />
            </Card>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="relative mb-6 mt-4">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400 dark:text-stone-500" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={t("waste.search_hubs")}
          className="w-full pl-9 pr-3 py-2 rounded-xl border border-primary-200/60 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm font-serif focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15"
        />
      </div>

      {/* Create form */}
      {showForm && (
        <Card variant="plain" className="p-6 mb-6 space-y-4">
          <h3 className="font-display font-bold text-stone-800 dark:text-stone-100">{t("waste.create_hub")}</h3>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">{t("waste.hub_name")}</label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} required
                  className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">{t("waste.hub_location")}</label>
                <input type="text" value={location} onChange={(e) => setLocation(e.target.value)} required
                  placeholder={t("marketplace.location_placeholder")}
                  className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">{t("waste.hub_description")}</label>
              <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
                className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15" />
            </div>
            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">{t("waste.capacity_week")} (kg)</label>
                <input type="number" step="0.1" value={capacity} onChange={(e) => setCapacity(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15" />
              </div>
              <div>
                <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-1">{t("waste.operating_hours")}</label>
                <input type="text" value={hours} onChange={(e) => setHours(e.target.value)}
                  placeholder="e.g., Mon-Fri 9h-17h"
                  className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15" />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300 mb-2">{t("waste.accepted_materials")}</label>
              <div className="flex flex-wrap gap-2">
                {MATERIALS.map((m) => (
                  <button key={m.value} type="button" onClick={() => toggleMaterial(m.value)}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition ${
                      materials.includes(m.value) ? "bg-green-600 text-white border-green-600" : "bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:border-green-300 dark:hover:border-green-600"
                    }`}>
                    {t(m.labelKey)}
                  </button>
                ))}
              </div>
            </div>
            <div className="flex gap-2">
              <Button type="submit">{t("waste.create_hub")}</Button>
              <Button variant="secondary" type="button" onClick={() => setShowForm(false)}>{t("marketplace.cancel")}</Button>
            </div>
          </form>
        </Card>
      )}

      {/* Hubs grid */}
      {loading ? (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => <CardSkeleton key={i} />)}
        </div>
      ) : hubs.length === 0 ? (
        <EmptyState
          icon={<Leaf className="w-7 h-7" />}
          title={t("waste.no_hubs")}
          message={t("waste.no_hubs_desc")}
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {hubs.map((hub) => (
            <Card key={hub.id} variant="default" className="p-5">
              <div className="flex items-start gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                  <Leaf className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <h3 className="font-display font-semibold text-stone-800 dark:text-stone-100 truncate">{hub.name}</h3>
                  <p className="text-xs text-stone-400 dark:text-stone-500 flex items-center gap-1 mt-0.5">
                    <MapPin className="w-3 h-3" /> {hub.location}
                  </p>
                </div>
              </div>

              {hub.description && (
                <p className="text-sm text-stone-500 font-serif line-clamp-2 mb-3">{hub.description}</p>
              )}

              {hub.accepted_materials?.length > 0 && (
                <div className="flex flex-wrap gap-1 mb-3">
                  {hub.accepted_materials.slice(0, 3).map((m: string) => (
                    <span key={m} className="text-[10px] bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-300 px-2 py-0.5 rounded-full">
                      {t(`waste.material_${m}`) || m}
                    </span>
                  ))}
                  {hub.accepted_materials.length > 3 && <span className="text-[10px] text-stone-400 dark:text-stone-500">+{hub.accepted_materials.length - 3}</span>}
                </div>
              )}

              {hub.operating_hours && (
                <p className="text-xs text-stone-400 dark:text-stone-500 flex items-center gap-1 mb-3">
                  <Clock className="w-3 h-3" /> {hub.operating_hours}
                </p>
              )}

              {/* Capacity progress */}
              {hub.capacity_kg_week && (
                <div className="mb-3">
                  <ProgressBar
                    value={hub.current_volume_kg}
                    max={hub.capacity_kg_week}
                    showPercent={false}
                    size="sm"
                    label={`${hub.current_volume_kg.toFixed(1)} / ${hub.capacity_kg_week} kg`}
                    variant="earth"
                  />
                </div>
              )}

              <div className="flex items-center justify-between pt-3 border-t border-primary-50 dark:border-stone-800">
                <span className="text-xs text-stone-400 dark:text-stone-500 flex items-center gap-1">
                  <Users className="w-3 h-3" /> {hub.member_count} {t("waste.members")}
                </span>
                {token && (
                  <Button variant="secondary" size="sm" onClick={() => handleJoin(hub.id)}>
                    {t("waste.join")}
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
