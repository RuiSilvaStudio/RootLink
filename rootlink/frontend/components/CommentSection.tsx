"use client";

import { useState, useEffect, useCallback } from "react";
import { MessageSquare, Send, Trash2, User } from "lucide-react";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/locale-context";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";

type Comment = {
  id: number;
  entity_type: string;
  entity_id: number;
  user_id: number;
  user_name: string | null;
  parent_id: number | null;
  body: string;
  created_at: string | null;
  replies: Comment[];
};

function findComment(comments: Comment[], id: number): Comment | null {
  for (const c of comments) {
    if (c.id === id) return c;
    if (c.replies) {
      const found = findComment(c.replies, id);
      if (found) return found;
    }
  }
  return null;
}

function CommentThread({
  comment,
  onReply,
  onDelete,
  currentUserId,
  depth = 0,
}: {
  comment: Comment;
  onReply: (parentId: number) => void;
  onDelete: (id: number) => void;
  currentUserId: number | null;
  depth?: number;
}) {
  const { t } = useLocale();
  const displayName = comment.user_name || `User #${comment.user_id}`;
  return (
    <div className={`${depth > 0 ? "ml-6 pl-4 border-l-2 border-primary-100 dark:border-primary-800/40" : ""}`}>
      <div className="py-4">
        <div className="flex items-center gap-2.5 mb-1.5">
          <Avatar fallback={displayName} size="sm" />
          <div>
            <span className="text-sm font-medium text-stone-700 dark:text-stone-300">{displayName}</span>
            <span className="text-xs text-stone-400 ml-2">
              {comment.created_at ? new Date(comment.created_at).toLocaleDateString() : ""}
            </span>
          </div>
        </div>
        <p className="text-stone-700 dark:text-stone-300 text-sm ml-12">{comment.body}</p>
        <div className="flex gap-3 ml-12 mt-1.5">
          <button
            onClick={() => onReply(comment.id)}
            className="text-xs text-primary-600 dark:text-primary-400 hover:text-primary-700 font-medium transition"
          >
            {t("content.reply")}
          </button>
          {currentUserId === comment.user_id && (
            <button
              onClick={() => onDelete(comment.id)}
              className="text-xs text-red-500 hover:text-red-600 font-medium transition"
            >
              <Trash2 className="w-3 h-3 inline mr-0.5" />
              {t("content.delete")}
            </button>
          )}
        </div>
      </div>
      {comment.replies?.map((reply) => (
        <CommentThread
          key={reply.id}
          comment={reply}
          onReply={onReply}
          onDelete={onDelete}
          currentUserId={currentUserId}
          depth={depth + 1}
        />
      ))}
    </div>
  );
}

type Props = {
  entityType: string;
  entityId: number;
  className?: string;
};

export function CommentSection({ entityType, entityId, className = "" }: Props) {
  const { t } = useLocale();
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadComments = useCallback(async () => {
    try {
      const data = await api.comments.list(entityType, entityId);
      setComments(data);
    } catch {
      setComments([]);
    } finally {
      setLoading(false);
    }
  }, [entityType, entityId]);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      api.auth.me().then(setCurrentUser).catch(() => {});
    }
    loadComments();
  }, [loadComments]);

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentBody.trim()) return;
    setSubmitting(true);
    try {
      const c = await api.comments.create({
        entity_type: entityType,
        entity_id: entityId,
        parent_id: replyTo ?? undefined,
        body: commentBody,
      });
      if (replyTo) {
        setComments((prev) => {
          const addReply = (cmts: Comment[]): Comment[] =>
            cmts.map((cm) =>
              cm.id === replyTo
                ? { ...cm, replies: [...(cm.replies || []), c] }
                : { ...cm, replies: addReply(cm.replies || []) }
            );
          return addReply(prev);
        });
      } else {
        setComments([...comments, c]);
      }
      setCommentBody("");
      setReplyTo(null);
    } catch {
      // error handled by toast in caller context
    }
    setSubmitting(false);
  };

  const handleDelete = async (commentId: number) => {
    try {
      await api.comments.delete(commentId);
      setComments(comments.filter((c) => c.id !== commentId));
    } catch {
      // error handled silently
    }
  };

  const replyToComment = replyTo ? findComment(comments, replyTo) : null;

  return (
    <section className={`mt-8 pt-8 border-t border-primary-100 dark:border-primary-800/30 ${className}`}>
      <h2 className="text-xl font-display font-semibold text-stone-800 dark:text-stone-200 mb-6 flex items-center gap-2">
        <MessageSquare className="w-5 h-5 text-primary-500" />
        {t("content.discussion")}
        {comments.length > 0 && (
          <span className="text-sm font-normal text-stone-400">({comments.length})</span>
        )}
      </h2>

      {currentUser ? (
        <form onSubmit={handleComment} className="mb-8">
          {replyTo && replyToComment && (
            <div className="text-sm text-primary-600 dark:text-primary-400 mb-3 flex items-center gap-2 bg-primary-50 dark:bg-primary-900/20 rounded-xl px-4 py-2">
              <User className="w-3.5 h-3.5" />
              {t("content.replying_to", { name: replyToComment.user_name || `User #${replyToComment.user_id}` })}
              <button
                type="button"
                onClick={() => setReplyTo(null)}
                className="text-stone-400 hover:text-stone-600 text-xs underline ml-auto"
              >
                {t("content.cancel")}
              </button>
            </div>
          )}
          <div className="flex gap-2">
            <input
              type="text"
              value={commentBody}
              onChange={(e) => setCommentBody(e.target.value)}
              placeholder={replyTo ? t("content.write_reply") : t("content.share_thoughts")}
              className="flex-1 px-4 py-2.5 rounded-xl border border-primary-100 dark:border-stone-700 bg-white dark:bg-stone-900 text-sm text-stone-800 dark:text-stone-200 focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15 transition-all font-serif"
              aria-label={replyTo ? t("content.write_reply") : t("content.share_thoughts")}
            />
            <Button type="submit" disabled={submitting || !commentBody.trim()} loading={submitting}>
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </form>
      ) : (
        <div className="bg-primary-50 dark:bg-primary-900/20 rounded-2xl p-6 text-center mb-8 border border-primary-100 dark:border-primary-800/30">
          <p className="text-sm text-stone-500 dark:text-stone-400">
            <a href="/auth/login" className="text-primary-600 dark:text-primary-400 hover:text-primary-700 font-medium">
              {t("content.sign_in_to_join")}
            </a>
          </p>
        </div>
      )}

      {loading ? (
        <div className="space-y-4 animate-pulse">
          {[1, 2].map((i) => (
            <div key={i} className="flex gap-3">
              <div className="w-8 h-8 rounded-full bg-primary-100/60" />
              <div className="flex-1 space-y-2">
                <div className="h-3 w-24 bg-primary-100/60 rounded" />
                <div className="h-4 w-full bg-primary-100/60 rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : comments.length === 0 ? (
        <div className="text-center py-10 text-stone-400">
          <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm font-serif">{t("content.no_comments")}</p>
        </div>
      ) : (
        <div className="divide-y divide-primary-50 dark:divide-primary-800/20">
          {comments.map((comment) => (
            <CommentThread
              key={comment.id}
              comment={comment}
              onReply={(id) => setReplyTo(id)}
              onDelete={handleDelete}
              currentUserId={currentUser?.id ?? null}
              depth={0}
            />
          ))}
        </div>
      )}
    </section>
  );
}
