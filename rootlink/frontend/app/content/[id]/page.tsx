"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { ArrowLeft, ExternalLink, Bookmark, Calendar, Globe, MessageSquare, Send, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { useLocale } from "@/lib/locale-context";

function findComment(comments: any[], id: number): any | null {
  for (const c of comments) {
    if (c.id === id) return c;
    if (c.replies) {
      const found = findComment(c.replies, id);
      if (found) return found;
    }
  }
  return null;
}

function CommentThread({ comment, onReply, onDelete, currentUserId, depth = 0 }: {
  comment: any;
  onReply: (parentId: number) => void;
  onDelete: (id: number) => void;
  currentUserId: number | null;
  depth: number;
}) {
  const { t } = useLocale();
  return (
    <div className={`${depth > 0 ? "ml-6 pl-4 border-l-2 border-stone-200" : ""}`}>
      <div className="py-3">
        <div className="flex items-center gap-2 text-sm text-stone-500 mb-1">
          <span className="font-medium text-stone-700">User #{comment.user_id}</span>
          <span>·</span>
          <span>{comment.created_at ? new Date(comment.created_at).toLocaleDateString() : ""}</span>
        </div>
        <p className="text-stone-700">{comment.body}</p>
        <div className="flex gap-3 mt-1">
          <button
            onClick={() => onReply(comment.id)}
            className="text-xs text-primary-600 hover:underline"
          >
            {t("content.reply")}
          </button>
          {currentUserId === comment.user_id && (
            <button
              onClick={() => onDelete(comment.id)}
              className="text-xs text-red-500 hover:underline"
            >
              {t("content.delete")}
            </button>
          )}
        </div>
      </div>
      {comment.replies?.map((reply: any) => (
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

export default function ContentDetailPage() {
  const params = useParams();
  const [content, setContent] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [bookmarked, setBookmarked] = useState(false);
  const [comments, setComments] = useState<any[]>([]);
  const [commentBody, setCommentBody] = useState("");
  const [replyTo, setReplyTo] = useState<number | null>(null);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [submitting, setSubmitting] = useState(false);
  const { t } = useLocale();

  useEffect(() => {
    const id = Number(params.id);
    const token = localStorage.getItem("token");
    Promise.all([
      api.content.get(id),
      api.comments.list(id),
      token ? api.auth.me().catch(() => null) : Promise.resolve(null),
    ]).then(([c, cmts, user]) => {
      setContent(c);
      setComments(cmts);
      setCurrentUser(user);
    }).catch(() => {}).finally(() => setLoading(false));
  }, [params.id]);

  const handleBookmark = async () => {
    try {
      await api.content.bookmarks.create({ content_id: content.id });
      setBookmarked(true);
    } catch {}
  };

  const handleComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!commentBody.trim()) return;
    setSubmitting(true);
    try {
      const c = await api.comments.create({
        content_id: Number(params.id),
        parent_id: replyTo ?? undefined,
        body: commentBody,
      });
      if (replyTo) {
        setComments((prev) => {
          const addReply = (cmts: any[]): any[] =>
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
    } catch {}
    setSubmitting(false);
  };

  const handleDelete = async (commentId: number) => {
    try {
      await api.comments.delete(commentId);
      setComments(comments.filter((c) => c.id !== commentId));
    } catch {}
  };

  if (loading) {
    return <div className="max-w-3xl mx-auto px-4 py-8 text-stone-500">{t("content.loading")}</div>;
  }

  if (!content) {
    return <div className="max-w-3xl mx-auto px-4 py-8 text-stone-500">{t("content.not_found")}</div>;
  }

  const replyToComment = replyTo ? findComment(comments, replyTo) : null;

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <a href="/search" className="text-sm text-primary-600 hover:underline flex items-center gap-1 mb-6">
        <ArrowLeft className="w-4 h-4" /> {t("content.back_to_search")}
      </a>

      <article>
        <div className="flex gap-2 mb-4 flex-wrap">
          {content.verification_status === "community_reviewed" && (
            <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded font-medium">
              {t("content.community_reviewed")}
            </span>
          )}
          {content.verification_status === "cross_referenced" && (
            <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-medium">
              {t("content.cross_referenced")}
            </span>
          )}
          <span className="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded">
            {content.category}
          </span>
          <span className="text-xs bg-stone-100 text-stone-600 px-2 py-0.5 rounded">
            {content.content_type}
          </span>
        </div>

        <h1 className="text-3xl font-bold text-stone-800 font-serif mb-4">
          {content.title}
        </h1>

        <div className="flex items-center gap-4 text-sm text-stone-500 mb-6">
          {content.published_at && (
            <span className="flex items-center gap-1">
              <Calendar className="w-4 h-4" />
              {new Date(content.published_at).toLocaleDateString()}
            </span>
          )}
          {content.source_url && (
            <span className="flex items-center gap-1">
              <Globe className="w-4 h-4" />
              {new URL(content.source_url).hostname}
            </span>
          )}
        </div>

        {content.summary && (
          <p className="text-lg text-stone-700 leading-relaxed mb-6">
            {content.summary}
          </p>
        )}

        {content.full_text && (
          <div className="prose prose-stone max-w-none">
            {content.full_text.split("\n").map((p: string, i: number) => (
              <p key={i} className="mb-4 text-stone-700 leading-relaxed">
                {p}
              </p>
            ))}
          </div>
        )}

        <div className="flex gap-3 mt-8 pt-6 border-t border-stone-200">
          {content.url && (
            <a href={content.url} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-2 bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition text-sm">
              <ExternalLink className="w-4 h-4" /> {t("content.view_original")}
            </a>
          )}
          <button onClick={handleBookmark} disabled={bookmarked}
            className="flex items-center gap-2 border border-stone-300 text-stone-600 px-4 py-2 rounded-lg hover:bg-stone-50 transition text-sm disabled:opacity-50">
            <Bookmark className="w-4 h-4" />
            {bookmarked ? t("content.saved") : t("content.bookmark")}
          </button>
        </div>
      </article>

      <section className="mt-12 pt-8 border-t border-stone-200">
        <h2 className="text-xl font-bold text-stone-800 font-serif mb-6 flex items-center gap-2">
          <MessageSquare className="w-5 h-5" /> {t("content.discussion")}
        </h2>

        {currentUser ? (
          <form onSubmit={handleComment} className="mb-8">
            {replyTo && replyToComment && (
              <div className="text-sm text-primary-600 mb-2 flex items-center gap-2">
                {t("content.replying_to", { name: `User #${replyToComment.user_id}` })}
                <button type="button" onClick={() => setReplyTo(null)}
                  className="text-stone-400 hover:text-stone-600 text-xs underline">
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
                className="flex-1 px-4 py-2 rounded-lg border border-stone-300 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              <button type="submit" disabled={submitting || !commentBody.trim()}
                className="bg-primary-600 text-white px-4 py-2 rounded-lg hover:bg-primary-700 transition disabled:opacity-50">
                <Send className="w-4 h-4" />
              </button>
            </div>
          </form>
        ) : (
          <p className="text-sm text-stone-500 mb-8">
            <a href="/auth/login" className="text-primary-600 hover:underline">{t("content.sign_in_to_join")}</a>
          </p>
        )}

        {comments.length === 0 ? (
          <p className="text-stone-400 text-center py-8">{t("content.no_comments")}</p>
        ) : (
          <div>
            {comments.map((comment) => (
              <CommentThread
                key={comment.id}
                comment={comment}
                onReply={(id) => setReplyTo(id)}
                onDelete={handleDelete}
                currentUserId={currentUser?.id}
                depth={0}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
