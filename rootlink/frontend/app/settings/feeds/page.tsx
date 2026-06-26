"use client";

import { useEffect, useState } from "react";
import { Rss, Plus, RefreshCw, Trash2, CheckCircle, XCircle, ArrowLeft, ExternalLink } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/lib/locale-context";
import { useToast } from "@/lib/toast-context";
import { Button, Badge, EmptyState } from "@/components/ui";

export default function FeedSettingsPage() {
  const { user, token } = useAuth();
  const { t, locale } = useLocale();
  const { addToast } = useToast();
  const [feeds, setFeeds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [feedUrl, setFeedUrl] = useState("");
  const [siteUrl, setSiteUrl] = useState("");
  const [connecting, setConnecting] = useState(false);

  useEffect(() => {
    if (!token) return;
    api.feeds.list().then(setFeeds).catch(() => {}).finally(() => setLoading(false));
  }, [token]);

  const handleConnect = async () => {
    if (!feedUrl.trim()) {
      addToast("error", "Feed URL is required");
      return;
    }
    setConnecting(true);
    try {
      await api.feeds.connect({ feed_url: feedUrl, site_url: siteUrl || undefined });
      addToast("success", "Feed connected! Check your site for the verification meta tag.");
      setFeedUrl("");
      setSiteUrl("");
      setShowForm(false);
      const updated = await api.feeds.list();
      setFeeds(updated);
    } catch (err: any) {
      addToast("error", err.message);
    }
    setConnecting(false);
  };

  const handleVerify = async (feedId: number) => {
    try {
      await api.feeds.verify(feedId);
      addToast("success", "Feed verified!");
      const updated = await api.feeds.list();
      setFeeds(updated);
    } catch (err: any) {
      addToast("error", err.message);
    }
  };

  const handleRefresh = async (feedId: number) => {
    try {
      const res = await api.feeds.refresh(feedId);
      addToast("success", `${res.new_items} new items found`);
      const updated = await api.feeds.list();
      setFeeds(updated);
    } catch (err: any) {
      addToast("error", err.message);
    }
  };

  const handleDisconnect = async (feedId: number) => {
    if (!confirm("Disconnect this feed?")) return;
    try {
      await api.feeds.disconnect(feedId);
      setFeeds(feeds.filter((f) => f.id !== feedId));
      addToast("success", "Feed disconnected");
    } catch (err: any) {
      addToast("error", err.message);
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-12">
      <Link
        href="/profile"
        className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200 transition-colors mb-8"
      >
        <ArrowLeft size={16} />
        {locale === "pt" ? "Voltar ao perfil" : "Back to profile"}
      </Link>

      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-display font-bold text-stone-900 dark:text-stone-100">
            {locale === "pt" ? "Feeds RSS" : "RSS Feeds"}
          </h1>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">
            {locale === "pt"
              ? "Conecte o seu blog ou site para injetar conteúdo automaticamente."
              : "Connect your blog or site to automatically inject content."}
          </p>
        </div>
        <Button variant="primary" size="sm" onClick={() => setShowForm(!showForm)}>
          <Plus size={14} className="mr-1" />
          {locale === "pt" ? "Conectar feed" : "Connect feed"}
        </Button>
      </div>

      {showForm && (
        <div className="mb-8 p-6 rounded-2xl bg-primary-50 dark:bg-primary-900/20 border border-primary-200/40 dark:border-primary-800/30">
          <h3 className="text-lg font-display font-semibold text-stone-900 dark:text-stone-100 mb-4">
            {locale === "pt" ? "Novo feed RSS" : "New RSS feed"}
          </h3>
          <div className="space-y-4">
            <div>
              <label className="block text-sm text-stone-600 dark:text-stone-400 mb-1">
                {locale === "pt" ? "URL do feed RSS *" : "RSS feed URL *"}
              </label>
              <input
                type="url"
                value={feedUrl}
                onChange={(e) => setFeedUrl(e.target.value)}
                placeholder="https://yourblog.com/feed"
                className="w-full px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15 focus:outline-none"
              />
            </div>
            <div>
              <label className="block text-sm text-stone-600 dark:text-stone-400 mb-1">
                {locale === "pt" ? "URL do site (para verificação)" : "Site URL (for verification)"}
              </label>
              <input
                type="url"
                value={siteUrl}
                onChange={(e) => setSiteUrl(e.target.value)}
                placeholder="https://yourblog.com"
                className="w-full px-4 py-2.5 rounded-xl border border-stone-200 dark:border-stone-700 bg-white dark:bg-stone-900 text-sm focus:border-primary-400 focus:ring-2 focus:ring-primary-500/15 focus:outline-none"
              />
            </div>
            <div className="flex gap-2">
              <Button variant="primary" onClick={handleConnect} disabled={connecting}>
                {connecting ? (locale === "pt" ? "A conectar..." : "Connecting...") : (locale === "pt" ? "Conectar" : "Connect")}
              </Button>
              <Button variant="secondary" onClick={() => setShowForm(false)}>
                {locale === "pt" ? "Cancelar" : "Cancel"}
              </Button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-stone-100 dark:bg-stone-800 animate-pulse" />
          ))}
        </div>
      ) : feeds.length === 0 ? (
        <EmptyState
          icon={<Rss size={48} />}
          title={locale === "pt" ? "Nenhum feed conectado" : "No feeds connected"}
          message={locale === "pt" ? "Conecte o seu blog RSS para começar a injetar conteúdo." : "Connect your RSS blog to start injecting content."}
        />
      ) : (
        <div className="space-y-3">
          {feeds.map((feed) => (
            <div
              key={feed.id}
              className="p-5 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={feed.verified ? "green" : "stone"}>
                      {feed.verified ? (
                        <span className="flex items-center gap-1"><CheckCircle size={10} /> Verified</span>
                      ) : (
                        <span className="flex items-center gap-1"><XCircle size={10} /> Pending</span>
                      )}
                    </Badge>
                    <Badge variant={feed.priority === 1 ? "amber" : "blue"}>
                      {feed.priority === 1
                        ? (locale === "pt" ? "Prioridade alta" : "High priority")
                        : (locale === "pt" ? "Prioridade normal" : "Normal priority")}
                    </Badge>
                  </div>
                  <p className="text-sm font-medium text-stone-700 dark:text-stone-300 truncate">
                    {feed.feed_url}
                  </p>
                  {feed.title && (
                    <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">{feed.title}</p>
                  )}
                </div>
              </div>

              {!feed.verified && feed.verification_token && (
                <div className="mb-3 p-3 rounded-lg bg-amber-50 dark:bg-amber-900/20 border border-amber-200/40 dark:border-amber-800/30">
                  <p className="text-xs text-amber-700 dark:text-amber-400 mb-1">
                    {locale === "pt" ? "Adicione esta meta tag ao seu site para verificar:" : "Add this meta tag to your site to verify:"}
                  </p>
                  <code className="text-xs text-stone-700 dark:text-stone-300 bg-white dark:bg-stone-900 px-2 py-1 rounded block overflow-x-auto">
                    {`<meta name="rootlink-verify" content="${feed.verification_token}">`}
                  </code>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleVerify(feed.id)}
                    className="mt-2"
                  >
                    <CheckCircle size={12} className="mr-1" />
                    {locale === "pt" ? "Verificar agora" : "Verify now"}
                  </Button>
                </div>
              )}

              <div className="flex items-center gap-4 text-xs text-stone-500 dark:text-stone-400 mb-3">
                {feed.last_crawled_at && (
                  <span>
                    {locale === "pt" ? "Última crawl:" : "Last crawl:"}{" "}
                    {new Date(feed.last_crawled_at).toLocaleDateString()}
                  </span>
                )}
                {feed.last_error && (
                  <span className="text-red-500">Error: {feed.last_error.slice(0, 50)}</span>
                )}
              </div>

              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => handleRefresh(feed.id)}>
                  <RefreshCw size={12} className="mr-1" />
                  {locale === "pt" ? "Atualizar" : "Refresh"}
                </Button>
                <Button variant="ghost" size="sm" onClick={() => handleDisconnect(feed.id)}>
                  <Trash2 size={12} className="mr-1" />
                  {locale === "pt" ? "Desconectar" : "Disconnect"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
