import { ReactNode } from "react";

export function ContentCardSkeleton() {
  return (
    <div data-rl-component="ContentCardSkeleton" className="bg-white dark:bg-stone-900 border border-primary-200/50 dark:border-stone-700/50 rounded-xl2 overflow-hidden">
      <div className="h-36 skeleton-shimmer" />
      <div className="p-5 space-y-3">
        <div className="flex gap-2">
          <div className="h-4 w-16 skeleton-shimmer rounded-full" />
          <div className="h-4 w-12 skeleton-shimmer rounded-full" />
        </div>
        <div className="h-5 w-3/4 skeleton-shimmer rounded" />
        <div className="h-4 w-full skeleton-shimmer rounded" />
        <div className="h-4 w-2/3 skeleton-shimmer rounded" />
      </div>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div data-rl-component="CardSkeleton" className="bg-white dark:bg-stone-900 border border-primary-200/50 dark:border-stone-700/50 rounded-xl2 overflow-hidden">
      <div className="p-5 space-y-3">
        <div className="flex gap-2">
          <div className="h-4 w-16 skeleton-shimmer rounded-full" />
          <div className="h-4 w-12 skeleton-shimmer rounded-full" />
        </div>
        <div className="h-5 w-3/4 skeleton-shimmer rounded" />
        <div className="h-4 w-full skeleton-shimmer rounded" />
        <div className="h-4 w-2/3 skeleton-shimmer rounded" />
      </div>
    </div>
  );
}

type ListSkeletonProps = {
  rows?: number;
  count?: number;
};

export function ListSkeleton({ rows = 4, count }: ListSkeletonProps) {
  const n = count ?? rows;
  return (
    <div data-rl-component="ListSkeleton" className="space-y-3">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 bg-white dark:bg-stone-900 border border-primary-200/50 dark:border-stone-700/50 rounded-xl2">
          <div className="w-10 h-10 rounded-full skeleton-shimmer" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-3/4 skeleton-shimmer rounded" />
            <div className="h-3 w-1/2 skeleton-shimmer rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div data-rl-component="ProfileSkeleton" className="flex items-center gap-4">
      <div className="w-12 h-12 skeleton-shimmer rounded-full" />
      <div className="space-y-2">
        <div className="h-4 w-32 skeleton-shimmer rounded" />
        <div className="h-3 w-24 skeleton-shimmer rounded" />
      </div>
    </div>
  );
}

type TextProps = {
  lines?: number;
  className?: string;
};

export function TextSkeleton({ lines = 3, className = "" }: TextProps) {
  return (
    <div data-rl-component="TextSkeleton" className={`space-y-2 ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-4 skeleton-shimmer rounded" style={{ width: `${100 - i * 15}%` }} />
      ))}
    </div>
  );
}

export function PageSkeleton({ children }: { children?: ReactNode }) {
  return (
    <div data-rl-component="PageSkeleton" className="max-w-4xl mx-auto px-4 sm:px-8 py-12">
      {children || (
        <div className="space-y-6">
          <div className="h-6 w-20 skeleton-shimmer rounded-full" />
          <div className="h-12 w-3/4 skeleton-shimmer rounded" />
          <div className="h-4 w-1/2 skeleton-shimmer rounded" />
          <div className="space-y-3 pt-8">
            <div className="h-4 w-full skeleton-shimmer rounded" />
            <div className="h-4 w-full skeleton-shimmer rounded" />
            <div className="h-4 w-5/6 skeleton-shimmer rounded" />
          </div>
        </div>
      )}
    </div>
  );
}
