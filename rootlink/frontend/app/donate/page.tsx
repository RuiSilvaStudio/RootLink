"use client";

import { useEffect, useState } from "react";
import { Heart, Trophy, Sparkles, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/lib/locale-context";
import { useToast } from "@/lib/toast-context";
import { Button, Badge } from "@/components/ui";

export default function DonatePage() {
  const { user, token } = useAuth();
  const { t, locale } = useLocale();
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
        <h1 className="text-4xl font-display font-bold text-stone-900 dark:text-stone-100 mb-3">
          {locale === "pt" ? "Apoie o RootLink" : "Support RootLink"}
        </h1>
        <p className="text-lg text-stone-600 dark:text-stone-400 font-serif max-w-2xl mx-auto">
          {locale === "pt"
            ? "RootLink é uma ONG. Todas as doações ajudam a manter a plataforma viva e a apoiar a comunidade. 1€ = 1 ponto = 1 dia de visibilidade."
            : "RootLink is an NGO. All donations help keep the platform alive and support the community. €1 = 1 point = 1 day of visibility."}
        </p>
      </div>

      {balance && (
        <div className="mb-10 p-6 rounded-2xl bg-primary-50 dark:bg-primary-900/20 border border-primary-200/40 dark:border-primary-800/30">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-stone-500 dark:text-stone-400">
                {locale === "pt" ? "O seu saldo de pontos" : "Your point balance"}
              </p>
              <p className="text-3xl font-display font-bold text-primary-700 dark:text-primary-400">
                {balance.balance.toFixed(1)}
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm text-stone-500 dark:text-stone-400">
                {locale === "pt" ? "Total doado" : "Total donated"}
              </p>
              <p className="text-xl font-display font-semibold text-stone-700 dark:text-stone-300">
                €{balance.total_donated.toFixed(0)}
              </p>
            </div>
          </div>
          {balance.boost_active && balance.boost_expires_at && (
            <div className="mt-4 pt-4 border-t border-primary-200/40 dark:border-primary-800/30">
              <Badge variant="amber">
                <Sparkles size={12} className="mr-1" />
                {locale === "pt" ? "Boost ativo até" : "Boost active until"}{" "}
                {new Date(balance.boost_expires_at).toLocaleDateString()}
              </Badge>
            </div>
          )}
        </div>
      )}

      <h2 className="text-2xl font-display font-bold text-stone-900 dark:text-stone-100 mb-6">
        {locale === "pt" ? "Níveis de doação" : "Donation tiers"}
      </h2>

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
              {tier.points} {locale === "pt" ? "pontos" : "points"} = {tier.points}{" "}
              {locale === "pt" ? "dias de boost" : "days of boost"}
            </div>
            <Button
              variant="primary"
              size="sm"
              onClick={() => handleDonate(tier.euros, tier.name)}
              disabled={donating === tier.euros}
              className="w-full"
            >
              {donating === tier.euros
                ? locale === "pt" ? "A processar..." : "Processing..."
                : locale === "pt" ? "Doar" : "Donate"}
            </Button>
          </div>
        ))}
      </div>

      {leaderboard.length > 0 && (
        <div>
          <h2 className="text-2xl font-display font-bold text-stone-900 dark:text-stone-100 mb-6 flex items-center gap-2">
            <Trophy className="w-6 h-6 text-amber-500" />
            {locale === "pt" ? "Maiores doadores" : "Top donors"}
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
        <h3 className="text-lg font-display font-semibold text-stone-900 dark:text-stone-100 mb-3">
          {locale === "pt" ? "Como funciona?" : "How does it work?"}
        </h3>
        <ul className="space-y-2 text-sm text-stone-600 dark:text-stone-400 font-serif">
          <li>• {locale === "pt" ? "1€ = 1 ponto = 1 dia de visibilidade boost" : "€1 = 1 point = 1 day of boosted visibility"}</li>
          <li>• {locale === "pt" ? "O boost aplica-se a todos os seus artigos publicados" : "Boost applies to all your published articles"}</li>
          <li>• {locale === "pt" ? "Máximo de 2 resultados boost por página (rotulados 'Apoiado pela comunidade')" : "Max 2 boosted results per page (labeled 'Community Supported')"}</li>
          <li>• {locale === "pt" ? "Decaimento de 10% ao mês quando tem artigos publicados" : "10% monthly decay when you have published articles"}</li>
          <li>• {locale === "pt" ? "Sem decaimento se não tiver artigos publicados" : "No decay if you have no published articles"}</li>
        </ul>
      </div>
    </div>
  );
}
