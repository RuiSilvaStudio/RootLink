"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/locale-context";
import { Badge } from "@/components/ui/Badge";
import { Button, EmptyState } from "@/components/ui";
import { ListSkeleton } from "@/components/ui/LoadingSkeleton";
import { LoadError } from "@/components/studio/LoadError";

export default function AdminComments() {
  const { t } = useLocale();
  const [comments, setComments] = useState<any[]>([]);
  const [entityFilter, setEntityFilter] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState(false);

  const fetchComments = async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const data = await api.admin.listComments(entityFilter ? { entity_type: entityFilter } : undefined);
      setComments(data);
    } catch {
      setLoadError(true);
    } finally {
      setLoading(false);
    }
  };

  // Auto-refetch when the entity filter changes.
  useEffect(() => { fetchComments(); }, [entityFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleDelete = async (id: number) => {
    if (!confirm(t("admin.delete_comment_confirm"))) return;
    await api.admin.deleteComment(id);
    fetchComments();
  };

  const entityLabels: Record<string, string> = {
    content: "Article",
    event: "Event",
    group: "Group",
    plant: "Plant",
    course: "Course",
    lesson: "Lesson",
  };

  if (loading) return <div className="p-6"><ListSkeleton rows={6} /></div>;
  if (loadError) return <div className="p-6 max-w-xl"><LoadError onRetry={fetchComments} /></div>;

  return (
    <div className="flex flex-col h-full">
      <div className="shrink-0 px-6 py-4 border-b border-primary-200/40 dark:border-stone-800">
        <h1 className="font-display text-xl font-semibold text-stone-800 dark:text-stone-100">Comments</h1>
        <p className="text-xs text-stone-500 dark:text-stone-400 mt-0.5">Moderate user comments across the platform</p>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        <div className="mb-4 flex gap-2 flex-wrap">
          <button
            onClick={() => setEntityFilter("")}
            className={`px-3 py-1.5 rounded-lg text-xs font-display font-medium transition ${
              !entityFilter ? "bg-primary-600 text-cream" : "bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700"
            }`}
          >
            All
          </button>
          {Object.entries(entityLabels).map(([key, label]) => (
            <button
              key={key}
              onClick={() => setEntityFilter(key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-display font-medium transition ${
                entityFilter === key ? "bg-primary-600 text-cream" : "bg-stone-100 dark:bg-stone-800 text-stone-500 dark:text-stone-300 hover:bg-stone-200 dark:hover:bg-stone-700"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="bg-white dark:bg-stone-900 rounded-2xl border border-stone-200/60 dark:border-stone-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-stone-100 dark:border-stone-800">
                  <th className="text-left px-4 py-3 text-xs font-display font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider">{t("admin.comment_body")}</th>
                  <th className="text-left px-4 py-3 text-xs font-display font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider hidden sm:table-cell">{t("admin.comment_meta")}</th>
                  <th className="text-right px-4 py-3 text-xs font-display font-semibold text-stone-400 dark:text-stone-500 uppercase tracking-wider">{t("admin.actions")}</th>
                </tr>
              </thead>
              <tbody>
                {comments.map((c: any) => (
                  <tr key={c.id} className="border-b border-stone-50 dark:border-stone-800/50 last:border-0 hover:bg-stone-50/50 dark:hover:bg-stone-800/30 transition">
                    <td className="px-4 py-3 max-w-xs">
                      <p className="text-stone-700 dark:text-stone-200 font-serif line-clamp-2">{c.body}</p>
                      <p className="text-xs text-stone-400 dark:text-stone-500 mt-1 sm:hidden font-serif">
                        {c.user_name || `User #${c.user_id}`} · {entityLabels[c.entity_type] || c.entity_type} #{c.entity_id}
                        {c.parent_id && <> · Reply to #{c.parent_id}</>}
                      </p>
                    </td>
                    <td className="px-4 py-3 hidden sm:table-cell">
                      <div className="flex items-center gap-2 text-xs text-stone-400 dark:text-stone-500 font-serif">
                        <span>{c.user_name || `User #${c.user_id}`}</span>
                        <span>·</span>
                        <span className="text-primary-600 dark:text-primary-400 font-medium">{entityLabels[c.entity_type] || c.entity_type}</span>
                        <span>#{c.entity_id}</span>
                        {c.parent_id && (
                          <>
                            <span>·</span>
                            <span>Reply to #{c.parent_id}</span>
                          </>
                        )}
                        {c.created_at && (
                          <>
                            <span>·</span>
                            <span>{new Date(c.created_at).toLocaleDateString()}</span>
                          </>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Button size="xs" variant="danger" onClick={() => handleDelete(c.id)}>
                        {t("admin.delete")}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {comments.length === 0 && (
            <EmptyState title="No results" message={t("admin.no_comments")} />
          )}
        </div>
      </div>
    </div>
  );
}
