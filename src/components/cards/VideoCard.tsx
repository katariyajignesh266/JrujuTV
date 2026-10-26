'use client';

import Link from 'next/link';
import { cn } from '@/lib/cn';
import { Video } from '@/types/content';

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

function formatRelativeTime(dateStr?: string | null): string {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (diffInSeconds < 60) return 'Just now';
  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;
  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;
  const diffInDays = Math.floor(diffInHours / 24);
  if (diffInDays < 30) return `${diffInDays}d ago`;
  const diffInMonths = Math.floor(diffInDays / 30);
  if (diffInMonths < 12) return `${diffInMonths}mo ago`;
  return `${Math.floor(diffInMonths / 12)}y ago`;
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
  const activeVideoId = video?.youtube_video_id || video?.id || youtubeVideoId || id;
  const activeTitle = video?.title || title;
  const activeChannelName = video?.channel?.title || video?.channelName || channelName;
  const activeChannelAvatar = video?.channel?.thumbnail_url || video?.channelAvatarUrl || channelAvatarUrl;
  const activeViews = video?.view_count ?? viewCount;
  const activeThumb = video?.thumbnail_url || thumbnailUrl;
  const activeDuration =
    video?.duration ||
    (video?.duration_seconds
      ? `${Math.floor(video.duration_seconds / 60)}:${String(video.duration_seconds % 60).padStart(2, '0')}`
      : duration);
  const activeDate = formatRelativeTime(video?.published_at || publishedAt);

  const isLoading = skeleton || !activeTitle;

  const content = (
    <article
      className={cn(
        'group flex gap-3',
        layout === 'grid' ? 'flex-col' : 'flex-row items-start',
        'rounded-2xl overflow-hidden',
        'transition-all duration-200 hover:scale-[1.01]',
        'cursor-pointer'
      )}
      aria-label={isLoading ? 'Loading video' : `Video: ${activeTitle}`}
    >
      {/* Thumbnail */}
      <div
        className={cn(
          'relative aspect-video w-full rounded-2xl overflow-hidden bg-surface-secondary shrink-0 border border-border/40',
          layout === 'row' ? 'w-44 sm:w-56' : 'w-full',
          isLoading && 'animate-pulse'
        )}
      >
        {activeThumb && !isLoading && (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={activeThumb}
            alt={activeTitle ?? ''}
            className="absolute inset-0 w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
            loading="lazy"
          />
        )}
        {/* Duration badge */}
        {activeDuration && !isLoading && (
          <span
            className="absolute bottom-2 right-2 px-1.5 py-0.5 rounded-md bg-black/80 backdrop-blur-sm text-white text-[10px] font-semibold tracking-wider"
            aria-label={`Duration: ${activeDuration}`}
          >
            {activeDuration}
          </span>
        )}
      </div>

      {/* Info */}
      <div className={cn('flex gap-2.5 px-0.5 min-w-0 flex-1', layout === 'row' && 'py-1')}>
        {/* Channel avatar */}
        {layout === 'grid' && (
          <div
            className={cn(
              'h-9 w-9 rounded-full shrink-0 overflow-hidden bg-surface-secondary border border-border/40',
              isLoading && 'animate-pulse'
            )}
            aria-hidden="true"
          >
            {activeChannelAvatar && !isLoading ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={activeChannelAvatar} alt={activeChannelName || ''} className="h-full w-full object-cover" />
            ) : (
              <div className="h-full w-full bg-brand-primary/20 flex items-center justify-center text-xs font-bold text-brand-primary">
                {activeChannelName ? activeChannelName.charAt(0).toUpperCase() : ''}
              </div>
            )}
          </div>
        )}

        <div className="flex-1 min-w-0 space-y-1">
          {/* Title */}
          <div
            className={cn(
              'text-fluid-sm font-semibold text-content-primary leading-snug line-clamp-2 group-hover:text-brand-primary transition-colors',
              isLoading && 'animate-pulse rounded h-4 bg-surface-secondary w-full'
            )}
          >
            {!isLoading && activeTitle}
          </div>
          {isLoading && <div className="animate-pulse rounded h-3 bg-surface-secondary w-3/4 mt-1" />}

          {/* Meta */}
          {!isLoading ? (
            <div className="text-[11.5px] text-content-secondary line-clamp-1">
              <span>{activeChannelName}</span>
              {activeViews !== undefined && (
                <>
                  <span className="mx-1">·</span>
                  <span>{activeViews.toLocaleString()} views</span>
                </>
              )}
              {activeDate && (
                <>
                  <span className="mx-1">·</span>
                  <span>{activeDate}</span>
                </>
              )}
            </div>
          ) : (
            <div className="animate-pulse rounded h-3 bg-surface-secondary w-1/2" />
          )}
        </div>
      </div>
    </article>
  );

  if (isLoading || !activeVideoId) {
    return content;
  }

  return (
    <Link href={`/videos/${activeVideoId}`} className="block focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary rounded-2xl">
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
