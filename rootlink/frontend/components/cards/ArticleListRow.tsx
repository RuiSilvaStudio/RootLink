"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import { Trash2, RotateCcw, Clock, XCircle, AlertTriangle, Send, FileText } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { safeImageUrl } from "@/lib/image-url";

type ArticleListRowProps = {
  article: any;
  onAppeal: (id: number) => void;
  onDelete: (id: number) => void;
  onEdit: (id: number) => void;
};

const statusMeta = (
  status: string,
): { variant: "green" | "stone" | "amber" | "red"; label: string; icon: ReactNode } => {
  switch (status) {
    case "published":
      return { variant: "green", label: "Published", icon: <Send size={10} /> };
    case "in_review":
      return { variant: "amber", label: "In review", icon: <Clock size={10} /> };
    case "needs_changes":
      return { variant: "amber", label: "Needs changes", icon: <AlertTriangle size={10} /> };
    case "rejected":
      return { variant: "red", label: "Rejected", icon: <XCircle size={10} /> };
    case "archived":
      return { variant: "stone", label: "Archived", icon: <Clock size={10} /> };
    default:
      return { variant: "stone", label: "Draft", icon: <Clock size={10} /> };
  }
};

const nextStepText = (status: string): string => {
  switch (status) {
    case "in_review":
      return "A moderator usually reviews within 24h.";
    case "published":
      return "Live and visible to the community.";
    case "needs_changes":
      return "Edit and resubmit to publish.";
    case "rejected":
      return "You can appeal this decision.";
    default:
      return "";
  }
};

// Owners can edit their own content in any active state (published edits trigger
// trust-based re-review on the backend). Archived items are read-only.
const isEditable = (status: string) => status !== "archived";

export function ArticleListRow({ article, onAppeal, onDelete, onEdit }: ArticleListRowProps) {
  return (
    <div
      data-rl-component="ArticleListRow"
      className="flex items-center justify-between p-4 rounded-xl bg-white dark:bg-stone-900 border border-stone-200 dark:border-stone-700"
    >
      <div className="flex items-center gap-4 flex-1 min-w-0">
        <div className="w-12 h-12 rounded-xl shrink-0 overflow-hidden bg-stone-100 dark:bg-stone-800">
          <img
            src={safeImageUrl(article.image_url, "/images/placeholder-card.svg")}
            alt={article.title}
            className="w-full h-full object-cover"
          />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 mb-1">
            {(() => {
              const meta = statusMeta(article.status);
              return (
                <Badge variant={meta.variant}>
                  <span className="flex items-center gap-1">{meta.icon} {meta.label}</span>
                </Badge>
              );
            })()}
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
            {nextStepText(article.status) && ` · ${nextStepText(article.status)}`}
          </p>
          {article.review_note && ["rejected", "needs_changes"].includes(article.status) && (
            <p className="text-xs text-red-600 dark:text-red-400 mt-1">
              Reason: {article.review_note}
            </p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2 ml-4">
        {article.status === "rejected" && (
          <Button variant="secondary" size="sm" onClick={() => onAppeal(article.id)}>
            <RotateCcw size={14} className="mr-1" />
            Appeal
          </Button>
        )}
        {isEditable(article.status) && (
          <Button
            variant="secondary"
            size="sm"
            onClick={() => onEdit(article.id)}
          >
            Edit
          </Button>
        )}
        {article.slug && article.status === "published" && (
          <Link href={`/articles/${article.slug}`}>
            <Button variant="ghost" size="sm">View</Button>
          </Link>
        )}
        <button
          onClick={() => onDelete(article.id)}
          className="p-1.5 text-stone-400 hover:text-red-500 transition-colors"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </div>
  );
}
