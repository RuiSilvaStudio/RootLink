"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/locale-context";

export default function AdminComments() {
  const { t } = useLocale();
  const [comments, setComments] = useState<any[]>([]);

  const fetchComments = async () => {
    const data = await api.admin.listComments();
    setComments(data);
  };

  useEffect(() => { fetchComments(); }, []);

  const handleDelete = async (id: number) => {
    if (!confirm(t("admin.delete_comment_confirm"))) return;
    await api.admin.deleteComment(id);
    fetchComments();
  };

  return (
    <div>
      <h1 className="text-2xl font-bold text-stone-800 mb-6">{t("admin.comment_moderation")}</h1>

      <div className="space-y-2">
        {comments.map((c: any) => (
          <div key={c.id} className="bg-stone-50 rounded-lg p-4 border border-stone-200">
            <div className="flex items-start justify-between gap-3">
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 text-xs text-stone-400 mb-1">
                  <span>User #{c.user_id}</span>
                  <span>·</span>
                  <span>Content #{c.content_id}</span>
                  {c.parent_id && (
                    <>
                      <span>·</span>
                      <span>Reply to #{c.parent_id}</span>
                    </>
                  )}
                  <span>·</span>
                  <span>{c.created_at ? new Date(c.created_at).toLocaleDateString() : ""}</span>
                </div>
                <p className="text-sm text-stone-700">{c.body}</p>
              </div>
              <button
                onClick={() => handleDelete(c.id)}
                className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded hover:bg-red-200 shrink-0"
              >
                {t("admin.delete")}
              </button>
            </div>
          </div>
        ))}
        {comments.length === 0 && (
          <p className="text-stone-400 text-sm py-8 text-center">{t("admin.no_comments")}</p>
        )}
      </div>
    </div>
  );
}
