// src/app/shorts/page.tsx
'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { PageShell } from '@/components/layout/PageShell';
import { EmptyState } from '@/components/shared/EmptyState';
import { ShortsPlayer } from '@/components/video/ShortsPlayer';
import { ShortsActionRail } from '@/components/video/ShortsActionRail';
import { ShortsCommentsModal } from '@/components/video/ShortsCommentsModal';
import { Zap, ChevronUp, ChevronDown, Plus, Loader2 } from 'lucide-react';
import { useAuthStore } from '@/store/authStore';
import { useShortsStore } from '@/store/shortsStore';
import { Video } from '@/types/content';
import { cn } from '@/lib/cn';
import { formatViewCount } from '@/lib/formatters';

export default function ShortsPage() {
  const { role, initialized } = useAuthStore();
  const { watchedIds } = useShortsStore();
  const [shorts, setShorts] = useState<Video[]>([]);
  const [activeIndex, setActiveIndex] = useState(0);
  const [loading, setLoading] = useState(true);
  const [seed] = useState<number>(() => Math.floor(Math.random() * 1000000));

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

  // Load shorts feed with watched exclusion for continuous non-repeating recommendations
  useEffect(() => {
    let isMounted = true;
    async function loadShorts() {
      try {
        setLoading(true);
        const excludeParam = watchedIds.length > 0 ? `&excludeIds=${encodeURIComponent(watchedIds.slice(-100).join(','))}` : '';
        const res = await fetch(`/api/feed/shorts?seed=${seed}&pageSize=35${excludeParam}`);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [initialized, seed]); // Intentionally preserve feed during watchedId updates

  // Track which short is in view using IntersectionObserver
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || shorts.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const index = Number(entry.target.getAttribute('data-index'));
            if (!isNaN(index)) {
              setActiveIndex(index);
            }
          }
        });
      },
      {
        root: container,
        threshold: 0.65,
      }
    );

    itemRefs.current.forEach((el) => {
      if (el) observer.observe(el);
    });

    return () => {
      observer.disconnect();
    };
  }, [shorts]);

  const scrollToIndex = useCallback((index: number) => {
    if (index < 0 || index >= shorts.length) return;
    const targetEl = itemRefs.current[index];
    if (targetEl) {
      targetEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [shorts.length]);

  const handleNext = useCallback(() => {
    if (activeIndex < shorts.length - 1) {
      scrollToIndex(activeIndex + 1);
    }
  }, [activeIndex, shorts.length, scrollToIndex]);

  const handlePrev = useCallback(() => {
    if (activeIndex > 0) {
      scrollToIndex(activeIndex - 1);
    }
  }, [activeIndex, scrollToIndex]);

  // Desktop keyboard navigation
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
  }, [handleNext, handlePrev]);

  return (
    <PageShell className="p-0 sm:p-0 md:px-6 md:pt-4 pb-0 md:pb-6 overflow-hidden">
      {/* Outer Viewport Wrapper — Eliminates all negative margin shifts */}
      <div className="relative w-full flex items-center justify-center mx-auto overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center w-full h-[calc(100dvh-48px-56px-env(safe-area-inset-bottom))] md:h-[calc(100dvh-5.5rem)] space-y-3 bg-black text-white">
            <Loader2 className="h-10 w-10 text-brand-primary animate-spin" />
            <p className="text-fluid-sm text-neutral-400">Loading shorts…</p>
          </div>
        ) : shorts.length === 0 ? (
          <div className="flex items-center justify-center w-full h-[calc(100dvh-48px-56px-env(safe-area-inset-bottom))] md:h-[calc(100dvh-5.5rem)] px-4">
            <div className="max-w-md w-full text-center space-y-4">
              <EmptyState
                icon={Zap}
                title={role === 'parent' ? 'No Shorts in Your Library' : 'No Shorts Available'}
                description={
                  role === 'parent'
                    ? 'Shorts are videos under 2 minutes. Once your added channels upload short videos, they will automatically appear here!'
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
          </div>
        ) : (
          /* Main Shorts Mobile Frame: Exact Viewport calculation without bottom nav collision */
          <div className="relative w-full max-w-full md:max-w-[420px] h-[calc(100dvh-48px-56px-env(safe-area-inset-bottom))] md:h-[calc(100dvh-5.5rem)] flex items-center justify-center md:rounded-3xl md:overflow-hidden md:shadow-2xl md:border md:border-neutral-800 bg-black">
            {/* Vertical Snap-Scroll Feed Container */}
            <div
              ref={scrollContainerRef}
              className="relative w-full h-full overflow-y-auto snap-y snap-mandatory bg-black select-none scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none]"
            >
              {shorts.map((short, index) => {
                // Preload window: keep previous 1, active, and PRELOAD NEXT 2 VIDEOS for zero latency
                const isWithinRenderWindow = index >= activeIndex - 1 && index <= activeIndex + 2;
                const isCurrentActive = index === activeIndex;

                return (
                  <div
                    key={short.id || short.youtube_video_id}
                    data-index={index}
                    ref={(el) => {
                      itemRefs.current[index] = el;
                    }}
                    className="relative w-full h-full snap-start snap-always shrink-0 bg-black flex flex-col justify-between overflow-hidden"
                  >
                    {/* Video Player or Preloaded High-Res Thumbnail */}
                    <div className="absolute inset-0 flex items-center justify-center bg-black overflow-hidden">
                      {isWithinRenderWindow ? (
                        <ShortsPlayer
                          videoId={short.youtube_video_id}
                          thumbnailUrl={short.thumbnail_url}
                          title={short.title}
                          isActive={isCurrentActive}
                          onEnded={handleNext}
                        />
                      ) : (
                        /* Offscreen placeholder */
                        short.thumbnail_url && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={short.thumbnail_url}
                            alt={short.title}
                            className="w-full h-full object-cover filter blur-md opacity-40"
                          />
                        )
                      )}
                    </div>

                    {/* Right Action Rail (Like, Comment, Share, Sound) */}
                    <ShortsActionRail
                      videoId={short.youtube_video_id || short.id}
                      title={short.title}
                      channelName={short.channelName}
                      channelAvatarUrl={short.channelAvatarUrl}
                      likeCount={short.view_count ? Math.round(short.view_count * 0.08) : 840}
                      className="absolute right-3 bottom-20 md:bottom-16"
                    />

                    {/* Bottom Metadata Overlay — Padded cleanly above the bottom navigation bar */}
                    <div className="absolute inset-x-0 bottom-0 z-20 p-4 pb-6 pr-20 bg-gradient-to-t from-black/95 via-black/60 to-transparent pointer-events-none text-white space-y-2">
                      {/* Channel Info */}
                      <div className="flex items-center gap-2.5">
                        <div className="h-9 w-9 rounded-full overflow-hidden bg-white/20 border border-white/30 shrink-0">
                          {short.channelAvatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={short.channelAvatarUrl}
                              alt={short.channelName || ''}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <div className="h-full w-full flex items-center justify-center font-bold text-xs text-white">
                              {short.channelName?.charAt(0) || 'C'}
                            </div>
                          )}
                        </div>
                        <span className="font-semibold text-fluid-sm drop-shadow-md truncate text-white">
                          {short.channelName}
                        </span>
                      </div>

                      {/* Video Title */}
                      <p className="font-medium text-fluid-sm text-white/95 line-clamp-2 drop-shadow-md leading-snug">
                        {short.title}
                      </p>

                      {/* Counter & Views */}
                      <div className="flex items-center gap-2 text-[11px] text-white/80 font-mono">
                        <span className="bg-white/15 px-2 py-0.5 rounded-full backdrop-blur-sm text-white">
                          Short {index + 1} of {shorts.length}
                        </span>
                        {short.view_count !== undefined && (
                          <>
                            <span>·</span>
                            <span>{formatViewCount(short.view_count)} views</span>
                          </>
                        )}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Desktop Navigation Floating Controls */}
            <div className="hidden md:flex flex-col gap-3 absolute -right-16 top-1/2 -translate-y-1/2 z-30">
              <button
                type="button"
                onClick={handlePrev}
                disabled={activeIndex === 0}
                className={cn(
                  'h-12 w-12 rounded-full bg-surface-secondary border border-border flex items-center justify-center',
                  'text-content-primary shadow-lg hover:bg-surface-elevated active:scale-95 transition-all',
                  'disabled:opacity-40 disabled:cursor-not-allowed'
                )}
                title="Previous short (Arrow Up)"
                aria-label="Previous short"
              >
                <ChevronUp size={22} />
              </button>
              <button
                type="button"
                onClick={handleNext}
                disabled={activeIndex === shorts.length - 1}
                className={cn(
                  'h-12 w-12 rounded-full bg-surface-secondary border border-border flex items-center justify-center',
                  'text-content-primary shadow-lg hover:bg-surface-elevated active:scale-95 transition-all',
                  'disabled:opacity-40 disabled:cursor-not-allowed'
                )}
                title="Next short (Arrow Down)"
                aria-label="Next short"
              >
                <ChevronDown size={22} />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Global Kid-friendly Comments Sheet */}
      <ShortsCommentsModal />
    </PageShell>
  );
}
