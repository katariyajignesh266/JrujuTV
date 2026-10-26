'use client';

import { use, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Share2, Check, Sparkles, Tv2, Loader2 } from 'lucide-react';
import { PageShell } from '@/components/layout/PageShell';
import { YouTubePlayer } from '@/components/video/YouTubePlayer';
import { VideoCard } from '@/components/cards/VideoCard';
import { Video } from '@/types/content';
import { cn } from '@/lib/cn';

function formatRelativeTime(dateStr?: string | null): string {
  if (!dateStr) return '';
  const now = new Date();
  const date = new Date(dateStr);
  const diffInDays = Math.floor((now.getTime() - date.getTime()) / (1000 * 60 * 60 * 24));
  if (diffInDays < 1) return 'Today';
  if (diffInDays === 1) return 'Yesterday';
  if (diffInDays < 30) return `${diffInDays} days ago`;
  if (diffInDays < 365) return `${Math.floor(diffInDays / 30)} months ago`;
  return `${Math.floor(diffInDays / 365)} years ago`;
}

export default function VideoPlaybackPage({
  params,
}: {
  params: Promise<{ videoId: string }>;
}) {
  const { videoId } = use(params);
  const router = useRouter();

  const [video, setVideo] = useState<Video | null>(null);
  const [channel, setChannel] = useState<any | null>(null);
  const [moreFromChannel, setMoreFromChannel] = useState<Video[]>([]);
  const [upNext, setUpNext] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let isMounted = true;
    async function loadVideoDetails() {
      try {
        setLoading(true);
        const res = await fetch(`/api/videos/${videoId}`);
        const data = await res.json();
        if (isMounted) {
          if (data.video) setVideo(data.video);
          if (data.channel) setChannel(data.channel);
          if (data.moreFromChannel) setMoreFromChannel(data.moreFromChannel);
          if (data.upNext) setUpNext(data.upNext);
        }
      } catch (err) {
        console.error('Failed to load video details:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (videoId) {
      loadVideoDetails();
    }
    return () => {
      isMounted = false;
    };
  }, [videoId]);

  const handleShare = async () => {
    if (typeof window !== 'undefined') {
      try {
        await navigator.clipboard.writeText(window.location.href);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      } catch {
        // fallback
      }
    }
  };

  const activeYtId = video?.youtube_video_id || videoId;

  return (
    <PageShell>
      <div className="max-w-6xl mx-auto space-y-6 pb-20">
        {/* Back navigation */}
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => router.back()}
            className="inline-flex items-center gap-1.5 p-2 -ml-2 rounded-2xl text-content-secondary hover:text-content-primary hover:bg-surface-secondary transition-colors"
          >
            <ArrowLeft size={20} />
            <span className="text-fluid-sm font-medium">Back</span>
          </button>

          <button
            type="button"
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-secondary border border-border text-xs font-semibold text-content-secondary hover:text-content-primary transition-colors"
          >
            {copied ? <Check size={14} className="text-emerald-500" /> : <Share2 size={14} />}
            <span>{copied ? 'Link Copied!' : 'Share'}</span>
          </button>
        </div>

        {/* ── 1. The Custom YouTube-Redirect-Proof Player ── */}
        {/* Item 7: Negative margin to cancel PageShell padding — player touches screen edges */}
        <div className="-mx-3 sm:-mx-4 md:-mx-6">
          {activeYtId ? (
            <YouTubePlayer videoId={activeYtId} title={video?.title} autoplay={true} />
          ) : (
            <div className="w-full aspect-video bg-surface-secondary animate-pulse flex items-center justify-center">
              <Loader2 className="h-10 w-10 text-brand-primary animate-spin" />
            </div>
          )}
        </div>

        {/* ── 2. Video Title & Channel Meta ── */}
        {video ? (
          <div className="space-y-4 pt-1">
            {/* Item 10: Reduced from text-fluid-xl to text-fluid-lg for a more premium, less dominant look */}
            <h1 className="font-display font-bold text-fluid-lg text-content-primary leading-snug">
              {video.title}
            </h1>

            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-3xl bg-surface-secondary border border-border">
              {/* Channel Info */}
              <Link
                href={channel?.id ? `/channels/${channel.id}` : '#'}
                className="flex items-center gap-3 group focus:outline-none"
              >
                <div className="relative h-12 w-12 rounded-full overflow-hidden bg-surface-elevated border border-border shrink-0">
                  {channel?.thumbnail_url ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={channel.thumbnail_url} alt={channel.title} className="h-full w-full object-cover" />
                  ) : (
                    <div className="h-full w-full flex items-center justify-center font-bold text-brand-primary">
                      {channel?.title?.charAt(0) || 'C'}
                    </div>
                  )}
                </div>

                <div>
                  <h3 className="font-semibold text-fluid-base text-content-primary group-hover:text-brand-primary transition-colors flex items-center gap-1.5">
                    <span>{channel?.title || video.channelName || 'Curated Channel'}</span>
                  </h3>
                  <p className="text-[11.5px] text-content-secondary">
                    {channel?.subscriber_count ? `${channel.subscriber_count.toLocaleString()} subscribers` : 'Parent approved'}
                  </p>
                </div>
              </Link>

              {/* Stats badge */}
              <div className="flex items-center gap-3 text-xs text-content-secondary pl-1 sm:pl-0">
                {video.view_count !== undefined && (
                  <span>{video.view_count.toLocaleString()} views</span>
                )}
                {video.published_at && (
                  <>
                    <span>·</span>
                    <span>{formatRelativeTime(video.published_at)}</span>
                  </>
                )}
                <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                  Child Safe
                </span>
              </div>
            </div>
          </div>
        ) : !loading ? (
          <div className="space-y-4 pt-1">
            {/* Item 10: Reduced from text-fluid-xl to text-fluid-lg */}
            <h1 className="font-display font-bold text-fluid-lg text-content-primary leading-snug">
              Curated Video Playback
            </h1>
            <div className="flex items-center justify-between p-4 rounded-3xl bg-surface-secondary border border-border">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-full bg-brand-primary/10 flex items-center justify-center font-bold text-brand-primary">
                  <Tv2 size={20} />
                </div>
                <div>
                  <h3 className="font-semibold text-fluid-base text-content-primary">Approved Content</h3>
                  <p className="text-[11.5px] text-content-secondary">Redirect-proof child player</p>
                </div>
              </div>
              <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-500 border border-emerald-500/20">
                Child Safe
              </span>
            </div>
          </div>
        ) : loading ? (
          <div className="space-y-3 pt-2">
            <div className="h-6 w-3/4 rounded bg-surface-secondary animate-pulse" />
            <div className="h-16 rounded-3xl bg-surface-secondary animate-pulse" />
          </div>
        ) : null}

        {/* ── 3. More from this Channel ── */}
        {moreFromChannel.length > 0 && (
          <div className="space-y-3 pt-4 border-t border-border">
            <div className="flex items-center justify-between">
              <h2 className="font-semibold text-fluid-lg text-content-primary flex items-center gap-2">
                <Tv2 size={18} className="text-brand-primary" /> More from {channel?.title || 'this channel'}
              </h2>
              {channel?.id && (
                <Link
                  href={`/channels/${channel.id}`}
                  className="text-xs font-semibold text-brand-primary hover:underline"
                >
                  View all
                </Link>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {moreFromChannel.map((v) => (
                <VideoCard key={v.id} video={v} />
              ))}
            </div>
          </div>
        )}

        {/* ── 4. Up Next / Recommendations (Interleaved) ── */}
        {upNext.length > 0 && (
          <div className="space-y-3 pt-6 border-t border-border">
            <h2 className="font-semibold text-fluid-lg text-content-primary flex items-center gap-2">
              <Sparkles size={18} className="text-amber-500" /> Up Next (Recommended)
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 gap-y-6">
              {upNext.map((v) => (
                <VideoCard key={v.id} video={v} />
              ))}
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
