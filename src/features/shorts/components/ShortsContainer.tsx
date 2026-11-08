// src/features/shorts/components/ShortsContainer.tsx
'use client';

import React, { useRef, useEffect, useCallback, useState } from 'react';
import { ChevronUp, ChevronDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/cn';
import { useAuthStore } from '@/store/authStore';
import { useUIStore } from '@/store/uiStore';
import { useShortsFeatureStore } from '../store/shortsStore';
import { useShortsFeedQuery } from '../hooks/useShortsFeedQuery';
import { useShortsPlayerPool } from '../hooks/useShortsPlayerPool';
import { useShortsV2PlayerPool } from '../hooks/useShortsV2PlayerPool';
import { ShortsItem } from './ShortsItem';
import { ShortsEmptyState } from './ShortsEmptyState';
import { ShortsDebugOverlay } from './ShortsDebugOverlay';
import { ShortVideo } from '../types';

export function ShortsContainer() {
  const { initialized } = useAuthStore();
  const { sidebarOpen } = useUIStore();
  const { activeIndex, setActiveIndex, markVideoUnplayable } = useShortsFeatureStore();

  const isV2FeatureFlag = process.env.NEXT_PUBLIC_SHORTS_V2 === 'true';
  const [isDebugMode, setIsDebugMode] = useState(false);
  const [v2FallbackMap, setV2FallbackMap] = useState<Record<number, boolean>>({});

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search);
      setIsDebugMode(searchParams.get('debug') === '1');
    }
  }, []);

  const {
    videos,
    loading,
    loadingMore,
    loadMore,
    replayShorts,
  } = useShortsFeedQuery(initialized);

  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const itemRefs = useRef<(HTMLDivElement | null)[]>([]);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const isWheelingRef = useRef(false);

  const scrollToIndex = useCallback(
    (index: number) => {
      const container = scrollContainerRef.current;
      if (!container || index < 0 || index >= videos.length) return;
      const targetTop = index * container.clientHeight;
      container.scrollTo({ top: targetTop, behavior: 'smooth' });
    },
    [videos.length]
  );

  const handleNext = useCallback(() => {
    if (activeIndex < videos.length - 1) {
      scrollToIndex(activeIndex + 1);
    }
  }, [activeIndex, videos.length, scrollToIndex]);

  const handlePrev = useCallback(() => {
    if (activeIndex > 0) {
      scrollToIndex(activeIndex - 1);
    }
  }, [activeIndex, scrollToIndex]);

  // Helper to check if a video item qualifies for V2
  const isVideoV2 = useCallback(
    (video: ShortVideo | undefined, index: number) => {
      if (!isV2FeatureFlag) return false;
      if (v2FallbackMap[index]) return false;
      return !!video?.storage_url && video?.media_status === 'ready';
    },
    [isV2FeatureFlag, v2FallbackMap]
  );

  const handleSkipError = useCallback(
    (index: number) => {
      const vid = videos[index];
      // If error occurs on V2 and YouTube ID is available, fall back to V1 seamlessly!
      if (isVideoV2(vid, index) && vid?.youtube_video_id) {
        console.warn(`[ShortsContainer] V2 playback failed on index ${index}. Switching to V1 YouTube fallback.`);
        setV2FallbackMap((prev) => ({ ...prev, [index]: true }));
        return;
      }

      // Mark unplayable in session store immediately so it never repeats
      if (vid?.id) markVideoUnplayable(vid.id);
      if (vid?.youtube_video_id) markVideoUnplayable(vid.youtube_video_id);

      // If active video fails completely, auto-advance silently to next short within < 500ms
      if (index === activeIndex && activeIndex < videos.length - 1) {
        scrollToIndex(activeIndex + 1);
      }
    },
    [videos, activeIndex, isVideoV2, markVideoUnplayable, scrollToIndex]
  );

  // V1 YouTube IFrame Pool (Fallback)
  const {
    attachPlayer: attachV1Player,
    pauseAllV1Players,
    playingIndices: v1PlayingIndices,
    errorMap: v1ErrorMap,
    progressMap: v1ProgressMap,
    handleUserGesturePlayback: handleV1Gesture,
    retryV1Player,
    getDiagnosticLogs,
  } = useShortsPlayerPool(videos, handleSkipError);

  // V2 Native Video Pool (Instant, Zero-Spinner)
  const {
    attachV2Container,
    pauseAllV2Videos,
    readyMap: v2ReadyMap,
    playingMap: v2PlayingMap,
    firstFrameMap: v2FirstFrameMap,
    errorMap: v2ErrorMap,
    progressMap: v2ProgressMap,
    handleUserGesturePlayback: handleV2Gesture,
    retryVideo: retryV2Video,
    debugInfo: v2DebugInfo,
  } = useShortsV2PlayerPool(videos, handleSkipError);

  // Determine active item engine
  const currentVideo = videos[activeIndex];
  const isCurrentActiveV2 = isVideoV2(currentVideo, activeIndex);

  // Mutual exclusion: ensure V1 and V2 never play simultaneously
  useEffect(() => {
    if (isCurrentActiveV2) {
      pauseAllV1Players();
    } else {
      pauseAllV2Videos();
    }
  }, [activeIndex, isCurrentActiveV2, pauseAllV1Players, pauseAllV2Videos]);

  // 1. Primary IntersectionObserver to detect currently visible Short
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container || videos.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const raw = entry.target.getAttribute('data-index');
            if (raw !== null) {
              const index = parseInt(raw, 10);
              if (!isNaN(index) && index >= 0) {
                setActiveIndex(index);
              }
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
  }, [videos, setActiveIndex]);

  // 2. Programmatic Snap Center Alignment Fallback (Observer is authoritative for activeIndex)
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    let snapTimeout: NodeJS.Timeout | null = null;

    const handleScrollSnapCheck = () => {
      const h = container.clientHeight;
      if (h <= 0) return;

      const currentTop = container.scrollTop;
      const targetIndex = Math.round(currentTop / h);

      if (snapTimeout) clearTimeout(snapTimeout);
      snapTimeout = setTimeout(() => {
        const targetTop = targetIndex * h;
        if (Math.abs(container.scrollTop - targetTop) > 2) {
          container.scrollTo({ top: targetTop, behavior: 'smooth' });
        }
      }, 150);
    };

    container.addEventListener('scroll', handleScrollSnapCheck, { passive: true });
    return () => {
      container.removeEventListener('scroll', handleScrollSnapCheck);
      if (snapTimeout) clearTimeout(snapTimeout);
    };
  }, []);

  // 3. Infinite Feed Sentinel: triggers loadMore before user reaches bottom
  useEffect(() => {
    const sentinel = sentinelRef.current;
    const container = scrollContainerRef.current;
    if (!sentinel || !container) return;

    const sentinelObserver = new IntersectionObserver(
      (entries) => {
        if (entries[0]?.isIntersecting) {
          loadMore();
        }
      },
      {
        root: container,
        rootMargin: '600px',
      }
    );

    sentinelObserver.observe(sentinel);
    return () => sentinelObserver.disconnect();
  }, [loadMore]);

  // 4. Desktop keyboard navigation (Arrow Up / Arrow Down)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowDown' || e.key === 'PageDown') {
        e.preventDefault();
        handleNext();
      } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
        e.preventDefault();
        handlePrev();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleNext, handlePrev]);

  // 5. Desktop mouse wheel debounced navigation
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const handleWheel = (e: WheelEvent) => {
      if (Math.abs(e.deltaY) < 30) return;
      if (isWheelingRef.current) {
        e.preventDefault();
        return;
      }

      isWheelingRef.current = true;
      e.preventDefault();

      if (e.deltaY > 0) {
        handleNext();
      } else {
        handlePrev();
      }

      setTimeout(() => {
        isWheelingRef.current = false;
      }, 450);
    };

    container.addEventListener('wheel', handleWheel, { passive: false });
    return () => container.removeEventListener('wheel', handleWheel);
  }, [handleNext, handlePrev]);

  return (
    <main
      id="main-content"
      tabIndex={-1}
      role="feed"
      aria-label="Shorts video feed"
      className={cn(
        'relative w-full overflow-hidden select-none',
        'md:ml-[72px]',
        sidebarOpen && 'xl:ml-60',
        'transition-all duration-300',
        // Mobile height fills between mobile top safe area and bottom nav (58px + safe area)
        'h-[calc(100dvh-58px-env(safe-area-inset-bottom,0px))] md:h-[calc(100dvh-56px)]'
      )}
    >
      {/* Real-Time Performance & Pool Debug Overlay (when ?debug=1) */}
      {isDebugMode && (
        <ShortsDebugOverlay
          debugInfo={v2DebugInfo}
          isV2Enabled={isV2FeatureFlag}
          activeEngine={isCurrentActiveV2 ? 'V2 (Native R2/CDN)' : 'V1 (YouTube IFrame)'}
          currentMediaStatus={currentVideo?.media_status || 'none'}
          currentStorageUrl={currentVideo?.storage_url || null}
          currentVideoId={currentVideo?.id || currentVideo?.youtube_video_id || ''}
          totalLoaded={videos.length}
          v1DiagnosticLogs={getDiagnosticLogs()}
          v1ErrorMap={v1ErrorMap}
          v2ErrorMap={v2ErrorMap}
        />
      )}

      <div className="relative w-full h-full flex items-center justify-center mx-auto overflow-hidden">
        {loading ? (
          <div className="flex flex-col items-center justify-center w-full h-full space-y-3 bg-black text-white">
            <Loader2 className="h-10 w-10 text-brand-primary animate-spin" />
            <p className="text-sm font-medium text-neutral-400">Loading shorts…</p>
          </div>
        ) : videos.length === 0 ? (
          <div className="flex items-center justify-center w-full h-full px-4 bg-black">
            <ShortsEmptyState onReplay={replayShorts} />
          </div>
        ) : (
          /* Main 9:16 Centered Shorts Container */
          <div className="relative w-full max-w-full md:max-w-[420px] h-full flex items-center justify-center md:rounded-3xl md:overflow-hidden md:shadow-2xl md:border md:border-neutral-800 bg-black">
            {/* Vertical Scroll-Snap Track */}
            <div
              ref={scrollContainerRef}
              id="shorts-track"
              tabIndex={0}
              aria-label="Scrollable shorts track"
              className="shorts-container-track relative w-full h-full overflow-y-auto bg-black select-none scrollbar-none [scrollbar-width:none] [-ms-overflow-style:none]"
              style={{
                scrollSnapType: 'y mandatory',
                overscrollBehaviorY: 'contain',
                touchAction: 'pan-y',
              }}
            >
              {videos.map((video, index) => {
                const isCurrentActive = index === activeIndex;
                // Mount sliding window [activeIndex - 1, activeIndex, activeIndex + 1, activeIndex + 2] for smooth preloading
                const isNearActive = index >= activeIndex - 1 && index <= activeIndex + 2;

                const isItemV2 = isVideoV2(video, index);

                const isPlaying = isItemV2
                  ? !!v2PlayingMap[index]
                  : !!v1PlayingIndices[index];

                const progressPct = isItemV2
                  ? v2ProgressMap[index] ?? 0
                  : v1ProgressMap[index] ?? 0;

                const gestureHandler = isItemV2
                  ? handleV2Gesture
                  : handleV1Gesture;

                const errorMessage = isItemV2
                  ? v2ErrorMap[index] ?? null
                  : v1ErrorMap[index] ?? null;

                const retryHandler = () => {
                  if (isItemV2) {
                    retryV2Video(index);
                  } else {
                    retryV1Player(index);
                  }
                };

                return (
                  <div
                    key={`${video.id || video.youtube_video_id}-${index}`}
                    data-index={index}
                    ref={(el) => {
                      itemRefs.current[index] = el;
                    }}
                    className="shorts-snap-card relative w-full shrink-0 bg-black"
                    style={{
                      height: '100%',
                      scrollSnapAlign: 'start',
                      scrollSnapStop: 'always',
                    }}
                  >
                    <ShortsItem
                      video={video}
                      index={index}
                      isActive={isCurrentActive}
                      isPlaying={isPlaying}
                      isMounted={isNearActive}
                      progressPercent={progressPct}
                      isV2={isItemV2}
                      isV2Ready={!!v2ReadyMap[index]}
                      isV2Playing={!!v2PlayingMap[index]}
                      isV2FirstFrame={!!v2FirstFrameMap[index]}
                      errorMessage={errorMessage}
                      onAttachContainer={attachV1Player}
                      onAttachV2Container={attachV2Container}
                      onGestureTap={gestureHandler}
                      onRetry={retryHandler}
                    />
                  </div>
                );
              })}

              {/* Infinite Prefetch Sentinel */}
              <div
                ref={sentinelRef}
                className="w-full h-8 shrink-0 flex items-center justify-center bg-black"
              >
                {loadingMore && (
                  <Loader2 className="w-5 h-5 text-neutral-500 animate-spin" />
                )}
              </div>
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
                  'disabled:opacity-30 disabled:cursor-not-allowed'
                )}
                title="Previous short (Arrow Up)"
                aria-label="Previous short"
              >
                <ChevronUp size={22} />
              </button>
              <button
                type="button"
                onClick={handleNext}
                disabled={activeIndex === videos.length - 1}
                className={cn(
                  'h-12 w-12 rounded-full bg-surface-secondary border border-border flex items-center justify-center',
                  'text-content-primary shadow-lg hover:bg-surface-elevated active:scale-95 transition-all',
                  'disabled:opacity-30 disabled:cursor-not-allowed'
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
    </main>
  );
}
