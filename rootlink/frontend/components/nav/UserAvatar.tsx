"use client";

import { useState } from "react";

/**
 * Filled user silhouette — shown when no profile photo is uploaded.
 * Uses fill="currentColor" so it renders solidly at any size.
 */
export function UserAvatar({ className = "w-4 h-4" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      aria-hidden="true"
      className={className}
    >
      {/* head */}
      <circle cx="12" cy="8" r="4" />
      {/* shoulders */}
      <path d="M4 20c0-4 3.6-7 8-7s8 3 8 7H4z" />
    </svg>
  );
}

/**
 * Shows a profile photo when available and loadable.
 * Falls back to UserAvatar silhouette on any load error.
 */
export function SafeAvatar({
  url,
  iconClassName = "w-4 h-4",
}: {
  url: string | null | undefined;
  iconClassName?: string;
}) {
  const [error, setError] = useState(false);

  if (url && !error) {
    return (
      <img
        src={url}
        alt=""
        className="w-full h-full object-cover"
        onError={() => setError(true)}
      />
    );
  }

  return <UserAvatar className={iconClassName} />;
}
