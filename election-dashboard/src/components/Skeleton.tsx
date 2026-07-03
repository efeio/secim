"use client";

interface SkeletonProps {
  className?: string;
}

export default function Skeleton({ className = "" }: SkeletonProps) {
  return (
    <div
      className={`rounded animate-pulse ${className}`}
      style={{ background: "var(--bg-overlay)" }}
    />
  );
}

export function CandidateCardSkeleton() {
  return (
    <div className="rounded-xl p-3.5 space-y-3" style={{ background: "var(--bg-elevated)", border: "1px solid var(--border-subtle)" }}>
      <div className="flex items-center justify-between">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-10" />
      </div>
      <div className="flex items-end justify-between">
        <Skeleton className="h-7 w-16" />
        <Skeleton className="h-3 w-14" />
      </div>
      <Skeleton className="h-1 w-full" />
    </div>
  );
}

export function MapSkeleton() {
  return (
    <div className="absolute inset-0 flex items-center justify-center">
      <Skeleton className="w-3/4 h-3/4 rounded-2xl opacity-30" />
    </div>
  );
}
