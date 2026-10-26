'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, RefreshCw, Tv2, Loader2 } from 'lucide-react';
import { PageShell } from '@/components/layout/PageShell';
import { VideoCard, VideoCardSkeleton } from '@/components/cards/VideoCard';
import { useAuthStore } from '@/store/authStore';
import { Channel, Video } from '@/types/content';
import { syncChannel } from '@/lib/api/channels';
import { cn } from '@/lib/cn';

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

  const fetchChannelVideos = async (pageNum: number = 1, append: boolean = false) => {
    try {
      if (pageNum === 1) setLoading(true);
      else setLoadingMore(true);

      const res = await fetch(`/api/channels/${channelId}/videos?page=${pageNum}&pageSize=20`);
      const data = await res.json();

      if (data.channel) setChannel(data.channel);
      if (append) {
        setVideos((prev) => [...prev, ...(data.videos || [])]);
      } else {
        setVideos(data.videos || []);
      }
      setHasMore(data.hasMore || false);
      setPage(pageNum);
    } catch (err) {
      console.error('Failed to load channel videos:', err);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  };

  useEffect(() => {
    if (channelId) {
      fetchChannelVideos(1, false);
    }
  }, [channelId]);

  const handleManualSync = async () => {
    if (!channel) return;
    setIsSyncing(true);
    try {
      await syncChannel(channel.id);
      await fetchChannelVideos(1, false);
    } catch (err) {
      console.error('Sync failed:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <PageShell>
      <div className="max-w-5xl mx-auto space-y-6 pb-16">
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
                  <img src={channel.thumbnail_url} alt={channel.title} className="h-full w-full object-cover" />
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
                  {channel.subscriber_count > 0 && `${channel.subscriber_count.toLocaleString()} subscribers`}
                  {channel.subscriber_count > 0 && channel.video_count > 0 && ' · '}
                  {channel.video_count > 0 && `${channel.video_count.toLocaleString()} videos`}
                </p>
                <div className="pt-1 flex flex-wrap items-center justify-center sm:justify-start gap-2">
                  <span className="px-3 py-1 rounded-full text-[11px] font-semibold bg-brand-primary/10 text-brand-primary border border-brand-primary/20">
                    Safe Curated Content
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

        {/* Video List Section */}
        <div className="space-y-4">
          <h2 className="font-semibold text-fluid-lg text-content-primary">
            Uploaded Videos {videos.length > 0 && `(${videos.length})`}
          </h2>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 gap-y-6">
              <VideoCardSkeleton count={8} />
            </div>
          ) : videos.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-12 text-center rounded-3xl bg-surface-secondary border border-border space-y-2">
              <Tv2 className="h-10 w-10 text-content-secondary mb-1" />
              <p className="font-semibold text-content-primary">No videos found</p>
              <p className="text-fluid-sm text-content-secondary">
                This channel does not have any cached videos yet.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 gap-y-6">
              {videos.map((vid) => (
                <VideoCard key={vid.id} video={vid} />
              ))}
            </div>
          )}

          {/* Load More Button */}
          {hasMore && (
            <div className="pt-6 flex justify-center">
              <button
                type="button"
                onClick={() => fetchChannelVideos(page + 1, true)}
                disabled={loadingMore}
                className={cn(
                  'px-6 py-2.5 rounded-2xl text-fluid-sm font-semibold',
                  'bg-surface-secondary border border-border text-content-primary',
                  'hover:bg-surface-elevated active:scale-95 transition-all disabled:opacity-50',
                  'flex items-center gap-2'
                )}
              >
                {loadingMore ? (
                  <>
                    <Loader2 size={16} className="animate-spin text-brand-primary" />
                    <span>Loading more…</span>
                  </>
                ) : (
                  <span>Load More Videos</span>
                )}
              </button>
            </div>
          )}
        </div>
      </div>
    </PageShell>
  );
}
