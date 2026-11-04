'use client';

import { use, useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Share2, Check, Sparkles, Tv2, Loader2 } from 'lucide-react';
import { PageShell } from '@/components/layout/PageShell';
import { YouTubePlayer } from '@/components/video/YouTubePlayer';
import { VideoCard, VideoCardSkeleton } from '@/components/cards/VideoCard';
import { Video } from '@/types/content';
import { useAuthStore } from '@/store/authStore';
import { createClient } from '@/lib/supabase/client';
import { cn } from '@/lib/cn';
import { formatViewCount, formatRelativeTime, formatCompactNumber } from '@/lib/formatters';

function VideoPlaybackContent({ videoId }: { videoId: string }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { role, user, session } = useAuthStore();

  const [video, setVideo] = useState<Video | null>(null);
  const [channel, setChannel] = useState<any | null>(null);
  const [moreFromChannel, setMoreFromChannel] = useState<Video[]>([]);
  const [upNext, setUpNext] = useState<Video[]>([]);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [copied, setCopied] = useState(false);
  const [startAt, setStartAt] = useState<number | undefined>(undefined);

  useEffect(() => {
    let isMounted = true;
    async function loadVideoDetails() {
      try {
        setLoading(true);
        setNotFound(false);
        const headers: Record<string, string> = {};
        if (session?.access_token) {
          headers['Authorization'] = `Bearer ${session.access_token}`;
        }
        const res = await fetch(`/api/videos/${videoId}`, { headers });
        if (!res.ok) {
          if (isMounted) {
            setNotFound(true);
          }
          return;
        }
        const data = await res.json();
        if (isMounted) {
          if (data.video) {
            setVideo(data.video);
            setNotFound(false);
          } else {
            setNotFound(true);
          }
          if (data.channel) setChannel(data.channel);
          if (data.moreFromChannel) setMoreFromChannel(data.moreFromChannel);
          if (data.upNext) setUpNext(data.upNext);
        }
      } catch (err) {
        console.error('Failed to load video details:', err);
        if (isMounted) setNotFound(true);
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
  }, [videoId, session?.access_token]);

  // Handle resume position
  useEffect(() => {
    const resumeParam = searchParams.get('resume');
    if (resumeParam) {
      const parsed = parseInt(resumeParam, 10);
      if (!isNaN(parsed) && parsed > 0) {
        setStartAt(parsed);
        return;
      }
    }

    // If no URL resume param, fetch saved position for child viewers
    if (role === 'child' && user?.id && video?.id) {
      const fetchResume = async () => {
        try {
          const supabase = createClient();
          const { data, error } = await supabase.rpc('get_child_watch_resume_position', {
            p_child_id: user.id,
            p_video_id: video.id,
          });
          if (!error && data && typeof (data as any).absolute_position === 'number') {
            const pos = (data as any).absolute_position;
            const pct = (data as any).progress_percent ?? 0;
            if (pos > 5 && pct < 95) {
              setStartAt(Math.floor(pos));
            }
          }
        } catch {
          // ignore
        }
      };
      fetchResume();
    }
  }, [searchParams, role, user?.id, video?.id]);

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

  const isDirectYtId = /^[a-zA-Z0-9_-]{11}$/.test(videoId);
  const activeYtId = video?.youtube_video_id || (isDirectYtId ? videoId : null);

  const handleBack = () => {
    if (typeof window !== 'undefined' && window.history.length > 1) {
      router.back();
    } else {
      router.push('/');
    }
  };

  // Filter recommendations: exclude current playing video
  const filteredUpNext = upNext.filter(
    (v) => v.id !== video?.id && v.youtube_video_id !== activeYtId
  );
  const filteredMoreFromChannel = moreFromChannel.filter(
    (v) => v.id !== video?.id && v.youtube_video_id !== activeYtId
  );

  return (
    <PageShell fullWidth>
      <div className="w-full max-w-[1720px] mx-auto pb-20">
        {/* Top Back navigation bar */}
        <div className="flex items-center justify-between mb-3.5">
          <button
            type="button"
            onClick={handleBack}
            className="inline-flex items-center gap-1.5 p-2 -ml-2 rounded-2xl text-content-secondary hover:text-content-primary hover:bg-neutral-900/5 dark:hover:bg-white/[0.06] transition-colors"
          >
            <ArrowLeft size={19} />
            <span className="text-fluid-sm font-medium">Back</span>
          </button>

          <button
            type="button"
            onClick={handleShare}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-surface-secondary/70 border border-border/80 text-xs font-semibold text-content-secondary hover:text-content-primary transition-colors"
          >
            {copied ? <Check size={14} className="text-emerald-500" /> : <Share2 size={14} />}
            <span>{copied ? 'Link Copied!' : 'Share'}</span>
          </button>
        </div>

        {/* ── Main YouTube-Style Layout: 2 columns on xl+ (or lg+ with 68/32 split), 1 column on tablet/mobile ── */}
        <div className="flex flex-col xl:flex-row gap-6 xl:gap-7 items-start">
          {/* ── Left Side: Primary Player & Info ── */}
          <div className="w-full xl:flex-1 min-w-0 space-y-4">
            {/* Player Container */}
            <div className="-mx-3 sm:-mx-4 md:mx-0 rounded-none md:rounded-3xl overflow-hidden shadow-sm md:shadow-xl md:border md:border-border/70 bg-black">
              <div className="w-full max-h-[calc(100dvh-56px-70px)] aspect-video flex items-center justify-center">
                {activeYtId ? (
                  <YouTubePlayer
                    videoId={activeYtId}
                    title={video?.title}
                    autoplay={true}
                    childId={role === 'child' ? user?.id : undefined}
                    videoDbId={video?.id}
                    channelId={video?.channel_id || channel?.id}
                    accessToken={session?.access_token}
                    startAt={startAt}
                  />
                ) : (
                  <div className="w-full h-full aspect-video bg-surface-secondary flex flex-col items-center justify-center rounded-none md:rounded-3xl overflow-hidden">
                    {notFound ? (
                      <div className="text-center p-6 space-y-3">
                        <p className="text-content-primary font-semibold text-fluid-base">Video not found or unavailable</p>
                        <p className="text-fluid-xs text-content-secondary max-w-sm">
                          This video could not be loaded. It may have been removed or is temporarily unavailable.
                        </p>
                        <button
                          type="button"
                          onClick={handleBack}
                          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-elevated text-xs font-semibold text-content-primary border border-border hover:bg-surface-secondary transition-colors"
                        >
                          <ArrowLeft size={14} />
                          <span>Go Back</span>
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Loader2 className="h-10 w-10 text-brand-primary animate-spin" />
                        <span className="text-fluid-xs text-content-secondary">Loading player…</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Title & Channel Information */}
            {video ? (
              <div className="space-y-3 pt-1">
                <h1 className="font-display font-bold text-fluid-lg sm:text-xl md:text-2xl text-content-primary leading-snug">
                  {video.title}
                </h1>

                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-2xl md:rounded-3xl bg-surface-secondary/70 border border-border/80">
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
                        {channel?.subscriber_count ? `${formatCompactNumber(channel.subscriber_count)} subscribers` : 'Parent approved'}
                      </p>
                    </div>
                  </Link>

                  {/* Stats badge */}
                  <div className="flex items-center gap-3 text-xs text-content-secondary pl-1 sm:pl-0">
                    {video.view_count !== undefined && (
                      <span>{formatViewCount(video.view_count)}</span>
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
            ) : (!loading && !notFound) ? (
              <div className="space-y-4 pt-1">
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

            {/* "More from this Channel" section */}
            {filteredMoreFromChannel.length > 0 && (
              <div className="space-y-3 pt-6 border-t border-border">
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
                  {filteredMoreFromChannel.slice(0, 6).map((v) => (
                    <VideoCard key={v.id} video={v} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Right Side: Up Next Sticky Sidebar (fixed 380px-410px width on desktop) ── */}
          <div className="w-full xl:w-[380px] 2xl:w-[410px] shrink-0 min-w-0">
            <aside
              aria-label="Recommended videos"
              className="xl:sticky xl:top-2 space-y-3 xl:max-h-[calc(100dvh-56px-24px)] xl:overflow-y-auto xl:pr-1.5 scrollbar-hide"
            >
              <div className="flex items-center justify-between pb-1 border-b border-border/40">
                <h2 className="font-semibold text-[14px] text-content-primary flex items-center gap-1.5">
                  <Sparkles size={16} className="text-amber-500" /> Up Next
                </h2>
                <span className="text-[11px] font-medium text-content-secondary">
                  Curated &amp; Safe
                </span>
              </div>

              {loading ? (
                <div className="space-y-2.5">
                  <VideoCardSkeleton count={7} layout="row" />
                </div>
              ) : filteredUpNext.length > 0 ? (
                <div className="space-y-2.5">
                  {filteredUpNext.map((v) => (
                    <VideoCard key={v.id} video={v} layout="row" />
                  ))}
                </div>
              ) : (
                <div className="p-6 rounded-2xl bg-surface-secondary/50 border border-border/60 text-center space-y-2">
                  <p className="text-xs font-medium text-content-secondary">No other recommended videos in this category.</p>
                </div>
              )}
            </aside>
          </div>
        </div>
      </div>
    </PageShell>
  );
}

export default function VideoPlaybackPage({
  params,
}: {
  params: Promise<{ videoId: string }>;
}) {
  const { videoId } = use(params);

  return (
    <Suspense
      fallback={
        <PageShell fullWidth>
          <div className="w-full max-w-[1720px] mx-auto space-y-6 pb-20">
            <div className="w-full aspect-video bg-surface-secondary animate-pulse rounded-3xl" />
          </div>
        </PageShell>
      }
    >
      <VideoPlaybackContent videoId={videoId} />
    </Suspense>
  );
}
