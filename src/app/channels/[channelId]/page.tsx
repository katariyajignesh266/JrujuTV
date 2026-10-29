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
  const [fetchError, setFetchError] = useState<string | null>(null);

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
        setFetchError(null);
      } catch (err: any) {
        console.error('Failed to load channel videos:', err);
        setFetchError(err?.message || 'Failed to load videos. Tap to retry.');
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

  // Pagination callback — triggered by VirtualizedVideoGrid's built-in
  // scroll-position-aware detection when the user approaches the end of loaded content
  const handleLoadMore = useCallback(() => {
    if (loadingMore || !hasMore) return;
    setFetchError(null);
    const nextPage = pageRef.current + 1;
    fetchChannelVideos(nextPage, true, nextCursorRef.current);
  }, [loadingMore, hasMore, fetchChannelVideos]);

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
        {/* Navigation */}
        <div className="flex items-center gap-2">
          <Link
            href="/channels"
            className={cn(
              'inline-flex items-center gap-2 px-3.5 py-2 rounded-2xl text-sm font-semibold',
              'text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-white',
              'bg-white dark:bg-white/[0.05] border border-neutral-200 dark:border-white/[0.08]',
              'hover:border-neutral-300 dark:hover:border-red-400/30 hover:bg-neutral-50 dark:hover:bg-white/[0.08]',
              'active:scale-95 transition-all duration-150 shadow-xs'
            )}
          >
            <ArrowLeft size={16} />
            <span>All Channels</span>
          </Link>
        </div>

        {/* Channel Banner / Header Card */}
        {channel ? (
          <div className="relative overflow-hidden rounded-3xl bg-white dark:bg-[#1a1a2e]/80 backdrop-blur-xl border border-neutral-200 dark:border-white/[0.07] shadow-lg p-6 sm:p-7">
            {/* Decorative corner glow */}
            <div className="absolute -top-10 -right-10 h-40 w-40 rounded-full bg-red-500/10 dark:bg-red-500/15 blur-3xl pointer-events-none" />
            {/* Top accent line */}
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-red-500 via-rose-400 to-red-600 rounded-t-3xl" />

            <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-5">
              {/* Avatar with glow ring */}
              <div className="relative shrink-0">
                <div className="absolute -inset-2 rounded-full bg-gradient-to-br from-red-500/20 to-rose-500/20 blur-md opacity-60" />
                <div className="relative h-24 w-24 rounded-full overflow-hidden bg-neutral-100 dark:bg-white/[0.05] border-2 border-red-400/40 shadow-xl">
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
                    <div className="h-full w-full flex items-center justify-center font-bold text-3xl text-red-500 bg-gradient-to-br from-red-500/10 to-rose-500/10">
                      {channel.title.charAt(0)}
                    </div>
                  )}
                </div>
              </div>

              <div className="flex-1 text-center sm:text-left min-w-0 space-y-2">
                <h1 className="font-extrabold text-2xl sm:text-3xl text-neutral-900 dark:text-white tracking-tight truncate">
                  {channel.title}
                </h1>
                <p className="text-sm text-neutral-500 dark:text-neutral-400 font-medium">
                  {channel.subscriber_count > 0 &&
                    `${formatCompactNumber(channel.subscriber_count)} subscribers`}
                  {channel.subscriber_count > 0 && channel.video_count > 0 && ' · '}
                  {channel.video_count > 0 &&
                    `${formatCompactNumber(channel.video_count)} videos`}
                </p>
                <div className="pt-0.5 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <span className="px-3 py-1 rounded-full text-[11px] font-semibold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                    Safe Curated Content
                  </span>
                  <span className="px-3 py-1 rounded-full text-[11px] font-medium bg-neutral-100 dark:bg-white/[0.06] text-neutral-600 dark:text-neutral-400 border border-neutral-200 dark:border-white/[0.08]">
                    5+ Min Long Form
                  </span>
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

              {/* Parent sync button */}
              {role === 'parent' && (
                <div className="shrink-0 mt-2 sm:mt-0">
                  <button
                    type="button"
                    onClick={handleManualSync}
                    disabled={isSyncing}
                    className={cn(
                      'inline-flex items-center gap-2 px-4 py-2.5 rounded-2xl text-sm font-semibold',
                      'bg-neutral-100 dark:bg-white/[0.06] border border-neutral-200 dark:border-white/[0.08]',
                      'text-neutral-700 dark:text-neutral-200',
                      'hover:border-red-400/40 dark:hover:border-red-400/30 hover:bg-red-500/5 dark:hover:bg-red-500/10',
                      'active:scale-95 transition-all disabled:opacity-50 shadow-xs'
                    )}
                  >
                    <RefreshCw
                      size={15}
                      className={cn(isSyncing && 'animate-spin text-red-500 dark:text-red-400')}
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

            {/* Import progress bar */}
            {isImporting && syncedCount > 0 && totalCount > 0 && (
              <div className="mt-5 space-y-2">
                <div className="flex justify-between text-[11px] text-neutral-500 dark:text-neutral-400">
                  <span>Import progress</span>
                  <span className="font-semibold text-neutral-700 dark:text-neutral-200">{Math.round((syncedCount / totalCount) * 100)}%</span>
                </div>
                <div className="h-2 bg-neutral-100 dark:bg-white/[0.06] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-700 shadow-sm"
                    style={{ width: `${Math.min(100, Math.round((syncedCount / totalCount) * 100))}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        ) : loading ? (
          <div className="h-36 rounded-3xl bg-neutral-100 dark:bg-white/[0.04] border border-neutral-200 dark:border-white/[0.06] animate-pulse" />
        ) : null}

        {/* Video List Section — Virtualized with look-ahead pagination */}
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <h2 className="font-bold text-xl text-neutral-900 dark:text-white tracking-tight">
              Uploaded Videos
            </h2>
            {videos.length > 0 && (
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20">
                {videos.length.toLocaleString()}{hasMore ? '+' : ''}
              </span>
            )}
          </div>

          {loading ? (
            <div className="-mx-3 sm:-mx-4 md:mx-0 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-0 sm:gap-4 gap-y-6">
              <VideoCardSkeleton count={8} />
            </div>
          ) : videos.length === 0 && syncStatus === 'complete' ? (
            <div className="flex flex-col items-center justify-center p-12 text-center rounded-3xl bg-white dark:bg-white/[0.04] border border-neutral-200 dark:border-white/[0.06] space-y-3">
              <div className="h-16 w-16 rounded-2xl bg-neutral-100 dark:bg-white/[0.06] flex items-center justify-center mb-1">
                <Tv2 className="h-8 w-8 text-neutral-400 dark:text-neutral-500" />
              </div>
              <p className="font-bold text-neutral-900 dark:text-white text-lg">No videos found</p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-xs">
                This channel does not have any videos over 5 minutes yet.
              </p>
            </div>
          ) : videos.length === 0 && isImporting ? (
            <div className="flex flex-col items-center justify-center p-12 text-center rounded-3xl bg-white dark:bg-white/[0.04] border border-neutral-200 dark:border-white/[0.06] space-y-3">
              <div className="h-16 w-16 rounded-2xl bg-red-500/10 flex items-center justify-center mb-1">
                <Loader2 className="h-8 w-8 text-red-500 animate-spin" />
              </div>
              <p className="font-bold text-neutral-900 dark:text-white text-lg">Importing videos…</p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 max-w-xs">
                Videos will appear here as they are imported. Large channels may take a few minutes.
              </p>
            </div>
          ) : (
            <VirtualizedVideoGrid
              videos={videos}
              onLoadMore={handleLoadMore}
              hasMore={hasMore}
              isLoading={loadingMore}
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

          {/* Fetch error with retry (Fix 4.4) */}
          {fetchError && !loading && !loadingMore && (
            <div className="pt-6 pb-4 flex flex-col items-center gap-3">
              <p className="text-fluid-sm text-red-500 dark:text-red-400 font-medium">
                {fetchError}
              </p>
              <button
                type="button"
                onClick={handleLoadMore}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-fluid-sm font-semibold bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20 hover:bg-red-500/20 active:scale-95 transition-all"
              >
                <RefreshCw size={14} />
                <span>Retry</span>
              </button>
            </div>
          )}

          {/* Manual load-more fallback — visible when auto-pagination hasn't triggered (Fix 4.4) */}
          {hasMore && !loadingMore && !loading && !fetchError && (
            <div className="pt-4 pb-2 flex justify-center">
              <button
                type="button"
                onClick={handleLoadMore}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-fluid-sm font-semibold bg-surface-secondary border border-border text-content-secondary hover:border-brand-primary/50 hover:text-brand-primary active:scale-95 transition-all"
              >
                <span>Load More Videos</span>
              </button>
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
