"use client";

import { useState, useEffect } from "react";
import { api } from "@/lib/api";
import { Globe, Search } from "lucide-react";
import { useLocale } from "@/lib/locale-context";

export default function SubmitPage() {
  const { t } = useLocale();
  const [token, setToken] = useState<string | null>(null);
  const [url, setUrl] = useState("");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("gardening");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [results, setResults] = useState<any[]>([]);
  const [error, setError] = useState("");
  const [tab, setTab] = useState<"url" | "search">("url");

  const CATEGORIES = [
    { value: "gardening", label: t("submit.category_gardening") },
    { value: "woodworking", label: t("submit.category_woodworking") },
    { value: "craft_trades", label: t("submit.category_craft_trades") },
    { value: "homesteading", label: t("submit.category_homesteading") },
  ];

  useEffect(() => {
    setToken(localStorage.getItem("token"));
  }, []);

  if (!token) {
    return (
      <div className="max-w-2xl mx-auto px-4 py-20 text-center">
        <p className="text-stone-500 mb-4">{t("submit.not_signed_in")}</p>
        <a href="/auth/login" className="text-primary-600 hover:underline">{t("submit.sign_in")}</a>
        <span className="text-stone-300 mx-2">{t("submit.or")}</span>
        <a href="/auth/register" className="text-primary-600 hover:underline">{t("submit.create_account")}</a>
      </div>
    );
  }

  const handleSubmitUrl = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setResult(null);
    setLoading(true);
    try {
      const res = await api.crawl.submitUrl({ url, category });
      setResult(res);
    } catch (err: any) {
      setError(err?.detail || err?.message || "Failed to submit URL. Check the link and try again.");
    } finally {
      setLoading(false);
    }
  };

  const handleSearchAndCrawl = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!query.trim()) return;
    setError("");
    setResults([]);
    setLoading(true);
    try {
      const res = await api.crawl.searchAndCrawl({ query: query.trim(), category });
      setResults(res);
    } catch (err: any) {
      setError(err?.detail || err?.message || "Search failed. Try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-12">
      <h1 className="text-3xl font-bold text-stone-800 font-serif mb-2">{t("submit.title")}</h1>
      <p className="text-stone-600 mb-8">
        {t("submit.subtitle")}
      </p>

      <div className="flex gap-1 bg-stone-100 rounded-lg p-1 mb-6 w-fit">
        <button
          onClick={() => setTab("url")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition ${
            tab === "url" ? "bg-white shadow text-primary-700" : "text-stone-500 hover:text-stone-700"
          }`}
        >
          <Globe className="w-4 h-4 inline mr-1.5" />
          {t("submit.submit_url_tab")}
        </button>
        <button
          onClick={() => setTab("search")}
          className={`px-4 py-2 rounded-md text-sm font-medium transition ${
            tab === "search" ? "bg-white shadow text-primary-700" : "text-stone-500 hover:text-stone-700"
          }`}
        >
          <Search className="w-4 h-4 inline mr-1.5" />
          {t("submit.search_crawl_tab")}
        </button>
      </div>

      {tab === "url" && (
        <form onSubmit={handleSubmitUrl} className="bg-white border border-stone-200 rounded-xl p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">{t("submit.url_label")}</label>
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder={t("submit.url_placeholder")}
              required
              className="w-full border border-stone-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">{t("submit.category_label")}</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border border-stone-300 rounded-lg px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary-600 text-white py-2.5 rounded-lg font-medium hover:bg-primary-700 transition disabled:opacity-50"
          >
            {loading ? t("submit.fetching") : t("submit.submit_link")}
          </button>
        </form>
      )}

      {tab === "search" && (
        <form onSubmit={handleSearchAndCrawl} className="bg-white border border-stone-200 rounded-xl p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">{t("submit.search_query_label")}</label>
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder={t("submit.search_placeholder")}
              required
              className="w-full border border-stone-300 rounded-lg px-4 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
            <p className="text-xs text-stone-400 mt-1">{t("submit.search_hint")}</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-stone-700 mb-1">{t("submit.category_label")}</label>
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full border border-stone-300 rounded-lg px-4 py-2.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-primary-500"
            >
              {CATEGORIES.map((c) => (
                <option key={c.value} value={c.value}>{c.label}</option>
              ))}
            </select>
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-primary-600 text-white py-2.5 rounded-lg font-medium hover:bg-primary-700 transition disabled:opacity-50"
          >
            {loading ? t("submit.searching_crawling") : t("submit.search_crawl")}
          </button>
        </form>
      )}

      {error && (
        <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {error}
        </div>
      )}

      {tab === "url" && result && (
        <div className="mt-6 bg-green-50 border border-green-200 rounded-xl p-5">
          <div className="flex items-center gap-2 mb-3">
            <Globe className="w-5 h-5 text-green-600" />
            <h2 className="font-semibold text-green-800">{t("submit.success_title")}</h2>
          </div>
          <p className="text-sm text-green-700 mb-1"><strong>Title:</strong> {result.title}</p>
          {result.summary && <p className="text-sm text-green-600 mb-3">{result.summary.slice(0, 200)}...</p>}
          <p className="text-xs text-green-500">{t("submit.success_text")}</p>
          <div className="flex gap-3 mt-4">
            <a href="/search" className="text-sm text-primary-600 hover:underline">{t("submit.back_to_search")}</a>
            <button onClick={() => { setUrl(""); setResult(null); }} className="text-sm text-stone-500 hover:underline">
              {t("submit.submit_another")}
            </button>
          </div>
        </div>
      )}

      {tab === "search" && results.length > 0 && (
        <div className="mt-6 space-y-3">
          <h2 className="font-semibold text-stone-700">{t("submit.indexed_results", { count: results.length })}</h2>
          {results.map((r: any, i: number) => (
            <div key={r.id} className="bg-green-50 border border-green-200 rounded-xl p-4">
              <div className="flex items-start gap-3">
                <span className="text-green-600 font-mono text-sm mt-0.5">#{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <h3 className="font-medium text-green-800">{r.title}</h3>
                  {r.summary && <p className="text-sm text-green-600 mt-0.5 line-clamp-2">{r.summary}</p>}
                  <div className="flex gap-2 mt-2 text-xs text-green-500">
                    <span>{r.category}</span>
                    <span>·</span>
                    <span className="truncate">{r.url}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
          <button onClick={() => { setQuery(""); setResults([]); }} className="text-sm text-primary-600 hover:underline">
            {t("submit.new_search")}
          </button>
        </div>
      )}
    </div>
  );
}
