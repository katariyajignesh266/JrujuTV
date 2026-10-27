// src/app/channels/[channelId]/page.tsx
'use client';

import { use, useEffect, useState, useRef, useCallback } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, Tv2, Loader2, Clock, CheckCircle2 } from 'lucide-react';
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

        // Pure keyset URL — no page number fallback
        let url = `/api/channels/${channelId}/videos?pageSize=20`;
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
      pageRef.current = 1;
      fetchChannelVideos(1, false, null);
    }
  }, [channelId, fetchChannelVideos]);

  // Predictive look-ahead pagination
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
      // Incremental if already complete, full-resume if still in progress
      const isIncremental = channel.sync_status === 'complete';
      await syncChannel(channel.id, isIncremental);
      nextCursorRef.current = null;
      pageRef.current = 1;
      await fetchChannelVideos(1, false, null);
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  // Derive three-state end-of-channel condition
  const syncStatus = channel?.sync_status ?? 'complete'; // default to 'complete' for legacy rows without column
  const syncedCount = channel?.synced_video_count ?? 0;
  const totalCount = channel?.total_video_count ?? channel?.video_count ?? 0;
  const isImporting = syncStatus === 'pending' || syncStatus === 'in_progress';
  const isGenuineEnd = !hasMore && !loading && videos.length > 0 && syncStatus === 'complete';
  const isImportingEnd = !hasMore && !loading && videos.length > 0 && isImporting;

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
                  {/* Sync status badge */}
                  {isImporting && (
                    <span className="flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                      <Loader2 size={10} className="animate-spin" />
                      Importing {syncedCount > 0 && totalCount > 0
                        ? `${syncedCount.toLocaleString()} / ${totalCount.toLocaleString()}`
                        : 'videos'}…
                    </span>
                  )}
                  {syncStatus === 'complete' && (
                    <span className="flex items-center gap-1 px-3 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      <CheckCircle2 size={10} />
                      Fully synced
                    </span>
                  )}
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
                    <RefreshCw
                      size={16}
                      className={cn(isSyncing && 'animate-spin text-brand-primary')}
                    />
                    <span>
                      {isSyncing
                        ? 'Syncing…'
                        : isImporting
                        ? 'Continue Import'
                        : 'Sync Videos'}
                    </span>
                  </button>
                </div>
              )}
            </div>

            {/* Inline progress bar for importing channels */}
            {isImporting && syncedCount > 0 && totalCount > 0 && (
              <div className="mt-4 space-y-1.5">
                <div className="flex justify-between text-[11px] text-content-secondary">
                  <span>Import progress</span>
                  <span>{Math.round((syncedCount / totalCount) * 100)}%</span>
                </div>
                <div className="h-1.5 bg-amber-500/10 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-amber-500 rounded-full transition-all duration-700"
                    style={{ width: `${Math.min(100, Math.round((syncedCount / totalCount) * 100))}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        ) : loading ? (
          <div className="h-32 rounded-3xl bg-surface-secondary animate-pulse" />
        ) : null}

        {/* Video List Section — Virtualized with look-ahead pagination */}
        <div className="space-y-4">
          <h2 className="font-semibold text-fluid-lg text-content-primary">
            Uploaded Videos {videos.length > 0 && `(${videos.length.toLocaleString()}${hasMore ? '+' : ''})`}
          </h2>

          {loading ? (
            <div className="-mx-3 sm:-mx-4 md:mx-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-0 sm:gap-4 gap-y-6">
              <VideoCardSkeleton count={8} />
            </div>
          ) : videos.length === 0 && syncStatus === 'complete' ? (
            <div className="flex flex-col items-center justify-center p-12 text-center rounded-3xl bg-surface-secondary border border-border space-y-2">
              <Tv2 className="h-10 w-10 text-content-secondary mb-1" />
              <p className="font-semibold text-content-primary">No videos found</p>
              <p className="text-fluid-sm text-content-secondary">
                This channel does not have any videos over 5 minutes yet.
              </p>
            </div>
          ) : videos.length === 0 && isImporting ? (
            <div className="flex flex-col items-center justify-center p-12 text-center rounded-3xl bg-surface-secondary border border-border space-y-2">
              <Loader2 className="h-10 w-10 text-brand-primary animate-spin mb-1" />
              <p className="font-semibold text-content-primary">Importing videos…</p>
              <p className="text-fluid-sm text-content-secondary">
                Videos will appear here as they are imported. Large channels may take a few minutes.
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

          {/* THREE-STATE END MESSAGES */}

          {/* State 1: Still importing — DB is not yet complete */}
          {isImportingEnd && (
            <div className="pt-6 pb-4 flex flex-col items-center gap-2">
              <div className="flex items-center gap-2 text-amber-500">
                <Clock size={15} />
                <p className="text-xs font-medium text-amber-600 dark:text-amber-400">
                  Importing videos… more will appear as the import progresses
                </p>
              </div>
              {syncedCount > 0 && totalCount > 0 && (
                <p className="text-[11px] text-content-secondary">
                  {syncedCount.toLocaleString()} of {totalCount.toLocaleString()} videos processed
                </p>
              )}
            </div>
          )}

          {/* State 2: Genuine end — fully synced AND no more DB rows */}
          {isGenuineEnd && (
            <div className="pt-6 pb-4 flex justify-center">
              <p className="text-xs text-content-secondary">
                You&apos;ve reached the end of this channel
              </p>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
