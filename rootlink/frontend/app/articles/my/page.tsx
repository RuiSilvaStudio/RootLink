"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, FileText } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/lib/locale-context";
import { useToast } from "@/lib/toast-context";
import { Button, EmptyState } from "@/components/ui";
import { ArticleListRow } from "@/components/cards/ArticleListRow";

export default function MyArticlesPage() {
  const router = useRouter();
  const { user, token, loading: authLoading } = useAuth();
  const { t } = useLocale();
  const { addToast } = useToast();
  const [articles, setArticles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (authLoading) return;
    if (!token) { router.push("/auth/login"); return; }
    api.articles.my({ limit: 100 }).then(setArticles).catch((err: any) => {
      if (err?.status === 401) { router.push("/auth/login"); return; }
      addToast("error", err?.message || "Failed to load articles");
    }).finally(() => setLoading(false));
  }, [token, router, addToast, authLoading]);

  const handleDelete = async (id: number) => {
    if (!confirm("Delete this article?")) return;
    try {
      await api.articles.delete(id);
      setArticles((prev) => prev.filter((a) => a.id !== id));
      addToast("success", "Article deleted");
    } catch (err: any) {
      addToast("error", err.message);
    }
  };

  const handleAppeal = async (id: number) => {
    try {
      const updated = await api.articles.appeal(id);
      setArticles((prev) => prev.map((a) => (a.id === id ? { ...a, ...updated } : a)));
      addToast("success", "Appeal submitted — your article is back in review");
    } catch (err: any) {
      addToast("error", err.message);
    }
  };

  if (!user) return null;

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-12">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-display font-bold text-stone-900 dark:text-stone-100">My Articles</h1>
          <p className="text-sm text-stone-500 dark:text-stone-400 mt-1">Drafts and published articles</p>
        </div>
        <Link href="/articles/new">
          <Button variant="primary" size="sm">
            <Plus size={14} className="mr-1" />
            New Article
          </Button>
        </Link>
      </div>

      {loading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-20 rounded-xl bg-stone-100 dark:bg-stone-800 animate-pulse" />
          ))}
        </div>
      ) : articles.length === 0 ? (
        <EmptyState
          icon={<FileText size={48} />}
          title="No articles yet"
          message="Write your first article to share knowledge with the community."
          action={
            <Link href="/articles/new">
              <Button variant="primary">
                <Plus size={14} className="mr-1" />
                Write an Article
              </Button>
            </Link>
          }
        />
      ) : (
        <div className="space-y-3">
          {articles.map((article) => (
            <ArticleListRow
              key={article.id}
              article={article}
              onAppeal={handleAppeal}
              onDelete={handleDelete}
              onEdit={(id) => router.push(`/articles/edit/${id}`)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
