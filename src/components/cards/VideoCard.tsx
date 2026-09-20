'use client';

import { cn } from '@/lib/cn';

interface VideoCardProps {
  title?: string;
  channelName?: string;
  viewCount?: number;
  publishedAt?: string;
  duration?: string;
  thumbnailUrl?: string;
  skeleton?: boolean;
}

export function VideoCard({
  title,
  channelName,
  viewCount,
  publishedAt,
  duration,
  thumbnailUrl,
  skeleton,
}: VideoCardProps) {
  const isLoading = skeleton || !title;

  return (
    <article
      className={cn(
        'group flex flex-col gap-2',
        'rounded-xl overflow-hidden',
        'transition-transform duration-150 hover:scale-[1.01]',
        'cursor-pointer'
      )}
      aria-label={isLoading ? 'Loading video' : `Video: ${title}`}
    >
      {/* Thumbnail */}
      <div
        className={cn(
          'relative aspect-video w-full rounded-xl overflow-hidden',
          'bg-surface-secondary',
          isLoading && 'animate-pulse'
        )}
      >
        {thumbnailUrl && !isLoading && (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={thumbnailUrl} alt={title ?? ''} className="absolute inset-0 w-full h-full object-cover" loading="lazy" />
        )}
        {/* Duration badge */}
        {duration && !isLoading && (
          <span
            className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded bg-black/80 text-white text-[10px] font-semibold"
            aria-label={`Duration: ${duration}`}
          >
            {duration}
          </span>
        )}
      </div>

      {/* Info */}
      <div className="flex gap-2 px-0.5">
        {/* Channel avatar */}
        <div
          className={cn(
            'h-9 w-9 rounded-full shrink-0 bg-surface-secondary',
            isLoading && 'animate-pulse'
          )}
          aria-hidden="true"
        />

        <div className="flex-1 min-w-0 space-y-1">
          {/* Title */}
          <div
            className={cn(
              'text-fluid-sm font-medium text-content-primary leading-snug line-clamp-2',
              isLoading && 'animate-pulse rounded h-4 bg-surface-secondary w-full'
            )}
          >
            {!isLoading && title}
          </div>
          {isLoading && <div className="animate-pulse rounded h-3 bg-surface-secondary w-3/4 mt-1" />}

          {/* Meta */}
          {!isLoading ? (
            <p className="text-[11px] text-content-secondary">
              {channelName} · {viewCount?.toLocaleString()} views · {publishedAt}
            </p>
          ) : (
            <div className="animate-pulse rounded h-3 bg-surface-secondary w-1/2" />
          )}
        </div>
      </div>
    </article>
  );
}

// Skeleton array helper
export function VideoCardSkeleton({ count = 8 }: { count?: number }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <VideoCard key={i} skeleton />
      ))}
    </>
  );
}
