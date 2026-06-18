"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { ExternalLink, Bookmark, Calendar, Globe, MessageSquare, Send, Trash2, Leaf, Clock, User } from "lucide-react";
import { api } from "@/lib/api";
import { Breadcrumbs } from "@/components/Breadcrumbs";
import { useLocale } from "@/lib/locale-context";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";

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
    <div className={`${depth > 0 ? "ml-6 pl-4 border-l-2 border-primary-100" : ""}`}>
      <div className="py-4">
        <div className="flex items-center gap-2.5 mb-1.5">
          <Avatar fallback={`User #${comment.user_id}`} size="sm" />
          <div>
            <span className="text-sm font-medium text-stone-700">User #{comment.user_id}</span>
            <span className="text-xs text-stone-400 ml-2">
              {comment.created_at ? new Date(comment.created_at).toLocaleDateString() : ""}
            </span>
          </div>
        </div>
        <p className="text-stone-700 text-sm ml-12">{comment.body}</p>
        <div className="flex gap-3 ml-12 mt-1.5">
          <button
            onClick={() => onReply(comment.id)}
            className="text-xs text-primary-600 hover:text-primary-700 font-medium transition"
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
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-12 space-y-6">
        <div className="h-6 w-48 bg-primary-100 rounded-lg animate-pulse" />
        <div className="space-y-3">
          <div className="h-10 w-3/4 bg-primary-100 rounded-lg animate-pulse" />
          <div className="h-4 w-full bg-primary-100 rounded animate-pulse" />
          <div className="h-4 w-5/6 bg-primary-100 rounded animate-pulse" />
        </div>
      </div>
    );
  }

  if (!content) {
    return (
      <div className="max-w-3xl mx-auto px-4 sm:px-8 py-20 text-center">
        <Leaf className="w-12 h-12 text-stone-300 mx-auto mb-4" />
        <p className="text-stone-500">{t("content.not_found")}</p>
      </div>
    );
  }

  const replyToComment = replyTo ? findComment(comments, replyTo) : null;

  return (
    <div className="max-w-3xl mx-auto px-4 sm:px-8 py-12">
      <Breadcrumbs items={[
        { label: t("nav.search"), href: "/search" },
        { label: content.title }
      ]} />

      <article className="mt-6">
        <div className="flex gap-2 mb-5 flex-wrap">
          {content.verification_status === "community_reviewed" && (
            <Badge variant="green" dot>{t("content.community_reviewed")}</Badge>
          )}
          {content.verification_status === "cross_referenced" && (
            <Badge variant="blue" dot>{t("content.cross_referenced")}</Badge>
          )}
          <Badge variant="sage">{content.category}</Badge>
          <Badge variant="stone">{content.content_type}</Badge>
        </div>

        <h1 className="text-3xl sm:text-4xl font-serif font-bold text-stone-800 leading-tight mb-5">
          {content.title}
        </h1>

        <div className="flex items-center gap-4 text-sm text-stone-500 mb-8 flex-wrap">
          {content.published_at && (
            <span className="flex items-center gap-1.5">
              <Calendar className="w-4 h-4 text-stone-400" />
              {new Date(content.published_at).toLocaleDateString()}
            </span>
          )}
          {content.source_url && (
            <span className="flex items-center gap-1.5">
              <Globe className="w-4 h-4 text-stone-400" />
              {new URL(content.source_url).hostname}
            </span>
          )}
        </div>

        {content.summary && (
          <div className="bg-primary-50 rounded-2xl p-6 mb-8 border border-primary-100">
            <p className="text-stone-700 leading-relaxed font-light">{content.summary}</p>
          </div>
        )}

        {content.full_text && (
          <div className="text-stone-700 leading-relaxed space-y-5 font-light">
            {content.full_text.split("\n").filter(Boolean).map((p: string, i: number) => (
              <p key={i}>{p}</p>
            ))}
          </div>
        )}

        <div className="flex gap-3 mt-10 pt-6 border-t border-primary-100">
          {content.url && (
            <a href={content.url} target="_blank" rel="noopener noreferrer">
              <Button variant="primary" className="flex items-center gap-2">
                <ExternalLink className="w-4 h-4" /> {t("content.view_original")}
              </Button>
            </a>
          )}
          <Button
            variant="secondary"
            onClick={handleBookmark}
            disabled={bookmarked}
          >
            <Bookmark className={`w-4 h-4 ${bookmarked ? "fill-primary-500 text-primary-500" : ""}`} />
            {bookmarked ? t("content.saved") : t("content.bookmark")}
          </Button>
        </div>
      </article>

      {/* Discussion */}
      <section className="mt-14 pt-8 border-t border-primary-100">
        <h2 className="text-xl font-serif font-bold text-stone-800 mb-6 flex items-center gap-2">
          <MessageSquare className="w-5 h-5 text-primary-500" />
          {t("content.discussion")}
          {comments.length > 0 && (
            <span className="text-sm font-normal text-stone-400 font-sans">({comments.length})</span>
          )}
        </h2>

        {currentUser ? (
          <form onSubmit={handleComment} className="mb-8">
            {replyTo && replyToComment && (
              <div className="text-sm text-primary-600 mb-3 flex items-center gap-2 bg-primary-50 rounded-xl px-4 py-2">
                <User className="w-3.5 h-3.5" />
                {t("content.replying_to", { name: `User #${replyToComment.user_id}` })}
                <button type="button" onClick={() => setReplyTo(null)}
                  className="text-stone-400 hover:text-stone-600 text-xs underline ml-auto">
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
                className="flex-1 px-4 py-2.5 rounded-xl border border-primary-100 bg-white text-sm focus:border-primary-500 focus:ring-2 focus:ring-primary-500/15 transition-all"
              />
              <Button type="submit" disabled={submitting || !commentBody.trim()} loading={submitting}>
                <Send className="w-4 h-4" />
              </Button>
            </div>
          </form>
        ) : (
          <div className="bg-primary-50 rounded-2xl p-6 text-center mb-8 border border-primary-100">
            <p className="text-sm text-stone-500">
              <a href="/auth/login" className="text-primary-600 hover:text-primary-700 font-medium">{t("content.sign_in_to_join")}</a>
            </p>
          </div>
        )}

        {comments.length === 0 ? (
          <div className="text-center py-10 text-stone-400">
            <MessageSquare className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p className="text-sm font-light">{t("content.no_comments")}</p>
          </div>
        ) : (
          <div className="divide-y divide-primary-50">
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
