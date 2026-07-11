"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Trash2, MapPin, Users, Plus, Search, Leaf, Clock, Package, Pencil, Archive, ShieldCheck, X } from "lucide-react";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/locale-context";
import { useToast } from "@/lib/toast-context";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";
import { ProgressBar } from "@/components/ui/ProgressBar";
import { Text } from "@/components/ui/Text";
import { BlockRenderer, type BlockSectionData } from "@/components/blocks";

const MATERIALS = [
  { value: "food_scraps", labelKey: "waste.material_food_scraps" },
  { value: "yard_waste", labelKey: "waste.material_yard_waste" },
  { value: "coffee_grounds", labelKey: "waste.material_coffee_grounds" },
  { value: "paper_cardboard", labelKey: "waste.material_paper_cardboard" },
  { value: "manure", labelKey: "waste.material_manure" },
  { value: "wood_chips", labelKey: "waste.material_wood_chips" },
];

const ORG_LIKE_KINDS = ["organization", "partners", "suppliers"];

export default function CompostingPage() {
  const { t } = useLocale();
  const { addToast } = useToast();
  const { user } = useAuth();
  const [hubs, setHubs] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [token, setToken] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [challenges, setChallenges] = useState<any[]>([]);
  const [editingHubId, setEditingHubId] = useState<number | null>(null);

  // Create-form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("");
  const [capacity, setCapacity] = useState("");
  const [hours, setHours] = useState("");
  const [materials, setMaterials] = useState<string[]>([]);

  // Edit-form state (separate from create-form, one hub at a time)
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editCapacity, setEditCapacity] = useState("");
  const [editHours, setEditHours] = useState("");
  const [editMaterials, setEditMaterials] = useState<string[]>([]);
  const [editStatus, setEditStatus] = useState("active");
  const [heroSections, setHeroSections] = useState<BlockSectionData[] | null>(null);

  const isPlatformSuperAdmin = user?.role === "super_admin";

  const canEditHub = (hub: any) => {
    if (!user) return false;
    if (hub.manager_id === user.id) return true;
    return (
      user.rank != null && user.rank >= 5 &&
      ORG_LIKE_KINDS.includes(user.entity_kind) &&
      user.entity_id != null &&
      hub.manager_entity_id != null &&
      user.entity_id === hub.manager_entity_id
    );
  };

  useEffect(() => {
    setToken(localStorage.getItem("token"));
    fetchHubs();
    api.waste.challenges().then(setChallenges).catch(() => {});
    api.blocks.getPage("composting")
      .then((p) => p?.sections?.length ? setHeroSections(p.sections) : setHeroSections([]))
      .catch(() => setHeroSections([]));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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

  const toggleEditMaterial = (mat: string) => {
    setEditMaterials(editMaterials.includes(mat) ? editMaterials.filter(m => m !== mat) : [...editMaterials, mat]);
  };

  const startEdit = (hub: any) => {
    setEditingHubId(hub.id);
    setEditName(hub.name || "");
    setEditDescription(hub.description || "");
    setEditLocation(hub.location || "");
    setEditCapacity(hub.capacity_kg_week != null ? String(hub.capacity_kg_week) : "");
    setEditHours(hub.operating_hours || "");
    setEditMaterials(hub.accepted_materials || []);
    setEditStatus(hub.status || "active");
  };

  const cancelEdit = () => setEditingHubId(null);

  const handleUpdate = async (e: React.FormEvent, hubId: number) => {
    e.preventDefault();
    try {
      await api.waste.updateHub(hubId, {
        name: editName,
        description: editDescription,
        location: editLocation,
        capacity_kg_week: editCapacity ? parseFloat(editCapacity) : undefined,
        operating_hours: editHours || undefined,
        accepted_materials: editMaterials,
        status: editStatus,
      });
      addToast("success", t("waste.hub_updated"));
      setEditingHubId(null);
      fetchHubs();
    } catch (err: any) {
      addToast("error", err.message);
    }
  };

  const handleArchive = async (hubId: number) => {
    if (!confirm(t("waste.archive_confirm"))) return;
    try {
      await api.waste.archiveHub(hubId);
      addToast("success", t("waste.hub_archived"));
      fetchHubs();
    } catch (err: any) {
      addToast("error", err.message);
    }
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-12">
      {heroSections && heroSections.length > 0 && (
        <BlockRenderer sections={heroSections} />
      )}

      <PageHeader
        icon={<Leaf className="w-5 h-5 text-green-600" />}
        title={<Text k="waste.composting_title" as="span" />}
        subtitle={<Text k="waste.composting_subtitle" as="span" />}
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
          {hubs.map((hub) => {
            const editable = canEditHub(hub);
            const isEditing = editingHubId === hub.id;
            const canArchive = isPlatformSuperAdmin && hub.status !== "archived";
            return (
            <Card
              key={hub.id}
              variant="default"
              className={`p-5 transition-colors ${isEditing ? "!bg-primary-50/50 !border-primary-300 dark:!bg-primary-950/20 dark:!border-primary-600/60" : ""}`}
            >
              {/* Header — always visible, even while editing, so the card never loses its identity */}
              <div className="flex items-start gap-3 mb-3">
                <div className="w-12 h-12 rounded-xl bg-green-100 dark:bg-green-900/30 flex items-center justify-center shrink-0">
                  <Leaf className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <h3 className="font-display font-semibold text-stone-800 dark:text-stone-100 leading-snug">{hub.name}</h3>
                    {!isEditing && (editable || canArchive) && (
                      <div className="flex items-center gap-1 shrink-0">
                        {editable && (
                          <button onClick={() => startEdit(hub)} aria-label={t("waste.edit_hub")} title={t("waste.edit_hub")}
                            className="p-1.5 rounded-lg text-stone-500 border border-transparent hover:border-primary-200 hover:text-primary-700 hover:bg-primary-50 dark:hover:bg-primary-900/20 transition">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        )}
                        {canArchive && (
                          <button onClick={() => handleArchive(hub.id)} aria-label={t("waste.archive_hub")} title={t("waste.archive_hub")}
                            className="p-1.5 rounded-lg text-stone-500 border border-transparent hover:border-rust-200 hover:text-rust-600 hover:bg-rust-50 dark:hover:bg-rust-900/20 transition">
                            <Archive className="w-3.5 h-3.5" />
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 flex-wrap mt-0.5">
                    {hub.status && hub.status !== "active" && (
                      <Badge variant={hub.status === "archived" ? "stone" : "amber"} className="text-[9px]">
                        {t(`waste.status_${hub.status}`)}
                      </Badge>
                    )}
                    <p className="text-xs text-stone-400 dark:text-stone-500 flex items-center gap-1">
                      <MapPin className="w-3 h-3" /> {hub.location}
                    </p>
                  </div>
                </div>
              </div>

              {editable && hub.manager_id !== user?.id && !isEditing && (
                <Badge variant="amber" className="text-[9px] mb-3">
                  <ShieldCheck className="w-2.5 h-2.5" /> {t("waste.managing_as_org_admin")}
                </Badge>
              )}

              {isEditing ? (
                <form onSubmit={(e) => handleUpdate(e, hub.id)} className="space-y-3 pt-1">
                  <p className="flex items-center gap-1.5 text-xs font-display font-medium uppercase tracking-wider text-primary-600 dark:text-primary-400 -mt-1 mb-1">
                    <Pencil className="w-3 h-3" /> {t("waste.editing_label")}
                  </p>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">{t("waste.hub_name")}</label>
                      <input type="text" value={editName} onChange={(e) => setEditName(e.target.value)} required
                        className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">{t("waste.hub_location")}</label>
                      <input type="text" value={editLocation} onChange={(e) => setEditLocation(e.target.value)} required
                        className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">{t("waste.hub_description")}</label>
                    <textarea value={editDescription} onChange={(e) => setEditDescription(e.target.value)} rows={2}
                      className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15" />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">{t("waste.capacity_week")} (kg)</label>
                      <input type="number" step="0.1" value={editCapacity} onChange={(e) => setEditCapacity(e.target.value)}
                        className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15" />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">{t("waste.operating_hours")}</label>
                      <input type="text" value={editHours} onChange={(e) => setEditHours(e.target.value)}
                        placeholder="e.g., Mon-Fri 9h-17h"
                        className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15" />
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-1">{t("waste.hub_status")}</label>
                    <select value={editStatus} onChange={(e) => setEditStatus(e.target.value)}
                      className="w-full px-3 py-2 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15">
                      <option value="active">{t("waste.status_active")}</option>
                      <option value="full">{t("waste.status_full")}</option>
                      <option value="closed">{t("waste.status_closed")}</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-stone-600 dark:text-stone-400 mb-2">{t("waste.accepted_materials")}</label>
                    <div className="flex flex-wrap gap-2">
                      {MATERIALS.map((m) => (
                        <button key={m.value} type="button" onClick={() => toggleEditMaterial(m.value)}
                          className={`px-2.5 py-1 text-[11px] rounded-lg border transition ${
                            editMaterials.includes(m.value) ? "bg-green-600 text-white border-green-600" : "bg-white dark:bg-stone-900 text-stone-600 dark:text-stone-300 border-stone-200 dark:border-stone-700 hover:border-green-300 dark:hover:border-green-600"
                          }`}>
                          {t(m.labelKey)}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div className="flex gap-2 pt-1">
                    <Button type="submit" size="sm">{t("waste.save_changes")}</Button>
                    <Button variant="ghost" size="sm" type="button" onClick={cancelEdit}>
                      <X className="w-3.5 h-3.5" /> {t("marketplace.cancel")}
                    </Button>
                  </div>
                </form>
              ) : (
              <>
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
              </>
              )}
            </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
