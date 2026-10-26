'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { PageShell } from '@/components/layout/PageShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { YouTubePlayer } from '@/components/video/YouTubePlayer';
import { Zap, ChevronUp, ChevronDown, Plus, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { Video } from '@/types/content';
import { cn } from '@/lib/cn';

export default function ShortsPage() {
  const { role, initialized } = useAuthStore();
  const [shorts, setShorts] = useState<Video[]>([]);
  const [currentIndex, setCurrentIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [seed] = useState<number>(() => Math.floor(Math.random() * 1000000));
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let isMounted = true;
    async function loadShorts() {
      try {
        setLoading(true);
        const res = await fetch(`/api/feed/shorts?seed=${seed}&pageSize=30`);
        const data = await res.json();
        if (isMounted && data.videos) {
          setShorts(data.videos);
        }
      } catch (err) {
        console.error('Failed to load shorts feed:', err);
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (initialized) {
      loadShorts();
    }
    return () => {
      isMounted = false;
    };
  }, [initialized, seed]);

  const handleNext = () => {
    if (currentIndex < shorts.length - 1) {
      setCurrentIndex((prev) => prev + 1);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex((prev) => prev - 1);
    }
  };

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        handlePrev();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [currentIndex, shorts.length]);

  const currentShort = shorts[currentIndex];

  return (
    <PageShell>
      <div className="flex flex-col items-center justify-center min-h-[calc(100dvh-8rem)] pb-12">
        {loading ? (
          <div className="flex flex-col items-center justify-center p-12 text-center space-y-3">
            <Loader2 className="h-10 w-10 text-brand-primary animate-spin" />
            <p className="text-fluid-sm text-content-secondary">Loading short videos…</p>
          </div>
        ) : shorts.length === 0 ? (
          <div className="max-w-md w-full text-center space-y-4">
            <EmptyState
              icon={Zap}
              title={role === 'parent' ? 'No Shorts in Your Library' : 'No Shorts Available'}
              description={
                role === 'parent'
                  ? 'Shorts are videos 60 seconds or shorter. Once your added channels upload short videos, they will automatically appear here!'
                  : 'Check back soon for fun short-form videos from approved channels!'
              }
            />
            {role === 'parent' && (
              <div className="pt-2">
                <Link
                  href="/settings/manage-channels"
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-2xl text-fluid-sm font-semibold bg-brand-primary text-white shadow-lg shadow-brand-primary/20 hover:bg-brand-primary/90 active:scale-95 transition-all"
                >
                  <Plus size={16} />
                  <span>Manage Channels</span>
                </Link>
              </div>
            )}
          </div>
        ) : (
          <div className="relative w-full max-w-sm sm:max-w-md h-[78dvh] max-h-[750px] flex items-center justify-center">
            {/* The Short Video Player Container */}
            <div
              ref={containerRef}
              className="relative w-full h-full rounded-3xl overflow-hidden bg-black shadow-2xl border border-border/40 flex flex-col justify-between"
            >
              {/* Player wrapper */}
              <div className="absolute inset-0 flex items-center justify-center bg-black">
                {currentShort && (
                  <YouTubePlayer
                    key={currentShort.id || currentShort.youtube_video_id}
                    videoId={currentShort.youtube_video_id}
                    title={currentShort.title}
                    autoplay={true}
                    onEnded={handleNext}
                  />
                )}
              </div>

              {/* Bottom Details Overlay */}
              <div className="absolute inset-x-0 bottom-0 z-25 p-4 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none text-white space-y-2">
                <div className="flex items-center gap-2.5">
                  <div className="h-9 w-9 rounded-full overflow-hidden bg-white/20 border border-white/30 shrink-0">
                    {currentShort?.channelAvatarUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={currentShort.channelAvatarUrl}
                        alt={currentShort.channelName || ''}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <div className="h-full w-full flex items-center justify-center font-bold text-xs text-white">
                        {currentShort?.channelName?.charAt(0) || 'C'}
                      </div>
                    )}
                  </div>
                  <span className="font-semibold text-fluid-sm drop-shadow-md truncate">
                    {currentShort?.channelName}
                  </span>
                </div>

                <p className="font-medium text-fluid-sm text-white/95 line-clamp-2 drop-shadow-md">
                  {currentShort?.title}
                </p>

                <div className="flex items-center gap-2 text-[11px] text-white/80 font-mono">
                  <span>Short {currentIndex + 1} of {shorts.length}</span>
                  {currentShort?.view_count !== undefined && (
                    <>
                      <span>·</span>
                      <span>{currentShort.view_count.toLocaleString()} views</span>
                    </>
                  )}
                </div>
              </div>
            </div>

            {/* Desktop Navigation Floating Controls */}
            <div className="hidden sm:flex flex-col gap-3 absolute -right-16 top-1/2 -translate-y-1/2 z-30">
              <button
                type="button"
                onClick={handlePrev}
                disabled={currentIndex === 0}
                className={cn(
                  'h-12 w-12 rounded-full bg-surface-secondary border border-border flex items-center justify-center',
                  'text-content-primary shadow-lg hover:bg-surface-elevated active:scale-95 transition-all',
                  'disabled:opacity-40 disabled:cursor-not-allowed'
                )}
                title="Previous short (Arrow Up)"
              >
                <ChevronUp size={22} />
              </button>
              <button
                type="button"
                onClick={handleNext}
                disabled={currentIndex === shorts.length - 1}
                className={cn(
                  'h-12 w-12 rounded-full bg-surface-secondary border border-border flex items-center justify-center',
                  'text-content-primary shadow-lg hover:bg-surface-elevated active:scale-95 transition-all',
                  'disabled:opacity-40 disabled:cursor-not-allowed'
                )}
                title="Next short (Arrow Down)"
              >
                <ChevronDown size={22} />
              </button>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  );
}
