// src/app/channels/[channelId]/page.tsx
'use client';

import { use, useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, Tv2, Loader2 } from 'lucide-react';
import { PageShell } from '@/components/layout/PageShell';
import { VideoCardSkeleton } from '@/components/cards/VideoCard';
import { VirtualizedVideoGrid } from '@/components/video/VirtualizedVideoGrid';
import { useAuthStore } from '@/store/authStore';
import { Channel, Video } from '@/types/content';
import { syncChannel } from '@/lib/api/channels';
import { cn } from '@/lib/cn';
import { useLookAheadPagination } from '@/hooks/useLookAheadPagination';
import { formatCompactNumber } from '@/lib/formatters';

export default function ChannelDetailPage({
  params,
}: {
  params: Promise<{ channelId: string }>;
}) {
  const { channelId } = use(params);
  const { role } = useAuthStore();

  const [channel, setChannel] = useState<Channel | null>(null);
  const [videos, setVideos] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [page, setPage] = useState(1);
  const [hasMore, setHasMore] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);

  const pageRef = useRef(1);
  const nextCursorRef = useRef<{ published_at: string; id: string } | null>(null);

  const fetchChannelVideos = useCallback(
    async (
      pageNum: number = 1,
      append: boolean = false,
      cursor: { published_at: string; id: string } | null = null
    ) => {
      try {
        if (pageNum === 1) setLoading(true);
        else setLoadingMore(true);

        let url = `/api/channels/${channelId}/videos?page=${pageNum}&pageSize=20`;
        if (cursor) {
          url += `&cursor_published_at=${encodeURIComponent(cursor.published_at)}&cursor_id=${encodeURIComponent(cursor.id)}`;
        }

        const res = await fetch(url);
        const data = await res.json();

        if (data.channel) setChannel(data.channel);

        if (append) {
          setVideos((prev) => {
            const existingIds = new Set(prev.map((v) => v.id));
            const newItems = (data.videos || []).filter((v: Video) => !existingIds.has(v.id));
            return [...prev, ...newItems];
          });
        } else {
          setVideos(data.videos || []);
        }

        setHasMore(Boolean(data.hasMore));
        nextCursorRef.current = data.nextCursor || null;
        setPage(pageNum);
        pageRef.current = pageNum;
      } catch (err) {
        console.error('Failed to load channel videos:', err);
      } finally {
        setLoading(false);
        setLoadingMore(false);
      }
    },
    [channelId]
  );

  useEffect(() => {
    if (channelId) {
      nextCursorRef.current = null;
      fetchChannelVideos(1, false, null);
    }
  }, [channelId, fetchChannelVideos]);

  // Predictive look-ahead pagination: triggers next batch when reaching 4th-from-last card
  const handleLoadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    const nextPage = pageRef.current + 1;
    fetchChannelVideos(nextPage, true, nextCursorRef.current);
  }, [loadingMore, hasMore, fetchChannelVideos]);

  const { sentinelIndex, attachSentinel } = useLookAheadPagination({
    itemCount: videos.length,
    hasMore,
    isLoading: loadingMore,
    lookAheadOffset: 4,
    rootMargin: '600px 0px',
    onLoadMore: handleLoadMore,
  });

  const handleManualSync = async () => {
    if (!channel) return;
    setIsSyncing(true);
    try {
      await syncChannel(channel.id);
      nextCursorRef.current = null;
      await fetchChannelVideos(1, false, null);
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <PageShell>
      <div className="max-w-7xl mx-auto space-y-6 pb-16">
        {/* Navigation & Header */}
        <div className="flex items-center gap-3">
          <Link
            href="/channels"
            className="p-2 -ml-2 rounded-2xl text-content-secondary hover:text-content-primary hover:bg-surface-secondary transition-colors"
          >
            <ArrowLeft size={20} />
          </Link>
          <span className="text-fluid-sm text-content-secondary font-medium">All Channels</span>
        </div>

        {/* Channel Banner / Header Card */}
        {channel ? (
          <div className="rounded-3xl bg-surface-secondary border border-border p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-5">
              <div className="relative h-24 w-24 rounded-full overflow-hidden bg-surface-elevated border-2 border-brand-primary/30 shrink-0 shadow-lg">
                {channel.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={channel.thumbnail_url}
                    alt={channel.title}
                    className="h-full w-full object-cover"
                    loading="lazy"
                    decoding="async"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center font-bold text-3xl text-brand-primary">
                    {channel.title.charAt(0)}
                  </div>
                )}
              </div>

              <div className="flex-1 text-center sm:text-left min-w-0 space-y-1.5">
                <h1 className="font-display font-bold text-fluid-xl text-content-primary truncate">
                  {channel.title}
                </h1>
                <p className="text-fluid-sm text-content-secondary">
                  {channel.subscriber_count > 0 &&
                    `${formatCompactNumber(channel.subscriber_count)} subscribers`}
                  {channel.subscriber_count > 0 && channel.video_count > 0 && ' · '}
                  {channel.video_count > 0 &&
                    `${formatCompactNumber(channel.video_count)} videos`}
                </p>
                <div className="pt-1 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <span className="px-3 py-1 rounded-full text-[11px] font-semibold bg-brand-primary/10 text-brand-primary border border-brand-primary/20">
                    Safe Curated Content
                  </span>
                  <span className="px-3 py-1 rounded-full text-[11px] font-medium bg-surface-elevated text-content-secondary border border-border">
                    5+ Min Long Form
                  </span>
                </div>
              </div>

              {/* Parent manual sync button */}
              {role === 'parent' && (
                <div className="shrink-0 mt-3 sm:mt-0">
                  <button
                    type="button"
                    onClick={handleManualSync}
                    disabled={isSyncing}
                    className={cn(
                      'inline-flex items-center gap-2 px-4 py-2 rounded-2xl text-fluid-sm font-semibold',
                      'bg-surface-elevated border border-border text-content-primary',
                      'hover:border-brand-primary/50 active:scale-95 transition-all disabled:opacity-50'
                    )}
                  >
                    <RefreshCw size={16} className={cn(isSyncing && 'animate-spin text-brand-primary')} />
                    <span>{isSyncing ? 'Syncing…' : 'Sync Videos'}</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        ) : loading ? (
          <div className="h-32 rounded-3xl bg-surface-secondary animate-pulse" />
        ) : null}

        {/* Video List Section — Virtualized with look-ahead pagination */}
        <div className="space-y-4">
          <h2 className="font-semibold text-fluid-lg text-content-primary">
            Uploaded Videos {videos.length > 0 && `(${videos.length})`}
          </h2>

          {loading ? (
            <div className="-mx-3 sm:-mx-4 md:mx-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-0 sm:gap-4 gap-y-6">
              <VideoCardSkeleton count={8} />
            </div>
          ) : videos.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center rounded-3xl bg-surface-secondary border border-border space-y-2">
              <Tv2 className="h-10 w-10 text-content-secondary mb-1" />
              <p className="font-semibold text-content-primary">No videos found</p>
              <p className="text-fluid-sm text-content-secondary">
                This channel does not have any videos over 5 minutes yet.
              </p>
            </div>
          ) : (
            <VirtualizedVideoGrid
              videos={videos}
              sentinelIndex={sentinelIndex}
              attachSentinel={attachSentinel}
            />
          )}

          {/* Look-ahead continuous loading indicator */}
          {loadingMore && (
            <div className="pt-6 pb-4 flex justify-center">
              <div className="flex items-center gap-2 text-content-secondary">
                <Loader2 size={16} className="animate-spin text-brand-primary" />
                <span className="text-fluid-sm">Loading more videos…</span>
              </div>
            </div>
          )}

          {!hasMore && !loading && videos.length > 0 && (
            <div className="pt-6 pb-4 flex justify-center">
              <p className="text-xs text-content-secondary">You&apos;ve reached the end of this channel</p>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
