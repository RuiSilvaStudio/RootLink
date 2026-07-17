/**
 * Page block components — donate, leaderboard, ranking, tools, groups.
 * Each encapsulates one section of a content-heavy page, fetching its own
 * dynamic data where needed. Static copy (titles, subtitles, labels) is
 * configurable via props (editable in the studio), falling back to t() i18n
 * values when a prop is empty.
 *
 * Phase 5-9: migrate content-heavy pages to the block model.
 * Spec: docs/content-studio/CONTENT_STUDIO.md §6 (block model), §8 (Phase 4+).
 *
 * Pattern mirrors components/blocks/HomeBlocks.tsx (Phase 4 homepage migration).
 * No EditableText wrappers — the studio edits via block props, not inline editing.
 */

"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Heart, Trophy, Sparkles, BarChart3,
  Calendar, CheckSquare, Droplets, Hammer, Wrench, Ruler, ArrowRight,
  Users, Plus, MessageCircle,
} from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import { useLocale } from "@/lib/locale-context";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Card } from "@/components/ui/Card";
import { PageHeader } from "@/components/ui/PageHeader";
import { IconContainer, RankedListRow } from "@/components/ui/DeFacto";
import { Text } from "@/components/ui/Text";

type BlockProps = { props: Record<string, string> };

// ── Donate: hero ────────────────────────────────────────────────

export function DonateHeroBlock({ props }: BlockProps) {
  const { t } = useLocale();
  return (
    <div data-rl-component="DonateHeroBlock" className="text-center mb-12">
      <IconContainer
        icon={Heart}
        size="2xl"
        shape="2xl"
        bgColor="bg-primary-100 dark:bg-primary-900/30"
        iconColor="text-primary-600 dark:text-primary-400"
        inline
        className="mb-6"
      />
      <Text k="donate.hero_title" as="h1" className="text-4xl font-display font-bold text-stone-900 dark:text-stone-100 mb-3">
        {props.hero_title || t("donate.hero_title")}
      </Text>
      <Text k="donate.hero_subtitle" as="p" className="text-lg text-stone-600 dark:text-stone-400 font-serif max-w-2xl mx-auto">
        {props.hero_subtitle || t("donate.hero_subtitle")}
      </Text>
    </div>
  );
}

// ── Donate: balance card (auth-gated) ───────────────────────────

export function DonateBalanceBlock({ props }: BlockProps) {
  const { token } = useAuth();
  const { t } = useLocale();
  const [balance, setBalance] = useState<any>(null);

  useEffect(() => {
    if (token) {
      api.points.balance().catch(() => null).then((d) => d && setBalance(d));
    }
  }, [token]);

  if (!balance) return null;

  return (
    <div data-rl-component="DonateBalanceBlock" className="mb-10 p-6 rounded-2xl bg-primary-50 dark:bg-primary-900/20 border border-primary-200/40 dark:border-primary-800/30">
      <div className="flex items-center justify-between">
        <div>
          <Text k="donate.your_balance" as="p" className="text-sm text-stone-500 dark:text-stone-400">
            {props.balance_label || t("donate.your_balance")}
          </Text>
          <p className="text-3xl font-display font-bold text-primary-700 dark:text-primary-400">
            {balance.balance.toFixed(1)}
          </p>
        </div>
        <div className="text-right">
          <Text k="donate.total_donated" as="p" className="text-sm text-stone-500 dark:text-stone-400">
            {props.total_donated_label || t("donate.total_donated")}
          </Text>
          <p className="text-xl font-display font-semibold text-stone-700 dark:text-stone-300">
            €{balance.total_donated.toFixed(0)}
          </p>
        </div>
      </div>
      {balance.boost_active && balance.boost_expires_at && (
        <div className="mt-4 pt-4 border-t border-primary-200/40 dark:border-primary-800/30">
          <Badge variant="amber">
            <Sparkles size={12} className="mr-1" />
            <Text k="donate.boost_active_until" as="span">
              {props.boost_label || t("donate.boost_active_until")}
            </Text>{" "}
            {new Date(balance.boost_expires_at).toLocaleDateString()}
          </Badge>
        </div>
      )}
    </div>
  );
}

// ── Donate: tiers (with checkout redirect) ──────────────────────

export function DonateTiersBlock({ props }: BlockProps) {
  const { token } = useAuth();
  const { addToast } = useToast();
  const { t } = useLocale();
  const [tiers, setTiers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [donating, setDonating] = useState<number | null>(null);

  useEffect(() => {
    api.points.tiers()
      .then((d) => setTiers(d?.tiers || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const handleDonate = async (amount: number, tierName?: string) => {
    if (!token) {
      addToast("error", "Please sign in to donate");
      return;
    }
    setDonating(amount);
    try {
      const res = await api.points.donate({ amount_euros: amount, tier_name: tierName });
      window.location.href = res.checkout_url;
    } catch (err: any) {
      addToast("error", err.message || "Donation failed");
      setDonating(null);
    }
  };

  const heading = props.heading || t("donate.donation_tiers");

  if (loading) {
    return (
      <div data-rl-component="DonateTiersBlock">
        <Text k="donate.donation_tiers" as="h2" className="text-2xl font-display font-bold text-stone-900 dark:text-stone-100 mb-6">
          {heading}
        </Text>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-40 rounded-2xl bg-stone-100 dark:bg-stone-800 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div data-rl-component="DonateTiersBlock">
      <Text k="donate.donation_tiers" as="h2" className="text-2xl font-display font-bold text-stone-900 dark:text-stone-100 mb-6">
        {heading}
      </Text>
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
        {tiers.map((tier) => (
          <div
            key={tier.name}
            className="p-6 rounded-2xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700 hover:border-primary-300 dark:hover:border-primary-700 transition-colors"
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-display font-semibold text-stone-900 dark:text-stone-100">
                {tier.name}
              </h3>
              <span className="text-2xl font-display font-bold text-primary-600 dark:text-primary-400">
                €{tier.euros}
              </span>
            </div>
            <p className="text-sm text-stone-600 dark:text-stone-400 font-serif mb-4">
              {tier.description}
            </p>
            <div className="text-xs text-stone-500 dark:text-stone-500 mb-4">
              {tier.points}{" "}
              <Text k="donate.points_label" as="span">
                {props.points_label || t("donate.points_label")}
              </Text>{" "}
              = {tier.points}{" "}
              <Text k="donate.days_of_boost" as="span">
                {props.days_label || t("donate.days_of_boost")}
              </Text>
            </div>
            <Button
              variant="primary"
              size="sm"
              data-rl-text="donate.donate_button"
              onClick={() => handleDonate(tier.euros, tier.name)}
              disabled={donating === tier.euros}
              className="w-full"
            >
              {donating === tier.euros
                ? (props.processing_label || t("donate.processing"))
                : (props.donate_label || t("donate.donate_button"))}
            </Button>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Donate: top donors leaderboard ──────────────────────────────

export function DonateLeaderboardBlock({ props }: BlockProps) {
  const { t } = useLocale();
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.points.leaderboard(10)
      .then(setLeaderboard)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  const heading = props.heading || t("donate.top_donors");

  if (loading) {
    return (
      <div data-rl-component="DonateLeaderboardBlock">
        <Text k="donate.top_donors" as="h2" className="text-2xl font-display font-bold text-stone-900 dark:text-stone-100 mb-6 flex items-center gap-2">
          <Trophy className="w-6 h-6 text-amber-500" />
          {heading}
        </Text>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 rounded-xl bg-stone-100 dark:bg-stone-800 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (leaderboard.length === 0) return null;

  return (
    <div data-rl-component="DonateLeaderboardBlock">
      <Text k="donate.top_donors" as="h2" className="text-2xl font-display font-bold text-stone-900 dark:text-stone-100 mb-6 flex items-center gap-2">
        <Trophy className="w-6 h-6 text-amber-500" />
        {heading}
      </Text>
      <div className="space-y-2">
        {leaderboard.map((entry, i) => (
          <div
            key={entry.user_id}
            className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700"
          >
            <div className="flex items-center gap-3">
              <span className="text-lg font-display font-bold text-stone-400 dark:text-stone-500 w-8">
                {i + 1}
              </span>
              {entry.avatar_url ? (
                <img src={entry.avatar_url} alt="" className="w-8 h-8 rounded-full" />
              ) : (
                <div className="w-8 h-8 rounded-full bg-primary-100 dark:bg-primary-900/30 flex items-center justify-center text-xs font-medium text-primary-700 dark:text-primary-400">
                  {entry.name[0]}
                </div>
              )}
              <span className="text-sm font-medium text-stone-700 dark:text-stone-300">
                {entry.name}
              </span>
            </div>
            <span className="text-sm font-display font-semibold text-primary-600 dark:text-primary-400">
              €{entry.total_donated.toFixed(0)}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Donate: how it works (static bullets) ───────────────────────

export function DonateHowItWorksBlock({ props }: BlockProps) {
  const { t } = useLocale();
  const bullets = [
    "donate.how_it_works_1",
    "donate.how_it_works_2",
    "donate.how_it_works_3",
    "donate.how_it_works_4",
    "donate.how_it_works_5",
  ];
  return (
    <div data-rl-component="DonateHowItWorksBlock" className="mt-12 p-6 rounded-2xl bg-stone-50 dark:bg-stone-900/50 border border-stone-200 dark:border-stone-700">
      <Text k="donate.how_it_works" as="h3" className="text-lg font-display font-semibold text-stone-900 dark:text-stone-100 mb-3">
        {props.heading || t("donate.how_it_works")}
      </Text>
      <ul className="space-y-2 text-sm text-stone-600 dark:text-stone-400 font-serif">
        {bullets.map((key, i) => (
          <li key={key}>• <Text k={key} as="span">{props[`how_${i + 1}`] || t(key)}</Text></li>
        ))}
      </ul>
    </div>
  );
}

// ── Leaderboard: hero ───────────────────────────────────────────

export function LeaderboardHeroBlock({ props }: BlockProps) {
  const { t } = useLocale();
  return (
    <div data-rl-component="LeaderboardHeroBlock" className="text-center mb-10">
      <IconContainer
        icon={Trophy}
        size="2xl"
        shape="2xl"
        bgColor="bg-amber-100 dark:bg-amber-900/30"
        iconColor="text-amber-600 dark:text-amber-400"
        inline
        className="mb-4"
      />
      <Text k="leaderboard.hero_title" as="h1" className="text-3xl font-display font-bold text-stone-900 dark:text-stone-100 mb-2">
        {props.hero_title || t("leaderboard.hero_title")}
      </Text>
      <Text k="leaderboard.hero_subtitle" as="p" className="text-stone-600 dark:text-stone-400 font-serif">
        {props.hero_subtitle || t("leaderboard.hero_subtitle")}
      </Text>
    </div>
  );
}

// ── Leaderboard: ranked list (gold/silver/bronze) ───────────────

export function LeaderboardListBlock({ props }: BlockProps) {
  const { t } = useLocale();
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.points.leaderboard(50)
      .then(setLeaderboard)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div data-rl-component="LeaderboardListBlock" className="space-y-3">
        {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((i) => (
          <div key={i} className="h-16 rounded-xl bg-stone-100 dark:bg-stone-800 animate-pulse" />
        ))}
      </div>
    );
  }

  if (leaderboard.length === 0) {
    return (
      <div data-rl-component="LeaderboardListBlock" className="text-center py-12">
        <Heart className="w-12 h-12 text-stone-300 dark:text-stone-600 mx-auto mb-4" />
        <Text k="leaderboard.empty_state" as="p" className="text-stone-500 dark:text-stone-400 font-serif">
          {props.empty_state || t("leaderboard.empty_state")}
        </Text>
        <Link href="/donate" className="mt-4 inline-block">
          <Button variant="primary" data-rl-text="leaderboard.donate_now">{props.donate_now_label || t("leaderboard.donate_now")}</Button>
        </Link>
      </div>
    );
  }

  return (
    <div data-rl-component="LeaderboardListBlock" className="space-y-2">
      {leaderboard.map((entry, i) => (
        <RankedListRow
          key={entry.user_id}
          rank={i + 1}
          name={entry.name}
          avatarUrl={entry.avatar_url}
          amount={`€${entry.total_donated.toFixed(0)}`}
          tierLabel={
            i < 3
              ? i === 0
                ? (props.gold_label || t("leaderboard.gold"))
                : i === 1
                ? (props.silver_label || t("leaderboard.silver"))
                : (props.bronze_label || t("leaderboard.bronze"))
              : undefined
          }
        />
      ))}
    </div>
  );
}

// ── Ranking: hero ───────────────────────────────────────────────

export function RankingHeroBlock({ props }: BlockProps) {
  const { t } = useLocale();
  return (
    <div data-rl-component="RankingHeroBlock" className="text-center mb-10">
      <IconContainer
        icon={BarChart3}
        size="2xl"
        shape="2xl"
        bgColor="bg-primary-100 dark:bg-primary-900/30"
        iconColor="text-primary-600 dark:text-primary-400"
        inline
        className="mb-4"
      />
      <Text k="ranking.hero_title" as="h1" className="text-3xl font-display font-bold text-stone-900 dark:text-stone-100 mb-2">
        {props.hero_title || t("ranking.hero_title")}
      </Text>
      <Text k="ranking.hero_subtitle" as="p" className="text-stone-600 dark:text-stone-400 font-serif">
        {props.hero_subtitle || t("ranking.hero_subtitle")}
      </Text>
    </div>
  );
}

// ── Ranking: transparency details (formula + weights) ───────────

export function RankingDetailsBlock({ props }: BlockProps) {
  const { t } = useLocale();
  const [info, setInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.articles.rankingTransparency()
      .then(setInfo)
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div data-rl-component="RankingDetailsBlock" className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-20 rounded-xl bg-stone-100 dark:bg-stone-800 animate-pulse" />
        ))}
      </div>
    );
  }

  if (!info) return null;

  return (
    <div data-rl-component="RankingDetailsBlock" className="space-y-6">
      <div className="p-6 rounded-2xl bg-primary-50 dark:bg-primary-900/20 border border-primary-200/40 dark:border-primary-800/30">
        <Text k="ranking.formula" as="h2" className="text-lg font-display font-semibold text-stone-900 dark:text-stone-100 mb-3">
          {props.formula_label || t("ranking.formula")}
        </Text>
        <code className="block text-sm text-primary-700 dark:text-primary-400 bg-white dark:bg-stone-900 p-4 rounded-lg overflow-x-auto">
          {info.formula}
        </code>
      </div>

      <div className="grid sm:grid-cols-2 gap-4">
        {Object.entries(info.weights).map(([key, weight]) => (
          <div
            key={key}
            className="p-5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700"
          >
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-sm font-display font-semibold text-stone-900 dark:text-stone-100 capitalize">
                {key}
              </h3>
              <span className="text-lg font-display font-bold text-primary-600 dark:text-primary-400">
                {((weight as number) * 100).toFixed(0)}%
              </span>
            </div>
            <p className="text-xs text-stone-500 dark:text-stone-400 font-serif">
              {info.descriptions[key]}
            </p>
          </div>
        ))}
      </div>

      <div className="p-6 rounded-2xl bg-stone-50 dark:bg-stone-900/50 border border-stone-200 dark:border-stone-700">
        <Text k="ranking.details" as="h2" className="text-lg font-display font-semibold text-stone-900 dark:text-stone-100 mb-4">
          {props.details_label || t("ranking.details")}
        </Text>
        <ul className="space-y-2 text-sm text-stone-600 dark:text-stone-400 font-serif">
          <li>
            • <Text k="ranking.boost_label" as="strong">{props.boost_label || t("ranking.boost_label")}</Text>{" "}
            {info.boost_slots_per_page}{" "}
            <Text k="ranking.boost_text" as="span">{props.boost_text || t("ranking.boost_text")}</Text>{" "}
            &ldquo;{info.boost_label}&rdquo;
          </li>
          <li>
            • <Text k="ranking.time_decay_label" as="strong">{props.time_decay_label || t("ranking.time_decay_label")}</Text>{" "}
            <Text k="ranking.half_life_of" as="span">{props.half_life_label || t("ranking.half_life_of")}</Text> {info.freshness_half_life}
          </li>
          <li>
            • <Text k="ranking.rating_method_label" as="strong">{props.rating_method_label || t("ranking.rating_method_label")}</Text>{" "}
            {info.rating_method}
          </li>
          <li>
            • <Text k="ranking.engagement_signals_label" as="strong">{props.engagement_signals_label || t("ranking.engagement_signals_label")}</Text>{" "}
            {info.engagement_signals}
          </li>
        </ul>
      </div>
    </div>
  );
}

// ── Tools: header ───────────────────────────────────────────────

export function ToolsHeaderBlock({ props }: BlockProps) {
  const { t } = useLocale();
  return (
    <div data-rl-component="ToolsHeaderBlock" className="flex items-center gap-3 mb-2">
      <IconContainer icon={Wrench} size="md" shape="xl" bgColor="bg-primary-100 dark:bg-primary-950/20" iconColor="text-primary-500" />
      <div>
        <Text k="tools.title" as="h1" className="text-3xl font-serif font-bold text-stone-800">
          {props.title || t("tools.title")}
        </Text>
        <Text k="tools.subtitle" as="p" className="text-stone-500 font-light">
          {props.subtitle || t("tools.subtitle")}
        </Text>
      </div>
    </div>
  );
}

// ── Tools: grid (static array, t() for names/descriptions) ──────

const TOOLS = [
  {
    nameKey: "tools.gardening_calendar",
    slug: "gardening-calendar",
    icon: Calendar,
    iconBg: "bg-primary-100 dark:bg-primary-900/30",
    iconColor: "text-primary-600 dark:text-primary-400",
    descKey: "tools.gardening_calendar_desc",
  },
  {
    nameKey: "tools.monthly_checklist",
    slug: "monthly-checklist",
    icon: CheckSquare,
    iconBg: "bg-earth-100 dark:bg-earth-900/30",
    iconColor: "text-earth-600 dark:text-earth-400",
    descKey: "tools.monthly_checklist_desc",
  },
  {
    nameKey: "tools.irrigation_calculator",
    slug: "irrigation-calculator",
    icon: Droplets,
    iconBg: "bg-blue-100 dark:bg-blue-900/30",
    iconColor: "text-blue-600 dark:text-blue-400",
    descKey: "tools.irrigation_calculator_desc",
  },
  {
    nameKey: "tools.coming_soon_planner",
    slug: "#",
    icon: Hammer,
    iconBg: "bg-stone-100 dark:bg-stone-800",
    iconColor: "text-stone-400 dark:text-stone-500",
    descKey: "tools.coming_soon_planner_desc",
    disabled: true,
  },
  {
    nameKey: "tools.coming_soon_estimator",
    slug: "#",
    icon: Ruler,
    iconBg: "bg-stone-100 dark:bg-stone-800",
    iconColor: "text-stone-400 dark:text-stone-500",
    descKey: "tools.coming_soon_estimator_desc",
    disabled: true,
  },
];

export function ToolsGridBlock({ props }: BlockProps) {
  const { t } = useLocale();
  return (
    <div data-rl-component="ToolsGridBlock" className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6 mt-10">
      {TOOLS.map((tool) => (
        tool.disabled ? (
          <div key={tool.slug}
            className="p-6 sm:p-8 rounded-xl2 border border-primary-100 dark:border-stone-700 bg-white/50 dark:bg-stone-900/50 opacity-50 cursor-not-allowed"
          >
            <IconContainer icon={tool.icon} size="md" shape="xl" bgColor={tool.iconBg} iconColor={tool.iconColor} className="mb-4" />
            <Text k={tool.nameKey} as="h3" className="text-lg font-serif font-bold text-stone-600 dark:text-stone-400 mb-2">
              {t(tool.nameKey)}
            </Text>
            <Text k={tool.descKey} as="p" className="text-stone-500 dark:text-stone-400 text-sm font-light">
              {t(tool.descKey)}
            </Text>
            <Badge variant="stone" className="mt-3 text-[11px]">
              <Text k="tools.coming_soon" as="span" defaultText="Coming soon">
                {props.coming_soon_label || t("tools.coming_soon")}
              </Text>
            </Badge>
          </div>
        ) : (
          <a key={tool.slug} href={`/tools/${tool.slug}`}
            className="card-lift p-6 sm:p-8 group"
          >
            <IconContainer icon={tool.icon} size="lg" shape="2xl" bgColor={tool.iconBg} iconColor={tool.iconColor} hoverScale className="mb-4" />
            <Text k={tool.nameKey} as="h3" className="text-xl font-serif font-bold text-stone-800 dark:text-stone-100 mb-2">
              {t(tool.nameKey)}
            </Text>
            <Text k={tool.descKey} as="p" className="text-stone-500 text-sm font-light leading-relaxed">
              {t(tool.descKey)}
            </Text>
            <span className="inline-flex items-center gap-1 text-sm font-medium text-primary-500 mt-4 group-hover:gap-2 transition-all">
              <Text k="tools.open_tool" as="span">{props.open_tool_label || t("tools.open_tool")}</Text> <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </a>
        )
      ))}
    </div>
  );
}

// ── Groups: header (PageHeader + new-group button) ──────────────

export function GroupsHeaderBlock({ props }: BlockProps) {
  const { t } = useLocale();
  const router = useRouter();
  return (
    <PageHeader
      data-rl-component="GroupsHeaderBlock"
      icon={<Users className="w-5 h-5 text-primary-500" />}
      title={<Text k="groups.title" as="span">{props.title || t("groups.title")}</Text>}
      subtitle={<Text k="groups.subtitle" as="span">{props.subtitle || t("groups.subtitle")}</Text>}
      action={
        <Button variant="primary" size="sm" data-rl-text="groups.new_group" onClick={() => router.push("/groups?new=1")}>
          <Plus className="w-4 h-4" /> {props.new_group_label || t("groups.new_group")}
        </Button>
      }
    />
  );
}

// ── Groups: hero (3-card value proposition) ─────────────────────

export function GroupsHeroBlock({ props }: BlockProps) {
  const { t } = useLocale();
  return (
    <Card variant="plain" data-rl-component="GroupsHeroBlock" className="p-6 mb-8 bg-gradient-to-br from-primary-50 to-white dark:from-primary-900/20 dark:to-stone-900 border-primary-100 dark:border-stone-700">
      <div className="grid md:grid-cols-3 gap-6">
        <div className="flex items-start gap-3">
          <IconContainer icon={MessageCircle} size="md" shape="xl" bgColor="bg-primary-100 dark:bg-primary-900/30" iconColor="text-primary-600 dark:text-primary-400" />
          <div>
            <Text k="groups.hero_discuss" as="h3" className="font-semibold text-stone-800 dark:text-stone-100 text-sm">
              {props.hero_discuss || t("groups.hero_discuss")}
            </Text>
            <Text k="groups.hero_discuss_desc" as="p" className="text-xs text-stone-500 dark:text-stone-400 mt-1 font-light leading-relaxed">
              {props.hero_discuss_desc || t("groups.hero_discuss_desc")}
            </Text>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <IconContainer icon={Calendar} size="md" shape="xl" bgColor="bg-earth-100 dark:bg-earth-900/30" iconColor="text-earth-600 dark:text-earth-400" />
          <div>
            <Text k="groups.hero_events" as="h3" className="font-semibold text-stone-800 dark:text-stone-100 text-sm">
              {props.hero_events || t("groups.hero_events")}
            </Text>
            <Text k="groups.hero_events_desc" as="p" className="text-xs text-stone-500 dark:text-stone-400 mt-1 font-light leading-relaxed">
              {props.hero_events_desc || t("groups.hero_events_desc")}
            </Text>
          </div>
        </div>
        <div className="flex items-start gap-3">
          <IconContainer icon={Users} size="md" shape="xl" bgColor="bg-green-100 dark:bg-green-900/30" iconColor="text-green-600 dark:text-green-400" />
          <div>
            <Text k="groups.hero_network" as="h3" className="font-semibold text-stone-800 dark:text-stone-100 text-sm">
              {props.hero_network || t("groups.hero_network")}
            </Text>
            <Text k="groups.hero_network_desc" as="p" className="text-xs text-stone-500 dark:text-stone-400 mt-1 font-light leading-relaxed">
              {props.hero_network_desc || t("groups.hero_network_desc")}
            </Text>
          </div>
        </div>
      </div>
    </Card>
  );
}
