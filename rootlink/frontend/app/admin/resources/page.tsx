"use client";

import { useEffect, useState, useCallback } from "react";
import { api } from "@/lib/api";
import { toast } from "sonner";
import { Badge, Button, EmptyState } from "@/components/ui";
import { ListSkeleton } from "@/components/ui/LoadingSkeleton";
import { LoadError } from "@/components/studio/LoadError";
import { flagFor } from "@/lib/language";
import { ExternalLink, Globe, FileText, Rss, Trash2, Power, Plus, Pencil, ShieldOff } from "lucide-react";

const SOURCE_LABELS: Record<string, string> = {
  crawled: "Crawled URL",
  user: "Authored",
  curated: "Curated",
};

const SOURCE_ICONS: Record<string, typeof Globe> = {
  crawled: Globe,
  user: FileText,
  curated: FileText,
};

export default function AdminResourcesPage() {
  const [tab, setTab] = useState<"articles" | "feeds" | "blocked">("articles");
  const [sources, setSources] = useState<any[]>([]);
  const [summary, setSummary] = useState<{ total: number; by_source: Record<string, { total: number; by_status: Record<string, number> }> }>({ total: 0, by_source: {} });
  const [feeds, setFeeds] = useState<any[]>([]);
  const [blockedFeeds, setBlockedFeeds] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [showAddFeed, setShowAddFeed] = useState(false);
  const [addFeedUrl, setAddFeedUrl] = useState("");
  const [addFeedSiteUrl, setAddFeedSiteUrl] = useState("");
  const [addFeedTitle, setAddFeedTitle] = useState("");
  const [addFeedPriority, setAddFeedPriority] = useState("2");
  const [addFeedLanguage, setAddFeedLanguage] = useState("");
  const [addingFeed, setAddingFeed] = useState(false);
  const [editingFeedId, setEditingFeedId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editPriority, setEditPriority] = useState("2");
  const [editLanguage, setEditLanguage] = useState("");

  const fetchArticles = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [srcData, sm] = await Promise.all([
        api.admin.contentBySource(),
        api.admin.contentSummary(),
      ]);
      let filtered = srcData;
      if (search) {
        const q = search.toLowerCase();
        filtered = srcData.filter((s: any) =>
          s.hostname.toLowerCase().includes(q) ||
          s.sample_title?.toLowerCase().includes(q)
        );
      }
      setSources(filtered);
      setSummary(sm);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, [search]);

  const fetchFeeds = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const data = await api.admin.listFeeds();
      setFeeds(data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchBlockedFeeds = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const data = await api.admin.listBlockedFeeds();
      setBlockedFeeds(data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (tab === "articles") fetchArticles();
    else if (tab === "feeds") fetchFeeds();
    else fetchBlockedFeeds();
  }, [tab, fetchArticles, fetchFeeds, fetchBlockedFeeds]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setSearch(searchInput);
  };

  const toggleFeedActive = async (feedId: number) => {
    try {
      const res = await api.admin.toggleFeedActive(feedId);
      setFeeds((prev) => prev.map((f) => f.id === feedId ? { ...f, is_active: res.is_active } : f));
      toast.success(res.is_active ? "Feed activated" : "Feed paused");
    } catch {
      toast.error("Failed to toggle feed");
    }
  };

  const deleteFeed = async (feedId: number) => {
    if (!confirm("Delete this feed source and all its items? This cannot be undone.")) return;
    try {
      await api.admin.deleteFeed(feedId);
      setFeeds((prev) => prev.filter((f) => f.id !== feedId));
      toast.success("Feed deleted");
    } catch {
      toast.error("Failed to delete feed");
    }
  };

  const blockFeed = async (feedId: number) => {
    const reason = prompt("Why is this feed being blocked? This will delete the feed and prevent the URL from being re-added.");
    if (reason === null || !reason.trim()) return;
    try {
      await api.admin.deleteFeed(feedId, reason.trim());
      setFeeds((prev) => prev.filter((f) => f.id !== feedId));
      toast.success("Feed blocked and deleted");
    } catch {
      toast.error("Failed to block feed");
    }
  };

  const unblockFeed = async (blockId: number) => {
    try {
      await api.admin.removeBlockedFeed(blockId);
      setBlockedFeeds((prev) => prev.filter((f) => f.id !== blockId));
      toast.success("Feed unblocked — can be re-added now");
    } catch {
      toast.error("Failed to unblock feed");
    }
  };

  const createFeed = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addFeedUrl.trim() || addingFeed) return;
    setAddingFeed(true);
    try {
      const res = await api.admin.createFeed({
        feed_url: addFeedUrl.trim(),
        site_url: addFeedSiteUrl.trim() || undefined,
        title: addFeedTitle.trim() || undefined,
        priority: parseInt(addFeedPriority) || 2,
        language: addFeedLanguage || undefined,
      });
      setFeeds((prev) => [{ ...res, item_count: 0 }, ...prev]);
      toast.success("Feed added");
      setShowAddFeed(false);
      setAddFeedUrl("");
      setAddFeedSiteUrl("");
      setAddFeedTitle("");
      setAddFeedPriority("2");
      setAddFeedLanguage("");
    } catch (err: any) {
      const msg = err?.message || "Failed to add feed";
      toast.error(msg);
    } finally {
      setAddingFeed(false);
    }
  };

  const startEditFeed = (feed: any) => {
    setEditingFeedId(feed.id);
    setEditTitle(feed.title || "");
    setEditPriority(String(feed.priority));
    setEditLanguage(feed.language || "");
  };

  const saveEditFeed = async (feedId: number) => {
    try {
      const res = await api.admin.updateFeed(feedId, {
        title: editTitle.trim() || undefined,
        priority: parseInt(editPriority) || undefined,
        language: editLanguage || undefined,
      });
      setFeeds((prev) => prev.map((f) => f.id === feedId ? { ...f, ...res } : f));
      toast.success("Feed updated");
      setEditingFeedId(null);
    } catch {
      toast.error("Failed to update feed");
    }
  };

  const sourceBadge = (source: string) => {
    const Icon = SOURCE_ICONS[source] || FileText;
    const variant = source === "crawled" ? "stone" : source === "user" ? "sage" : "earth";
    return (
      <Badge variant={variant as any} className="text-[10px] gap-1">
        <Icon size={10} />
        {SOURCE_LABELS[source] || source}
      </Badge>
    );
  };

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 px-6 py-4 border-b border-primary-200/40 dark:border-stone-800">
        <h1 className="font-display text-xl font-semibold text-stone-800 dark:text-stone-100">Resources</h1>
        <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">
          All content indexed on the platform - crawled URLs, authored articles, and RSS feed sources.
        </p>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {/* Tabs */}
        <div className="flex gap-1 bg-stone-100/60 dark:bg-stone-800/60 rounded-xl p-1 border border-stone-200/40 dark:border-stone-800 mb-5 w-fit">
          <button
            onClick={() => setTab("articles")}
            className={`px-4 py-1.5 rounded-lg text-sm font-display font-medium transition ${
              tab === "articles" ? "bg-white dark:bg-stone-900 shadow-sm text-primary-700 dark:text-primary-300" : "text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
            }`}
          >
            Articles
          </button>
          <button
            onClick={() => setTab("feeds")}
            className={`px-4 py-1.5 rounded-lg text-sm font-display font-medium transition ${
              tab === "feeds" ? "bg-white dark:bg-stone-900 shadow-sm text-primary-700 dark:text-primary-300" : "text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
            }`}
          >
            RSS Feeds
          </button>
          <button
            onClick={() => setTab("blocked")}
            className={`px-4 py-1.5 rounded-lg text-sm font-display font-medium transition ${
              tab === "blocked" ? "bg-white dark:bg-stone-900 shadow-sm text-primary-700 dark:text-primary-300" : "text-stone-500 dark:text-stone-400 hover:text-stone-700 dark:hover:text-stone-200"
            }`}
          >
            <span className="flex items-center gap-1.5">
              <ShieldOff size={14} />
              Blocked
              {blockedFeeds.length > 0 && (
                <span className="text-[10px] bg-red-500/10 text-red-600 dark:text-red-400 px-1.5 py-0.5 rounded-full">
                  {blockedFeeds.length}
                </span>
              )}
            </span>
          </button>
        </div>

        {tab === "articles" && (
          <>
            {/* Summary cards */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
              <SummaryCard label="Total" value={summary.total} />
              <SummaryCard label="Crawled" value={summary.by_source?.crawled?.total ?? 0} icon={Globe} />
              <SummaryCard label="Authored" value={summary.by_source?.user?.total ?? 0} icon={FileText} />
              <SummaryCard label="Curated" value={summary.by_source?.curated?.total ?? 0} icon={FileText} />
            </div>

            {/* Search */}
            <div className="flex gap-3 mb-5 items-center flex-wrap">
              <form onSubmit={handleSearch} className="flex gap-2">
                <input
                  value={searchInput}
                  onChange={(e) => setSearchInput(e.target.value)}
                  placeholder="Search source..."
                  className="border border-stone-200/60 dark:border-stone-800 rounded-xl px-3 py-2 text-sm bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 font-serif focus:outline-none focus:ring-2 focus:ring-primary-500/15 focus:border-primary-400 transition w-56"
                />
                <Button type="submit" size="sm" variant="primary">Search</Button>
              </form>
              <span className="text-xs text-stone-400">
                {sources.length} source{sources.length !== 1 ? "s" : ""}
              </span>
            </div>

            {/* Source list - one row per URL source */}
            {loading ? <ListSkeleton rows={6} /> : loadError ? <LoadError onRetry={fetchArticles} /> : (
              <div className="space-y-2">
                {sources.map((s: any, idx: number) => (
                  <div key={idx} className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/60 dark:border-stone-800 p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          {sourceBadge(s.source)}
                          <span className="font-display font-semibold text-stone-800 dark:text-stone-100 text-sm">
                            {s.hostname}
                          </span>
                          <Badge variant="sage" className="text-[10px]">
                            {s.article_count} article{s.article_count !== 1 ? "s" : ""}
                          </Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400 flex-wrap">
                          {s.languages.map((lang: string) => (
                            flagFor(lang) && <span key={lang} title={lang} className="text-sm leading-none">{flagFor(lang)}</span>
                          ))}
                          {s.families.slice(0, 5).map((fam: string) => (
                            <Badge key={fam} variant="stone" className="text-[10px]">{fam}</Badge>
                          ))}
                          {s.families.length > 5 && (
                            <span className="text-[10px] text-stone-400">+{s.families.length - 5} more</span>
                          )}
                        </div>
                        {s.source_url && s.source !== "user" && (
                          <a
                            href={s.source_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-0.5 text-xs text-primary-600 hover:underline mt-1"
                          >
                            <ExternalLink size={10} />
                            {s.source_url.length > 70 ? s.source_url.slice(0, 70) + "..." : s.source_url}
                          </a>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {sources.length === 0 && (
                  <EmptyState title="No sources found" message="Try a different search query." />
                )}
              </div>
            )}
          </>
        )}

        {tab === "feeds" && (
          <>
            <div className="flex items-center justify-between mb-4">
              <div className="text-sm text-stone-500 dark:text-stone-400">
                {feeds.length} RSS feed source{feeds.length !== 1 ? "s" : ""} registered on the platform.
              </div>
              {!showAddFeed && (
                <Button size="sm" variant="primary" onClick={() => setShowAddFeed(true)}>
                  <Plus size={14} />
                  Add feed
                </Button>
              )}
            </div>

            {showAddFeed && (
              <form onSubmit={createFeed} className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/60 dark:border-stone-800 p-4 mb-4">
                <div className="flex items-center gap-2 mb-3">
                  <Rss size={16} className="text-primary-500" />
                  <span className="font-display font-semibold text-stone-800 dark:text-stone-100 text-sm">Add RSS feed source</span>
                </div>
                <div className="grid sm:grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-stone-500 dark:text-stone-400 mb-1 block">Feed URL (RSS/Atom) *</label>
                    <input
                      value={addFeedUrl}
                      onChange={(e) => setAddFeedUrl(e.target.value)}
                      placeholder="https://example.com/feed.xml"
                      className="border border-stone-200/60 dark:border-stone-800 rounded-xl px-3 py-2 text-sm bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 font-serif focus:outline-none focus:ring-2 focus:ring-primary-500/15 focus:border-primary-400 transition w-full"
                      required
                    />
                  </div>
                  <div>
                    <label className="text-xs text-stone-500 dark:text-stone-400 mb-1 block">Site URL (optional)</label>
                    <input
                      value={addFeedSiteUrl}
                      onChange={(e) => setAddFeedSiteUrl(e.target.value)}
                      placeholder="https://example.com"
                      className="border border-stone-200/60 dark:border-stone-800 rounded-xl px-3 py-2 text-sm bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 font-serif focus:outline-none focus:ring-2 focus:ring-primary-500/15 focus:border-primary-400 transition w-full"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-stone-500 dark:text-stone-400 mb-1 block">Title (optional)</label>
                    <input
                      value={addFeedTitle}
                      onChange={(e) => setAddFeedTitle(e.target.value)}
                      placeholder="Example News"
                      className="border border-stone-200/60 dark:border-stone-800 rounded-xl px-3 py-2 text-sm bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 font-serif focus:outline-none focus:ring-2 focus:ring-primary-500/15 focus:border-primary-400 transition w-full"
                    />
                  </div>
                  <div>
                    <label className="text-xs text-stone-500 dark:text-stone-400 mb-1 block">Crawl frequency</label>
                    <select
                      value={addFeedPriority}
                      onChange={(e) => setAddFeedPriority(e.target.value)}
                      className="border border-stone-200/60 dark:border-stone-800 rounded-xl px-3 py-2 text-sm bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 font-serif focus:outline-none focus:ring-2 focus:ring-primary-500/15 focus:border-primary-400 transition w-full"
                    >
                      <option value="1">High (every 15 min)</option>
                      <option value="2">Normal (hourly)</option>
                      <option value="3">Low (every 6 hours)</option>
                    </select>
                  </div>
                  <div>
                    <label className="text-xs text-stone-500 dark:text-stone-400 mb-1 block">Language</label>
                    <select
                      value={addFeedLanguage}
                      onChange={(e) => setAddFeedLanguage(e.target.value)}
                      className="border border-stone-200/60 dark:border-stone-800 rounded-xl px-3 py-2 text-sm bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 font-serif focus:outline-none focus:ring-2 focus:ring-primary-500/15 focus:border-primary-400 transition w-full"
                    >
                      <option value="">Auto (not set)</option>
                      <option value="pt">🇵🇹 Portuguese</option>
                      <option value="en">🇬🇧 English</option>
                      <option value="es">🇪🇸 Spanish</option>
                      <option value="fr">🇫🇷 French</option>
                      <option value="nl">🇳🇱 Dutch</option>
                    </select>
                  </div>
                </div>
                <div className="flex gap-2 mt-3">
                  <Button type="submit" size="sm" variant="primary" disabled={addingFeed}>
                    {addingFeed ? "Adding..." : "Add feed"}
                  </Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => setShowAddFeed(false)}>
                    Cancel
                  </Button>
                </div>
              </form>
            )}

            {loading ? <ListSkeleton rows={6} /> : loadError ? <LoadError onRetry={fetchFeeds} /> : (
              <div className="space-y-2">
                {feeds.map((f: any) => (
                  <div key={f.id} className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/60 dark:border-stone-800 p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <Rss size={14} className="text-stone-400 shrink-0" />
                          {editingFeedId === f.id ? (
                            <input
                              value={editTitle}
                              onChange={(e) => setEditTitle(e.target.value)}
                              className="border border-stone-200/60 dark:border-stone-800 rounded-lg px-2 py-0.5 text-sm bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100 font-display focus:outline-none focus:ring-2 focus:ring-primary-500/15"
                            />
                          ) : (
                            <span className="font-display font-semibold text-stone-800 dark:text-stone-100 text-sm">
                              {f.title || f.site_url || f.feed_url}
                            </span>
                          )}
                          {f.verified && <Badge variant="green" className="text-[10px]">Verified</Badge>}
                          {f.is_active ? (
                            <Badge variant="green" className="text-[10px]">Active</Badge>
                          ) : (
                            <Badge variant="stone" className="text-[10px]">Paused</Badge>
                          )}
                          {editingFeedId === f.id ? (
                            <select
                              value={editPriority}
                              onChange={(e) => setEditPriority(e.target.value)}
                              className="border border-stone-200/60 dark:border-stone-800 rounded-lg px-1.5 py-0.5 text-xs bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100"
                            >
                              <option value="1">P1</option>
                              <option value="2">P2</option>
                              <option value="3">P3</option>
                            </select>
                          ) : (
                            <Badge variant="stone" className="text-[10px]">Priority {f.priority}</Badge>
                          )}
                          {editingFeedId === f.id ? (
                            <select
                              value={editLanguage}
                              onChange={(e) => setEditLanguage(e.target.value)}
                              className="border border-stone-200/60 dark:border-stone-800 rounded-lg px-1.5 py-0.5 text-xs bg-white dark:bg-stone-900 text-stone-800 dark:text-stone-100"
                            >
                              <option value="">Auto</option>
                              <option value="pt">PT</option>
                              <option value="en">EN</option>
                              <option value="es">ES</option>
                              <option value="fr">FR</option>
                              <option value="nl">NL</option>
                            </select>
                          ) : (
                            flagFor(f.language) && <span className="text-sm leading-none" title={f.language}>{flagFor(f.language)}</span>
                          )}
                          <Badge variant="sage" className="text-[10px]">{f.item_count} items</Badge>
                        </div>
                        <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400 flex-wrap">
                          <a
                            href={f.feed_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-0.5 text-primary-600 hover:underline line-clamp-1"
                          >
                            <ExternalLink size={10} />
                            {f.feed_url}
                          </a>
                        </div>
                        {f.last_error && (
                          <p className="text-xs text-red-500 mt-1 line-clamp-1">Error: {f.last_error}</p>
                        )}
                        {f.last_crawled_at && (
                          <p className="text-xs text-stone-400 mt-0.5">
                            Last crawled: {new Date(f.last_crawled_at).toLocaleString()}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        {editingFeedId === f.id ? (
                          <>
                            <Button size="xs" variant="primary" onClick={() => saveEditFeed(f.id)}>
                              Save
                            </Button>
                            <Button size="xs" variant="ghost" onClick={() => setEditingFeedId(null)}>
                              Cancel
                            </Button>
                          </>
                        ) : (
                          <>
                            <Button size="xs" variant="ghost" onClick={() => startEditFeed(f)}>
                              <Pencil size={12} />
                            </Button>
                            <Button
                              size="xs"
                              variant="ghost"
                              onClick={() => toggleFeedActive(f.id)}
                            >
                              <Power size={12} />
                              {f.is_active ? "Pause" : "Activate"}
                            </Button>
                            <Button
                              size="xs"
                              variant="ghost"
                              className="text-red-600 hover:text-red-700 dark:text-red-400"
                              onClick={() => blockFeed(f.id)}
                            >
                              <ShieldOff size={12} />
                              Block
                            </Button>
                            <Button
                              size="xs"
                              variant="danger"
                              onClick={() => deleteFeed(f.id)}
                            >
                              <Trash2 size={12} />
                            </Button>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
                {feeds.length === 0 && (
                  <EmptyState title="No RSS feeds registered" message="Click 'Add feed' to register the platform's first RSS source." />
                )}
              </div>
            )}
          </>
        )}

        {tab === "blocked" && (
          <>
            <div className="mb-4 text-sm text-stone-500 dark:text-stone-400">
              {blockedFeeds.length} blocked feed source{blockedFeeds.length !== 1 ? "s" : ""}.
              These feed URLs cannot be re-added until unblocked.
            </div>
            {loading ? <ListSkeleton rows={4} /> : loadError ? <LoadError onRetry={fetchBlockedFeeds} /> : (
              <div className="space-y-2">
                {blockedFeeds.map((b: any) => (
                  <div key={b.id} className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/60 dark:border-stone-800 p-4">
                    <div className="flex items-start gap-3">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1 flex-wrap">
                          <ShieldOff size={14} className="text-red-400 shrink-0" />
                          <a
                            href={b.feed_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-0.5 text-sm font-display font-semibold text-stone-800 dark:text-stone-100 hover:text-primary-600 line-clamp-1"
                          >
                            <ExternalLink size={10} />
                            {b.feed_url}
                          </a>
                        </div>
                        {b.reason && (
                          <p className="text-xs text-stone-500 dark:text-stone-400 font-serif italic mt-1">
                            {b.reason}
                          </p>
                        )}
                        {b.created_at && (
                          <p className="text-xs text-stone-400 mt-0.5">
                            Blocked on {new Date(b.created_at).toLocaleDateString()}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <Button
                          size="xs"
                          variant="ghost"
                          onClick={() => unblockFeed(b.id)}
                        >
                          Unblock
                        </Button>
                      </div>
                    </div>
                  </div>
                ))}
                {blockedFeeds.length === 0 && (
                  <EmptyState title="No blocked feeds" message="Rejected feed URLs will appear here so they can't be accidentally re-added." />
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}

function SummaryCard({ label, value, icon: Icon }: { label: string; value: number; icon?: typeof Globe }) {
  return (
    <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/60 dark:border-stone-800 p-4">
      <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-stone-400 mb-1">
        {Icon && <Icon size={12} />}
        {label}
      </div>
      <div className="text-2xl font-display font-semibold text-stone-800 dark:text-stone-100">{value}</div>
    </div>
  );
}
