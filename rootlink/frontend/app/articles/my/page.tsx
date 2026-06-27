"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, FileText, Send, Trash2, Clock } from "lucide-react";
import { api } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { useLocale } from "@/lib/locale-context";
import { useToast } from "@/lib/toast-context";
import { Button, Badge, EmptyState } from "@/components/ui";

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
            <div
              key={article.id}
              className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700"
            >
              <div className="flex items-center gap-4 flex-1 min-w-0">
                <div className="w-12 h-12 rounded-xl shrink-0 overflow-hidden bg-stone-100 dark:bg-stone-800">
                  <img
                    src={article.image_url || "/images/placeholder-card.svg"}
                    alt={article.title}
                    className="w-full h-full object-cover"
                  />
                </div>
                <div className="min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant={article.status === "published" ? "green" : "stone"}>
                      {article.status === "published" ? (
                        <span className="flex items-center gap-1"><Send size={10} /> Published</span>
                      ) : (
                        <span className="flex items-center gap-1"><Clock size={10} /> Draft</span>
                      )}
                    </Badge>
                    {article.verification_status === "community_reviewed" && (
                      <Badge variant="sage">Reviewed</Badge>
                    )}
                  </div>
                  <h3 className="text-base font-medium text-stone-900 dark:text-stone-100 truncate">
                    {article.title}
                  </h3>
                  <p className="text-xs text-stone-400 dark:text-stone-500 mt-0.5">
                    {article.updated_at ? new Date(article.updated_at).toLocaleDateString() : ""}
                    {article.rating_up > 0 && ` · ${article.rating_up} likes`}
                    {article.view_count > 0 && ` · ${article.view_count} views`}
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2 ml-4">
                {article.status === "draft" && (
                  <Button
                    variant="secondary"
                    size="sm"
                    onClick={() => router.push(`/articles/edit/${article.id}`)}
                  >
                    Edit
                  </Button>
                )}
                {article.slug && (
                  <Link href={`/articles/${article.slug}`}>
                    <Button variant="ghost" size="sm">View</Button>
                  </Link>
                )}
                <button
                  onClick={() => handleDelete(article.id)}
                  className="p-1.5 text-stone-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
