"use client";

import Link from "next/link";
import { MessageCircle } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";

export interface NetworkUserCardProps {
  user: any;
  isFollowing: boolean;
  showActions: boolean;
  onFollow: (userId: number) => void;
  followText: string;
  unfollowText: string;
  messageText: string;
}

export function NetworkUserCard({
  user,
  isFollowing,
  showActions,
  onFollow,
  followText,
  unfollowText,
  messageText,
}: NetworkUserCardProps) {
  return (
    <div className="card-lift p-5" data-rl-component="NetworkUserCard">
      <Link href={`/profile/${user.id}`} className="flex items-center gap-3 mb-3">
        <div className="w-12 h-12 rounded-2xl bg-primary-100 dark:bg-primary-950/20 flex items-center justify-center text-primary-700 font-bold shrink-0 text-lg">
          {user.name?.[0]?.toUpperCase() || "?"}
        </div>
        <div className="min-w-0">
          <p className="font-semibold text-stone-800 dark:text-stone-100 truncate">{user.name}</p>
          {user.location && <p className="text-xs text-stone-00 dark:text-stone-500 truncate">{user.location}</p>}
        </div>
      </Link>
      {user.bio && <p className="text-sm text-stone-500 line-clamp-2 mb-3 font-light">{user.bio}</p>}
      {user.skills && user.skills.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-2">
          {user.skills.slice(0, 3).map((s: string) => (
            <Badge key={s} variant="sage" className="text-[11px]">{s}</Badge>
          ))}
          {user.skills.length > 3 && <Badge variant="stone" className="text-[11px]">+{user.skills.length - 3}</Badge>}
        </div>
      )}
      {showActions && (
        <div className="flex gap-2 mt-3">
          <Button
            variant={isFollowing ? "secondary" : "primary"}
            size="sm"
            onClick={() => onFollow(user.id)}
          >
            {isFollowing ? unfollowText : followText}
          </Button>
          <Link href={`/messages?user=${user.id}`}>
            <Button variant="secondary" size="sm">
              <MessageCircle className="w-3 h-3" /> {messageText}
            </Button>
          </Link>
        </div>
      )}
    </div>
  );
}
