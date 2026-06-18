"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/locale-context";
import { Badge } from "@/components/ui/Badge";

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
      <div className="mb-6">
        <Badge variant="sage" className="mb-3">{t("admin.comments")}</Badge>
        <h1 className="text-3xl sm:text-4xl font-display font-semibold text-stone-800 leading-[1.08]">
          {t("admin.comment_moderation")}
        </h1>
      </div>

      <div className="bg-white rounded-2xl border border-stone-200/60 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-stone-100">
                <th className="text-left px-4 py-3 text-xs font-display font-semibold text-stone-400 uppercase tracking-wider">{t("admin.comment_body")}</th>
                <th className="text-left px-4 py-3 text-xs font-display font-semibold text-stone-400 uppercase tracking-wider hidden sm:table-cell">{t("admin.comment_meta")}</th>
                <th className="text-right px-4 py-3 text-xs font-display font-semibold text-stone-400 uppercase tracking-wider">{t("admin.actions")}</th>
              </tr>
            </thead>
            <tbody>
              {comments.map((c: any) => (
                <tr key={c.id} className="border-b border-stone-50 last:border-0 hover:bg-stone-50/50 transition">
                  <td className="px-4 py-3 max-w-xs">
                    <p className="text-stone-700 font-serif line-clamp-2">{c.body}</p>
                    <p className="text-xs text-stone-400 mt-1 sm:hidden font-serif">
                      User #{c.user_id} · Content #{c.content_id}
                      {c.parent_id && <> · Reply to #{c.parent_id}</>}
                    </p>
                  </td>
                  <td className="px-4 py-3 hidden sm:table-cell">
                    <div className="flex items-center gap-2 text-xs text-stone-400 font-serif">
                      <span>User #{c.user_id}</span>
                      <span>·</span>
                      <span>Content #{c.content_id}</span>
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
                    <button
                      onClick={() => handleDelete(c.id)}
                      className="text-xs bg-stone-100/60 text-stone-500 border border-stone-200/40 px-2.5 py-1 rounded-lg hover:bg-stone-100 font-display font-medium transition"
                    >
                      {t("admin.delete")}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {comments.length === 0 && (
          <p className="text-stone-400 text-sm py-8 text-center font-serif">{t("admin.no_comments")}</p>
        )}
      </div>
    </div>
  );
}
