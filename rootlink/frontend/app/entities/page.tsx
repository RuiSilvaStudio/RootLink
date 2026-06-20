"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { Building, Stethoscope, Search, CheckCircle, MapPin, FileText, Calendar, Users, Filter, ShieldCheck } from "lucide-react";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/locale-context";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { EmptyState } from "@/components/ui/EmptyState";
import { CardSkeleton } from "@/components/ui/LoadingSkeleton";

const ENTITY_TYPES = [
  { value: "", labelKey: "entities.all_types" },
  { value: "ipss", labelKey: "auth.entity_ipss" },
  { value: "cooperative", labelKey: "auth.entity_cooperative" },
  { value: "association", labelKey: "auth.entity_association" },
  { value: "cer", labelKey: "auth.entity_cer" },
  { value: "ministry", labelKey: "auth.entity_ministry" },
  { value: "regulatory", labelKey: "auth.entity_regulatory" },
  { value: "adr", labelKey: "auth.entity_adr" },
  { value: "municipality", labelKey: "auth.entity_municipality" },
  { value: "company", labelKey: "auth.entity_company" },
  { value: "other", labelKey: "auth.entity_other" },
];

const REGIONS = ["", "Norte", "Centro", "Lisboa e Vale do Tejo", "Alentejo", "Algarve", "Açores", "Madeira"];

export default function EntitiesPage() {
  const { t, locale } = useLocale();
  const [entities, setEntities] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [families, setFamilies] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [query, setQuery] = useState("");
  const [accountType, setAccountType] = useState("");
  const [entityType, setEntityType] = useState("");
  const [family, setFamily] = useState("");
  const [region, setRegion] = useState("");
  const [verifiedOnly, setVerifiedOnly] = useState(false);

  const fetchEntities = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api.users.entities({
        q: query || undefined,
        account_type: accountType || undefined,
        entity_type: entityType || undefined,
        family: family || undefined,
        region: region || undefined,
        verified_only: verifiedOnly || undefined,
        limit: 100,
      });
      setEntities(data);
    } catch {
      setEntities([]);
    } finally {
      setLoading(false);
    }
  }, [query, accountType, entityType, family, region, verifiedOnly]);

  useEffect(() => {
    api.users.entityStats().then(setStats).catch(() => {});
    api.taxonomy.families().then(setFamilies).catch(() => {});
    fetchEntities();
  }, [fetchEntities]);

  const entityTypeLabel = (type: string | null) => {
    if (!type) return "";
    const found = ENTITY_TYPES.find((e) => e.value === type);
    return found ? t(found.labelKey) : type;
  };

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-8 py-12">
      <PageHeader
        icon={<Building className="w-5 h-5 text-primary-500" />}
        title={t("entities.title")}
        subtitle={t("entities.subtitle")}
      />

      {/* Stats row */}
      {stats && (
        <div className="flex gap-3 mt-6 mb-8 flex-wrap">
          <Badge variant="blue" className="text-sm">
            <Building className="w-3.5 h-3.5 mr-1" />
            {stats.organizations} {t("entities.organizations")}
          </Badge>
          <Badge variant="earth" className="text-sm">
            <Stethoscope className="w-3.5 h-3.5 mr-1" />
            {stats.practitioners} {t("entities.practitioners")}
          </Badge>
          {stats.verified > 0 && (
            <Badge variant="green" className="text-sm">
              <ShieldCheck className="w-3.5 h-3.5 mr-1" />
              {stats.verified} {t("entities.verified")}
            </Badge>
          )}
        </div>
      )}

      <div className="flex flex-col lg:flex-row gap-8">
        {/* Sidebar filters */}
        <aside className="lg:w-64 shrink-0 space-y-5">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("entities.search_placeholder")}
              className="w-full pl-9 pr-3 py-2 rounded-xl border border-primary-200/60 bg-white text-sm font-serif focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15"
            />
          </div>

          {/* Account type toggle */}
          <div>
            <p className="text-xs font-display font-semibold text-stone-500 uppercase tracking-wider mb-2">{t("entities.filter_type")}</p>
            <div className="flex gap-1.5 flex-wrap">
              <button
                onClick={() => setAccountType("")}
                className={`px-3 py-1.5 text-xs rounded-lg border transition ${!accountType ? "bg-primary-600 text-white border-primary-600" : "bg-white text-stone-600 border-primary-100 hover:border-primary-300"}`}
              >
                {t("entities.all")}
              </button>
              <button
                onClick={() => setAccountType("organization")}
                className={`px-3 py-1.5 text-xs rounded-lg border transition ${accountType === "organization" ? "bg-primary-600 text-white border-primary-600" : "bg-white text-stone-600 border-primary-100 hover:border-primary-300"}`}
              >
                <Building className="w-3 h-3 inline mr-0.5" /> {t("auth.type_organization")}
              </button>
              <button
                onClick={() => setAccountType("practitioner")}
                className={`px-3 py-1.5 text-xs rounded-lg border transition ${accountType === "practitioner" ? "bg-primary-600 text-white border-primary-600" : "bg-white text-stone-600 border-primary-100 hover:border-primary-300"}`}
              >
                <Stethoscope className="w-3 h-3 inline mr-0.5" /> {t("auth.type_practitioner")}
              </button>
            </div>
          </div>

          {/* Entity type (organizations only) */}
          {(!accountType || accountType === "organization") && (
            <div>
              <p className="text-xs font-display font-semibold text-stone-500 uppercase tracking-wider mb-2">{t("entities.entity_type")}</p>
              <select
                value={entityType}
                onChange={(e) => setEntityType(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-primary-100 bg-white text-sm font-serif focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15"
              >
                {ENTITY_TYPES.map((et) => (
                  <option key={et.value} value={et.value}>{t(et.labelKey)}</option>
                ))}
              </select>
            </div>
          )}

          {/* Region */}
          <div>
            <p className="text-xs font-display font-semibold text-stone-500 uppercase tracking-wider mb-2">{t("entities.filter_region")}</p>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-primary-100 bg-white text-sm font-serif focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15"
            >
              {REGIONS.map((r) => (
                <option key={r} value={r}>{r || t("entities.all_regions")}</option>
              ))}
            </select>
          </div>

          {/* Taxonomy family */}
          <div>
            <p className="text-xs font-display font-semibold text-stone-500 uppercase tracking-wider mb-2">{t("entities.filter_family")}</p>
            <select
              value={family}
              onChange={(e) => setFamily(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-primary-100 bg-white text-sm font-serif focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15"
            >
              <option value="">{t("entities.all_families")}</option>
              {families.map((f) => (
                <option key={f.value} value={f.value}>{locale === "pt" ? f.label_pt : f.label}</option>
              ))}
            </select>
          </div>

          {/* Verified toggle */}
          <label className="flex items-center gap-2 text-sm text-stone-600 cursor-pointer">
            <input
              type="checkbox"
              checked={verifiedOnly}
              onChange={(e) => setVerifiedOnly(e.target.checked)}
              className="w-4 h-4 rounded border-primary-200 text-primary-600 focus:ring-primary-500"
            />
            <ShieldCheck className="w-4 h-4 text-stone-400" />
            {t("entities.filter_verified")}
          </label>
        </aside>

        {/* Entity grid */}
        <div className="flex-1 min-w-0">
          {loading ? (
            <div className="grid sm:grid-cols-2 gap-4">
              {[1, 2, 3, 4].map((i) => <CardSkeleton key={i} />)}
            </div>
          ) : entities.length === 0 ? (
            <EmptyState
              icon={<Building className="w-7 h-7" />}
              title={t("entities.no_results")}
              message={t("entities.no_results_desc")}
            />
          ) : (
            <div className="grid sm:grid-cols-2 gap-4">
              {entities.map((e) => (
                <Link
                  key={e.id}
                  href={`/profile?id=${e.id}`}
                  className="card-lift p-5 group"
                >
                  <div className="flex items-start gap-4 mb-3">
                    <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center overflow-hidden shrink-0">
                      {e.avatar_url ? (
                        <img src={e.avatar_url} alt={e.name} className="w-full h-full object-cover" />
                      ) : e.account_type === "practitioner" ? (
                        <Stethoscope className="w-6 h-6 text-primary-600" />
                      ) : (
                        <Building className="w-6 h-6 text-primary-600" />
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <h3 className="font-display font-semibold text-stone-800 group-hover:text-primary-700 transition truncate">{e.name}</h3>
                        {e.is_verified && <CheckCircle className="w-4 h-4 text-green-500 shrink-0" />}
                      </div>
                      <div className="flex gap-1.5 mt-1 flex-wrap">
                        <Badge variant={e.account_type === "organization" ? "blue" : "earth"} className="text-[9px]">
                          {e.account_type === "organization" ? t("auth.type_organization") : t("auth.type_practitioner")}
                        </Badge>
                        {e.entity_type && (
                          <Badge variant="stone" className="text-[9px]">{entityTypeLabel(e.entity_type)}</Badge>
                        )}
                      </div>
                    </div>
                  </div>

                  {e.bio && <p className="text-sm text-stone-500 font-serif line-clamp-2 mb-3">{e.bio}</p>}

                  {e.services && e.services.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {e.services.slice(0, 3).map((s: string) => (
                        <span key={s} className="text-[10px] bg-primary-50 text-primary-600 px-2 py-0.5 rounded-full">{s}</span>
                      ))}
                      {e.services.length > 3 && <span className="text-[10px] text-stone-400">+{e.services.length - 3}</span>}
                    </div>
                  )}

                  {e.modality && (
                    <p className="text-xs text-stone-500 mb-3 flex items-center gap-1">
                      <Stethoscope className="w-3 h-3 text-stone-400" /> {e.modality}
                    </p>
                  )}

                  <div className="flex items-center justify-between mt-3 pt-3 border-t border-primary-50">
                    {(e.location || e.service_area) && (
                      <p className="text-xs text-stone-400 flex items-center gap-1">
                        <MapPin className="w-3 h-3" /> {e.service_area || e.location}
                      </p>
                    )}
                    <div className="flex gap-2 ml-auto">
                      {e.content_count > 0 && (
                        <span className="text-[10px] text-stone-400 flex items-center gap-0.5">
                          <FileText className="w-3 h-3" /> {e.content_count}
                        </span>
                      )}
                      {e.event_count > 0 && (
                        <span className="text-[10px] text-stone-400 flex items-center gap-0.5">
                          <Calendar className="w-3 h-3" /> {e.event_count}
                        </span>
                      )}
                      {e.group_count > 0 && (
                        <span className="text-[10px] text-stone-400 flex items-center gap-0.5">
                          <Users className="w-3 h-3" /> {e.group_count}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
