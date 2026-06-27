"use client";

import { useState, useEffect } from "react";
import { Search, Leaf, TreePine, Wrench, Users, BookOpen, Calendar, CheckSquare, Droplets, Sprout, Bird, Flower, Home as HomeIcon, ArrowRight, Sparkles, Building } from "lucide-react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { safeImageUrl } from "@/lib/image-url";
import { useLocale } from "@/lib/locale-context";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { StatCounter } from "@/components/ui/StatCounter";
import { HeroParticleCanvas } from "@/components/ui/HeroParticleCanvas";
import { ContentCardSkeleton } from "@/components/ui/LoadingSkeleton";

const ICON_MAP: Record<string, any> = {
  Sprout, Bird, Flower, TreePine, Wrench, HomeIcon, Leaf, Users, BookOpen, Calendar,
};

export default function Home() {
  const [query, setQuery] = useState("");
  const [recent, setRecent] = useState<any[]>([]);
  const [stats, setStats] = useState<any>(null);
  const [statsError, setStatsError] = useState(false);
  const [loading, setLoading] = useState(true);
  const [families, setFamilies] = useState<any[]>([]);
  const { t, locale } = useLocale();
  const router = useRouter();

  useEffect(() => {
    Promise.all([
      api.content.recent(8),
      api.content.publicStats().catch((e: Error) => {
        console.warn("publicStats failed:", e);
        setStatsError(true);
        return null;
      }),
      api.taxonomy.families().catch(() => []),
    ]).then(([recentData, statsData, famData]) => {
      setRecent(recentData || []);
      setStats(statsData);
      setFamilies(famData || []);
    }).finally(() => setLoading(false));
  }, []);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    router.push(`/search?q=${encodeURIComponent(query.trim())}`);
  };

  return (
    <div>
      {/* ========== HERO — editorial split ========== */}
      <section className="relative hero-grad min-h-[90vh] flex items-center px-4 sm:px-8 pt-16 overflow-hidden">
        <HeroParticleCanvas />
        <div className="absolute inset-0 z-[1] bg-gradient-to-b from-cream/70 via-cream/30 to-transparent dark:from-stone-950/80 dark:via-stone-950/40 dark:to-transparent pointer-events-none" />
        <div className="relative z-10 max-w-6xl mx-auto w-full">
          <div className="grid lg:grid-cols-5 gap-12 items-center">
            <div className="lg:col-span-3 animate-fade-in">
              <Badge variant="sage" className="mb-6">
                {t("home.discover_rootlink")}
              </Badge>
              <h1 className="text-5xl sm:text-6xl md:text-7xl lg:text-8xl font-display font-semibold text-stone-800 dark:text-stone-100 dark:text-stone-100 leading-[0.95] tracking-tight">
                {t("home.hero_title")}
              </h1>
              <div className="mt-6 w-20 h-0.5 bg-primary-300/50 rounded-full" />
              <p className="text-lg sm:text-xl text-stone-500 dark:text-stone-300 mt-6 max-w-lg font-serif leading-relaxed">
                {t("home.hero_subtitle")}
              </p>
              <form onSubmit={handleSearch} className="mt-8 flex flex-col sm:flex-row gap-3 max-w-lg">
                <div className="relative flex-1">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-00 dark:text-stone-500 dark:text-stone-400" />
                  <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder={t("home.search_placeholder")}
                    className="w-full pl-11 pr-4 py-3 rounded-xl2 border border-primary-200/60 bg-white/80 backdrop-blur-sm text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15 focus:outline-none transition-all font-serif"
                  />
                </div>
                <Button type="submit" size="md">{t("home.search")}</Button>
              </form>
            </div>

            {/* Editorial stat column */}
            <div className="lg:col-span-2 space-y-8 lg:border-l lg:border-primary-200/30 lg:pl-12 animate-fade-in" style={{ animationDelay: "0.2s" }}>
              {statsError ? (
                <div className="space-y-6">
                  {[t("home.active_members"), t("home.articles_curated"), t("home.community_gardens"), t("home.guides_courses")].map((label, i) => (
                    <div key={label}>
                      {i > 0 && <div className="w-full h-px bg-primary-200/20 mb-6" />}
                      <div className="text-center">
                        <div className="number-lg text-4xl sm:text-5xl text-stone-300">—</div>
                        <p className="text-sm text-stone-00 dark:text-stone-500 dark:text-stone-400 mt-2 font-serif tracking-wide italic">{label}</p>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="space-y-6">
                  <StatCounter value={stats?.users || 0} label={t("home.active_members")} />
                  <div className="w-full h-px bg-primary-200/20" />
                  <StatCounter value={stats?.content || 0} label={t("home.articles_curated")} />
                  <div className="w-full h-px bg-primary-200/20" />
                  <StatCounter value={stats?.groups || 0} label={t("home.community_gardens")} />
                  <div className="w-full h-px bg-primary-200/20" />
                  <StatCounter value={stats?.courses || 0} label={t("home.guides_courses")} />
                </div>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* ========== CATEGORIES — editorial feature grid ========== */}
      <section className="px-4 sm:px-8 py-24 sm:py-32">
        <div className="max-w-6xl mx-auto">
          <div className="mb-16">
            <Badge variant="earth" className="mb-5">{t("home.browse_category")}</Badge>
            <h2 className="text-4xl sm:text-5xl md:text-6xl font-display font-semibold text-stone-800 dark:text-stone-100 leading-[1.05] max-w-2xl">
              {t("home.find_your_corner")}
            </h2>
            <div className="mt-5 w-16 h-0.5 bg-primary-300/40 rounded-full" />
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {families.length > 0 ? families.map((fam, i) => {
              const Icon = ICON_MAP[fam.icon] || Leaf;
              const colors = ["bg-primary-100 dark:bg-primary-950/20/50", "bg-earth-100/50", "bg-stone-200/50", "bg-green-100/50", "bg-sky-100/50", "bg-amber-100/50"];
              return (
              <Link
                key={fam.value}
                href={`/search?family=${fam.value}`}
                className="card-lift p-8 sm:p-10 group relative overflow-hidden"
                style={{ animationDelay: `${i * 0.12}s` }}
              >
                <div className={`w-14 h-14 rounded-2xl ${colors[i % colors.length]} flex items-center justify-center mb-6 group-hover:scale-110 transition-transform duration-300`}>
                  <Icon className="w-7 h-7 text-primary-600" />
                </div>
                <h3 className="text-2xl font-display font-semibold text-stone-800 dark:text-stone-100 mb-3">
                  {locale === "pt" ? fam.label_pt : fam.label}
                </h3>
                <p className="text-stone-500 dark:text-stone-400 font-serif leading-relaxed">
                  {t("home.discover_category", { category: (locale === "pt" ? fam.label_pt : fam.label).toLowerCase() })}
                </p>
                <span className="inline-flex items-center gap-2 text-sm font-display font-medium text-primary-600 mt-6 group-hover:gap-3 transition-all">
                  {t("home.explore")} <ArrowRight className="w-3.5 h-3.5" />
                </span>
              </Link>
              );
            }) : (
              <p className="col-span-3 text-center text-stone-00 dark:text-stone-500 dark:text-stone-400 py-8 font-serif">{t("home.no_categories") || "No categories available"}</p>
            )}
          </div>
        </div>
      </section>

      {/* ========== TOOLS — editorial spread ========== */}
      <section className="px-4 sm:px-8 py-24 sm:py-32 bg-primary-50/40 dark:bg-primary-950/20 noise-bg">
        <div className="max-w-6xl mx-auto">
          <div className="mb-16 max-w-2xl">
            <Badge variant="sage" className="mb-5">{t("home.featured_tools")}</Badge>
            <h2 className="text-4xl sm:text-5xl font-display font-semibold text-stone-800 dark:text-stone-100 dark:text-stone-100 leading-[1.05]">
              {t("home.built_for_seasons")}
            </h2>
            <p className="mt-5 text-lg text-stone-500 dark:text-stone-300 font-serif leading-relaxed">{t("home.tools_subtitle")}</p>
            <div className="mt-5 w-16 h-0.5 bg-primary-300/40 dark:bg-primary-700/40 rounded-full" />
          </div>
          <div className="grid sm:grid-cols-3 gap-6">
            <Link href="/tools/gardening-calendar" className="card-lift p-8 sm:p-10 group">
              <div className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-950/20/60 dark:bg-primary-900/30 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                <Calendar className="w-6 h-6 text-primary-600 dark:text-primary-400" />
              </div>
              <h3 className="text-xl font-display font-semibold text-stone-800 dark:text-stone-100 dark:text-stone-100">{t("home.gardening_calendar")}</h3>
              <p className="text-stone-500 dark:text-stone-300 mt-3 font-serif text-sm leading-relaxed">{t("home.gardening_calendar_desc")}</p>
            </Link>
            <Link href="/tools/monthly-checklist" className="card-lift p-8 sm:p-10 group">
              <div className="w-12 h-12 rounded-xl bg-earth-100/60 dark:bg-earth-900/30 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                <CheckSquare className="w-6 h-6 text-earth-600 dark:text-earth-400" />
              </div>
              <h3 className="text-xl font-display font-semibold text-stone-800 dark:text-stone-100 dark:text-stone-100">{t("home.monthly_checklist")}</h3>
              <p className="text-stone-500 dark:text-stone-300 mt-3 font-serif text-sm leading-relaxed">{t("home.monthly_checklist_desc")}</p>
            </Link>
            <Link href="/tools/irrigation-calculator" className="card-lift p-8 sm:p-10 group">
              <div className="w-12 h-12 rounded-xl bg-sky-100/60 dark:bg-sky-900/30 flex items-center justify-center mb-5 group-hover:scale-110 transition-transform duration-300">
                <Droplets className="w-6 h-6 text-sky-600 dark:text-sky-400" />
              </div>
              <h3 className="text-xl font-display font-semibold text-stone-800 dark:text-stone-100 dark:text-stone-100">{t("home.irrigation_calculator")}</h3>
              <p className="text-stone-500 dark:text-stone-300 mt-3 font-serif text-sm leading-relaxed">{t("home.irrigation_calculator_desc")}</p>
            </Link>
          </div>
        </div>
      </section>

      {/* ========== COMMUNITY — editorial spread ========== */}
      <section className="px-4 sm:px-8 py-24 sm:py-32">
        <div className="max-w-6xl mx-auto">
          <div className="mb-16">
            <Badge variant="green" className="mb-5">{t("home.community")}</Badge>
            <h2 className="text-4xl sm:text-5xl font-display font-semibold text-stone-800 dark:text-stone-100 dark:text-stone-100 leading-[1.05]">{t("home.learning")}</h2>
            <div className="mt-5 w-16 h-0.5 bg-primary-300/40 dark:bg-primary-700/40 rounded-full" />
          </div>
          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-6">
            <Link href="/groups" className="group border border-primary-200/30 dark:border-primary-800/30 rounded-2xl p-8 transition-all duration-200 hover:shadow-lg hover:shadow-primary-900/5 dark:hover:shadow-stone-950/50 hover:-translate-y-0.5 hover:border-primary-300/50 dark:hover:border-primary-700/50 bg-white dark:bg-stone-900">
              <div className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-950/20/50 dark:bg-primary-900/30 flex items-center justify-center mb-5 group-hover:bg-primary-100 dark:bg-primary-950/20 dark:group-hover:bg-primary-900/50 transition">
                <Users className="w-6 h-6 text-primary-600 dark:text-primary-400" />
              </div>
              <h3 className="text-xl font-display font-semibold text-stone-800 dark:text-stone-100 dark:text-stone-100 mb-2 group-hover:text-primary-700 dark:group-hover:text-primary-400 transition">{t("home.community")}</h3>
              <p className="text-stone-500 dark:text-stone-00 dark:text-stone-500 dark:text-stone-400 font-serif text-sm leading-relaxed mb-5">{t("home.community_desc")}</p>
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 dark:text-primary-400 group-hover:gap-2.5 transition-all">
                {t("home.explore")} <span className="text-lg leading-none">→</span>
              </span>
            </Link>
            <Link href="/learning" className="group border border-primary-200/30 dark:border-primary-800/30 rounded-2xl p-8 transition-all duration-200 hover:shadow-lg hover:shadow-primary-900/5 dark:hover:shadow-stone-950/50 hover:-translate-y-0.5 hover:border-primary-300/50 dark:hover:border-primary-700/50 bg-white dark:bg-stone-900">
              <div className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-950/20/50 dark:bg-primary-900/30 flex items-center justify-center mb-5 group-hover:bg-primary-100 dark:bg-primary-950/20 dark:group-hover:bg-primary-900/50 transition">
                <BookOpen className="w-6 h-6 text-primary-600 dark:text-primary-400" />
              </div>
              <h3 className="text-xl font-display font-semibold text-stone-800 dark:text-stone-100 dark:text-stone-100 mb-2 group-hover:text-primary-700 dark:group-hover:text-primary-400 transition">{t("home.learning")}</h3>
              <p className="text-stone-500 dark:text-stone-00 dark:text-stone-500 dark:text-stone-400 font-serif text-sm leading-relaxed mb-5">{t("home.learning_desc")}</p>
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 dark:text-primary-400 group-hover:gap-2.5 transition-all">
                {t("home.explore")} <span className="text-lg leading-none">→</span>
              </span>
            </Link>
            <Link href="/events" className="group border border-primary-200/30 dark:border-primary-800/30 rounded-2xl p-8 transition-all duration-200 hover:shadow-lg hover:shadow-primary-900/5 dark:hover:shadow-stone-950/50 hover:-translate-y-0.5 hover:border-primary-300/50 dark:hover:border-primary-700/50 bg-white dark:bg-stone-900">
              <div className="w-12 h-12 rounded-xl bg-primary-100 dark:bg-primary-950/20/50 dark:bg-primary-900/30 flex items-center justify-center mb-5 group-hover:bg-primary-100 dark:bg-primary-950/20 dark:group-hover:bg-primary-900/50 transition">
                <Calendar className="w-6 h-6 text-primary-600 dark:text-primary-400" />
              </div>
              <h3 className="text-xl font-display font-semibold text-stone-800 dark:text-stone-100 dark:text-stone-100 mb-2 group-hover:text-primary-700 dark:group-hover:text-primary-400 transition">{t("home.events")}</h3>
              <p className="text-stone-500 dark:text-stone-00 dark:text-stone-500 dark:text-stone-400 font-serif text-sm leading-relaxed mb-5">{t("home.events_desc")}</p>
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 dark:text-primary-400 group-hover:gap-2.5 transition-all">
                {t("home.explore")} <span className="text-lg leading-none">→</span>
              </span>
            </Link>
            <Link href="/entities" className="group border border-primary-200/30 dark:border-primary-800/30 rounded-2xl p-8 transition-all duration-200 hover:shadow-lg hover:shadow-primary-900/5 dark:hover:shadow-stone-950/50 hover:-translate-y-0.5 hover:border-primary-300/50 dark:hover:border-primary-700/50 bg-white dark:bg-stone-900">
              <div className="w-12 h-12 rounded-xl bg-earth-100/50 dark:bg-earth-900/30 flex items-center justify-center mb-5 group-hover:bg-earth-100 dark:group-hover:bg-earth-900/50 transition">
                <Building className="w-6 h-6 text-earth-600 dark:text-earth-400" />
              </div>
              <h3 className="text-xl font-display font-semibold text-stone-800 dark:text-stone-100 dark:text-stone-100 mb-2 group-hover:text-primary-700 dark:group-hover:text-primary-400 transition">{t("home.entities")}</h3>
              <p className="text-stone-500 dark:text-stone-00 dark:text-stone-500 dark:text-stone-400 font-serif text-sm leading-relaxed mb-5">{t("home.entities_desc")}</p>
              <span className="inline-flex items-center gap-1.5 text-sm font-medium text-primary-600 dark:text-primary-400 group-hover:gap-2.5 transition-all">
                {t("home.explore")} <span className="text-lg leading-none">→</span>
              </span>
            </Link>
          </div>
        </div>
      </section>

      {/* ========== RECENT CONTENT — editorial grid ========== */}
      <section className="px-4 sm:px-8 py-24 sm:py-32 bg-primary-50/40 noise-bg">
        <div className="max-w-6xl mx-auto">
          <div className="mb-16">
            <Badge variant="green" className="mb-5">{t("home.recently_indexed")}</Badge>
            <h2 className="text-4xl sm:text-5xl font-display font-semibold text-stone-800 dark:text-stone-100 leading-[1.05]">{t("home.from_community")}</h2>
            <div className="mt-5 w-16 h-0.5 bg-primary-300/40 rounded-full" />
          </div>
          {loading ? (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {[1, 2, 3, 4].map((i) => (
                <ContentCardSkeleton key={i} />
              ))}
            </div>
          ) : recent.length === 0 ? (
            <p className="text-center text-stone-00 dark:text-stone-500 dark:text-stone-400 py-12 font-serif">{t("home.no_recent_content")}</p>
          ) : (
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-5">
              {recent.slice(0, 8).map((item: any) => {
                const isExternal = !!item.url;
                const href = isExternal ? item.url : `/articles/${item.slug}`;
                return (
                <Link
                  key={item.id}
                  href={href}
                  target={isExternal ? "_blank" : undefined}
                  rel={isExternal ? "noopener noreferrer" : undefined}
                  className="card-lift overflow-hidden group"
                >
                  <div className="h-40 bg-primary-100 dark:bg-primary-950/20/40 flex items-center justify-center overflow-hidden">
                    <img
                      src={safeImageUrl(item.image_url, "/images/placeholder-card.svg")}
                      alt={item.title}
                      className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
                      loading="lazy"
                    />
                  </div>
                  <div className="p-5">
                    <div className="flex items-center gap-2 mb-3 flex-wrap">
                      <Badge variant="sage" className="text-[10px]">{item.category}</Badge>
                      {item.content_type && <Badge variant="stone" className="text-[10px]">{item.content_type}</Badge>}
                    </div>
                    <h3 className="font-display font-semibold text-stone-800 dark:text-stone-100 text-sm leading-snug line-clamp-2 group-hover:text-primary-700 transition">{item.title}</h3>
                    {item.summary && (
                      <p className="text-stone-500 text-xs mt-2 font-serif leading-relaxed line-clamp-2">{item.summary}</p>
                    )}
                  </div>
                </Link>
              );
            })}
            </div>
          )}
        </div>
      </section>

      {/* ========== CTA ========== */}
      <section className="px-4 sm:px-8 py-24 sm:py-32">
        <div className="max-w-3xl mx-auto text-center">
          <div className="w-12 h-px bg-primary-300/40 mx-auto mb-8" />
          <Badge variant="sage" className="mb-5">{t("home.join_community")}</Badge>
          <h2 className="text-4xl sm:text-5xl font-display font-semibold text-stone-800 dark:text-stone-100 leading-[1.05]">{t("home.ready_to_share")}</h2>
          <p className="text-stone-500 dark:text-stone-400 mt-5 max-w-md mx-auto font-serif text-lg leading-relaxed">{t("home.cta_subtitle")}</p>
            <div className="flex flex-wrap justify-center gap-4 mt-10">
            <Button variant="primary" size="lg" onClick={() => router.push("/submit")}>
              {t("home.submit_link")}
            </Button>
            <Button variant="secondary" size="lg" onClick={() => router.push("/search")}>
              {t("home.browse_all")}
            </Button>
            </div>
          <div className="mt-10 w-12 h-px bg-primary-300/40 mx-auto" />
        </div>
      </section>
    </div>
  );
}
