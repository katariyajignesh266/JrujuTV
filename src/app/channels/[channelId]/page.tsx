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
  const importPercent = totalCount > 0 ? Math.min(100, Math.round((syncedCount / totalCount) * 100)) : 0;
  const isGenuineEnd = !hasMore && !loading && videos.length > 0 && syncStatus === 'complete';
  const isImportingEnd = !hasMore && !loading && videos.length > 0 && isImporting;

  return (
    <PageShell>
      <div className="max-w-7xl mx-auto space-y-5 pb-16">
        {/* Top Navigation + Parent Sync Action */}
        <div className="flex items-center justify-between gap-3">
          <Link
            href="/channels"
            className={cn(
              'inline-flex items-center gap-2 min-h-[40px] px-3.5 py-2 rounded-full text-sm font-semibold',
              'text-[var(--color-text-primary)] bg-[var(--color-bg-elevated)] border border-[var(--color-border)]',
              'hover:border-[#903d30]/50 dark:hover:border-[#f2b59a]/50',
              'active:scale-95 transition-all duration-150 shadow-xs'
            )}
          >
            <ArrowLeft size={16} />
            <span>All Channels</span>
          </Link>

          {channel && role === 'parent' && (
            <button
              type="button"
              onClick={handleManualSync}
              disabled={isSyncing}
              className={cn(
                'inline-flex items-center gap-2 min-h-[40px] px-4 py-2 rounded-full text-xs sm:text-sm font-semibold',
                'bg-[#74382f] text-[#fff7ef] dark:bg-[#f1c1a6] dark:text-[#342129]',
                'hover:opacity-90 active:scale-95 transition-all disabled:opacity-50 shadow-xs'
              )}
            >
              <RefreshCw
                size={14}
                className={cn(isSyncing && 'animate-spin')}
              />
              <span>
                {isSyncing
                  ? 'Syncing…'
                  : isImporting
                  ? 'Continue Import'
                  : 'Sync Videos'}
              </span>
            </button>
          )}
        </div>

        {/* Premium Editorial Channel Header Card */}
        {channel ? (
          <div className="relative overflow-hidden rounded-3xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] shadow-md p-5 sm:p-7">
            {/* Subtle editorial gradient wash */}
            <div
              className="absolute inset-0 pointer-events-none opacity-60 dark:opacity-40"
              style={{
                background:
                  'radial-gradient(ellipse at top right, rgba(229,57,53,0.09), transparent 55%), radial-gradient(ellipse at bottom left, rgba(255,143,0,0.06), transparent 55%)',
              }}
            />
            {/* Top accent bar */}
            <div className="absolute top-0 left-0 right-0 h-[3px] bg-gradient-to-r from-[#903d30] via-[#E53935] to-[#FF8F00]" />

            <div className="relative flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-6 min-w-0">
              {/* Channel Avatar */}
              <div className="relative shrink-0">
                <div className="h-20 w-20 sm:h-24 sm:w-24 rounded-full overflow-hidden bg-[var(--color-bg-secondary)] border-2 border-[#903d30]/30 dark:border-[#f2b59a]/30 shadow-md">
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
                    <div className="h-full w-full flex items-center justify-center font-bold text-2xl sm:text-3xl text-[#903d30] dark:text-[#f2b59a] bg-red-500/10">
                      {channel.title.charAt(0)}
                    </div>
                  )}
                </div>
              </div>

              {/* Channel Copy — full width + clean wrapping so long names never clip */}
              <div className="w-full flex-1 min-w-0 text-center sm:text-left space-y-2">
                <h1 className="font-display font-bold text-xl sm:text-3xl text-[var(--color-text-primary)] tracking-tight leading-snug break-words line-clamp-2">
                  {channel.title}
                </h1>

                <p className="text-xs sm:text-sm text-[var(--color-text-secondary)] font-medium">
                  {channel.subscriber_count > 0 &&
                    `${formatCompactNumber(channel.subscriber_count)} subscribers`}
                  {channel.subscriber_count > 0 && channel.video_count > 0 && ' · '}
                  {channel.video_count > 0 &&
                    `${formatCompactNumber(channel.video_count)} videos`}
                </p>

                <div className="pt-1 flex flex-wrap items-center justify-center sm:justify-start gap-1.5 sm:gap-2">
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-semibold bg-red-500/10 text-[#903d30] dark:text-[#f2b59a] border border-red-500/20">
                    Safe Curated
                  </span>
                  <span className="px-2.5 py-1 rounded-full text-[11px] font-medium bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] border border-[var(--color-border)]">
                    5+ Min Long Form
                  </span>
                  {isImporting && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                      <Loader2 size={10} className="animate-spin shrink-0" />
                      <span>
                        Importing {syncedCount > 0 ? syncedCount.toLocaleString() : ''} videos…
                      </span>
                    </span>
                  )}
                  {syncStatus === 'complete' && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                      <CheckCircle2 size={10} className="shrink-0" />
                      <span>Synced</span>
                    </span>
                  )}
                </div>
              </div>
            </div>

            {/* Import progress bar (clamped to 0..100%) */}
            {isImporting && syncedCount > 0 && totalCount > 0 && (
              <div className="mt-5 pt-4 border-t border-[var(--color-border)]/70 space-y-1.5">
                <div className="flex justify-between text-[11px] text-[var(--color-text-secondary)]">
                  <span>Import progress ({syncedCount.toLocaleString()} synced)</span>
                  <span className="font-semibold text-[var(--color-text-primary)] tabular-nums">
                    {importPercent}%
                  </span>
                </div>
                <div className="h-1.5 bg-[var(--color-bg-secondary)] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-amber-400 to-amber-500 rounded-full transition-all duration-700"
                    style={{ width: `${importPercent}%` }}
                  />
                </div>
              </div>
            )}
          </div>
        ) : loading ? (
          <div className="h-40 rounded-3xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] animate-pulse" />
        ) : null}

        {/* Video List Section — Virtualized with look-ahead pagination */}
        <div className="space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <h2 className="font-display font-bold text-lg sm:text-xl text-[var(--color-text-primary)] tracking-tight">
                Uploaded Videos
              </h2>
              {videos.length > 0 && (
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-red-500/10 text-[#903d30] dark:text-[#f2b59a] border border-red-500/20 tabular-nums">
                  {videos.length.toLocaleString()}{hasMore ? '+' : ''}
                </span>
              )}
            </div>
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
