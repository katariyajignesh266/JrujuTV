'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Tv2 } from 'lucide-react';
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
  layout?: 'grid' | 'row' | 'hero';
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
  const [thumbError, setThumbError] = useState(false);
  const [avatarError, setAvatarError] = useState(false);

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
  const isHero = layout === 'hero';
  const isRow = layout === 'row';
  const isGrid = layout === 'grid';

  const content = (
    <article
      className={cn(
        'group flex min-w-0 w-full cursor-pointer transition-all duration-200',
        isHero && 'flex-col gap-3 rounded-2xl p-2.5 sm:p-3 bg-[var(--color-bg-elevated)] border border-[var(--color-border)]/80 shadow-sm hover:shadow-md',
        isGrid && 'flex-col gap-2 sm:gap-2.5',
        isRow && 'flex-row items-start gap-2.5 sm:gap-3 p-1.5 -m-1.5 rounded-2xl hover:bg-neutral-900/5 dark:hover:bg-white/[0.04]',
        isGrid && !isLoading && 'hover:-translate-y-0.5'
      )}
      aria-label={isLoading ? 'Loading video' : `Video: ${activeTitle}`}
    >
      {/* Thumbnail Container — Strict 16:9 aspect ratio */}
      <div
        className={cn(
          'relative aspect-video overflow-hidden shrink-0 bg-neutral-900',
          isHero && 'w-full rounded-xl',
          isGrid && 'w-full rounded-xl',
          isRow && 'w-[136px] sm:w-[155px] md:w-[168px] rounded-xl',
          isLoading && 'animate-pulse bg-[var(--color-bg-secondary)]',
          !isLoading && 'shadow-xs group-hover:shadow-md transition-shadow duration-300'
        )}
      >
        {/* Shimmer Placeholder before image loads */}
        {!thumbLoaded && !thumbError && !isLoading && (
          <div className="absolute inset-0 bg-gradient-to-r from-neutral-900 via-neutral-800 to-neutral-900 animate-pulse" />
        )}

        {/* Missing / broken artwork fallback */}
        {(!activeThumb || thumbError) && !isLoading && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-1.5 bg-gradient-to-br from-[#2d1a24] via-[#1c131d] to-[#120e16] text-white/70 p-3 text-center">
            <Tv2 className={cn(isRow ? 'h-5 w-5' : 'h-8 w-8', 'text-rose-300/70')} />
            {!isRow && (
              <span className="text-[11px] font-medium text-white/60 line-clamp-1 max-w-[85%]">
                {activeChannelName || 'JruJu TV'}
              </span>
            )}
          </div>
        )}

        {activeThumb && !thumbError && !isLoading && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={activeThumb}
            alt={activeTitle ?? ''}
            className={cn(
              'absolute inset-0 w-full h-full object-cover transition-all duration-500 group-hover:scale-[1.03]',
              thumbLoaded ? 'opacity-100 blur-0' : 'opacity-0 blur-sm'
            )}
            loading={isHero ? 'eager' : 'lazy'}
            decoding="async"
            onLoad={() => setThumbLoaded(true)}
            onError={() => {
              setThumbError(true);
              setThumbLoaded(true);
            }}
          />
        )}

        {/* Hover play overlay (desktop/pointer) */}
        {!isLoading && thumbLoaded && !thumbError && (
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-all duration-300 flex items-center justify-center">
            <div
              className={cn(
                'rounded-full bg-white/95 flex items-center justify-center scale-0 group-hover:scale-100 transition-all duration-200 shadow-xl',
                isHero ? 'h-14 w-14' : isRow ? 'h-8 w-8' : 'h-11 w-11'
              )}
            >
              <svg
                viewBox="0 0 24 24"
                fill="currentColor"
                className={cn(
                  'text-neutral-900 translate-x-0.5',
                  isHero ? 'w-6 h-6' : isRow ? 'w-3.5 h-3.5' : 'w-5 h-5'
                )}
              >
                <polygon points="5,3 19,12 5,21" />
              </svg>
            </div>
          </div>
        )}

        {/* Duration badge — high contrast, crisp, never clips content */}
        {activeDuration && !isLoading && (
          <span
            className={cn(
              'absolute bottom-1.5 right-1.5 rounded-md bg-black/85 backdrop-blur-xs text-white font-bold tracking-wide z-10 shadow-xs tabular-nums',
              isHero ? 'px-2 py-0.5 text-[11px]' : 'px-1.5 py-0.5 text-[10px]'
            )}
            aria-label={`Duration: ${activeDuration}`}
          >
            {activeDuration}
          </span>
        )}
      </div>

      {/* Info Details */}
      <div
        className={cn(
          'flex min-w-0 flex-1',
          isHero && 'gap-3 items-start px-0.5',
          isGrid && 'gap-2.5 px-0.5',
          isRow && 'flex-col gap-1 py-0'
        )}
      >
        {/* Channel avatar: always shown on Hero, shown on sm+ for Grid (to give 2-col mobile titles full width) */}
        {(isHero || isGrid) && (
          <div
            className={cn(
              'rounded-full shrink-0 overflow-hidden border border-[var(--color-border)] bg-[var(--color-bg-secondary)] shadow-xs',
              isHero ? 'h-10 w-10 mt-0.5' : 'hidden sm:block h-9 w-9',
              isLoading && 'animate-pulse'
            )}
            aria-hidden="true"
          >
            {activeChannelAvatar && !avatarError && !isLoading ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={activeChannelAvatar}
                alt={activeChannelName || ''}
                className="h-full w-full object-cover"
                loading="lazy"
                decoding="async"
                onError={() => setAvatarError(true)}
              />
            ) : (
              <div className="h-full w-full bg-red-500/15 flex items-center justify-center text-xs font-bold text-red-600 dark:text-red-400">
                {activeChannelName ? activeChannelName.charAt(0).toUpperCase() : 'J'}
              </div>
            )}
          </div>
        )}

        <div className="flex-1 min-w-0 space-y-1">
          {/* Title — generous line-height for Gujarati & mixed script */}
          <div
            className={cn(
              'font-semibold text-[var(--color-text-primary)] text-gujarati',
              'group-hover:text-red-600 dark:group-hover:text-red-400 transition-colors duration-200',
              isHero && 'font-display font-bold text-[16px] sm:text-lg leading-[1.42] line-clamp-3',
              isGrid && 'text-[13px] sm:text-fluid-sm leading-[1.42] line-clamp-2',
              isRow && 'text-[12.5px] sm:text-[13px] leading-[1.38] line-clamp-2',
              isLoading && 'animate-pulse rounded-lg h-4 bg-[var(--color-bg-secondary)] w-full'
            )}
          >
            {!isLoading && activeTitle}
          </div>
          {isLoading && <div className="animate-pulse rounded-lg h-3 bg-[var(--color-bg-secondary)] w-3/4 mt-1" />}

          {/* Channel & Views Meta */}
          {!isLoading ? (
            <div className="text-[11px] text-[var(--color-text-secondary)] flex flex-wrap items-center gap-x-1.5 gap-y-0.5 font-medium min-w-0">
              {/* Compact inline avatar on mobile 2-col grid */}
              {isGrid && (
                <span className="sm:hidden inline-flex h-4 w-4 rounded-full overflow-hidden border border-[var(--color-border)] bg-[var(--color-bg-secondary)] shrink-0">
                  {activeChannelAvatar && !avatarError ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={activeChannelAvatar}
                      alt=""
                      className="h-full w-full object-cover"
                      loading="lazy"
                      decoding="async"
                      onError={() => setAvatarError(true)}
                    />
                  ) : (
                    <span className="h-full w-full flex items-center justify-center text-[8px] font-bold text-red-600 dark:text-red-400">
                      {activeChannelName ? activeChannelName.charAt(0).toUpperCase() : 'J'}
                    </span>
                  )}
                </span>
              )}
              <span className="truncate max-w-[130px] sm:max-w-[170px]">{activeChannelName}</span>
              {formattedViews && (
                <>
                  <span className="opacity-40" aria-hidden="true">·</span>
                  <span className="shrink-0">{formattedViews}</span>
                </>
              )}
              {activeDate && !isGrid && (
                <>
                  <span className="opacity-40" aria-hidden="true">·</span>
                  <span className="shrink-0">{activeDate}</span>
                </>
              )}
              {activeDate && isGrid && (
                <span className="hidden sm:inline-flex items-center gap-1.5 shrink-0">
                  <span className="opacity-40" aria-hidden="true">·</span>
                  <span>{activeDate}</span>
                </span>
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
export function VideoCardSkeleton({ count = 8, layout = 'grid' }: { count?: number; layout?: 'grid' | 'row' | 'hero' }) {
  return (
    <>
      {Array.from({ length: count }).map((_, i) => (
        <VideoCard key={i} skeleton layout={layout} />
      ))}
    </>
  );
}
