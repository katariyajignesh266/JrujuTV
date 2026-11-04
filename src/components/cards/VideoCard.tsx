'use client';

import { useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/cn';
import { Video } from '@/types/content';
import { formatViewCount, formatRelativeTime, formatDuration } from '@/lib/formatters';

interface VideoCardProps {
  video?: Video;
  id?: string;
  youtubeVideoId?: string;
  title?: string;
  channelName?: string;
  channelAvatarUrl?: string;
  viewCount?: number;
  publishedAt?: string;
  duration?: string;
  thumbnailUrl?: string;
  skeleton?: boolean;
  layout?: 'grid' | 'row';
}

export function VideoCard({
  video,
  id,
  youtubeVideoId,
  title,
  channelName,
  channelAvatarUrl,
  viewCount,
  publishedAt,
  duration,
  thumbnailUrl,
  skeleton,
  layout = 'grid',
}: VideoCardProps) {
  const [thumbLoaded, setThumbLoaded] = useState(false);

  const activeVideoId = video?.youtube_video_id || video?.id || youtubeVideoId || id;
  const activeTitle = video?.title || title;
  const activeChannelName = video?.channel?.title || video?.channelName || channelName;
  const activeChannelAvatar = video?.channel?.thumbnail_url || video?.channelAvatarUrl || channelAvatarUrl;
  const activeViews = video?.view_count ?? viewCount;
  const activeThumb = video?.thumbnail_url || thumbnailUrl;
  const activeDuration =
    video?.duration ||
    (video?.duration_seconds ? formatDuration(video.duration_seconds) : duration);
  const activeDate = formatRelativeTime(video?.published_at || publishedAt);
  const formattedViews = activeViews !== undefined ? formatViewCount(activeViews) : '';

  const isLoading = skeleton || !activeTitle;

  const content = (
    <article
      className={cn(
        'group flex',
        layout === 'grid' ? 'flex-col gap-3' : 'flex-row items-start gap-2.5 sm:gap-3',
        'overflow-hidden',
        'transition-all duration-300',
        'cursor-pointer w-full',
        layout === 'grid' && !isLoading && 'hover:-translate-y-0.5',
        layout === 'row' && !isLoading && 'p-1.5 -m-1.5 rounded-2xl hover:bg-neutral-900/5 dark:hover:bg-white/[0.04]'
      )}
      aria-label={isLoading ? 'Loading video' : `Video: ${activeTitle}`}
    >
      {/* Thumbnail Container — Strict 16:9 aspect ratio */}
      <div
        className={cn(
          'relative aspect-video overflow-hidden shrink-0 bg-neutral-900 rounded-xl',
          layout === 'row' ? 'w-[140px] sm:w-[155px] md:w-[168px] rounded-xl' : 'w-full rounded-xl',
          isLoading && 'animate-pulse bg-[var(--color-bg-secondary)]',
          !isLoading && 'shadow-xs group-hover:shadow-md transition-shadow duration-300'
        )}
      >
        {/* Shimmer Placeholder before image loads */}
        {!thumbLoaded && !isLoading && (
          <div className="absolute inset-0 bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-900 animate-pulse" />
        )}

        {activeThumb && !isLoading && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={activeThumb}
            alt={activeTitle ?? ''}
            className={cn(
              'absolute inset-0 w-full h-full object-cover transition-all duration-500 group-hover:scale-[1.04]',
              thumbLoaded ? 'opacity-100 blur-0' : 'opacity-0 blur-sm'
            )}
            loading="lazy"
            decoding="async"
            onLoad={() => setThumbLoaded(true)}
          />
        )}

        {/* Hover play overlay */}
        {!isLoading && thumbLoaded && (
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all duration-300 flex items-center justify-center">
            <div className={cn(
              'rounded-full bg-white/95 dark:bg-white/90 flex items-center justify-center scale-0 group-hover:scale-100 transition-all duration-300 shadow-xl',
              layout === 'row' ? 'h-8 w-8' : 'h-11 w-11'
            )}>
              <svg viewBox="0 0 24 24" fill="currentColor" className={cn('text-neutral-900 translate-x-0.5', layout === 'row' ? 'w-3.5 h-3.5' : 'w-5 h-5')}>
                <polygon points="5,3 19,12 5,21" />
              </svg>
            </div>
          </div>
        )}

        {/* Duration badge */}
        {activeDuration && !isLoading && (
          <span
            className="absolute bottom-1.5 right-1.5 px-1.5 py-0.5 rounded-md bg-black/85 backdrop-blur-xs text-white text-[9.5px] font-bold tracking-wide z-10 shadow-xs"
            aria-label={`Duration: ${activeDuration}`}
          >
            {activeDuration}
          </span>
        )}

        {/* Top-left shimmer line on hover */}
        <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-red-500 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 z-10" />
      </div>

      {/* Info Details */}
      <div className={cn('flex min-w-0 flex-1', layout === 'grid' ? 'gap-2.5 px-1 sm:px-0.5' : 'flex-col gap-1 py-0')}>
        {/* Channel avatar only for grid layout */}
        {layout === 'grid' && (
          <div
            className={cn(
              'h-9 w-9 rounded-full shrink-0 overflow-hidden border border-[var(--color-border)]',
              'bg-[var(--color-bg-secondary)]',
              'shadow-xs group-hover:shadow-md group-hover:border-red-400/40 dark:group-hover:border-red-400/30 transition-all duration-200',
              isLoading && 'animate-pulse'
            )}
            aria-hidden="true"
          >
            {activeChannelAvatar && !isLoading ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={activeChannelAvatar}
                alt={activeChannelName || ''}
                className="h-full w-full object-cover"
                loading="lazy"
                decoding="async"
              />
            ) : (
              <div className="h-full w-full bg-red-500/20 flex items-center justify-center text-xs font-bold text-red-500">
                {activeChannelName ? activeChannelName.charAt(0).toUpperCase() : ''}
              </div>
            )}
          </div>
        )}

        <div className="flex-1 min-w-0 space-y-1">
          {/* Title */}
          <div
            className={cn(
              'font-semibold text-[var(--color-text-primary)] leading-snug line-clamp-2',
              layout === 'row' ? 'text-[12.5px] sm:text-[13px] leading-[1.35]' : 'text-fluid-sm',
              'group-hover:text-red-500 dark:group-hover:text-red-400 transition-colors duration-200',
              isLoading && 'animate-pulse rounded-lg h-4 bg-[var(--color-bg-secondary)] w-full'
            )}
          >
            {!isLoading && activeTitle}
          </div>
          {isLoading && <div className="animate-pulse rounded-lg h-3 bg-[var(--color-bg-secondary)] w-3/4 mt-1" />}

          {/* YouTube-style Channel & Views Meta */}
          {!isLoading ? (
            <div className="text-[11px] text-[var(--color-text-secondary)] line-clamp-1 flex flex-wrap items-center gap-1 font-medium">
              <span className="truncate max-w-[130px] sm:max-w-[170px]">{activeChannelName}</span>
              {formattedViews && (
                <>
                  <span className="opacity-40">·</span>
                  <span>{formattedViews}</span>
                </>
              )}
              {activeDate && (
                <>
                  <span className="opacity-40">·</span>
                  <span>{activeDate}</span>
                </>
              )}
            </div>
          ) : (
            <div className="animate-pulse rounded-lg h-3 bg-[var(--color-bg-secondary)] w-1/2" />
          )}
        </div>
      </div>
    </article>
  );

  if (isLoading || !activeVideoId) {
    return content;
  }

  return (
    <Link
      href={`/videos/${activeVideoId}`}
      className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500/60 rounded-xl w-full min-w-0"
    >
      {content}
    </Link>
  );
}

// Skeleton array helper
export function VideoCardSkeleton({ count = 8, layout = 'grid' }: { count?: number; layout?: 'grid' | 'row' }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <VideoCard key={i} skeleton layout={layout} />
      ))}
    </>
  );
}
