"use client";

import { useEffect, useState } from "react";
import { Heart, Trophy, Sparkles, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useToast } from "@/lib/toast-context";
import { Button, Badge } from "@/components/ui";
import { EditableText } from "@/components/editor-mode/editable-text";

export default function DonatePage() {
  const { user, token } = useAuth();
  const { addToast } = useToast();
  const [tiers, setTiers] = useState<any[]>([]);
  const [balance, setBalance] = useState<any>(null);
  const [leaderboard, setLeaderboard] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [donating, setDonating] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      api.points.tiers(),
      token ? api.points.balance().catch(() => null) : Promise.resolve(null),
      api.points.leaderboard(10),
    ]).then(([tiersData, balanceData, leaderboardData]) => {
      setTiers(tiersData?.tiers || []);
      setBalance(balanceData);
      setLeaderboard(leaderboardData || []);
      setLoading(false);
    }).catch(() => setLoading(false));
  }, [token]);

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

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 sm:px-8 py-12">
        <div className="space-y-6">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-32 rounded-xl bg-stone-100 dark:bg-stone-800 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-12">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200 transition-colors mb-8"
      >
        <ArrowLeft size={16} />
        Back
      </Link>

      <div className="text-center mb-12">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-primary-100 dark:bg-primary-900/30 mb-6">
          <Heart className="w-8 h-8 text-primary-600 dark:text-primary-400" />
        </div>
        <EditableText k="donate.hero_title" as="h1" className="text-4xl font-display font-bold text-stone-900 dark:text-stone-100 mb-3" />
        <EditableText k="donate.hero_subtitle" as="p" className="text-lg text-stone-600 dark:text-stone-400 font-serif max-w-2xl mx-auto" />
      </div>

      {balance && (
        <div className="mb-10 p-6 rounded-2xl bg-primary-50 dark:bg-primary-900/20 border border-primary-200/40 dark:border-primary-800/30">
          <div className="flex items-center justify-between">
            <div>
              <EditableText k="donate.your_balance" as="p" className="text-sm text-stone-500 dark:text-stone-400" />
              <p className="text-3xl font-display font-bold text-primary-700 dark:text-primary-400">
                {balance.balance.toFixed(1)}
              </p>
            </div>
            <div className="text-right">
              <EditableText k="donate.total_donated" as="p" className="text-sm text-stone-500 dark:text-stone-400" />
              <p className="text-xl font-display font-semibold text-stone-700 dark:text-stone-300">
                €{balance.total_donated.toFixed(0)}
              </p>
            </div>
          </div>
          {balance.boost_active && balance.boost_expires_at && (
            <div className="mt-4 pt-4 border-t border-primary-200/40 dark:border-primary-800/30">
              <Badge variant="amber">
                <Sparkles size={12} className="mr-1" />
                <EditableText k="donate.boost_active_until" as="span" />{" "}
                {new Date(balance.boost_expires_at).toLocaleDateString()}
              </Badge>
            </div>
          )}
        </div>
      )}

      <EditableText k="donate.donation_tiers" as="h2" className="text-2xl font-display font-bold text-stone-900 dark:text-stone-100 mb-6" />

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
              {tier.points} <EditableText k="donate.points_label" as="span" /> = {tier.points}{" "}
              <EditableText k="donate.days_of_boost" as="span" />
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleDonate(tier.euros, tier.name)}
              disabled={donating === tier.euros}
              className="w-full"
            >
              {donating === tier.euros
                ? <EditableText k="donate.processing" as="span" />
                : <EditableText k="donate.donate_button" as="span" />}
            </Button>
          </div>
        ))}
      </div>

      {leaderboard.length > 0 && (
        <div>
          <h2 className="text-2xl font-display font-bold text-stone-900 dark:text-stone-100 mb-6 flex items-center gap-2">
            <Trophy className="w-6 h-6 text-amber-500" />
            <EditableText k="donate.top_donors" as="span" />
          </h2>
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
      )}

      <div className="mt-12 p-6 rounded-2xl bg-stone-50 dark:bg-stone-900/50 border border-stone-200 dark:border-stone-700">
        <EditableText k="donate.how_it_works" as="h3" className="text-lg font-display font-semibold text-stone-900 dark:text-stone-100 mb-3" />
        <ul className="space-y-2 text-sm text-stone-600 dark:text-stone-400 font-serif">
          <li>• <EditableText k="donate.how_it_works_1" as="span" /></li>
          <li>• <EditableText k="donate.how_it_works_2" as="span" /></li>
          <li>• <EditableText k="donate.how_it_works_3" as="span" /></li>
          <li>• <EditableText k="donate.how_it_works_4" as="span" /></li>
          <li>• <EditableText k="donate.how_it_works_5" as="span" /></li>
        </ul>
      </div>
    </div>
  );
}
