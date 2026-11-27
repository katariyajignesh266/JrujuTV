'use client';

import { use, useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { ArrowLeft, Share2, Check, Sparkles, Tv2, Loader2, ChevronRight } from 'lucide-react';
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
  const [avatarError, setAvatarError] = useState(false);
  const [mobileTab, setMobileTab] = useState<'more' | 'upnext'>('more');

  useEffect(() => {
    let isMounted = true;
    async function loadVideoDetails() {
      try {
        setLoading(true);
        setNotFound(false);
        setAvatarError(false);
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

  // Default mobile tab: show "More from channel" if available, otherwise "Up Next"
  useEffect(() => {
    if (filteredMoreFromChannel.length === 0 && filteredUpNext.length > 0) {
      setMobileTab('upnext');
    } else {
      setMobileTab('more');
    }
  }, [filteredMoreFromChannel.length, filteredUpNext.length, videoId]);

  const channelDisplayName = channel?.title || video?.channelName || 'Curated Channel';

  return (
    <PageShell fullWidth>
      <div className="w-full max-w-[1720px] mx-auto pb-20">
        {/* Top Action Bar: Back + Share */}
        <div className="flex items-center justify-between mb-3">
          <button
            type="button"
            onClick={handleBack}
            className={cn(
              'inline-flex items-center gap-2 min-h-[40px] px-3.5 py-2 rounded-full text-sm font-semibold',
              'bg-[var(--color-bg-elevated)] border border-[var(--color-border)]',
              'text-[var(--color-text-primary)] hover:border-[#903d30]/50 dark:hover:border-[#f2b59a]/50',
              'active:scale-95 transition-all shadow-xs'
            )}
          >
            <ArrowLeft size={16} />
            <span>Back</span>
          </button>

          <button
            type="button"
            onClick={handleShare}
            className={cn(
              'inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-full text-xs font-semibold',
              'bg-[var(--color-bg-elevated)] border border-[var(--color-border)]',
              'text-[var(--color-text-primary)] hover:border-[#903d30]/50 dark:hover:border-[#f2b59a]/50',
              'active:scale-95 transition-all shadow-xs'
            )}
          >
            {copied ? <Check size={14} className="text-emerald-500" /> : <Share2 size={14} />}
            <span>{copied ? 'Link Copied!' : 'Share'}</span>
          </button>
        </div>

        {/* ── Main Layout: 2 columns on xl+ (68/32 split), 1 column on tablet/mobile ── */}
        <div className="flex flex-col xl:flex-row gap-5 xl:gap-7 items-start">
          {/* ── Left Side: Player, Video Info & Channel Strip ── */}
          <div className="w-full xl:flex-1 min-w-0 space-y-4">
            {/* Player Container */}
            <div className="-mx-3 sm:-mx-4 md:mx-0 rounded-none md:rounded-3xl overflow-hidden shadow-sm md:shadow-xl md:border md:border-[var(--color-border)] bg-black">
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
                  <div className="w-full h-full aspect-video bg-[var(--color-bg-secondary)] flex flex-col items-center justify-center rounded-none md:rounded-3xl overflow-hidden">
                    {notFound ? (
                      <div className="text-center p-6 space-y-3">
                        <p className="text-[var(--color-text-primary)] font-semibold text-fluid-base">
                          Video not found or unavailable
                        </p>
                        <p className="text-fluid-xs text-[var(--color-text-secondary)] max-w-sm">
                          This video could not be loaded. It may have been removed or is temporarily unavailable.
                        </p>
                        <div className="flex items-center justify-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={handleBack}
                            className="inline-flex items-center gap-1.5 min-h-[40px] px-4 py-2 rounded-xl bg-[var(--color-bg-elevated)] text-xs font-semibold text-[var(--color-text-primary)] border border-[var(--color-border)] hover:bg-[var(--color-bg-secondary)] transition-colors"
                          >
                            <ArrowLeft size={14} />
                            <span>Go Back</span>
                          </button>
                          <Link
                            href="/"
                            className="inline-flex items-center gap-1.5 min-h-[40px] px-4 py-2 rounded-xl bg-[#b43d2d] text-xs font-semibold text-white hover:bg-[#9b3024] transition-colors"
                          >
                            <span>Browse Home</span>
                          </Link>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-col items-center justify-center gap-2">
                        <Loader2 className="h-10 w-10 text-brand-primary animate-spin" />
                        <span className="text-fluid-xs text-[var(--color-text-secondary)]">Loading player…</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {/* Title, Metadata & Channel Identity */}
            {video ? (
              <div className="space-y-3 pt-0.5">
                <h1 className="font-display font-bold text-[18px] sm:text-xl md:text-2xl text-[var(--color-text-primary)] text-gujarati leading-[1.42]">
                  {video.title}
                </h1>

                {/* Compact stats + Child Safe badge */}
                <div className="flex flex-wrap items-center gap-2 text-xs text-[var(--color-text-secondary)]">
                  {video.view_count !== undefined && (
                    <span className="font-medium">{formatViewCount(video.view_count)}</span>
                  )}
                  {video.published_at && (
                    <>
                      <span aria-hidden="true">·</span>
                      <span>{formatRelativeTime(video.published_at)}</span>
                    </>
                  )}
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    Child Safe
                  </span>
                </div>

                {/* Channel Identity Card — handles long channel names cleanly without squeezing actions */}
                <div className="flex items-center justify-between gap-3 p-3.5 sm:p-4 rounded-2xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] shadow-xs">
                  <Link
                    href={channel?.id ? `/channels/${channel.id}` : '#'}
                    className="flex items-center gap-3 min-w-0 flex-1 group focus:outline-none"
                  >
                    <div className="relative h-11 w-11 sm:h-12 sm:w-12 rounded-full overflow-hidden bg-[var(--color-bg-secondary)] border border-[var(--color-border)] shrink-0">
                      {channel?.thumbnail_url && !avatarError ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={channel.thumbnail_url}
                          alt={channelDisplayName}
                          className="h-full w-full object-cover"
                          onError={() => setAvatarError(true)}
                        />
                      ) : (
                        <div className="h-full w-full flex items-center justify-center font-bold text-base text-[#903d30] dark:text-[#f2b59a] bg-red-500/10">
                          {channelDisplayName.charAt(0).toUpperCase()}
                        </div>
                      )}
                    </div>

                    <div className="min-w-0 flex-1">
                      <h3 className="font-semibold text-sm sm:text-base text-[var(--color-text-primary)] group-hover:text-[#903d30] dark:group-hover:text-[#f2b59a] transition-colors line-clamp-2 leading-snug">
                        {channelDisplayName}
                      </h3>
                      <p className="text-[11.5px] text-[var(--color-text-secondary)] truncate">
                        {channel?.subscriber_count
                          ? `${formatCompactNumber(channel.subscriber_count)} subscribers`
                          : 'Parent approved channel'}
                      </p>
                    </div>
                  </Link>

                  <div className="flex items-center gap-2 shrink-0">
                    {channel?.id && (
                      <Link
                        href={`/channels/${channel.id}`}
                        className="inline-flex items-center gap-1 min-h-[38px] px-3 py-1.5 rounded-xl text-xs font-semibold bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-[var(--color-text-primary)] hover:border-[#903d30]/40 transition-colors"
                      >
                        <span>Channel</span>
                        <ChevronRight size={14} />
                      </Link>
                    )}
                  </div>
                </div>
              </div>
            ) : !loading && !notFound ? (
              <div className="space-y-4 pt-1">
                <h1 className="font-display font-bold text-fluid-lg text-[var(--color-text-primary)] leading-snug">
                  Curated Video Playback
                </h1>
                <div className="flex items-center justify-between p-4 rounded-2xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)]">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-red-500/10 flex items-center justify-center font-bold text-[#903d30] dark:text-[#f2b59a]">
                      <Tv2 size={20} />
                    </div>
                    <div>
                      <h3 className="font-semibold text-fluid-base text-[var(--color-text-primary)]">Approved Content</h3>
                      <p className="text-[11.5px] text-[var(--color-text-secondary)]">Redirect-proof child player</p>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    Child Safe
                  </span>
                </div>
              </div>
            ) : loading ? (
              <div className="space-y-3 pt-2">
                <div className="h-6 w-3/4 rounded-lg bg-[var(--color-bg-secondary)] animate-pulse" />
                <div className="h-4 w-1/3 rounded-lg bg-[var(--color-bg-secondary)] animate-pulse" />
                <div className="h-16 rounded-2xl bg-[var(--color-bg-secondary)] animate-pulse" />
              </div>
            ) : null}

            {/* ── Mobile / Tablet (< xl): Tabbed "More from channel" | "Up Next" ── */}
            <div className="xl:hidden pt-2 space-y-3">
              <div
                role="tablist"
                aria-label="Video recommendations"
                className="grid grid-cols-2 gap-1 p-1 rounded-2xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]"
              >
                <button
                  type="button"
                  role="tab"
                  aria-selected={mobileTab === 'more'}
                  onClick={() => setMobileTab('more')}
                  className={cn(
                    'min-h-[42px] px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all',
                    mobileTab === 'more'
                      ? 'bg-[#74382f] text-[#fff7ef] dark:bg-[#f1c1a6] dark:text-[#342129] shadow-xs'
                      : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                  )}
                >
                  <Tv2 size={14} />
                  <span className="truncate">More from channel</span>
                  {filteredMoreFromChannel.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded-md bg-black/10 dark:bg-white/10 text-[10px] tabular-nums">
                      {filteredMoreFromChannel.length}
                    </span>
                  )}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={mobileTab === 'upnext'}
                  onClick={() => setMobileTab('upnext')}
                  className={cn(
                    'min-h-[42px] px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all',
                    mobileTab === 'upnext'
                      ? 'bg-[#74382f] text-[#fff7ef] dark:bg-[#f1c1a6] dark:text-[#342129] shadow-xs'
                      : 'text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)]'
                  )}
                >
                  <Sparkles size={14} />
                  <span>Up Next</span>
                  {filteredUpNext.length > 0 && (
                    <span className="px-1.5 py-0.5 rounded-md bg-black/10 dark:bg-white/10 text-[10px] tabular-nums">
                      {filteredUpNext.length}
                    </span>
                  )}
                </button>
              </div>

              {loading ? (
                <div className="space-y-3">
                  <VideoCardSkeleton count={5} layout="row" />
                </div>
              ) : mobileTab === 'more' ? (
                filteredMoreFromChannel.length > 0 ? (
                  <div className="space-y-3">
                    {filteredMoreFromChannel.slice(0, 8).map((v) => (
                      <VideoCard key={v.id} video={v} layout="row" />
                    ))}
                    {channel?.id && (
                      <Link
                        href={`/channels/${channel.id}`}
                        className="flex items-center justify-center gap-1.5 min-h-[44px] w-full rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-xs font-semibold text-[var(--color-text-primary)] hover:border-[#903d30]/40 transition-colors"
                      >
                        <span>View all from {channelDisplayName}</span>
                        <ChevronRight size={14} />
                      </Link>
                    )}
                  </div>
                ) : (
                  <div className="p-6 rounded-2xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-center space-y-2">
                    <p className="text-xs font-medium text-[var(--color-text-secondary)]">
                      No other videos from {channelDisplayName} right now.
                    </p>
                    {filteredUpNext.length > 0 && (
                      <button
                        type="button"
                        onClick={() => setMobileTab('upnext')}
                        className="text-xs font-semibold text-[#903d30] dark:text-[#f2b59a] hover:underline"
                      >
                        Switch to Up Next
                      </button>
                    )}
                  </div>
                )
              ) : filteredUpNext.length > 0 ? (
                <div className="space-y-3">
                  {filteredUpNext.map((v) => (
                    <VideoCard key={v.id} video={v} layout="row" />
                  ))}
                </div>
              ) : (
                <div className="p-6 rounded-2xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-center space-y-2">
                  <p className="text-xs font-medium text-[var(--color-text-secondary)]">
                    No other recommended videos available right now.
                  </p>
                </div>
              )}
            </div>

            {/* ── Desktop (xl+): "More from this Channel" grid below player ── */}
            {filteredMoreFromChannel.length > 0 && (
              <div className="hidden xl:block space-y-3 pt-6 border-t border-[var(--color-border)]">
                <div className="flex items-center justify-between gap-4">
                  <h2 className="font-semibold text-fluid-lg text-[var(--color-text-primary)] flex items-center gap-2 min-w-0">
                    <Tv2 size={18} className="text-[#903d30] dark:text-[#f2b59a] shrink-0" />
                    <span className="truncate">More from {channelDisplayName}</span>
                  </h2>
                  {channel?.id && (
                    <Link
                      href={`/channels/${channel.id}`}
                      className="shrink-0 text-xs font-semibold text-[#903d30] dark:text-[#f2b59a] hover:underline"
                    >
                      View all
                    </Link>
                  )}
                </div>

                <div className="grid grid-cols-3 gap-4">
                  {filteredMoreFromChannel.slice(0, 6).map((v) => (
                    <VideoCard key={v.id} video={v} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* ── Desktop Right Side (xl+): Up Next Sticky Sidebar ── */}
          <div className="hidden xl:block w-[380px] 2xl:w-[410px] shrink-0 min-w-0">
            <aside
              aria-label="Recommended videos"
              className="sticky top-2 space-y-3 max-h-[calc(100dvh-56px-24px)] overflow-y-auto pr-1.5 scrollbar-hide"
            >
              <div className="flex items-center justify-between pb-2 border-b border-[var(--color-border)]">
                <h2 className="font-semibold text-[14px] text-[var(--color-text-primary)] flex items-center gap-1.5">
                  <Sparkles size={16} className="text-amber-500" /> Up Next
                </h2>
                <span className="text-[11px] font-medium text-[var(--color-text-secondary)]">
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
                <div className="p-6 rounded-2xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-center space-y-2">
                  <p className="text-xs font-medium text-[var(--color-text-secondary)]">
                    No other recommended videos right now.
                  </p>
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
            <div className="w-full aspect-video bg-[var(--color-bg-secondary)] animate-pulse rounded-3xl" />
          </div>
        </PageShell>
      }
    >
      <VideoPlaybackContent videoId={videoId} />
    </Suspense>
  );
}
