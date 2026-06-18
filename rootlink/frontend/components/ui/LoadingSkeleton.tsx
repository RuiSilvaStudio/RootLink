import { ReactNode } from "react";

export function ContentCardSkeleton() {
  return (
    <div className="bg-white border border-primary-200/50 rounded-xl2 overflow-hidden animate-pulse">
      <div className="h-36 bg-primary-100/60" />
      <div className="p-5 space-y-3">
        <div className="flex gap-2">
          <div className="h-4 w-16 bg-primary-100/60 rounded-full" />
          <div className="h-4 w-12 bg-primary-100/60 rounded-full" />
        </div>
        <div className="h-5 w-3/4 bg-primary-100/60 rounded" />
        <div className="h-4 w-full bg-primary-100/60 rounded" />
        <div className="h-4 w-2/3 bg-primary-100/60 rounded" />
      </div>
    </div>
  );
}

export function CardSkeleton() {
  return (
    <div className="bg-white border border-primary-200/50 rounded-xl2 overflow-hidden animate-pulse">
      <div className="p-5 space-y-3">
        <div className="flex gap-2">
          <div className="h-4 w-16 bg-primary-100/60 rounded-full" />
          <div className="h-4 w-12 bg-primary-100/60 rounded-full" />
        </div>
        <div className="h-5 w-3/4 bg-primary-100/60 rounded" />
        <div className="h-4 w-full bg-primary-100/60 rounded" />
        <div className="h-4 w-2/3 bg-primary-100/60 rounded" />
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
    <div className="space-y-3 animate-pulse">
      {Array.from({ length: n }).map((_, i) => (
        <div key={i} className="flex items-center gap-4 p-4 bg-white border border-primary-200/50 rounded-xl2">
          <div className="w-10 h-10 rounded-full bg-primary-100/60" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-3/4 bg-primary-100/60 rounded" />
            <div className="h-3 w-1/2 bg-primary-100/60 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ProfileSkeleton() {
  return (
    <div className="flex items-center gap-4 animate-pulse">
      <div className="w-12 h-12 bg-primary-100/60 rounded-full" />
      <div className="space-y-2">
        <div className="h-4 w-32 bg-primary-100/60 rounded" />
        <div className="h-3 w-24 bg-primary-100/60 rounded" />
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
    <div className={`space-y-2 animate-pulse ${className}`}>
      {Array.from({ length: lines }).map((_, i) => (
        <div key={i} className="h-4 bg-primary-100/60 rounded" style={{ width: `${100 - i * 15}%` }} />
      ))}
    </div>
  );
}

export function PageSkeleton({ children }: { children?: ReactNode }) {
  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-8 py-12 animate-pulse">
      {children || (
        <div className="space-y-6">
          <div className="h-6 w-20 bg-primary-100/60 rounded-full" />
          <div className="h-12 w-3/4 bg-primary-100/60 rounded" />
          <div className="h-4 w-1/2 bg-primary-100/60 rounded" />
          <div className="space-y-3 pt-8">
            <div className="h-4 w-full bg-primary-100/60 rounded" />
            <div className="h-4 w-full bg-primary-100/60 rounded" />
            <div className="h-4 w-5/6 bg-primary-100/60 rounded" />
          </div>
        </div>
      )}
    </div>
  );
}
